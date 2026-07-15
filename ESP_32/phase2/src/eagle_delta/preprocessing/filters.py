
"""
EAGLE-Δ Filtering &amp; Noise Removal Module
Provides functions for cleaning and filtering CSI data
"""

import numpy as np
from scipy import signal
from typing import Tuple, Optional
import logging


logger = logging.getLogger(__name__)


class CSIFilter:
    """
    Provides various filtering and noise reduction methods for CSI data
    """
    
    @staticmethod
    def hampel_filter(
        data: np.ndarray,
        window_size: int = 5,
        n_sigmas: float = 3.0
    ) -&gt; Tuple[np.ndarray, np.ndarray]:
        """
        Apply Hampel filter to remove outliers from time-series data
        """
        data = np.asarray(data)
        filtered_data = data.copy()
        k = 1.4826  # scale factor for Gaussian distribution
        indices = []
        
        for i in range(window_size, len(data) - window_size):
            window = data[i - window_size:i + window_size + 1]
            median = np.median(window)
            mad = k * np.median(np.abs(window - median))
            
            if np.abs(data[i] - median) &gt; n_sigmas * mad:
                filtered_data[i] = median
                indices.append(i)
        
        return filtered_data, np.array(indices)
    
    @staticmethod
    def moving_average(
        data: np.ndarray,
        window_size: int = 5
    ) -&gt; np.ndarray:
        """
        Apply simple moving average filter
        """
        if window_size &lt; 1:
            raise ValueError("Window size must be at least 1")
        
        return np.convolve(data, np.ones(window_size)/window_size, mode='same')
    
    @staticmethod
    def exponential_moving_average(
        data: np.ndarray,
        alpha: float = 0.3
    ) -&gt; np.ndarray:
        """
        Apply exponential moving average filter
        """
        if not 0 &lt; alpha &lt;= 1:
            raise ValueError("Alpha must be between 0 and 1")
        
        ema = np.zeros_like(data, dtype=np.float64)
        ema[0] = data[0]
        for i in range(1, len(data)):
            ema[i] = alpha * data[i] + (1 - alpha) * ema[i-1]
        
        return ema
    
    @staticmethod
    def lowpass_filter(
        data: np.ndarray,
        cutoff: float,
        fs: float = 100.0,
        order: int = 4
    ) -&gt; np.ndarray:
        """
        Apply Butterworth low-pass filter
        """
        nyquist = 0.5 * fs
        normal_cutoff = cutoff / nyquist
        b, a = signal.butter(order, normal_cutoff, btype='low', analog=False)
        return signal.filtfilt(b, a, data)
    
    @staticmethod
    def highpass_filter(
        data: np.ndarray,
        cutoff: float,
        fs: float = 100.0,
        order: int = 4
    ) -&gt; np.ndarray:
        """
        Apply Butterworth high-pass filter
        """
        nyquist = 0.5 * fs
        normal_cutoff = cutoff / nyquist
        b, a = signal.butter(order, normal_cutoff, btype='high', analog=False)
        return signal.filtfilt(b, a, data)
    
    @staticmethod
    def bandpass_filter(
        data: np.ndarray,
        low_cut: float,
        high_cut: float,
        fs: float = 100.0,
        order: int = 4
    ) -&gt; np.ndarray:
        """
        Apply Butterworth band-pass filter
        """
        nyquist = 0.5 * fs
        low = low_cut / nyquist
        high = high_cut / nyquist
        b, a = signal.butter(order, [low, high], btype='band', analog=False)
        return signal.filtfilt(b, a, data)
    
    @staticmethod
    def remove_static_component(
        data: np.ndarray,
        window_size: Optional[int] = None
    ) -&gt; np.ndarray:
        """
        Remove static (DC) component from CSI data
        """
        data = np.asarray(data)
        if window_size is None:
            # Remove global mean
            return data - np.mean(data, axis=0, keepdims=True)
        else:
            # Remove rolling mean
            if len(data.shape) == 1:
                rolling_mean = np.convolve(data, np.ones(window_size)/window_size, mode='same')
                return data - rolling_mean
            else:
                result = np.zeros_like(data)
                for i in range(data.shape[1]):
                    rolling_mean = np.convolve(data[:, i], np.ones(window_size)/window_size, mode='same')
                    result[:, i] = data[:, i] - rolling_mean
                return result
    
    @staticmethod
    def denoise_wavelet(
        data: np.ndarray,
        wavelet: str = 'db4',
        level: int = 3
    ) -&gt; np.ndarray:
        """
        Apply wavelet denoising (requires PyWavelets)
        """
        try:
            import pywt
        except ImportError:
            logger.warning("PyWavelets not installed, returning original data")
            return data
        
        coeffs = pywt.wavedec(data, wavelet, level=level)
        threshold = np.std(coeffs[-1]) * np.sqrt(2 * np.log(len(data)))
        
        denoised_coeffs = [coeffs[0]]
        for detail in coeffs[1:]:
            denoised_detail = pywt.threshold(detail, threshold, mode='soft')
            denoised_coeffs.append(denoised_detail)
        
        return pywt.waverec(denoised_coeffs, wavelet)

