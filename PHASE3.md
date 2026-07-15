
# EAGLE-Δ Project - Phase 3: AI and Machine Learning

## Overview
Phase 3 implements AI/ML models for:
- Human presence detection (present / not present)
- Activity recognition (standing / sitting / walking)
- Future capabilities: occupancy counting, vital signs (respiration/heartbeat)

## Directory Structure
```
ESP_32/phase3/
├── requirements.txt          # Python dependencies
├── train_model.py            # Example training script
├── src/
│   └── eagle_delta_ml/
│       ├── __init__.py
│       ├── data/
│       │   ├── __init__.py
│       │   └── preprocessing.py  # Windowing and data preparation
│       ├── models/
│       │   ├── __init__.py
│       │   └── classifiers.py    # Presence/activity models
│       ├── evaluation/
│       │   ├── __init__.py
│       │   └── metrics.py       # Evaluation and plotting
│       └── inference/
│           ├── __init__.py
│           └── pipeline.py      # End-to-end inference pipeline
├── tests/
├── data/
├── models/                    # Trained models stored here
├── notebooks/
└── output/                    # Plots, logs, etc.
```

## Setup
1. Install dependencies:
   ```bash
   cd ESP_32/phase3
   python -m venv venv
   source venv/bin/activate  # Linux/macOS
   # OR
   venv\Scripts\activate    # Windows
   pip install -r requirements.txt
   ```

## Modules

### Data Preparation
- **preprocessing.py**: Handles windowing, feature extraction
  - `CSIWindowProcessor`: Creates sliding windows and extracts features
  - `prepare_dataset_from_records`: Prepares datasets from CSI records

### Models
- **classifiers.py**:
  - `PresenceDetector`: Binary classifier (present / not present)
  - `ActivityRecognizer`: Multi-class classifier (standing / sitting / walking)
  - Supported models: Random Forest, SVM, KNN
  - Uses standardization and sklearn Pipeline
  - Model saving/loading via joblib

### Evaluation
- **metrics.py**:
  - `Evaluator`: Computes accuracy, precision, recall, F1 score
  - Generates confusion matrices
  - Prints classification reports

### Inference
- **pipeline.py**:
  - `EAGLEDeltaPipeline`: End-to-end inference pipeline
  - Manages sliding window buffer
  - Preprocesses incoming CSI data
  - Runs presence detection and activity recognition
  - Returns results with probabilities

## Example Usage
### Training
Run the example training script:
```bash
python train_model.py
```
This will:
- Generate synthetic CSI data for different activities
- Train and evaluate a presence detector
- Train and evaluate an activity recognizer
- Save models to models/ directory
- Save evaluation plots to output/ directory

### Inference
```python
from eagle_delta_ml.inference.pipeline import EAGLEDeltaPipeline

# Initialize pipeline
pipeline = EAGLEDeltaPipeline(
    presence_model_path="models/presence_detector.pkl",
    activity_model_path="models/activity_recognizer.pkl"
)

# Process incoming CSI records
for record in incoming_csi_stream:
    result = pipeline.process_csi_record(record)
    if result:
        print(result)
```

## Next Steps
- Proceed to Phase 4 (Visualization)
- Proceed to Phase 5 (Applications)
- Proceed to Phase 6 (Backend)
- Proceed to Phase 7 (Deployment)
