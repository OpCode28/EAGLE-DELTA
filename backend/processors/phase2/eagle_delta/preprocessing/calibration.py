
"""
EAGLE-Δ Phase Calibration & Amplitude Extraction Module
Provides phase calibration and amplitude/phase extraction for CSI data
"""

import numpy as np
from typing import Tuple, Optional
import logging


logger = logging.getLogger(__name__)


class CSICalibration:
    """
    Provides phase calibration and CSI feature extraction methods
    """
    
    @staticmethod
    def extract_csi_components(
        raw_data: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extract real and imaginary components from raw ESP32 CSI data
        ESP32 stores CSI as interleaved signed 8-bit real/imaginary pairs
        """
        raw_data = np.asarray(raw_data)
        
        if len(raw_data) % 2 != 0:
            logger.warning("Raw data length is odd, truncating last value")
            raw_data = raw_data[:-1]
        
        real = raw_data[::2].astype(np.float64)
        imag = raw_data[1::2].astype(np.float64)
        
        return real, imag
    
    @staticmethod
    def compute_amplitude(
        real: np.ndarray,
        imag: np.ndarray
    ) -> np.ndarray:
        """
        Compute amplitude from real and imaginary components
        """
        return np.sqrt(real**2 + imag**2)
    
    @staticmethod
    def compute_phase(
        real: np.ndarray,
        imag: np.ndarray
    ) -> np.ndarray:
        """
        Compute phase from real and imaginary components
        """
        return np.arctan2(imag, real)
    
    @staticmethod
    def calibrate_phase_linear(
        phase: np.ndarray,
        subcarrier_indices: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Apply linear phase calibration to remove linear phase offset
        """
        phase = np.asarray(phase)
        
        if subcarrier_indices is None:
            subcarrier_indices = np.arange(len(phase))
        
        # Fit a linear line to the phase
        slope, intercept = np.polyfit(subcarrier_indices, phase, 1)
        linear_phase = slope * subcarrier_indices + intercept
        
        # Remove linear phase
        calibrated_phase = phase - linear_phase
        
        # Unwrap the phase
        calibrated_phase = np.unwrap(calibrated_phase)
        
        return calibrated_phase
    
    @staticmethod
    def calibrate_phase_reference(
        phase: np.ndarray,
        reference_phase: np.ndarray
    ) -> np.ndarray:
        """
        Calibrate phase using a reference measurement
        """
        phase = np.asarray(phase)
        reference_phase = np.asarray(reference_phase)
        
        if len(phase) != len(reference_phase):
            raise ValueError("Phase and reference must have the same length")
        
        calibrated_phase = phase - reference_phase
        return np.unwrap(calibrated_phase)
    
    @staticmethod
    def sanitize_csi(
        amplitude: np.ndarray,
        phase: np.ndarray,
        remove_pilots: bool = True,
        remove_dc: bool = True
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Sanitize CSI data by removing unwanted subcarriers
        """
        amplitude = np.asarray(amplitude)
        phase = np.asarray(phase)
        
        mask = np.ones(len(amplitude), dtype=bool)
        
        if remove_dc and len(amplitude) > 32:
            # Typically DC subcarrier is at index 32 for 64 subcarriers
            mask[32] = False
        
        if remove_pilots and len(amplitude) == 64:
            # Remove pilot subcarriers for 20MHz 802.11n
            pilot_indices = [11, 25, 39, 53]
            mask[pilot_indices] = False
        
        return amplitude[mask], phase[mask]
    
    @staticmethod
    def compute_csi_matrix(
        all_records: list,
        node_id: Optional[int] = None
    ) -> np.ndarray:
        """
        Compute a complete CSI amplitude matrix from records
        Shape: (num_packets, num_subcarriers)
        """
        amplitude_list = []
        
        for rec in all_records:
            if node_id is not None and rec.get("node_id") != node_id:
                continue
            
            raw_data = np.array(rec.get("data", []))
            if len(raw_data) < 2:
                continue
            
            real, imag = CSICalibration.extract_csi_components(raw_data)
            amp = CSICalibration.compute_amplitude(real, imag)
            amplitude_list.append(amp)
        
        if not amplitude_list:
            return np.array([])
        
        # Pad all to the same length
        max_len = max(len(a) for a in amplitude_list)
        padded_amplitudes = []
        for amp in amplitude_list:
            padded = np.pad(amp, (0, max_len - len(amp)), mode='constant')
            padded_amplitudes.append(padded)
        
        return np.array(padded_amplitudes)

