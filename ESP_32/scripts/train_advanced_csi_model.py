import json
import os
import glob
import argparse
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib

def extract_features(window_frames):
    """
    Extract statistical features from a time window of frames, grouping by node_id.
    Supports up to 4 nodes to leverage spatial diversity.
    """
    features = []
    
    # Extract features for up to 4 nodes
    for node_id in range(1, 5):
        node_frames = [f for f in window_frames if f.get('node_id') == node_id]
        if not node_frames:
            # Pad with zeros if this node didn't transmit in this window
            features.extend([0.0] * 8)
            continue
            
        mean_amps = [f['mean_amp'] for f in node_frames if 'mean_amp' in f]
        std_amps = [f['std_amp'] for f in node_frames if 'std_amp' in f]
        rssis = [f['rssi'] for f in node_frames if 'rssi' in f]
        
        if not mean_amps:
            features.extend([0.0] * 8)
            continue
            
        features.extend([
            np.mean(mean_amps),
            np.std(mean_amps),
            np.max(mean_amps),
            np.min(mean_amps),
            np.mean(std_amps),
            np.std(std_amps),
            np.mean(rssis),
            np.std(rssis) if len(rssis) > 1 else 0.0
        ])
        
    features.append(len(window_frames)) # Total packets in window
    return features

def parse_label(label_str):
    """Map string labels to integer person count."""
    mapping = {
        'zero': 0, 'empty': 0, '0': 0,
        'one': 1, '1': 1,
        'two': 2, '2': 2,
        'three': 3, '3': 3,
        'four': 4, '4': 4
    }
    label_lower = label_str.lower()
    for key, val in mapping.items():
        if key in label_lower:
            return val
    return -1

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', default='data/csi', help='Directory containing JSONL files')
    parser.add_argument('--output-model', default='csi_advanced_model.joblib', help='Output model path')
    parser.add_argument('--window-size', type=int, default=20, help='Number of frames per window')
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"Data directory {data_dir} does not exist.")
        return

    X = []
    y = []

    for file_path in data_dir.glob('*.jsonl'):
        print(f"Processing {file_path}...")
        frames = []
        with open(file_path, 'r') as f:
            for line in f:
                try:
                    frames.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        
        # Group into windows
        for i in range(0, len(frames), args.window_size):
            window = frames[i:i+args.window_size]
            if len(window) < args.window_size // 2:
                continue
                
            label_str = window[0].get('label', '')
            person_count = parse_label(label_str)
            if person_count == -1:
                continue
                
            features = extract_features(window)
            if features is not None:
                X.append(features)
                y.append(person_count)

    if not X:
        print("No valid training data found.")
        return

    X = np.array(X)
    y = np.array(y)

    print(f"Extracted {len(X)} samples.")
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Classifier...")
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X_train, y_train)
    
    print("Evaluating...")
    y_pred = clf.predict(X_test)
    print(classification_report(y_test, y_pred, zero_division=0))
    
    joblib.dump(clf, args.output_model)
    print(f"Model saved to {args.output_model}")

if __name__ == '__main__':
    main()
