#!/usr/bin/env python3
"""
MIDAS Scan Routine: Compute trading signals (every 5 seconds, ~$0.005).

Reads cached data from manage_notes (midas:data:{pair}), computes:
  - Adaptive + asymmetric spread (volatility + trend-based)
  - OBI (Order Book Imbalance)
  - ML-based adverse selection protection
  - Inventory lean (LONG/SHORT/NEUTRAL)
  - Buy/sell limit order prices (spot + perps)
  - Cross-exchange arbitrage opportunities

Caches signal to manage_notes: midas:signal:{pair}
"""

import asyncio
import time
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime

# Import adverse selection detector
from .midas_adverse_selection import AdverseSelectionDetector


# Configuration
SPREAD_BASELINE = 0.0002  # 0.02% baseline spread
VOLATILITY_WINDOW = 5  # 5-period rolling stdev
TREND_WINDOW_SLOW = 50  # SMA_50 for trend detection
TREND_WINDOW_FAST = 20  # SMA_20 for trend detection
OBI_THRESHOLD = 0.3  # OBI >|0.3| = significant imbalance
MIN_MARGIN_RATIO = 1.5  # Minimum margin ratio (safety filter)


class MidasScan:
    """Compute MIDAS trading signals."""

    def __init__(self):
        self.detector = AdverseSelectionDetector()
        self.price_history = {}  # pair → list of mid prices
        self.data_hash_cache = {}  # pair → hash of cached data (skip recomputation)

    def compute_volatility(self, pair: str, current_mid: float) -> float:
        """Compute rolling volatility (stdev of mid-price)."""
        if pair not in self.price_history:
            self.price_history[pair] = []

        self.price_history[pair].append(current_mid)

        # Keep only last VOLATILITY_WINDOW prices
        if len(self.price_history[pair]) > VOLATILITY_WINDOW:
            self.price_history[pair] = self.price_history[pair][-VOLATILITY_WINDOW:]

        if len(self.price_history[pair]) < 2:
            return 0.0

        volatility = float(np.std(self.price_history[pair]))  # Explicitly cast to float
        return volatility

    def detect_trend(self, pair: str, current_mid: float) -> str:
        """
        Detect trend direction using SMA_20 vs SMA_50.

        Returns: "UPTREND", "DOWNTREND", or "SIDEWAYS"
        """
        if pair not in self.price_history:
            self.price_history[pair] = []

        prices = self.price_history[pair]

        if len(prices) < TREND_WINDOW_SLOW:
            return "SIDEWAYS"  # Not enough data

        sma_fast = np.mean(prices[-TREND_WINDOW_FAST:])
        sma_slow = np.mean(prices[-TREND_WINDOW_SLOW:])

        threshold = 0.001  # 0.1% threshold for trend detection

        if sma_fast > sma_slow * (1 + threshold):
            return "UPTREND"
        elif sma_fast < sma_slow * (1 - threshold):
            return "DOWNTREND"
        else:
            return "SIDEWAYS"

    def calculate_adaptive_spread(self, volatility: float) -> float:
        """Calculate volatility-adjusted spread."""
        if volatility > 0.001:  # HIGH vol (>0.1%)
            spread = 0.0005  # 0.05%
        elif volatility > 0.0005:  # MEDIUM vol
            spread = 0.0002  # 0.02%
        else:  # LOW vol
            spread = 0.0001  # 0.01%

        return spread

    def calculate_asymmetric_spread(self, base_spread: float, trend: str) -> Tuple[float, float]:
        """
        Calculate asymmetric spread (downtrend protection).

        Returns: (buy_spread, sell_spread)
        """
        if trend == "DOWNTREND":
            # Widen BUY (avoid getting filled LONG)
            buy_spread = base_spread * 2.0
            # Tighten SELL (get filled SHORT more often)
            sell_spread = base_spread * 0.5
        elif trend == "UPTREND":
            # Tighten BUY (get filled LONG)
            buy_spread = base_spread * 0.5
            # Widen SELL (avoid getting filled SHORT)
            sell_spread = base_spread * 2.0
        else:  # SIDEWAYS
            buy_spread = base_spread
            sell_spread = base_spread

        return buy_spread, sell_spread

    def compute_obi(self, orderbook: Dict, depth: int = 5) -> Optional[float]:
        """Compute Order Book Imbalance (OBI)."""
        if not orderbook or "bids" not in orderbook or "asks" not in orderbook:
            return None

        bid_volume = sum(level[1] for level in orderbook["bids"][:depth])
        ask_volume = sum(level[1] for level in orderbook["asks"][:depth])

        if bid_volume + ask_volume == 0:
            return 0.0

        obi = (bid_volume - ask_volume) / (bid_volume + ask_volume)
        return obi

    def determine_inventory_lean(self, obi: float) -> str:
        """
        Determine inventory lean based on OBI.

        Returns: "LONG", "SHORT", or "NEUTRAL"
        """
        if obi > OBI_THRESHOLD:  # More bids → price likely to rise
            return "SHORT"  # Lean SHORT (post more SELL orders)
        elif obi < -OBI_THRESHOLD:  # More asks → price likely to fall
            return "LONG"  # Lean LONG (post more BUY orders)
        else:
            return "NEUTRAL"

    def generate_order_prices(self, mid: float, buy_spread: float, sell_spread: float) -> Tuple[float, float]:
        """
        Generate buy/sell limit order prices.

        Returns: (buy_price, sell_price)
        """
        buy_price = mid * (1 - buy_spread / 2)
        sell_price = mid * (1 + sell_spread / 2)
        return buy_price, sell_price

    def check_safety_filters(self, margin_ratio: float, exchange_uptime: bool) -> bool:
        """
        Apply safety filters.

        Returns: True if SAFE to trade, False if should NOT trade.
        """
        # Check margin ratio
        if margin_ratio < MIN_MARGIN_RATIO:
            print(f"[MIDAS] ⚠️  Margin ratio too low: {margin_ratio:.2f} < {MIN_MARGIN_RATIO}")
            return False

        # Check exchange uptime
        if not exchange_uptime:
            print(f"[MIDAS] ⚠️  Exchange is down, pausing trading")
            return False

        return True

    def compute_signal(self, pair: str, cached_data: Dict) -> Optional[Dict]:
        """
        Compute MIDAS signal from cached data.

        Args:
          - pair: Trading pair (e.g, "BTC_USDT")
          - cached_data: Cached data from manage_notes (midas:data:{pair})

        Returns:
          - Signal dict or None if should not trade
        """
        # Extract data
        gateio_spot = cached_data.get("gateio_spot", {})
        gateio_perp = cached_data.get("gateio_perp", {})
        arbitrage_opportunities = cached_data.get("arbitrage", [])

        spot_mid = gateio_spot.get("mid")
        perp_mid = gateio_perp.get("mid")
        spot_orderbook = gateio_spot.get("orderbook")
        perp_orderbook = gateio_perp.get("orderbook")

        if not spot_mid or not perp_mid:
            print(f"[MIDAS] ⚠️  Missing mid price for {pair}")
            return None

        # 1. Compute volatility + trend
        volatility = self.compute_volatility(pair, spot_mid)
        trend = self.detect_trend(pair, spot_mid)

        # 2. Calculate adaptive + asymmetric spread
        base_spread = self.calculate_adaptive_spread(volatility)
        buy_spread, sell_spread = self.calculate_asymmetric_spread(base_spread, trend)

        # 3. Compute OBI
        spot_obi = self.compute_obi(spot_orderbook)
        perp_obi = self.compute_obi(perp_orderbook)

        # Handle None case for OBI
        if spot_obi is None:
            spot_obi = 0.0
        if perp_obi is None:
            perp_obi = 0.0

        # 4. Determine inventory lean
        inventory_lean = self.determine_inventory_lean(spot_obi)

        # 5. Generate order prices (spot + perps)
        spot_buy_price, spot_sell_price = self.generate_order_prices(spot_mid, buy_spread, sell_spread)
        perp_buy_price, perp_sell_price = self.generate_order_prices(perp_mid, buy_spread, sell_spread)

        # 6. ML-based adverse selection protection
        # (Mock recent_trades, recent_orders, orderbook_history for now)
        recent_trades = []  # TODO: Fetch from exchange API
        recent_orders = []  # TODO: Fetch from exchange API
        orderbook_history = [spot_orderbook] if spot_orderbook else []  # TODO: Maintain history

        cancel_orders, informed_prob = self.detector.should_cancel_orders(
            spot_orderbook, recent_trades, recent_orders, orderbook_history
        )

        # 7. Safety filters (mock margin_ratio, exchange_uptime for now)
        margin_ratio = 2.0  # TODO: Fetch from exchange API
        exchange_uptime = True  # TODO: Check WebSocket connection
        safe_to_trade = self.check_safety_filters(margin_ratio, exchange_uptime)

        if not safe_to_trade:
            return None

        # 8. Build signal
        signal = {
            "pair": pair,
            "timestamp": time.time(),
            "spot": {
                "mid": spot_mid,
                "buy_price": spot_buy_price,
                "sell_price": spot_sell_price,
                "obi": spot_obi,
            },
            "perp": {
                "mid": perp_mid,
                "buy_price": perp_buy_price,
                "sell_price": perp_sell_price,
                "obi": perp_obi,
            },
            "volatility": volatility,
            "trend": trend,
            "spread": {
                "base": base_spread,
                "buy": buy_spread,
                "sell": sell_spread,
            },
            "inventory_lean": inventory_lean,
            "adverse_selection": {
                "cancel_orders": cancel_orders,
                "informed_probability": informed_prob,
            },
            "arbitrage": arbitrage_opportunities,
            "safe_to_trade": safe_to_trade,
        }

        return signal

    async def run(self, pairs: List[str] = ["BTC_USDT", "ETH_USDT", "SOL_USDT"]):
        """Main loop: compute signals every 5 seconds."""
        while True:
            for pair in pairs:
                # TODO: Read cached data from manage_notes
                # cached_data = await read_from_manage_notes(f"midas:data:{pair}")
                cached_data = {
                    "gateio_spot": {"mid": 100.0, "orderbook": {"bids": [[99.9, 1.0]], "asks": [[100.1, 1.0]]}},
                    "gateio_perp": {"mid": 100.5, "orderbook": {"bids": [[100.4, 1.0]], "asks": [[100.6, 1.0]]}},
                    "arbitrage": []
                }  # Mock data

                # Check data hash (skip recomputation if unchanged)
                data_hash = hash(str(cached_data))
                if pair in self.data_hash_cache and self.data_hash_cache[pair] == data_hash:
                    print(f"[MIDAS] {pair} | Data unchanged, reusing cached signal")
                    continue

                # Compute signal
                signal = self.compute_signal(pair, cached_data)

                if signal:
                    # Cache to manage_notes
                    # TODO: await cache_to_manage_notes(f"midas:signal:{pair}", signal)
                    print(f"[MIDAS] {pair} | Spot: {signal['spot']['mid']:.4f} | Perp: {signal['perp']['mid']:.4f} | Trend: {signal['trend']} | Lean: {signal['inventory_lean']}")

                    # Update data hash cache
                    self.data_hash_cache[pair] = data_hash
                else:
                    print(f"[MIDAS] {pair} | No signal (safety filters triggered)")

            await asyncio.sleep(5)


async def main():
    """Entry point for testing."""
    scanner = MidasScan()
    await scanner.run()


if __name__ == "__main__":
    asyncio.run(main())
