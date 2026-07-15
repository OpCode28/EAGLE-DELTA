
"""
EAGLE-Δ Time-Domain Feature Extraction Module
Extracts time-domain features from CSI data
"""

import numpy as np
from typing import Dict, List, Optional
import logging


logger = logging.getLogger(__name__)


class TimeDomainFeatures:
    """
    Extracts time-domain features from CSI amplitude time-series
    """
    
    @staticmethod
    def mean(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute mean amplitude"""
        return np.mean(data, axis=axis)
    
    @staticmethod
    def std(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute standard deviation"""
        return np.std(data, axis=axis)
    
    @staticmethod
    def variance(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute variance"""
        return np.var(data, axis=axis)
    
    @staticmethod
    def max_value(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute maximum value"""
        return np.max(data, axis=axis)
    
    @staticmethod
    def min_value(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute minimum value"""
        return np.min(data, axis=axis)
    
    @staticmethod
    def median(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute median value"""
        return np.median(data, axis=axis)
    
    @staticmethod
    def percentile(data: np.ndarray, percentile: float, axis: Optional[int] = None) -> np.ndarray:
        """Compute percentile value"""
        return np.percentile(data, percentile, axis=axis)
    
    @staticmethod
    def kurtosis(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute kurtosis (requires scipy)"""
        try:
            from scipy.stats import kurtosis
            return kurtosis(data, axis=axis)
        except ImportError:
            logger.warning("scipy not available, returning zeros")
            return np.zeros(data.shape[:-1]) if axis is not None else 0.0
    
    @staticmethod
    def skewness(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute skewness (requires scipy)"""
        try:
            from scipy.stats import skew
            return skew(data, axis=axis)
        except ImportError:
            logger.warning("scipy not available, returning zeros")
            return np.zeros(data.shape[:-1]) if axis is not None else 0.0
    
    @staticmethod
    def rms(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute root mean square"""
        return np.sqrt(np.mean(data**2, axis=axis))
    
    @staticmethod
    def mad(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute median absolute deviation"""
        median = np.median(data, axis=axis, keepdims=True)
        return np.median(np.abs(data - median), axis=axis)
    
    @staticmethod
    def iqr(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute interquartile range"""
        q75 = np.percentile(data, 75, axis=axis)
        q25 = np.percentile(data, 25, axis=axis)
        return q75 - q25
    
    @staticmethod
    def zero_crossing_rate(data: np.ndarray, axis: Optional[int] = None) -> np.ndarray:
        """Compute zero-crossing rate"""
        if axis is None:
            data = data.flatten()
            crossings = np.sum((data[:-1] * data[1:]) < 0)
            return crossings / len(data)
        else:
            crossings = np.sum((np.take(data, np.arange(data.shape[axis]-1), axis=axis) * 
                               np.take(data, np.arange(1, data.shape[axis]), axis=axis)) < 0, axis=axis)
            return crossings / (data.shape[axis]-1)
    
    @staticmethod
    def extract_all_features(
        data: np.ndarray,
        axis: int = 0
    ) -> Dict[str, np.ndarray]:
        """
        Extract all time-domain features
        Returns a dictionary of feature names to feature values
        """
        features = {}
        
        features['mean'] = TimeDomainFeatures.mean(data, axis=axis)
        features['std'] = TimeDomainFeatures.std(data, axis=axis)
        features['variance'] = TimeDomainFeatures.variance(data, axis=axis)
        features['max'] = TimeDomainFeatures.max_value(data, axis=axis)
        features['min'] = TimeDomainFeatures.min_value(data, axis=axis)
        features['median'] = TimeDomainFeatures.median(data, axis=axis)
        features['rms'] = TimeDomainFeatures.rms(data, axis=axis)
        features['mad'] = TimeDomainFeatures.mad(data, axis=axis)
        features['iqr'] = TimeDomainFeatures.iqr(data, axis=axis)
        features['p25'] = TimeDomainFeatures.percentile(data, 25, axis=axis)
        features['p75'] = TimeDomainFeatures.percentile(data, 75, axis=axis)
        features['p90'] = TimeDomainFeatures.percentile(data, 90, axis=axis)
        
        return features

