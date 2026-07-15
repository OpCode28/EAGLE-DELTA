
#!/usr/bin/env python3
"""
EAGLE-Δ Phase 2 Example: CSI Signal Processing
Demonstrates loading, filtering, and visualizing CSI data
"""

import sys
import logging
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from eagle_delta.preprocessing.loader import CSIDataLoader
from eagle_delta.preprocessing.filters import CSIFilter
from eagle_delta.preprocessing.calibration import CSICalibration
from eagle_delta.features.time_domain import TimeDomainFeatures
from eagle_delta.features.frequency_domain import FrequencyDomainFeatures
from eagle_delta.visualization.plotting import CSIPlotter


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    # Paths
    DATA_DIR = Path(__file__).parent.parent / "data" / "csi"
    OUTPUT_DIR = Path(__file__).parent / "output"
    
    # Initialize components
    loader = CSIDataLoader()
    plotter = CSIPlotter(output_dir=OUTPUT_DIR)
    
    # Step 1: Load data
    logger.info("=== Step 1: Loading CSI data ===")
    try:
        if DATA_DIR.exists():
            loader.load_directory(DATA_DIR)
        else:
            logger.warning("Data directory doesn't exist, skipping loading")
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        return
    
    if len(loader.records) == 0:
        logger.warning("No data loaded, generating synthetic data for demo")
        # Generate synthetic data for demo purposes
        import numpy as np
        
        num_packets = 1000
        num_subcarriers = 30
        
        # Create synthetic CSI data
        for i in range(num_packets):
            t = i / 100.0
            real = (np.random.randn(num_subcarriers) * 10 + np.sin(t * 2 * np.pi * 1.0) * 5).astype(np.int8)
            imag = (np.random.randn(num_subcarriers) * 10 + np.cos(t * 2 * np.pi * 1.0) * 5).astype(np.int8)
            interleaved = np.empty(2*num_subcarriers, dtype=np.int8)
            interleaved[::2] = real
            interleaved[1::2] = imag
            
            fake_record = {
                "node_id": 1,
                "sequence_number": i,
                "timestamp_us": int(i * 10000),
                "rssi": -45,
                "channel": 6,
                "len": len(interleaved),
                "data": interleaved.tolist()
            }
            loader.records.append(fake_record)
    
    # Step 2: Extract CSI matrix
    logger.info("=== Step 2: Extracting CSI matrix ===")
    csi_matrix = CSICalibration.compute_csi_matrix(loader.records, node_id=1)
    
    if len(csi_matrix) == 0:
        logger.warning("No CSI data available")
        return
    
    # Step 3: Plot raw CSI matrix
    plotter.plot_csi_matrix(
        csi_matrix,
        title="Raw CSI Amplitude Matrix",
        filename="csi_matrix_raw.png"
    )
    
    # Step 4: Apply filtering
    logger.info("=== Step 3: Applying filtering ===")
    filtered_matrix = csi_matrix.copy()
    for sc_idx in range(filtered_matrix.shape[1]):
        filtered_matrix[:, sc_idx] = CSIFilter.hampel_filter(
            filtered_matrix[:, sc_idx], window_size=5
        )[0]
        filtered_matrix[:, sc_idx] = CSIFilter.lowpass_filter(
            filtered_matrix[:, sc_idx], cutoff=20.0, fs=100.0
        )
        filtered_matrix[:, sc_idx] = CSIFilter.remove_static_component(
            filtered_matrix[:, sc_idx]
        )
    
    # Plot filtered CSI matrix
    plotter.plot_csi_matrix(
        filtered_matrix,
        title="Filtered CSI Amplitude Matrix",
        filename="csi_matrix_filtered.png"
    )
    
    # Step 5: Extract time-series for a single subcarrier
    if filtered_matrix.shape[1] &gt; 0:
        sc_index = filtered_matrix.shape[1] // 2
        amplitude_series = filtered_matrix[:, sc_index]
        
        # Plot amplitude time-series
        plotter.plot_amplitude_time_series(
            amplitude_series,
            title=f"Filtered Amplitude (Subcarrier {sc_index})",
            filename="amplitude_series_filtered.png"
        )
        
        # Step 6: Extract features
        logger.info("=== Step 4: Extracting features ===")
        time_features = TimeDomainFeatures.extract_all_features(amplitude_series)
        freq_features = FrequencyDomainFeatures.extract_all_features(amplitude_series)
        
        logger.info("Time-domain features:")
        for name, value in time_features.items():
            logger.info(f"  {name:15s}: {value:.4f}")
        
        logger.info("Frequency-domain features:")
        for name, value in freq_features.items():
            logger.info(f"  {name:25s}: {value:.4f}")
        
        # Step 7: Plot PSD
        logger.info("=== Step 5: Plotting PSD ===")
        f, Pxx = FrequencyDomainFeatures.compute_psd(amplitude_series)
        plotter.plot_psd(f, Pxx, filename="psd_example.png")
    
    # Step 8: Plot RSSI
    rssis = loader.get_rssis(node_id=1)
    if len(rssis) &gt; 0:
        plotter.plot_rssi_time_series(rssis)
    
    logger.info("=== Processing complete! ===")


if __name__ == "__main__":
    main()

