
"""
EAGLE-Δ ML Models Module
Contains presence detection, occupancy counting, and activity recognition models
"""

import numpy as np
from typing import Dict, Any, Optional, Tuple
import logging
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


logger = logging.getLogger(__name__)


class PresenceDetector:
    """
    Human presence detection model
    Binary classification: present / not present
    """
    
    def __init__(self, model_type: str = "random_forest"):
        self.model_type = model_type
        self.model = None
        self.scaler = None
        self.is_trained = False
        
        if model_type == "random_forest":
            self.model = RandomForestClassifier(
                n_estimators=100, max_depth=10, random_state=42, n_jobs=-1
            )
        elif model_type == "svm":
            self.model = SVC(kernel='rbf', probability=True, random_state=42)
        elif model_type == "knn":
            self.model = KNeighborsClassifier(n_neighbors=5)
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        self.pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('classifier', self.model)
        ])
    
    def train(self, X: np.ndarray, y: np.ndarray):
        """
        Train the presence detector
        """
        logger.info(f"Training {self.model_type} presence detector on {len(X)} samples")
        self.pipeline.fit(X, y)
        self.is_trained = True
    
    def predict(self, X: np.ndarray) -&gt; np.ndarray:
        """
        Predict presence
        """
        if not self.is_trained:
            raise ValueError("Model not trained, call train() first")
        return self.pipeline.predict(X)
    
    def predict_proba(self, X: np.ndarray) -&gt; np.ndarray:
        """
        Predict probabilities
        """
        if not self.is_trained:
            raise ValueError("Model not trained, call train() first")
        return self.pipeline.predict_proba(X)
    
    def save(self, path: str):
        """
        Save model to disk
        """
        joblib.dump(self.pipeline, path)
        logger.info(f"Saved model to {path}")
    
    def load(self, path: str):
        """
        Load model from disk
        """
        self.pipeline = joblib.load(path)
        self.is_trained = True
        logger.info(f"Loaded model from {path}")


class ActivityRecognizer:
    """
    Human activity recognition model
    Classes: walking, standing, sitting
    """
    
    def __init__(self, model_type: str = "random_forest"):
        self.model_type = model_type
        self.model = None
        self.is_trained = False
        self.class_names = ["standing", "sitting", "walking"]
        
        if model_type == "random_forest":
            self.model = RandomForestClassifier(
                n_estimators=100, max_depth=10, random_state=42, n_jobs=-1
            )
        elif model_type == "svm":
            self.model = SVC(kernel='rbf', probability=True, random_state=42)
        elif model_type == "knn":
            self.model = KNeighborsClassifier(n_neighbors=5)
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        self.pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('classifier', self.model)
        ])
    
    def train(self, X: np.ndarray, y: np.ndarray):
        """
        Train the activity recognizer
        """
        logger.info(f"Training {self.model_type} activity recognizer on {len(X)} samples")
        self.pipeline.fit(X, y)
        self.is_trained = True
    
    def predict(self, X: np.ndarray) -&gt; np.ndarray:
        """
        Predict activity
        """
        if not self.is_trained:
            raise ValueError("Model not trained, call train() first")
        return self.pipeline.predict(X)
    
    def predict_proba(self, X: np.ndarray) -&gt; np.ndarray:
        """
        Predict probabilities
        """
        if not self.is_trained:
            raise ValueError("Model not trained, call train() first")
        return self.pipeline.predict_proba(X)
    
    def save(self, path: str):
        """
        Save model to disk
        """
        joblib.dump(self.pipeline, path)
        logger.info(f"Saved model to {path}")
    
    def load(self, path: str):
        """
        Load model from disk
        """
        self.pipeline = joblib.load(path)
        self.is_trained = True
        logger.info(f"Loaded model from {path}")

