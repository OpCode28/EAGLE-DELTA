
#!/usr/bin/env python3
"""
EAGLE-Δ Phase 3 Example: Model Training
Demonstrates training presence detection and activity recognition models
"""

import sys
import logging
from pathlib import Path

# Add phase2 and phase3 src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "phase2" / "src"))

import numpy as np
from sklearn.model_selection import train_test_split

from eagle_delta_ml.data.preprocessing import (
    CSIWindowProcessor,
    prepare_dataset_from_records
)
from eagle_delta_ml.models.classifiers import (
    PresenceDetector,
    ActivityRecognizer
)
from eagle_delta_ml.evaluation.metrics import Evaluator

from eagle_delta.preprocessing.calibration import CSICalibration
from eagle_delta.preprocessing.filters import CSIFilter


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_synthetic_csi(
    num_packets: int = 2000,
    num_subcarriers: int = 30,
    label: int = 0,
    activity_type: int = 0
) -&gt; list:
    """
    Generate synthetic CSI data for training/testing
    label 0: empty/not present
    label 1: present
    activity_type 0: standing
    activity_type 1: sitting
    activity_type 2: walking
    """
    records = []
    
    for i in range(num_packets):
        t = i / 100.0
        
        # Base signal (empty room)
        real = np.random.randn(num_subcarriers) * 8.0
        imag = np.random.randn(num_subcarriers) * 8.0
        
        # Add activity-specific signal
        if label == 1:
            if activity_type == 2:  # walking
                # Higher variance, periodic signal
                real += np.sin(t * 2 * np.pi * 2.0 + np.arange(num_subcarriers)*0.1) * 10.0
                imag += np.cos(t * 2 * np.pi * 2.0 + np.arange(num_subcarriers)*0.1) * 10.0
            elif activity_type == 0:  # standing
                # Smaller, slower variations
                real += np.sin(t * 2 * np.pi * 0.5) * 3.0
                imag += np.cos(t * 2 * np.pi * 0.5) * 3.0
            elif activity_type == 1:  # sitting
                # Minimal variation
                real += np.sin(t * 2 * np.pi * 0.2) * 1.0
                imag += np.cos(t * 2 * np.pi * 0.2) * 1.0
        
        # Interleave and convert to int8
        interleaved = np.empty(2 * num_subcarriers, dtype=np.int8)
        interleaved[::2] = np.clip(real, -128, 127).astype(np.int8)
        interleaved[1::2] = np.clip(imag, -128, 127).astype(np.int8)
        
        record = {
            "node_id": 1,
            "sequence_number": i,
            "timestamp_us": int(i * 10000),
            "rssi": -45,
            "channel": 6,
            "len": len(interleaved),
            "data": interleaved.tolist()
        }
        records.append(record)
    
    return records


def main():
    # Initialize components
    window_processor = CSIWindowProcessor(window_size=100, step_size=50)
    evaluator = Evaluator(output_dir=Path(__file__).parent / "output")
    models_dir = Path(__file__).parent / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Generate synthetic data
    logger.info("=== Step 1: Generating synthetic data ===")
    
    # Empty room (no presence)
    logger.info("Generating empty room data")
    empty_records = generate_synthetic_csi(num_packets=1500, label=0)
    
    # Present (standing)
    logger.info("Generating standing data")
    standing_records = generate_synthetic_csi(num_packets=1500, label=1, activity_type=0)
    
    # Present (sitting)
    logger.info("Generating sitting data")
    sitting_records = generate_synthetic_csi(num_packets=1500, label=1, activity_type=1)
    
    # Present (walking)
    logger.info("Generating walking data")
    walking_records = generate_synthetic_csi(num_packets=1500, label=1, activity_type=2)
    
    # Step 2: Train presence detector
    logger.info("\n=== Step 2: Training presence detector ===")
    
    # Prepare data: empty vs present
    empty_X, empty_y = prepare_dataset_from_records(
        empty_records, window_processor, label=0
    )
    present_X, present_y = prepare_dataset_from_records(
        standing_records + sitting_records + walking_records,
        window_processor,
        label=1
    )
    X_presence = np.vstack([empty_X, present_X])
    y_presence = np.hstack([empty_y, present_y])
    
    # Split into train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X_presence, y_presence, test_size=0.2, random_state=42
    )
    
    # Train and evaluate
    presence_model = PresenceDetector(model_type="random_forest")
    presence_model.train(X_train, y_train)
    y_pred = presence_model.predict(X_test)
    evaluator.evaluate_classification(
        y_test, y_pred,
        class_names=["not_present", "present"],
        prefix="presence_"
    )
    presence_model.save(str(models_dir / "presence_detector.pkl"))
    
    # Step 3: Train activity recognizer
    logger.info("\n=== Step 3: Training activity recognizer ===")
    
    # Prepare data: standing, sitting, walking
    standing_X, standing_y = prepare_dataset_from_records(
        standing_records, window_processor, label=0
    )
    sitting_X, sitting_y = prepare_dataset_from_records(
        sitting_records, window_processor, label=1
    )
    walking_X, walking_y = prepare_dataset_from_records(
        walking_records, window_processor, label=2
    )
    X_activity = np.vstack([standing_X, sitting_X, walking_X])
    y_activity = np.hstack([standing_y, sitting_y, walking_y])
    
    # Split into train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X_activity, y_activity, test_size=0.2, random_state=42
    )
    
    # Train and evaluate
    activity_model = ActivityRecognizer(model_type="random_forest")
    activity_model.train(X_train, y_train)
    y_pred = activity_model.predict(X_test)
    evaluator.evaluate_classification(
        y_test, y_pred,
        class_names=activity_model.class_names,
        prefix="activity_"
    )
    activity_model.save(str(models_dir / "activity_recognizer.pkl"))
    
    logger.info("\n=== Training complete! ===")


if __name__ == "__main__":
    main()

