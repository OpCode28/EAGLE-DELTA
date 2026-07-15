
#!/usr/bin/env python3
"""
EAGLE-Δ CSI Receiver Script
Receives CSI data from ESP32 nodes via UDP and processes/stores it.
"""

import socket
import json
import threading
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Tuple
import struct


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger("csi_receiver")


class CSIReceiver:
    """
    Main class for receiving and processing CSI data from ESP32 nodes
    """
    
    def __init__(
        self,
        port: int = 3021,
        buffer_size: int = 4096,
        output_dir: Optional[Path] = None,
        save_to_file: bool = True,
        print_to_console: bool = True
    ):
        self.port = port
        self.buffer_size = buffer_size
        self.output_dir = output_dir or Path(__file__).parent / "data" / "csi"
        self.save_to_file = save_to_file
        self.print_to_console = print_to_console
        self.sock: Optional[socket.socket] = None
        self.running = False
        self.thread: Optional[threading.Thread] = None
        
        # Node-specific file handlers
        self.node_files: Dict[int, Path] = {}
        
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"CSI Receiver initialized on port {port}")
        logger.info(f"Output directory: {self.output_dir}")
    
    def _parse_csi_data(self, data: str) -&gt; Optional[Dict]:
        """
        Parse incoming CSI data string
        Expected format: CSI_DATA,node_id,seq,timestamp_us,rssi,channel,sig_mode,mcs,cwb,stbc,len,[csi_data...]
        """
        try:
            if not data.startswith("CSI_DATA,"):
                return None
            
            parts = data.strip().split(",", 11)
            if len(parts) &lt; 12:
                return None
            
            # Parse the first 10 fields (before CSI array)
            node_id = int(parts[1])
            seq = int(parts[2])
            timestamp_us = int(parts[3])
            rssi = int(parts[4])
            channel = int(parts[5])
            sig_mode = int(parts[6])
            mcs = int(parts[7])
            cwb = int(parts[8])
            stbc = int(parts[9])
            len_csi = int(parts[10])
            
            # Parse CSI data array
            csi_array_part = parts[11].strip("[]\n")
            csi_data = list(map(int, csi_array_part.split(","))) if csi_array_part else []
            
            # Validate length
            if len(csi_data) != len_csi:
                logger.warning(f"CSI length mismatch: expected {len_csi}, got {len(csi_data)}")
            
            return {
                "node_id": node_id,
                "sequence_number": seq,
                "timestamp_us": timestamp_us,
                "rssi": rssi,
                "channel": channel,
                "sig_mode": sig_mode,
                "mcs": mcs,
                "cwb": cwb,
                "stbc": stbc,
                "len": len_csi,
                "data": csi_data,
                "received_at": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to parse CSI data: {e}")
            return None
    
    def _get_node_file(self, node_id: int) -&gt; Path:
        """Get or create output file for a specific node"""
        if node_id not in self.node_files:
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            filename = f"node{node_id}-{timestamp}.jsonl"
            self.node_files[node_id] = self.output_dir / filename
            logger.info(f"Created output file for node {node_id}: {self.node_files[node_id]}")
        return self.node_files[node_id]
    
    def _process_packet(self, packet: bytes, addr: Tuple[str, int]):
        """Process a single incoming UDP packet"""
        try:
            data_str = packet.decode('utf-8', errors='replace')
            csi_record = self._parse_csi_data(data_str)
            
            if csi_record:
                if self.print_to_console:
                    print(json.dumps(csi_record))
                
                if self.save_to_file:
                    node_id = csi_record["node_id"]
                    file_path = self._get_node_file(node_id)
                    with open(file_path, 'a', encoding='utf-8') as f:
                        f.write(json.dumps(csi_record) + '\n')
        except Exception as e:
            logger.error(f"Failed to process packet from {addr}: {e}")
    
    def _receive_loop(self):
        """Main receive loop"""
        logger.info("Receive loop started")
        while self.running:
            try:
                self.sock.settimeout(1.0)
                try:
                    data, addr = self.sock.recvfrom(self.buffer_size)
                    self._process_packet(data, addr)
                except socket.timeout:
                    continue
            except Exception as e:
                if self.running:
                    logger.error(f"Error in receive loop: {e}")
    
    def start(self):
        """Start the receiver"""
        if self.running:
            logger.warning("Receiver already running")
            return
        
        # Create UDP socket
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        # Bind to all interfaces on specified port
        self.sock.bind(('0.0.0.0', self.port))
        
        self.running = True
        self.thread = threading.Thread(target=self._receive_loop, daemon=True)
        self.thread.start()
        
        logger.info(f"Receiver started, listening on 0.0.0.0:{self.port}")
    
    def stop(self):
        """Stop the receiver"""
        if not self.running:
            return
        
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        
        if self.sock:
            self.sock.close()
        
        logger.info("Receiver stopped")


def main():
    parser = argparse.ArgumentParser(
        description="EAGLE-Δ CSI Receiver - Receives WiFi CSI data from ESP32 nodes"
    )
    parser.add_argument(
        "-p", "--port", type=int, default=3021,
        help="UDP port to listen on (default: 3021)"
    )
    parser.add_argument(
        "-o", "--output-dir", type=str, default=None,
        help="Directory to save CSI data files"
    )
    parser.add_argument(
        "--no-save", action="store_true",
        help="Don't save data to files"
    )
    parser.add_argument(
        "--no-print", action="store_true",
        help="Don't print data to console"
    )
    
    args = parser.parse_args()
    
    # Create output directory if specified
    output_dir = Path(args.output_dir) if args.output_dir else None
    
    receiver = CSIReceiver(
        port=args.port,
        output_dir=output_dir,
        save_to_file=not args.no_save,
        print_to_console=not args.no_print
    )
    
    try:
        receiver.start()
        print("Press Ctrl+C to stop...")
        while receiver.running:
            import time
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Received interrupt, shutting down...")
    finally:
        receiver.stop()


if __name__ == "__main__":
    main()

