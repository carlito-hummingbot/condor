#!/usr/bin/env python3
"""
Train Informed Trader Detection Model for MIDAS.

Uses LogisticRegression to detect informed traders based on:
  - OBI (Order Book Imbalance)
  - VPIN (Volume-synchronized Probability of Informed Trading)
  - trade_size_zscore (Z-score of recent trade sizes)
  - cancel_rate (How fast orders are being canceled)
  - obi_velocity (How fast OBI changes)

Usage:
  python train_informed_trader_model.py --data data/informed_trader_samples.csv
  python train_informed_trader_model.py --generate-synthetic  # Generate sample data
"""

import argparse
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import joblib
from pathlib import Path


# Feature names (must match midas_adverse_selection.py)
FEATURE_NAMES = [
    "obi",
    "vpin",
    "trade_size_zscore",
    "cancel_rate",
    "obi_velocity"
]

# Output path
MODEL_PATH = Path(__file__).parent.parent / "data" / "informed_trader_model.pkl"


def generate_synthetic_data(n_samples: int = 10000) -> pd.DataFrame:
    """
    Generate synthetic training data.

    Informed trader behavior (label=1):
      - High OBI velocity (rapid changes)
      - High VPIN (asymmetric trading)
      - Abnormal trade sizes (high z-score)
      - High cancel rate (spoofing)

    Normal market making (label=0):
      - Stable OBI
      - Low VPIN
      - Normal trade sizes
      - Low cancel rate
    """
    np.random.seed(42)

    data = []

    for _ in range(n_samples):
        # 50% chance of informed trader
        is_informed = np.random.choice([0, 1], p=[0.5, 0.5])

        if is_informed:
            # Informed trader features
            obi = np.random.uniform(-0.8, 0.8)  # Can be extreme
            vpin = np.random.uniform(0.3, 0.8)  # High VPIN
            trade_size_zscore = np.random.uniform(2.0, 5.0)  # Abnormal sizes
            cancel_rate = np.random.uniform(0.4, 0.9)  # High cancel rate
            obi_velocity = np.random.uniform(0.05, 0.2)  # Rapid changes
        else:
            # Normal market making features
            obi = np.random.uniform(-0.3, 0.3)  # Moderate OBI
            vpin = np.random.uniform(0.0, 0.3)  # Low VPIN
            trade_size_zscore = np.random.uniform(-1.5, 1.5)  # Normal sizes
            cancel_rate = np.random.uniform(0.0, 0.3)  # Low cancel rate
            obi_velocity = np.random.uniform(0.0, 0.03)  # Slow changes

        data.append({
            "obi": obi,
            "vpin": vpin,
            "trade_size_zscore": trade_size_zscore,
            "cancel_rate": cancel_rate,
            "obi_velocity": obi_velocity,
            "label": is_informed
        })

    df = pd.DataFrame(data)
    return df


def train_model(data_path: str = None, generate_synthetic: bool = False):
    """
    Train LogisticRegression model for informed trader detection.

    Args:
      - data_path: Path to CSV file with labeled data
      - generate_synthetic: If True, generate synthetic data for testing
    """
    if generate_synthetic:
        print("[MIDAS] Generating synthetic training data...")
        df = generate_synthetic_data(n_samples=10000)
        print(f"[MIDAS]   Generated {len(df)} samples")
        print(f"[MIDAS]   Informed trader ratio: {df['label'].mean():.2%}")
    elif data_path:
        print(f"[MIDAS] Loading data from {data_path}...")
        df = pd.read_csv(data_path)
        print(f"[MIDAS]   Loaded {len(df)} samples")
        print(f"[MIDAS]   Informed trader ratio: {df['label'].mean():.2%}")
    else:
        raise ValueError("Either --data or --generate-synthetic must be provided")

    # Prepare features and labels
    X = df[FEATURE_NAMES]
    y = df["label"]

    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"\n[MIDAS] Training model...")
    print(f"[MIDAS]   Train samples: {len(X_train)}")
    print(f"[MIDAS]   Test samples: {len(X_test)}")

    # Train LogisticRegression
    model = LogisticRegression(
        max_iter=1000,
        class_weight="balanced",  # Handle imbalanced data
        random_state=42
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]

    print(f"\n[MIDAS] Model Evaluation:")
    print(classification_report(y_test, y_pred, target_names=["Normal", "Informed"]))
    print(f"[MIDAS]   ROC AUC: {roc_auc_score(y_test, y_pred_proba):.4f}")

    # Feature importance (coefficients)
    print(f"\n[MIDAS] Feature Importance (coefficients):")
    for name, coef in zip(FEATURE_NAMES, model.coef_[0]):
        print(f"[MIDAS]   {name:25s}: {coef:+.4f}")

    # Save model
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"\n[MIDAS] ✅ Model saved to {MODEL_PATH}")

    # Save feature statistics (for normalization, if needed)
    stats_path = MODEL_PATH.parent / "feature_stats.pkl"
    stats = {
        "mean": X_train.mean(),
        "std": X_train.std()
    }
    joblib.dump(stats, stats_path)
    print(f"[MIDAS] ✅ Feature stats saved to {stats_path}")

    return model


def main():
    parser = argparse.ArgumentParser(description="Train Informed Trader Detection Model")
    parser.add_argument("--data", type=str, help="Path to CSV file with labeled data")
    parser.add_argument("--generate-synthetic", action="store_true",
                        help="Generate synthetic data for testing")
    args = parser.parse_args()

    train_model(data_path=args.data, generate_synthetic=args.generate_synthetic)


if __name__ == "__main__":
    main()
