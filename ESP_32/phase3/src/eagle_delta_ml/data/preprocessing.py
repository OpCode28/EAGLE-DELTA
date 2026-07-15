
"""
EAGLE-Δ ML Data Preparation Module
Handles windowing, feature extraction, and dataset creation
"""

import sys
import numpy as np
from typing import List, Dict, Tuple, Optional
from pathlib import Path
import logging

# Add phase2 src to path
phase2_src = Path(__file__).parent.parent.parent.parent / "phase2" / "src"
sys.path.insert(0, str(phase2_src))

from eagle_delta.preprocessing.loader import CSIDataLoader
from eagle_delta.preprocessing.filters import CSIFilter
from eagle_delta.preprocessing.calibration import CSICalibration
from eagle_delta.features.time_domain import TimeDomainFeatures
from eagle_delta.features.frequency_domain import FrequencyDomainFeatures


logger = logging.getLogger(__name__)


class CSIWindowProcessor:
    """
    Processes CSI data into sliding windows for ML
    """
    
    def __init__(
        self,
        window_size: int = 100,
        step_size: int = 50,
        fs: float = 100.0
    ):
        self.window_size = window_size
        self.step_size = step_size
        self.fs = fs
    
    def create_windows(self, data: np.ndarray) -&gt; np.ndarray:
        """
        Split data into sliding windows
        """
        data = np.asarray(data)
        
        if len(data) &lt; self.window_size:
            logger.warning("Data shorter than window size, padding")
            padding = np.zeros((self.window_size - len(data),) + data.shape[1:], dtype=data.dtype)
            data = np.vstack([data, padding])
        
        num_windows = (len(data) - self.window_size) // self.step_size + 1
        windows = []
        
        for i in range(num_windows):
            start = i * self.step_size
            end = start + self.window_size
            windows.append(data[start:end])
        
        return np.array(windows)
    
    def extract_window_features(self, window: np.ndarray) -&gt; np.ndarray:
        """
        Extract features from a single window
        """
        feature_list = []
        
        # If window is 2D (time x subcarriers), extract features per subcarrier and aggregate
        if len(window.shape) == 2:
            num_sub = window.shape[1]
            for sc_idx in range(num_sub):
                sc_data = window[:, sc_idx]
                # Time-domain features
                td = TimeDomainFeatures.extract_all_features(sc_data)
                # Frequency-domain features
                fd = FrequencyDomainFeatures.extract_all_features(sc_data, fs=self.fs)
                # Combine
                feature_list.extend(list(td.values()))
                feature_list.extend(list(fd.values()))
        else:
            # Single channel
            td = TimeDomainFeatures.extract_all_features(window)
            fd = FrequencyDomainFeatures.extract_all_features(window, fs=self.fs)
            feature_list.extend(list(td.values()))
            feature_list.extend(list(fd.values()))
        
        return np.array(feature_list)
    
    def process_dataset(
        self,
        csi_matrix: np.ndarray,
        labels: Optional[np.ndarray] = None
    ) -&gt; Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        Process CSI matrix into features and (optionally) labels
        Returns (X, y) where X is shape (num_windows, num_features)
        """
        if len(csi_matrix.shape) != 2:
            raise ValueError("CSI matrix must be shape (num_packets, num_subcarriers)")
        
        windows = self.create_windows(csi_matrix)
        X = []
        
        for window in windows:
            features = self.extract_window_features(window)
            X.append(features)
        
        X = np.array(X)
        
        # Process labels if provided
        y = None
        if labels is not None:
            y_windows = self.create_windows(labels.reshape(-1, 1))
            y = np.array([np.bincount(w.flatten().astype(int)).argmax() for w in y_windows])
        
        return X, y


def prepare_dataset_from_records(
    records: List[Dict],
    window_processor: CSIWindowProcessor,
    label: Optional[int] = None,
    node_id: Optional[int] = None
) -&gt; Tuple[np.ndarray, Optional[np.ndarray]]:
    """
    Prepare a dataset from loaded CSI records
    """
    # Compute CSI matrix
    csi_matrix = CSICalibration.compute_csi_matrix(records, node_id=node_id)
    
    if len(csi_matrix) == 0:
        return np.array([]), None
    
    # Apply preprocessing
    filtered_matrix = csi_matrix.copy()
    for sc_idx in range(filtered_matrix.shape[1]):
        filtered_matrix[:, sc_idx] = CSIFilter.hampel_filter(
            filtered_matrix[:, sc_idx], window_size=5
        )[0]
        filtered_matrix[:, sc_idx] = CSIFilter.lowpass_filter(
            filtered_matrix[:, sc_idx], cutoff=20.0
        )
        filtered_matrix[:, sc_idx] = CSIFilter.remove_static_component(
            filtered_matrix[:, sc_idx]
        )
    
    # Create labels if provided
    y = None
    if label is not None:
        y = np.full(len(filtered_matrix), label, dtype=int)
    
    # Process into windows and features
    X, y = window_processor.process_dataset(filtered_matrix, y)
    return X, y

