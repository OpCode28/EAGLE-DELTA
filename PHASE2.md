
# EAGLE-Δ Project - Phase 2: Signal Processing

## Overview
Phase 2 implements signal processing, noise removal, phase calibration, and feature extraction for WiFi CSI data.

## Directory Structure

```
ESP_32/phase2/
├── requirements.txt          # Python dependencies
├── process_csi.py            # Example processing script
├── src/
│   └── eagle_delta/
│       ├── __init__.py
│       ├── preprocessing/
│       │   ├── __init__.py
│       │   ├── loader.py     # Load and parse CSI data
│       │   ├── filters.py    # Filters and noise removal
│       │   └── calibration.py # Phase calibration and CSI processing
│       ├── features/
│       │   ├── __init__.py
│       │   ├── time_domain.py # Time-domain feature extraction
│       │   └── frequency_domain.py # Frequency-domain feature extraction
│       └── visualization/
│           ├── __init__.py
│           └── plotting.py   # Plotting functions
├── tests/
├── data/
├── notebooks/
└── output/                   # Generated plots and outputs
```

## Setup
1. Install dependencies:
   ```bash
   cd ESP_32/phase2
   python -m venv venv
   source venv/bin/activate  # Linux/macOS
   # OR
   venv\Scripts\activate    # Windows
   pip install -r requirements.txt
   ```

## Modules

### Preprocessing
- **loader.py**: Load and parse CSI data from JSONL files
  - `CSIDataLoader`: Loads data from files/directories, extracts amplitude, RSSI, timestamps

- **filters.py**: Noise removal and filtering
  - `CSIFilter`:
    - `hampel_filter`: Remove outliers
    - `moving_average`: Simple smoothing
    - `exponential_moving_average`: EMA filter
    - `lowpass_filter`, `highpass_filter`, `bandpass_filter`: Butterworth filters
    - `remove_static_component`: Remove DC offset
    - `denoise_wavelet`: Wavelet denoising (requires PyWavelets)

- **calibration.py**: Phase calibration and CSI matrix computation
  - `CSICalibration`:
    - `extract_csi_components`: Extract real/imaginary parts
    - `compute_amplitude`, `compute_phase`: Compute amplitude/phase
    - `calibrate_phase_linear`, `calibrate_phase_reference`: Phase calibration
    - `compute_csi_matrix`: Build amplitude matrix from records

### Feature Extraction
- **time_domain.py**: Time-domain features
  - `TimeDomainFeatures`:
    - Mean, std, variance, max, min, median
    - RMS, MAD, IQR, percentiles
    - Skewness, kurtosis (requires scipy)
    - Zero-crossing rate
    - `extract_all_features`: Extract all features

- **frequency_domain.py**: Frequency-domain features
  - `FrequencyDomainFeatures`:
    - `compute_psd`: Compute PSD with Welch's method
    - Spectral centroid, bandwidth, rolloff
    - Spectral flatness
    - Energy in specific frequency bands
    - `extract_all_features`: Extract all features

### Visualization
- **plotting.py**: Plotting and visualization
  - `CSIPlotter`:
    - `plot_csi_matrix`: Amplitude heatmap
    - `plot_amplitude_time_series`: Time-series plots
    - `plot_rssi_time_series`: RSSI plot
    - `plot_phase`: Phase plot
    - `plot_psd`: PSD plot
    - `plot_feature_comparison`: Feature comparison plots

## Example Usage
Run the example script to demonstrate the pipeline:
```bash
python process_csi.py
```

This will:
1. Load CSI data (or generate synthetic data if none is available)
2. Compute and plot the CSI matrix
3. Apply filtering
4. Extract time- and frequency-domain features
5. Save all plots to output/ directory

## Next Steps
Proceed to Phase 3: AI and Machine Learning for activity detection and classification
