#!/usr/bin/env python3
"""
MIDAS Adverse Selection Protection: ML-based informed trader detection.

Uses LogisticRegression to detect informed traders and cancel orders before they
"pick off" the market maker.

Features:
  - OBI (Order Book Imbalance)
  - VPIN (Volume-synchronized Probability of Informed Trading)
  - trade_size_zscore (Z-score of recent trade sizes)
  - cancel_rate (How fast orders are being canceled)
  - obi_velocity (How fast OBI changes)
"""

import numpy as np
import joblib
import os
from typing import List, Tuple, Optional


# Feature names (must match training)
FEATURE_NAMES = [
    "obi",
    "vpin",
    "trade_size_zscore",
    "cancel_rate",
    "obi_velocity"
]

# Model path
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "informed_trader_model.pkl")


class AdverseSelectionDetector:
    """Detect informed traders using pre-trained ML model."""

    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self.threshold = 0.7  # Probability threshold to cancel orders
        self._load_model()

    def _load_model(self):
        """Load pre-trained model from disk."""
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
            print(f"[MIDAS] Loaded informed trader model from {self.model_path}")
        else:
            print(f"[MIDAS] WARNING: Model not found at {self.model_path}")
            print(f"[MIDAS]   Run training first (see train_informed_trader_model.py)")
            self.model = None

    def compute_obi(self, orderbook: dict, depth: int = 5) -> float:
        """Compute Order Book Imbalance."""
        if not orderbook or "bids" not in orderbook or "asks" not in orderbook:
            return 0.0

        bid_volume = sum(level[1] for level in orderbook["bids"][:depth])
        ask_volume = sum(level[1] for level in orderbook["asks"][:depth])

        if bid_volume + ask_volume == 0:
            return 0.0

        obi = (bid_volume - ask_volume) / (bid_volume + ask_volume)
        return obi

    def compute_vpin(self, recent_trades: List[dict], bucket_size: int = 50) -> float:
        """
        Compute VPIN (Volume-synchronized Probability of Informed Trading).

        Simplified implementation:
          VPIN = |V_buy - V_sell| / (V_buy + V_sell)
        """
        if not recent_trades or len(recent_trades) < bucket_size:
            return 0.0

        # Get last bucket_size trades
        bucket = recent_trades[-bucket_size:]

        buy_volume = sum(t["amount"] for t in bucket if t.get("side") == "BUY")
        sell_volume = sum(t["amount"] for t in bucket if t.get("side") == "SELL")

        total_volume = buy_volume + sell_volume
        if total_volume == 0:
            return 0.0

        vpin = abs(buy_volume - sell_volume) / total_volume
        return vpin

    def compute_trade_size_zscore(self, recent_trades: List[dict], window: int = 50) -> float:
        """Compute Z-score of recent trade sizes (informed traders use specific sizes)."""
        if not recent_trades or len(recent_trades) < window:
            return 0.0

        # Get last window trades
        sizes = [t["amount"] for t in recent_trades[-window:]]
        mean_size = np.mean(sizes)
        std_size = np.std(sizes)

        if std_size == 0:
            return 0.0

        latest_size = recent_trades[-1]["amount"]
        zscore = (latest_size - mean_size) / std_size
        return zscore

    def compute_cancel_rate(self, recent_orders: List[dict], window: int = 20) -> float:
        """
        Compute cancel rate (spoofing detection).

        cancel_rate = number of canceled orders / total orders in window
        """
        if not recent_orders or len(recent_orders) < window:
            return 0.0

        # Get last window orders
        window_orders = recent_orders[-window:]
        canceled = sum(1 for o in window_orders if o.get("status") == "CANCELED")
        cancel_rate = canceled / len(window_orders)
        return cancel_rate

    def compute_obi_velocity(self, orderbook_history: List[dict], window: int = 5) -> float:
        """Compute OBI velocity (how fast OBI changes = informed trading)."""
        if not orderbook_history or len(orderbook_history) < window:
            return 0.0

        # Get last window order books
        obis = [self.compute_obi(ob) for ob in orderbook_history[-window:]]
        obi_velocity = np.diff(obis).mean()  # Average change per tick
        return obi_velocity

    def extract_features(self, orderbook: dict, recent_trades: List[dict],
                        recent_orders: List[dict], orderbook_history: List[dict]) -> np.ndarray:
        """Extract features for ML model."""
        obi = self.compute_obi(orderbook)
        vpin = self.compute_vpin(recent_trades)
        trade_size_zscore = self.compute_trade_size_zscore(recent_trades)
        cancel_rate = self.compute_cancel_rate(recent_orders)
        obi_velocity = self.compute_obi_velocity(orderbook_history)

        features = np.array([[obi, vpin, trade_size_zscore, cancel_rate, obi_velocity]])
        return features

    def predict(self, features: np.ndarray) -> Tuple[bool, float]:
        """
        Predict if informed trader is present.

        Returns:
          - is_informed: True if probability > threshold
          - probability: Probability of informed trader (0..1)
        """
        if self.model is None:
            # No model = assume NO informed trader
            return False, 0.0

        probability = self.model.predict_proba(features)[0][1]  # Probability of class 1
        is_informed = probability > self.threshold

        return is_informed, probability

    def should_cancel_orders(self, orderbook: dict, recent_trades: List[dict],
                             recent_orders: List[dict], orderbook_history: List[dict]) -> Tuple[bool, float]:
        """
        Main entry point: Should we cancel orders?

        Returns:
          - cancel: True if we should cancel all orders
          - probability: Probability of informed trader (for logging)
        """
        features = self.extract_features(orderbook, recent_trades, recent_orders, orderbook_history)
        cancel, probability = self.predict(features)

        if cancel:
            print(f"[MIDAS] ⚠️  Informed trader detected (probability={probability:.2f}) → canceling orders")

        return cancel, probability


# Training function (separate script)
def train_informed_trader_model(data_path: str, output_path: str = MODEL_PATH):
    """
    Train LogisticRegression model for informed trader detection.

    Data format (CSV):
      obi,trade_size_zscore,cancel_rate,obi_velocity,label
      0.2,1.5,0.3,0.01,0
      -0.4,2.1,0.8,0.05,1
      ...

    Label: 0 = no informed trader, 1 = informed trader
    """
    import pandas as pd
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report

    # Load data
    df = pd.read_csv(data_path)
    X = df[FEATURE_NAMES]
    y = df["label"]

    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train model
    model = LogisticRegression()
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    # Save model
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    joblib.dump(model, output_path)
    print(f"[MIDAS] Model saved to {output_path}")


if __name__ == "__main__":
    # Test detection
    detector = AdverseSelectionDetector()

    # Mock data
    orderbook = {
        "bids": [[100.0, 1.0], [99.9, 2.0]],
        "asks": [[100.1, 1.5], [100.2, 2.5]]
    }
    recent_trades = [
        {"side": "BUY", "amount": 1.0, "price": 100.0},
        {"side": "SELL", "amount": 1.5, "price": 100.1}
    ]
    recent_orders = [
        {"status": "FILLED"},
        {"status": "CANCELED"}
    ]
    orderbook_history = [orderbook] * 5

    cancel, prob = detector.should_cancel_orders(orderbook, recent_trades, recent_orders, orderbook_history)
    print(f"Cancel: {cancel}, Probability: {prob:.2f}")
