import numpy as np
from scipy.signal import butter, filtfilt, find_peaks, welch

def extract_vitals(time_series, fs):
    """
    Extract breathing rate and heart rate from a CSI time series.
    
    Args:
        time_series: 1D numpy array of CSI amplitude/feature over time.
        fs: Sampling frequency in Hz.
        
    Returns:
        dict: {'breathing_rate_bpm': float, 'heartrate_bpm': float}
    """
    if len(time_series) < fs * 5:  # Need at least 5 seconds of data for meaningful FFT
        return {'breathing_rate_bpm': None, 'heartrate_bpm': None}
        
    # Remove DC offset
    time_series = time_series - np.mean(time_series)
    
    # 1. Breathing Rate (0.2 Hz to 0.5 Hz -> 12 to 30 BPM)
    try:
        b_br, a_br = butter(3, [0.15, 0.6], btype='bandpass', fs=fs)
        br_filtered = filtfilt(b_br, a_br, time_series)
        
        # Power Spectral Density using Welch's method
        f_br, Pxx_br = welch(br_filtered, fs, nperseg=min(len(br_filtered), 256))
        
        # Find peak frequency in the breathing range
        br_valid_idx = np.where((f_br >= 0.15) & (f_br <= 0.6))[0]
        if len(br_valid_idx) > 0:
            peak_idx = br_valid_idx[np.argmax(Pxx_br[br_valid_idx])]
            br_hz = f_br[peak_idx]
            breathing_rate = br_hz * 60.0
        else:
            breathing_rate = None
    except Exception:
        breathing_rate = None
        
    # 2. Heart Rate (1.0 Hz to 2.0 Hz -> 60 to 120 BPM)
    try:
        b_hr, a_hr = butter(3, [0.8, 2.5], btype='bandpass', fs=fs)
        hr_filtered = filtfilt(b_hr, a_hr, time_series)
        
        f_hr, Pxx_hr = welch(hr_filtered, fs, nperseg=min(len(hr_filtered), 256))
        
        hr_valid_idx = np.where((f_hr >= 0.8) & (f_hr <= 2.5))[0]
        if len(hr_valid_idx) > 0:
            peak_idx = hr_valid_idx[np.argmax(Pxx_hr[hr_valid_idx])]
            hr_hz = f_hr[peak_idx]
            heart_rate = hr_hz * 60.0
        else:
            heart_rate = None
    except Exception:
        heart_rate = None

    return {
        'breathing_rate_bpm': round(breathing_rate, 1) if breathing_rate else None,
        'heartrate_bpm': round(heart_rate, 1) if heart_rate else None
    }
