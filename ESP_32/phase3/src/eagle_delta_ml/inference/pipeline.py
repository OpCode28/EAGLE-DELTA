
"""
EAGLE-Δ ML Inference Pipeline
End-to-end pipeline for CSI-based sensing inference
"""

import sys
from pathlib import Path
from typing import Optional, Dict, Any, List
import numpy as np
import logging

# Add phase2 src to path
phase2_src = Path(__file__).parent.parent.parent.parent / "phase2" / "src"
sys.path.insert(0, str(phase2_src))

from eagle_delta_ml.data.preprocessing import CSIWindowProcessor
from eagle_delta_ml.models.classifiers import PresenceDetector, ActivityRecognizer
from eagle_delta.preprocessing.calibration import CSICalibration
from eagle_delta.preprocessing.filters import CSIFilter


logger = logging.getLogger(__name__)


class EAGLEDeltaPipeline:
    """
    End-to-end pipeline for CSI-based human sensing
    """
    
    def __init__(
        self,
        presence_model_path: Optional[str] = None,
        activity_model_path: Optional[str] = None,
        window_size: int = 100,
        step_size: int = 50
    ):
        self.window_processor = CSIWindowProcessor(window_size=window_size, step_size=step_size)
        self.presence_detector = None
        self.activity_recognizer = None
        self.csi_buffer = []
        self.window_size = window_size
        
        # Load models if paths are provided
        if presence_model_path:
            self.presence_detector = PresenceDetector()
            self.presence_detector.load(presence_model_path)
        
        if activity_model_path:
            self.activity_recognizer = ActivityRecognizer()
            self.activity_recognizer.load(activity_model_path)
    
    def process_csi_record(self, record: Dict[str, Any]) -&gt; Optional[Dict[str, Any]]:
        """
        Process a single CSI record and perform inference
        """
        # Add to buffer
        self.csi_buffer.append(record)
        
        # Keep buffer size manageable
        if len(self.csi_buffer) &gt; self.window_size * 2:
            self.csi_buffer = self.csi_buffer[-self.window_size * 2:]
        
        # If buffer is not full yet, return None
        if len(self.csi_buffer) &lt; self.window_size:
            return None
        
        # Extract and process CSI matrix
        csi_matrix = CSICalibration.compute_csi_matrix(self.csi_buffer[-self.window_size:])
        
        if len(csi_matrix) == 0:
            return None
        
        # Apply filtering
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
        
        # Extract features from the latest window
        X, _ = self.window_processor.process_dataset(filtered_matrix)
        
        if len(X) == 0:
            return None
        
        latest_features = X[-1].reshape(1, -1)
        
        # Perform inference
        results = {
            "timestamp": record.get("timestamp_us", 0),
            "node_id": record.get("node_id", -1)
        }
        
        if self.presence_detector:
            presence_pred = self.presence_detector.predict(latest_features)
            presence_prob = self.presence_detector.predict_proba(latest_features)
            results["presence"] = bool(presence_pred[0])
            results["presence_probability"] = presence_prob[0].tolist()
        
        if self.activity_recognizer and results.get("presence", False):
            activity_pred = self.activity_recognizer.predict(latest_features)
            activity_prob = self.activity_recognizer.predict_proba(latest_features)
            results["activity"] = self.activity_recognizer.class_names[int(activity_pred[0])]
            results["activity_probability"] = activity_prob[0].tolist()
        
        return results
    
    def reset(self):
        """
        Reset the buffer
        """
        self.csi_buffer = []

