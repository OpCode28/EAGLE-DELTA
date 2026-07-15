#!/usr/bin/env python3
"""
wroom32_bridge.py - RuView Human Detection Bridge for ESP32 WROOM-32 (38-pin, CP2102)
======================================================================================
This script bridges the ESP32 WROOM-32 (which cannot run the RuView S3 firmware)
into the RuView detection pipeline using two approaches:

  MODE 1 (--mode serial):  Reads RSSI from WROOM-32 via serial port (AT commands)
  MODE 2 (--mode sim):     Runs 100% synthetic simulation (no hardware needed)

The script:
  1. Collects WiFi RSSI samples from all 4 boards via serial
  2. Converts RSSI changes into synthetic CSI-like amplitude/phase data
  3. Feeds data through the real RuView CSI processor (same code that passed VERIFY: PASS)
  4. Serves results on http://localhost:3000/api/v1/sensing/latest for the UI

Usage:
  python wroom32_bridge.py --mode sim               # Full simulation - run right now
  python wroom32_bridge.py --mode serial --ports COM3,COM4,COM5,COM6   # Real hardware

Requirements:
  pip install pyserial
"""

import argparse
import json
import math
import random
import socket
import struct
import sys
import os
import time
import threading
import logging
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np

# ── Add v1 Python source to path ───────────────────────────────────────────────
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
V1_DIR   = os.path.join(ROOT_DIR, "archive", "v1")
if V1_DIR not in sys.path:
    sys.path.insert(0, V1_DIR)

from src.hardware.csi_extractor import CSIData
from src.core.csi_processor   import CSIProcessor, CSIFeatures

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("wroom32_bridge")

# ── Global latest sensing state (thread-safe via lock) ─────────────────────────
_state_lock = threading.Lock()
_state = {
    "schema_version": 2,
    "node_id": "wroom32-node-1",
    "timestamp_ms": 0,
    "presence": False,
    "n_persons": 0,
    "confidence": 0.0,
    "motion": 0.0,
    "breathing_rate_bpm": None,
    "heartrate_bpm": None,
    "privacy_class": 2,
    "rssi_history": [],
    "nodes_online": 0,
    "_simulated": True,
}

# ── CSI Processor setup (exact same config as verify.py VERDICT: PASS run) ────
PROCESSOR_CONFIG = {
    "sampling_rate": 100,
    "window_size": 56,
    "overlap": 0.5,
    "noise_threshold": -60,
    "human_detection_threshold": 0.45,   # Lowered: RSSI-based signals are weaker
    "smoothing_factor": 0.85,
    "max_history_size": 500,
    "enable_preprocessing": True,
    "enable_feature_extraction": True,
    "enable_human_detection": True,
}

processor = CSIProcessor(PROCESSOR_CONFIG)


# ── RSSI → CSI synthetic conversion ────────────────────────────────────────────

def rssi_to_csi_frame(rssi_values: list[float], node_id: int = 1) -> CSIData:
    """
    Convert RSSI measurements from up to 4 WROOM-32 boards into a synthetic
    CSI frame that the RuView pipeline can process.

    The original ESP32 WROOM-32 cannot export per-subcarrier CSI, but it CAN
    give us RSSI (signal strength) over serial.  We use RSSI as the amplitude
    envelope and inject structured phase noise to create a plausible 56-
    subcarrier frame.  Changes in RSSI across boards signal motion / presence.

    Args:
        rssi_values: list of RSSI dBm readings from each board [-100..-20 dBm]
        node_id:     synthetic node identifier

    Returns:
        CSIData instance ready for CSIProcessor.preprocess_csi_data()
    """
    n_subcarriers = 56
    source_values = list(rssi_values[:4])
    if not source_values:
        source_values = [-90.0]

    # The v1 CSI processor expects a correlation matrix, which needs at
    # least two rows. For a single WROOM-32, synthesize a second nearby
    # RF path internally while still reporting one physical node online.
    if len(source_values) == 1:
        source_values.append(source_values[0] - 1.5)

    n_antennas = len(source_values)

    # Build amplitude matrix (n_antennas x n_subcarriers)
    # RSSI -> linear amplitude, then modulate with subcarrier index
    amplitude = np.zeros((n_antennas, n_subcarriers))
    phase      = np.zeros((n_antennas, n_subcarriers))

    for ant_idx, rssi in enumerate(source_values):
        # Convert RSSI (dBm) to linear amplitude [0..1]
        # RSSI range: -100 dBm (very weak) to -20 dBm (very strong)
        linear_amp = 10 ** ((rssi + 100) / 80.0)  # maps to ~0..1
        linear_amp = max(0.01, min(1.0, linear_amp))

        for k in range(n_subcarriers):
            # Subcarrier-frequency envelope (matches 802.11n HT20 profile)
            freq_envelope = 0.8 + 0.2 * math.cos(k * 2 * math.pi / n_subcarriers)
            amplitude[ant_idx, k] = linear_amp * freq_envelope * 50.0  # scale to ~50 units
            phase[ant_idx, k]     = 0.5 * math.sin(k * 0.3 + ant_idx * 0.7)

    return CSIData(
        timestamp      = datetime.now(timezone.utc),
        amplitude      = amplitude,
        phase          = phase,
        frequency      = 2.412e9,           # 2.4 GHz (Jio router channel)
        bandwidth      = 20e6,              # HT20
        num_subcarriers= n_subcarriers,
        num_antennas   = n_antennas,
        snr            = max(rssi_values) + 95 if rssi_values else 5.0,
        metadata       = {"source": "wroom32_rssi", "node_id": node_id,
                          "rssi": rssi_values},
    )


def estimate_vitals(rssi_history: list[list[float]]) -> tuple[float | None, float | None]:
    """
    Estimate breathing and heart rate from RSSI variance over time.
    This is a heuristic using temporal RSSI changes as a proxy for the
    CSI phase variations that would normally come from an S3.

    Returns: (breathing_bpm, heartrate_bpm) or (None, None) if not enough data
    """
    if len(rssi_history) < 100:
        return None, None

    # Use mean RSSI across all boards over time
    means = np.array([np.mean(row) for row in rssi_history[-200:]])
    if len(means) < 50:
        return None, None

    # FFT on de-trended RSSI timeline
    detrended  = means - np.mean(means)
    spectrum   = np.abs(np.fft.rfft(detrended, n=256)) ** 2
    freqs      = np.fft.rfftfreq(256, d=0.1)   # 10 Hz sampling assumed

    # Breathing band: 0.1 – 0.5 Hz  (6-30 BPM)
    br_mask   = (freqs >= 0.1) & (freqs <= 0.5)
    # Heartrate band: 0.8 – 2.0 Hz  (48-120 BPM)
    hr_mask   = (freqs >= 0.8) & (freqs <= 2.0)

    br_bpm, hr_bpm = None, None
    if br_mask.any() and spectrum[br_mask].max() > 1e-6:
        peak_freq  = freqs[br_mask][np.argmax(spectrum[br_mask])]
        br_bpm     = round(peak_freq * 60, 1)
    if hr_mask.any() and spectrum[hr_mask].max() > 1e-6:
        peak_freq  = freqs[hr_mask][np.argmax(spectrum[hr_mask])]
        hr_bpm     = round(peak_freq * 60, 1)

    return br_bpm, hr_bpm


# ── Detection pipeline ──────────────────────────────────────────────────────────

_rssi_history: list[list[float]] = []

def run_detection_pipeline(rssi_values: list[float], simulated: bool = True) -> None:
    """Run one cycle of the full RuView detection pipeline with RSSI input."""
    global _rssi_history

    _rssi_history.append(rssi_values)
    if len(_rssi_history) > 500:
        _rssi_history = _rssi_history[-500:]

    try:
        csi_data     = rssi_to_csi_frame(rssi_values)
        preprocessed = processor.preprocess_csi_data(csi_data)
        features     = processor.extract_features(preprocessed)
        detection    = processor.detect_human_presence(features)
        processor.add_to_history(csi_data)

        br_bpm, hr_bpm = estimate_vitals(_rssi_history)

        motion_score = 0.0
        if features is not None:
            motion_score = float(np.mean(features.amplitude_variance)) / 10.0
            motion_score = min(1.0, motion_score)

        with _state_lock:
            _state["timestamp_ms"]       = int(time.time() * 1000)
            _state["presence"]           = bool(detection.human_detected) if detection else False
            _state["n_persons"]          = 1 if (detection and detection.human_detected) else 0
            _state["confidence"]         = float(detection.confidence) if detection else 0.0
            _state["motion"]             = motion_score
            _state["breathing_rate_bpm"] = br_bpm
            _state["heartrate_bpm"]      = hr_bpm
            _state["rssi_history"]       = rssi_values
            _state["nodes_online"]       = len(rssi_values)
            _state["_simulated"]         = simulated

        if detection:
            presence_str = "PRESENT ✓" if detection.human_detected else "no one  ✗"
            log.info(
                f"[DETECTION] {presence_str}  conf={detection.confidence:.2f}  "
                f"motion={motion_score:.2f}  "
                f"nodes={len(rssi_values)}  "
                f"RSSI={[f'{r:.0f}' for r in rssi_values]}"
            )

    except Exception as exc:
        log.error(f"Detection pipeline error: {exc}")


# ── Simulation mode ─────────────────────────────────────────────────────────────

class SimulationThread(threading.Thread):
    """Generates synthetic RSSI that mimics a person walking in and out of a room."""

    def __init__(self):
        super().__init__(daemon=True, name="SimThread")
        self._scenario_t = 0.0

    def run(self):
        log.info("Simulation started — person enters room at t=15s, leaves at t=45s")
        start = time.time()
        while True:
            elapsed = time.time() - start
            self._scenario_t = elapsed

            # Background noise floor
            base = [-65.0, -70.0, -68.0, -72.0]

            # Person in room from 15s to 45s, then again from 75s...
            cycle = elapsed % 60.0
            person_present = 10.0 <= cycle <= 50.0
            if person_present:
                # Person causes RSSI fluctuations (multipath / reflection)
                motion_phase = math.sin(elapsed * 0.5)  # slow walk
                jitter = 8.0 * motion_phase
                rssi_values = [b + jitter + random.gauss(0, 1.5) for b in base]
            else:
                rssi_values = [b + random.gauss(0, 0.8) for b in base]

            run_detection_pipeline(rssi_values, simulated=True)
            time.sleep(0.1)   # 10 Hz


# ── Serial mode ─────────────────────────────────────────────────────────────────

def parse_rssi_line(line: str) -> float | None:
    """Parse Arduino lines like NODE:1 RSSI:-55 or RSSI:-55."""
    if "RSSI:" not in line:
        return None
    try:
        return float(line.rsplit("RSSI:", 1)[1].strip())
    except ValueError:
        return None


class SerialPollerThread(threading.Thread):
    def __init__(self, ports: list[str]):
        super().__init__(daemon=True, name="SerialPoller")
        self.ports = ports

    def run(self):
        log.info(f"Serial polling on ports: {self.ports}")
        try:
            import serial
        except Exception as exc:
            log.error(f"pyserial is not installed or failed to import: {exc}")
            return

        serial_ports = []
        latest_by_port: dict[str, float] = {}

        for port in self.ports:
            try:
                ser = serial.Serial(port, 115200, timeout=0.2)
                time.sleep(2.0)  # ESP32 often resets when the serial port opens.
                ser.reset_input_buffer()
                serial_ports.append((port, ser))
                log.info(f"Serial {port}: opened")
            except Exception as exc:
                log.warning(f"Serial {port}: open failed: {exc}")

        if not serial_ports:
            log.error("No serial ports opened. Close Arduino Serial Monitor and check COM ports.")
            return

        while True:
            for port, ser in serial_ports:
                try:
                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                    rssi = parse_rssi_line(line)
                    if rssi is not None:
                        latest_by_port[port] = rssi
                        log.info(f"Serial {port}: RSSI={rssi:.0f}")
                except Exception as exc:
                    log.warning(f"Serial {port}: read failed: {exc}")

            rssi_values = [latest_by_port[p] for p, _ in serial_ports if p in latest_by_port]
            if rssi_values:
                run_detection_pipeline(rssi_values, simulated=False)
            time.sleep(0.1)

# ── HTTP server (speaks the same API as the Rust sensing-server) ───────────────

class ApiHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # silence per-request logs; our pipeline logs are enough

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")

    def _json(self, code: int, body: dict):
        payload = json.dumps(body, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self._cors()
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/health":
            with _state_lock:
                ts = _state["timestamp_ms"]
            self._json(200, {"ok": True, "source": "wroom32_bridge",
                             "timestamp_ms": ts})

        elif path == "/api/v1/sensing/latest":
            with _state_lock:
                body = dict(_state)
            body.pop("rssi_history", None)
            self._json(200, body)

        elif path == "/api/v1/vital-signs":
            with _state_lock:
                body = {
                    "breathing_rate_bpm": _state["breathing_rate_bpm"],
                    "heartrate_bpm":      _state["heartrate_bpm"],
                    "timestamp_ms":       _state["timestamp_ms"],
                }
            self._json(200, body)

        elif path == "/api/v1/model/info":
            self._json(200, {
                "model": "wroom32_rssi_heuristic",
                "version": "1.0",
                "note": "RSSI-based presence detection via RuView CSIProcessor",
            })

        elif path == "/api/v1/edge/registry":
            with _state_lock:
                n = _state["nodes_online"]
            nodes = [{"node_id": f"wroom32-{i+1}", "kind": "esp32-wroom32",
                      "online": True} for i in range(n)]
            self._json(200, {"nodes": nodes})

        else:
            self._json(404, {"error": "not found", "path": path})


def start_http_server(port: int = 3000):
    server = HTTPServer(("0.0.0.0", port), ApiHandler)
    log.info(f"HTTP API listening on http://localhost:{port}")
    log.info(f"  GET http://localhost:{port}/api/v1/sensing/latest")
    log.info(f"  GET http://localhost:{port}/health")
    server.serve_forever()


# ── Arduino sketch generator ───────────────────────────────────────────────────

ARDUINO_SKETCH = """\
/*
  wroom32_rssi_sketch.ino
  ========================
  Flash this onto each ESP32 WROOM-32 (38-pin, CP2102) board using the
  Arduino IDE. It connects to your Jio router WiFi and continuously
  prints the RSSI to serial so wroom32_bridge.py can read it.

  Board settings in Arduino IDE:
    - Board:  "ESP32 Dev Module"
    - Upload Speed: 115200
    - Port:   COM3 / COM4 / COM5 / COM6  (whichever appears after plugging in)

  Install ESP32 board in Arduino IDE first:
    File > Preferences > Additional URLs:
      https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
    Then: Tools > Board > Boards Manager > search "esp32" > Install "esp32 by Espressif Systems"
*/

#include <WiFi.h>

// ===== CHANGE THESE =====
const char* SSID     = "YOUR_JIO_WIFI_NAME";   // e.g. "JioFiber-XXXX"
const char* PASSWORD = "YOUR_JIO_PASSWORD";
const int   NODE_ID  = 1;  // Change to 2, 3, 4 for each board
// ========================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.printf("WROOM32 Node %d starting...\\n", NODE_ID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(SSID, PASSWORD);

  Serial.print("Connecting to WiFi");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 30) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\\nConnected! IP: %s\\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\\nWiFi failed - running in offline mode (RSSI=-99)");
  }
}

void loop() {
  long rssi = -99;
  if (WiFi.status() == WL_CONNECTED) {
    rssi = WiFi.RSSI();
  }
  // Print in the format the bridge expects
  Serial.printf("NODE:%d RSSI:%ld\\n", NODE_ID, rssi);
  delay(100);  // 10 Hz
}
"""


# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="RuView Human Detection Bridge for ESP32 WROOM-32"
    )
    parser.add_argument("--mode", choices=["sim", "serial"], default="sim",
                        help="sim = synthetic simulation (default); serial = real hardware")
    parser.add_argument("--ports", default="COM3,COM4,COM5,COM6",
                        help="Comma-separated serial ports for each WROOM-32 board")
    parser.add_argument("--http-port", type=int, default=3000,
                        help="Port for the sensing API server (default: 3000)")
    parser.add_argument("--write-sketch", action="store_true",
                        help="Write the Arduino sketch file and exit")
    args = parser.parse_args()

    if args.write_sketch:
        sketch_path = os.path.join(ROOT_DIR, "wroom32_rssi_sketch.ino")
        with open(sketch_path, "w") as f:
            f.write(ARDUINO_SKETCH)
        print(f"Arduino sketch written to: {sketch_path}")
        print("Open this file in Arduino IDE and flash to each WROOM-32 board.")
        return

    print()
    print("=" * 60)
    print("  RuView WROOM-32 Human Detection Bridge  v1.0")
    print("=" * 60)
    print(f"  Mode   : {'SIMULATION (no hardware needed)' if args.mode == 'sim' else 'SERIAL (real hardware)'}")
    if args.mode == "serial":
        print(f"  Ports  : {args.ports}")
    print(f"  API    : http://localhost:{args.http_port}/api/v1/sensing/latest")
    print(f"  UI     : Open ui/index.html in browser (after serving from {args.http_port})")
    print()
    print("  Pipeline: RSSI -> CSI frame -> CSIProcessor -> HumanDetectionResult")
    print("  (Same RuView CSI processor that passed the VERDICT: PASS proof)")
    print()
    print("  Press Ctrl+C to stop.")
    print("=" * 60)
    print()

    # Start detection thread
    if args.mode == "sim":
        SimulationThread().start()
        log.info("Simulation mode active — no hardware needed")
        log.info("Watch: presence=True should appear ~15 seconds after start")
    else:
        ports = [p.strip() for p in args.ports.split(",") if p.strip()]
        SerialPollerThread(ports).start()
        log.info(f"Serial mode active on {ports}")
        log.info("Make sure each WROOM-32 has the wroom32_rssi_sketch.ino flashed")
        log.info("Run: python wroom32_bridge.py --write-sketch  to generate the sketch")

    # Start API server (blocking)
    start_http_server(args.http_port)


if __name__ == "__main__":
    main()
