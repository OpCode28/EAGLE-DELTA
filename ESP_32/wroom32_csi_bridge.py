#!/usr/bin/env python3
"""Minimal ESP32 WROOM-32 CSI bridge for RuView.

Reads ESP-IDF firmware lines like:
CSI_DATA,2,0,99767169,-70,13,1,4,0,0,256,[114,-96,...]

Serves: http://localhost:3020/api/v1/sensing/latest
"""

from __future__ import annotations

import argparse
import ast
import json
import logging
import re
import socket
import sys
import threading
import time
from collections import deque
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import numpy as np
import serial

try:
    import joblib
except ImportError:
    joblib = None

LOG = logging.getLogger('wroom32_csi_bridge')
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s %(name)s: %(message)s', datefmt='%H:%M:%S')

ROOT = Path(__file__).resolve().parent

# Add scripts directory to path to import extract_vitals
sys.path.append(str(ROOT / 'scripts'))
try:
    from extract_vitals import extract_vitals
except ImportError:
    extract_vitals = None
CSI_RE = re.compile(r'^CSI_DATA,(?P<head>[^\[]+)(?P<body>\[.*\])\s*$')

state_lock = threading.Lock()
state = {
    'schema_version': 2,
    'node_id': 'wroom32-csi',
    'timestamp_ms': 0,
    'presence': False,
    'n_persons': 0,
    'confidence': 0.0,
    'motion': 0.0,
    'activity': 'unknown',
    'gait_behavior': 'unknown',
    'posture': 'unknown_csi_untrained',
    'breathing_rate_bpm': None,
    'heartrate_bpm': None,
    'privacy_class': 2,
    'nodes_online': 0,
    'mode': 'csi',
    '_simulated': False,
}


def parse_csi_line(line: str, port: str):
    m = CSI_RE.match(line.strip())
    if not m:
        return None
    try:
        head = [x.strip() for x in m.group('head').rstrip(',').split(',')]
        if len(head) < 10:
            return None
        raw = ast.literal_eval(m.group('body'))
        raw = [int(x) for x in raw]
        iq = np.asarray(raw, dtype=np.float32)
        if iq.size < 2:
            return None
        if iq.size % 2:
            iq = iq[:-1]
        i_vals = iq[0::2]
        q_vals = iq[1::2]
        amp = np.sqrt(i_vals * i_vals + q_vals * q_vals)
        phase = np.arctan2(q_vals, i_vals)
        return {
            'port': port,
            'node_id': int(head[0]),
            'seq': int(head[1]),
            'device_timestamp_us': int(head[2]),
            'rssi': int(head[3]),
            'channel': int(head[4]),
            'sig_mode': int(head[5]),
            'mcs': int(head[6]),
            'cwb': int(head[7]),
            'stbc': int(head[8]),
            'len': int(head[9]),
            'raw': raw,
            'mean_amp': float(np.mean(amp)),
            'std_amp': float(np.std(amp)),
            'amp': amp,
            'phase': phase,
            'host_timestamp_ms': int(time.time() * 1000),
        }
    except Exception:
        return None


class Estimator:
    def __init__(self, calibrate_seconds: float, threshold_sigma: float, motion_threshold: float, model_path: str = ""):
        self.calibrate_until = time.time() + calibrate_seconds
        self.threshold_sigma = threshold_sigma
        self.motion_threshold = motion_threshold
        
        self.model = None
        if model_path and joblib:
            try:
                self.model = joblib.load(model_path)
                LOG.info(f"Loaded advanced CSI model from {model_path}")
            except Exception as e:
                LOG.error(f"Failed to load model {model_path}: {e}")
                
        self.baseline = []
        self.baseline_mean = None
        self.baseline_std = None
        if calibrate_seconds <= 0:
            self.baseline_mean = 0.0
            self.baseline_std = 1.0
        self.conf_hist = deque(maxlen=20)
        self.feature_hist = deque(maxlen=60)
        self.frame_buffer = deque(maxlen=200) # Buffer for vitals & ML (approx 10-20 seconds)

    def extract_ml_features(self):
        if not self.frame_buffer: return None
        features = []
        for node_id in range(1, 5):
            node_frames = [f for f in self.frame_buffer if f.get('node_id') == node_id]
            if not node_frames:
                features.extend([0.0] * 8)
                continue
                
            mean_amps = [f['mean_amp'] for f in node_frames if 'mean_amp' in f]
            std_amps = [f['std_amp'] for f in node_frames if 'std_amp' in f]
            rssis = [f['rssi'] for f in node_frames if 'rssi' in f]
            
            if not mean_amps:
                features.extend([0.0] * 8)
                continue
                
            features.extend([
                np.mean(mean_amps), np.std(mean_amps), np.max(mean_amps), np.min(mean_amps),
                np.mean(std_amps), np.std(std_amps), np.mean(rssis), np.std(rssis) if len(rssis) > 1 else 0.0
            ])
            
        features.append(len(self.frame_buffer))
        return features

    def update(self, frames):
        if not frames:
            return False, 0, 0, 0, 'no_data', None, None, 'unknown'
            
        for f in frames:
            self.frame_buffer.append(f)
            
        feature = float(np.mean([f['std_amp'] for f in frames]) + np.std([f['mean_amp'] for f in frames]))
        self.feature_hist.append(feature)

        if time.time() < self.calibrate_until or self.baseline_mean is None:
            self.baseline.append(feature)
            if len(self.baseline) >= 10:
                self.baseline_mean = float(np.mean(self.baseline))
                self.baseline_std = float(np.std(self.baseline) + 1e-6)
            return False, 0.0, 0.0, 0, 'calibrating_empty_room', None, None, 'unknown'

        # Vitals extraction
        breathing_rate, heart_rate = None, None
        if extract_vitals and len(self.frame_buffer) >= 50:
            time_series = np.array([f['mean_amp'] for f in self.frame_buffer])
            fs = len(self.frame_buffer) / max(0.1, (self.frame_buffer[-1]['host_timestamp_ms'] - self.frame_buffer[0]['host_timestamp_ms']) / 1000.0)
            vitals = extract_vitals(time_series, fs)
            breathing_rate = vitals.get('breathing_rate_bpm')
            heart_rate = vitals.get('heartrate_bpm')

        # Presence can either increase or decrease the CSI feature relative to the empty-room baseline.
        z = abs(feature - self.baseline_mean) / ((self.baseline_std or 1e-6) * self.threshold_sigma)
        confidence = float(max(0.0, min(1.0, z)))
        self.conf_hist.append(confidence)
        smooth = float(np.mean(self.conf_hist))

        motion = 0.0
        if len(self.feature_hist) >= 8:
            motion = float(np.std(list(self.feature_hist)[-30:]) / ((self.baseline_std or 1e-6) * 2.0))
            motion = max(0.0, min(1.0, motion))

        presence = smooth >= 0.45 or motion >= self.motion_threshold
        activity = 'moving' if presence and motion >= self.motion_threshold else 'still' if presence else 'empty'
        
        gait_behavior = 'unknown'
        if presence:
            if motion < 0.2:
                gait_behavior = 'sitting/laying'
            elif motion < 0.6:
                gait_behavior = 'walking_slowly'
            elif motion < 1.5:
                gait_behavior = 'walking_briskly'
            else:
                gait_behavior = 'running/falling'

        if self.model:
            ml_feats = self.extract_ml_features()
            if ml_feats:
                try:
                    n_persons = int(self.model.predict([ml_feats])[0])
                    presence = n_persons > 0
                except Exception:
                    n_persons = 1 if presence else 0
            else:
                n_persons = 1 if presence else 0
        else:
            n_persons = 1 if presence else 0
            if presence and len(frames) >= 2 and smooth > 0.80 and motion > 0.35:
                n_persons = 2
                
        return presence, smooth, motion, n_persons, activity, breathing_rate, heart_rate, gait_behavior


class Reader(threading.Thread):
    def __init__(self, ports, baud, estimator, label, record_path, record_seconds):
        super().__init__(daemon=True)
        self.ports = ports
        self.baud = baud
        self.estimator = estimator
        self.label = label
        self.record_path = record_path
        self.record_until = time.time() + record_seconds if record_seconds > 0 else None
        self.latest = {}
        self.record_file = None

    def run(self):
        opened = []
        for port in self.ports:
            try:
                ser = serial.Serial(port, self.baud, timeout=0.2)
                time.sleep(1.0)
                ser.reset_input_buffer()
                opened.append((port, ser))
                LOG.info('Serial %s: opened at %d baud', port, self.baud)
            except Exception as exc:
                LOG.warning('Serial %s: open failed: %s', port, exc)
        if not opened:
            LOG.error('No serial ports opened. Close ESP-IDF monitor/Arduino monitor first.')
            return

        if self.record_path:
            self.record_path.parent.mkdir(parents=True, exist_ok=True)
            self.record_file = self.record_path.open('a', encoding='utf-8')
            LOG.info('Recording to %s', self.record_path)

        while True:
            for port, ser in opened:
                try:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    frame = parse_csi_line(line, port)
                    if frame is None:
                        if line and ('sta ip:' in line or 'CSI enabled' in line or 'WROOM32' in line or 'Connected. IP:' in line or 'WiFi connected' in line):
                            LOG.info('Serial %s: %s', port, line)
                        continue
                    self.latest[frame['node_id']] = frame
                    frames = list(self.latest.values())

                    if self.record_file and (self.record_until is None or time.time() <= self.record_until):
                        rec = dict(frame)
                        rec.pop('amp', None)
                        rec.pop('phase', None)
                        rec['label'] = self.label
                        self.record_file.write(json.dumps(rec) + '\n')
                        self.record_file.flush()
                    elif self.record_file:
                        LOG.info('Recording complete: %s', self.record_path)
                        self.record_file.close()
                        self.record_file = None

                    presence, conf, motion, n_persons, activity, br, hr, gait = self.estimator.update(frames)
                    with state_lock:
                        state.update({
                            'timestamp_ms': int(time.time() * 1000),
                            'presence': bool(presence),
                            'n_persons': int(n_persons),
                            'confidence': float(conf),
                            'motion': float(motion),
                            'activity': activity,
                            'breathing_rate_bpm': br,
                            'heartrate_bpm': hr,
                            'gait_behavior': gait,
                            'nodes_online': len(frames),
                            'rssi_by_node': {str(f['node_id']): f['rssi'] for f in frames},
                            'mean_amp_by_node': {str(f['node_id']): round(f['mean_amp'], 3) for f in frames},
                        })
                    LOG.info('CSI nodes=%d presence=%s conf=%.2f motion=%.2f activity=%s n_persons=%d rssi=%s',
                             len(frames), presence, conf, motion, activity, n_persons,
                             {f['node_id']: f['rssi'] for f in frames})
                except Exception as exc:
                    LOG.warning('Serial %s: read failed: %s', port, exc)

class UDPReader(threading.Thread):
    def __init__(self, port, estimator, label, record_path, record_seconds):
        super().__init__(daemon=True)
        self.port = port
        self.estimator = estimator
        self.label = label
        self.record_path = record_path
        self.record_until = time.time() + record_seconds if record_seconds > 0 else None
        self.latest = {}
        self.record_file = None

    def run(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.bind(('0.0.0.0', self.port))
        LOG.info('UDP socket listening on port %d', self.port)

        if self.record_path:
            self.record_path.parent.mkdir(parents=True, exist_ok=True)
            self.record_file = self.record_path.open('a', encoding='utf-8')
            LOG.info('Recording to %s', self.record_path)

        while True:
            try:
                data, addr = sock.recvfrom(2048)
                line = data.decode('utf-8', errors='ignore').strip()
                frame = parse_csi_line(line, f'udp://{addr[0]}')
                if frame is None:
                    continue
                self.latest[frame['node_id']] = frame
                frames = list(self.latest.values())

                if self.record_file and (self.record_until is None or time.time() <= self.record_until):
                    rec = dict(frame)
                    rec.pop('amp', None)
                    rec.pop('phase', None)
                    rec['label'] = self.label
                    self.record_file.write(json.dumps(rec) + '\n')
                    self.record_file.flush()
                elif self.record_file:
                    LOG.info('Recording complete: %s', self.record_path)
                    self.record_file.close()
                    self.record_file = None

                presence, conf, motion, n_persons, activity, br, hr, gait = self.estimator.update(frames)
                with state_lock:
                    state.update({
                        'timestamp_ms': int(time.time() * 1000),
                        'presence': bool(presence),
                        'n_persons': int(n_persons),
                        'confidence': float(conf),
                        'motion': float(motion),
                        'activity': activity,
                        'breathing_rate_bpm': br,
                        'heartrate_bpm': hr,
                        'gait_behavior': gait,
                        'nodes_online': len(frames),
                        'rssi_by_node': {str(f['node_id']): f['rssi'] for f in frames},
                        'mean_amp_by_node': {str(f['node_id']): round(f['mean_amp'], 3) for f in frames},
                    })
                LOG.info('UDP CSI nodes=%d presence=%s conf=%.2f motion=%.2f activity=%s n_persons=%d rssi=%s',
                         len(frames), presence, conf, motion, activity, n_persons,
                         {f['node_id']: f['rssi'] for f in frames})
            except Exception as exc:
                LOG.warning('UDP read failed: %s', exc)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def send_json(self, code, body):
        payload = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/health':
            self.send_json(200, {'ok': True, 'source': 'wroom32_csi_bridge'})
        elif path == '/api/v1/sensing/latest':
            with state_lock:
                self.send_json(200, dict(state))
        else:
            self.send_json(404, {'error': 'not found', 'path': path})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ports', default='COM4')
    ap.add_argument('--baud', type=int, default=115200)
    ap.add_argument('--http-port', type=int, default=3020)
    ap.add_argument('--udp-port', type=int, default=3021, help='UDP port for wireless CSI')
    ap.add_argument('--calibrate-seconds', type=float, default=20.0)
    ap.add_argument('--threshold-sigma', type=float, default=3.0)
    ap.add_argument('--motion-threshold', type=float, default=0.35)
    ap.add_argument('--label', default='live')
    ap.add_argument('--record-seconds', type=float, default=0.0)
    ap.add_argument('--record-path', default='')
    ap.add_argument('--model-path', default='', help='Path to advanced ML model (csi_advanced_model.joblib)')
    args = ap.parse_args()

    ports = [p.strip() for p in args.ports.split(',') if p.strip()]
    record_path = None
    if args.record_seconds > 0:
        if args.record_path:
            record_path = Path(args.record_path)
        else:
            stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            safe_label = re.sub(r'[^A-Za-z0-9_.-]+', '_', args.label).strip('_') or 'recording'
            record_path = ROOT / 'data' / 'csi' / f'{stamp}-{safe_label}.jsonl'

    print('\nRuView WROOM-32 CSI Bridge')
    print(f'Ports: {ports}')
    print(f'Baud: {args.baud}')
    print(f'API: http://localhost:{args.http_port}/api/v1/sensing/latest')
    print(f'Calibration: keep room empty for {args.calibrate_seconds:.0f}s after start')
    if record_path:
        print(f'Recording: {record_path}')
    if args.model_path:
        print(f'Model: {args.model_path}')
    print(f'UDP Port: {args.udp_port}')
    print('Press Ctrl+C to stop.\n')

    estimator = Estimator(args.calibrate_seconds, args.threshold_sigma, args.motion_threshold, args.model_path)
    if ports:
        Reader(ports, args.baud, estimator, args.label, record_path, args.record_seconds).start()
    if args.udp_port > 0:
        UDPReader(args.udp_port, estimator, args.label, record_path, args.record_seconds).start()
        
    HTTPServer(('0.0.0.0', args.http_port), Handler).serve_forever()


if __name__ == '__main__':
    main()
