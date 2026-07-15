
"""
EAGLE-Δ ML Evaluation Module
Provides evaluation metrics and visualization
"""

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path
from typing import Dict, Any, Optional
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)
import logging


logger = logging.getLogger(__name__)


class Evaluator:
    """
    Evaluates ML models for CSI-based sensing
    """
    
    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = Path(output_dir) if output_dir else Path("output")
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def evaluate_classification(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        class_names: Optional[list] = None,
        prefix: str = ""
    ) -&gt; Dict[str, float]:
        """
        Evaluate classification performance
        """
        results = {}
        
        # Accuracy
        results['accuracy'] = accuracy_score(y_true, y_pred)
        
        # Precision, recall, F1 (macro)
        results['precision_macro'] = precision_score(y_true, y_pred, average='macro', zero_division=0)
        results['recall_macro'] = recall_score(y_true, y_pred, average='macro', zero_division=0)
        results['f1_macro'] = f1_score(y_true, y_pred, average='macro', zero_division=0)
        
        # Precision, recall, F1 (weighted)
        results['precision_weighted'] = precision_score(y_true, y_pred, average='weighted', zero_division=0)
        results['recall_weighted'] = recall_score(y_true, y_pred, average='weighted', zero_division=0)
        results['f1_weighted'] = f1_score(y_true, y_pred, average='weighted', zero_division=0)
        
        # Log results
        logger.info("=== Classification Results ===")
        for key, value in results.items():
            logger.info(f"  {key:20s}: {value:.4f}")
        
        # Print classification report
        logger.info("\nClassification Report:")
        logger.info(classification_report(y_true, y_pred, target_names=class_names, zero_division=0))
        
        # Plot confusion matrix
        self.plot_confusion_matrix(y_true, y_pred, class_names, prefix=prefix)
        
        return results
    
    def plot_confusion_matrix(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        class_names: Optional[list] = None,
        prefix: str = ""
    ):
        """
        Plot confusion matrix
        """
        cm = confusion_matrix(y_true, y_pred)
        
        fig, ax = plt.subplots(figsize=(8, 6))
        im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
        ax.figure.colorbar(im, ax=ax)
        
        if class_names is None:
            class_names = [str(i) for i in range(len(cm))]
        
        ax.set(
            xticks=np.arange(len(class_names)),
            yticks=np.arange(len(class_names)),
            xticklabels=class_names,
            yticklabels=class_names,
            title='Confusion Matrix',
            ylabel='True Label',
            xlabel='Predicted Label'
        )
        
        # Rotate tick labels
        plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")
        
        # Annotate matrix with counts
        fmt = 'd'
        thresh = cm.max() / 2.
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                ax.text(
                    j, i, format(cm[i, j], fmt),
                    ha="center", va="center",
                    color="white" if cm[i, j] &gt; thresh else "black"
                )
        
        fig.tight_layout()
        filename = f"{prefix}confusion_matrix.png" if prefix else "confusion_matrix.png"
        out_path = self.output_dir / filename
        plt.savefig(out_path, dpi=150, bbox_inches='tight')
        plt.close()
        logger.info(f"Saved confusion matrix to {out_path}")

