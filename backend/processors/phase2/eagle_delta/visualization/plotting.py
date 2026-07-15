
"""
EAGLE-Δ Visualization Module
Provides plotting functions for CSI data
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
from typing import Optional, Tuple, List, Union
from pathlib import Path
import logging


logger = logging.getLogger(__name__)


class CSIPlotter:
    """
    Provides methods to visualize CSI data and features
    """
    
    def __init__(self, output_dir: Union[str, Path] = "output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def plot_csi_matrix(
        self,
        csi_matrix: np.ndarray,
        title: str = "CSI Amplitude Matrix",
        filename: str = "csi_matrix.png"
    ):
        """
        Plot CSI amplitude matrix as heatmap
        """
        if len(csi_matrix) == 0 or len(csi_matrix.shape) != 2:
            logger.warning("Invalid CSI matrix, cannot plot")
            return
        
        plt.figure(figsize=(12, 6))
        im = plt.imshow(
            csi_matrix.T,
            aspect='auto',
            cmap='viridis',
            origin='lower'
        )
        plt.colorbar(im, label='Amplitude')
        plt.title(title)
        plt.xlabel('Packet Index')
        plt.ylabel('Subcarrier Index')
        plt.tight_layout()
        out_path = self.output_dir / filename
        plt.savefig(out_path, dpi=150)
        plt.close()
        logger.info(f"Saved CSI matrix plot to {out_path}")
    
    def plot_amplitude_time_series(
        self,
        amplitudes: np.ndarray,
        timestamps: Optional[np.ndarray] = None,
        subcarrier_indices: Optional[List[int]] = None,
        title: str = "CSI Amplitude Over Time",
        filename: str = "amplitude_series.png"
    ):
        """
        Plot CSI amplitude time-series
        """
        if len(amplitudes) == 0:
            logger.warning("No amplitude data to plot")
            return
        
        plt.figure(figsize=(14, 5))
        
        if len(amplitudes.shape) == 2:
            num_sub = amplitudes.shape[1]
            if subcarrier_indices is None:
                # Plot a few subcarriers
                subcarrier_indices = [0, num_sub//4, num_sub//2, 3*num_sub//4]
            
            for idx in subcarrier_indices:
                if idx < num_sub:
                    label = f"Subcarrier {idx}"
                    x = timestamps if timestamps is not None else np.arange(len(amplitudes))
                    plt.plot(x, amplitudes[:, idx], label=label, alpha=0.8)
        else:
            x = timestamps if timestamps is not None else np.arange(len(amplitudes))
            plt.plot(x, amplitudes, label='Amplitude')
        
        plt.title(title)
        plt.xlabel('Time' if timestamps is not None else 'Packet Index')
        plt.ylabel('Amplitude')
        plt.legend(loc='best')
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        out_path = self.output_dir / filename
        plt.savefig(out_path, dpi=150)
        plt.close()
        logger.info(f"Saved amplitude time-series plot to {out_path}")
    
    def plot_rssi_time_series(
        self,
        rssis: np.ndarray,
        timestamps: Optional[np.ndarray] = None,
        title: str = "RSSI Over Time",
        filename: str = "rssi_series.png"
    ):
        """
        Plot RSSI time-series
        """
        plt.figure(figsize=(14, 4))
        x = timestamps if timestamps is not None else np.arange(len(rssis))
        plt.plot(x, rssis, color='red', label='RSSI')
        plt.title(title)
        plt.xlabel('Time' if timestamps is not None else 'Packet Index')
        plt.ylabel('RSSI (dBm)')
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        out_path = self.output_dir / filename
        plt.savefig(out_path, dpi=150)
        plt.close()
        logger.info(f"Saved RSSI plot to {out_path}")
    
    def plot_phase(
        self,
        phase: np.ndarray,
        title: str = "CSI Phase",
        filename: str = "phase.png"
    ):
        """
        Plot CSI phase
        """
        plt.figure(figsize=(12, 5))
        plt.plot(phase, label='Phase')
        plt.title(title)
        plt.xlabel('Subcarrier Index')
        plt.ylabel('Phase (radians)')
        plt.grid(True, alpha=0.3)
        plt.legend()
        plt.tight_layout()
        out_path = self.output_dir / filename
        plt.savefig(out_path, dpi=150)
        plt.close()
        logger.info(f"Saved phase plot to {out_path}")
    
    def plot_psd(
        self,
        frequencies: np.ndarray,
        psd: np.ndarray,
        title: str = "Power Spectral Density",
        filename: str = "psd.png"
    ):
        """
        Plot Power Spectral Density
        """
        plt.figure(figsize=(12, 5))
        plt.semilogy(frequencies, psd)
        plt.title(title)
        plt.xlabel('Frequency (Hz)')
        plt.ylabel('Power Spectral Density')
        plt.grid(True, alpha=0.3, which='both')
        plt.tight_layout()
        out_path = self.output_dir / filename
        plt.savefig(out_path, dpi=150)
        plt.close()
        logger.info(f"Saved PSD plot to {out_path}")
    
    def plot_feature_comparison(
        self,
        features_dict: dict,
        title: str = "Feature Comparison",
        filename: str = "features.png"
    ):
        """
        Plot a comparison of extracted features
        """
        feature_names = list(features_dict.keys())
        num_features = len(feature_names)
        
        fig, axes = plt.subplots(
            num_features, 1, figsize=(12, 3*num_features), squeeze=False)
        axes = axes.flatten()
        
        for idx, (name, values) in enumerate(features_dict.items()):
            ax = axes[idx]
            values = np.asarray(values)
            if len(values.shape) == 2:
                ax.plot(values[:, 0], label=name)
            else:
                ax.plot(values, label=name)
            ax.set_title(name)
            ax.legend()
            ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        out_path = self.output_dir / filename
        plt.savefig(out_path, dpi=150)
        plt.close()
        logger.info(f"Saved feature plot to {out_path}")

