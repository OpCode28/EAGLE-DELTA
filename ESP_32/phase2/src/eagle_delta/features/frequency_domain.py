
"""
EAGLE-Δ Frequency-Domain Feature Extraction Module
Extracts frequency-domain features from CSI data
"""

import numpy as np
from scipy import signal
from typing import Dict, Optional
import logging


logger = logging.getLogger(__name__)


class FrequencyDomainFeatures:
    """
    Extracts frequency-domain features from CSI amplitude time-series
    """
    
    @staticmethod
    def compute_psd(
        data: np.ndarray,
        fs: float = 100.0,
        nperseg: int = 256
    ) -&gt; tuple:
        """
        Compute Power Spectral Density using Welch's method
        Returns (frequencies, psd)
        """
        f, Pxx = signal.welch(data, fs=fs, nperseg=nperseg)
        return f, Pxx
    
    @staticmethod
    def spectral_centroid(
        data: np.ndarray,
        fs: float = 100.0,
        axis: Optional[int] = None
    ) -&gt; np.ndarray:
        """Compute spectral centroid"""
        if axis is None:
            data = data.flatten()
            f, Pxx = signal.welch(data, fs=fs)
            centroid = np.sum(f * Pxx) / np.sum(Pxx) if np.sum(Pxx) &gt; 0 else 0
            return centroid
        else:
            raise NotImplementedError("Spectral centroid with axis not implemented yet")
    
    @staticmethod
    def spectral_bandwidth(
        data: np.ndarray,
        fs: float = 100.0,
        axis: Optional[int] = None
    ) -&gt; np.ndarray:
        """Compute spectral bandwidth"""
        if axis is None:
            data = data.flatten()
            f, Pxx = signal.welch(data, fs=fs)
            centroid = np.sum(f * Pxx) / np.sum(Pxx) if np.sum(Pxx) &gt; 0 else 0
            bandwidth = np.sqrt(np.sum(((f - centroid) ** 2) * Pxx) / np.sum(Pxx)) if np.sum(Pxx) &gt; 0 else 0
            return bandwidth
        else:
            raise NotImplementedError("Spectral bandwidth with axis not implemented yet")
    
    @staticmethod
    def spectral_rolloff(
        data: np.ndarray,
        fs: float = 100.0,
        rolloff_percent: float = 0.85,
        axis: Optional[int] = None
    ) -&gt; np.ndarray:
        """Compute spectral rolloff frequency"""
        if axis is None:
            data = data.flatten()
            f, Pxx = signal.welch(data, fs=fs)
            total_energy = np.sum(Pxx)
            if total_energy == 0:
                return 0
            
            target_energy = rolloff_percent * total_energy
            cumulative_energy = np.cumsum(Pxx)
            rolloff_idx = np.where(cumulative_energy &gt;= target_energy)[0][0] if np.any(cumulative_energy &gt;= target_energy) else len(f)-1
            return f[rolloff_idx]
        else:
            raise NotImplementedError("Spectral rolloff with axis not implemented yet")
    
    @staticmethod
    def spectral_flatness(
        data: np.ndarray,
        fs: float = 100.0,
        axis: Optional[int] = None
    ) -&gt; np.ndarray:
        """Compute spectral flatness (tonality measure)"""
        if axis is None:
            data = data.flatten()
            f, Pxx = signal.welch(data, fs=fs)
            # Add small epsilon to avoid log(0)
            Pxx_safe = Pxx + 1e-10
            geometric_mean = np.exp(np.mean(np.log(Pxx_safe)))
            arithmetic_mean = np.mean(Pxx_safe)
            return geometric_mean / arithmetic_mean if arithmetic_mean != 0 else 0
        else:
            raise NotImplementedError("Spectral flatness with axis not implemented yet")
    
    @staticmethod
    def energy_in_band(
        data: np.ndarray,
        fs: float = 100.0,
        low_freq: float = 0.0,
        high_freq: float = 50.0,
        axis: Optional[int] = None
    ) -&gt; np.ndarray:
        """Compute energy in a specific frequency band"""
        if axis is None:
            data = data.flatten()
            f, Pxx = signal.welch(data, fs=fs)
            mask = (f &gt;= low_freq) &amp; (f &lt;= high_freq)
            return np.sum(Pxx[mask])
        else:
            raise NotImplementedError("Energy in band with axis not implemented yet")
    
    @staticmethod
    def extract_all_features(
        data: np.ndarray,
        fs: float = 100.0
    ) -&gt; Dict[str, float]:
        """
        Extract all frequency-domain features
        Returns a dictionary of feature names to values
        """
        features = {}
        
        features['spectral_centroid'] = FrequencyDomainFeatures.spectral_centroid(data, fs=fs)
        features['spectral_bandwidth'] = FrequencyDomainFeatures.spectral_bandwidth(data, fs=fs)
        features['spectral_rolloff'] = FrequencyDomainFeatures.spectral_rolloff(data, fs=fs)
        features['spectral_flatness'] = FrequencyDomainFeatures.spectral_flatness(data, fs=fs)
        features['energy_0-10hz'] = FrequencyDomainFeatures.energy_in_band(data, fs=fs, low_freq=0.0, high_freq=10.0)
        features['energy_10-30hz'] = FrequencyDomainFeatures.energy_in_band(data, fs=fs, low_freq=10.0, high_freq=30.0)
        features['energy_30-50hz'] = FrequencyDomainFeatures.energy_in_band(data, fs=fs, low_freq=30.0, high_freq=50.0)
        
        return features

