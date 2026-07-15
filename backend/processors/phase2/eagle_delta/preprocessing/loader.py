
"""
EAGLE-Δ CSI Data Loader Module
Loads and parses CSI data from JSONL files
"""

import json
from pathlib import Path
from typing import List, Dict, Optional, Union
import numpy as np
import logging


logger = logging.getLogger(__name__)


class CSIDataLoader:
    """
    Loads and manages CSI data from JSONL files
    """
    
    def __init__(self):
        self.records: List[Dict] = []
        self.node_ids: List[int] = []
    
    def load_file(self, file_path: Union[str, Path]) -> List[Dict]:
        """
        Load CSI data from a single JSONL file
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        logger.info(f"Loading data from {file_path}")
        records = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    record = json.loads(line)
                    records.append(record)
                except json.JSONDecodeError as e:
                    logger.warning(f"Error parsing line {line_num}: {e}")
                    continue
        
        self.records.extend(records)
        logger.info(f"Loaded {len(records)} records from {file_path}")
        return records
    
    def load_directory(self, dir_path: Union[str, Path], pattern: str = "*.jsonl") -> List[Dict]:
        """
        Load all CSI data files from a directory
        """
        dir_path = Path(dir_path)
        if not dir_path.exists():
            raise FileNotFoundError(f"Directory not found: {dir_path}")
        
        logger.info(f"Loading data from directory {dir_path}")
        all_records = []
        
        for file_path in dir_path.glob(pattern):
            try:
                records = self.load_file(file_path)
                all_records.extend(records)
            except Exception as e:
                logger.error(f"Error loading {file_path}: {e}")
        
        return all_records
    
    def get_amplitudes(self, node_id: Optional[int] = None) -> np.ndarray:
        """
        Extract CSI amplitude matrix from loaded records
        """
        filtered_records = self.records
        if node_id is not None:
            filtered_records = [r for r in self.records if r.get("node_id") == node_id]
        
        if not filtered_records:
            return np.array([])
        
        amplitudes_list = []
        for rec in filtered_records:
            data = np.array(rec.get("data", []))
            # For ESP32, CSI data is stored as interleaved real and imaginary parts
            # OR as signed 8-bit values that need to be combined
            if len(data) >= 2:
                # Combine real and imaginary parts to get amplitude
                real = data[::2]
                imag = data[1::2]
                amp = np.sqrt(real**2 + imag**2)
                amplitudes_list.append(amp)
        
        if not amplitudes_list:
            return np.array([])
        
        # Pad to same length and stack
        max_len = max(len(a) for a in amplitudes_list)
        padded = []
        for a in amplitudes_list:
            padded_a = np.pad(a, (0, max_len - len(a)), mode='constant')
            padded.append(padded_a)
        
        return np.array(padded)
    
    def get_timestamps(self, node_id: Optional[int] = None) -> np.ndarray:
        """
        Extract timestamps from loaded records
        """
        filtered_records = self.records
        if node_id is not None:
            filtered_records = [r for r in self.records if r.get("node_id") == node_id]
        
        ts = [r.get("timestamp_us", 0) for r in filtered_records]
        return np.array(ts)
    
    def get_rssis(self, node_id: Optional[int] = None) -> np.ndarray:
        """
        Extract RSSI values from loaded records
        """
        filtered_records = self.records
        if node_id is not None:
            filtered_records = [r for r in self.records if r.get("node_id") == node_id]
        
        rssis = [r.get("rssi", 0) for r in filtered_records]
        return np.array(rssis)
    
    def clear(self):
        """Clear all loaded data"""
        self.records = []
        self.node_ids = []
        logger.info("Cleared all loaded data")

