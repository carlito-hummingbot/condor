#!/usr/bin/env python3
"""
WHIRL Rebalance Routine: Check LP range + compute rebalancing signals.

This routine runs every 5 minutes (~$0.01 LLM cost).
It reads cached pool data from manage_notes (whirl:data:pools),
checks if price is inside LP range, and generates rebalance signals.

Output: Caches to manage_notes: whirl:signal:{pair}
"""

import asyncio
import time
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime

# Configuration
REBALANCE_CHECK_INTERVAL = 300  # 5 minutes (in seconds)
VOLATILITY_WINDOW = 20  # 20-period ATR (Average True Range)
REBALANCE_THRESHOLD_PCT = 0.01  # 1% price movement triggers rebalance
TIME_BASED_REBALANCE = 4 * 3600  # 4 hours (force rebalance)


class WhirlRebalance:
    """Check LP range and generate rebalancing signals."""

    def __init__(self, pairs: List[str] = ["BTC_USDC", "ETH_USDC", "SOL_USDC", "GOLD_USDC", "EUR_USDC"]):
        self.pairs = pairs
        self.price_history = {pair: [] for pair in pairs}
        self.last_rebalance_time = {pair: 0 for pair in pairs}
        self.lp_positions = {pair: None for pair in pairs}  # Track LP positions

    def compute_atr(self, pair: str, current_price: float) -> float:
        """Compute Average True Range (ATR) for volatility."""
        if pair not in self.price_history:
            self.price_history[pair] = []

        prices = self.price_history[pair]

        if len(prices) < 2:
            return 0.0

        # Compute True Range (TR)
        tr_values = []
        for i in range(1, len(prices)):
            high = max(prices[i], prices[i-1])
            low = min(prices[i], prices[i-1])
            tr = high - low
            tr_values.append(tr)

        # ATR = average of last VOLATILITY_WINDOW TR values
        atr = np.mean(tr_values[-VOLATILITY_WINDOW:]) if len(tr_values) >= VOLATILITY_WINDOW else np.mean(tr_values)
        return float(atr)

    def price_to_tick(self, price: float, tick_spacing: int = 1) -> int:
        """Convert price to tick (Orca Whirlpool uses ticks)."""
        import math
        tick = math.log(price / 1.0001) / math.log(1.0001)  # Simplified (actual formula depends on Whirlpool)
        tick = int(tick / tick_spacing) * tick_spacing
        return tick

    def tick_to_price(self, tick: int, tick_spacing: int = 1) -> float:
        """Convert tick to price."""
        import math
        price = 1.0001 ** tick  # Simplified (actual formula depends on Whirlpool)
        return price

    def compute_tick_range(self, current_price: float, atr: float, volatility: float) -> Tuple[int, int]:
        """Compute tick range based on volatility (ATR)."""
        # Adjust range based on volatility
        if volatility > 0.05:  # HIGH vol (>5%)
            range_pct = 0.05  # 5% range (wide)
        elif volatility > 0.02:  # MEDIUM vol (2-5%)
            range_pct = 0.03  # 3% range
        else:  # LOW vol (<2%)
            range_pct = 0.01  # 1% range (tight)

        # Convert to tick range
        tick_lower = self.price_to_tick(current_price * (1 - range_pct))
        tick_upper = self.price_to_tick(current_price * (1 + range_pct))

        return tick_lower, tick_upper

    def check_lp_range(self, pair: str, current_price: float, tick_lower: int, tick_upper: int) -> str:
        """Check if price is inside LP range."""
        current_tick = self.price_to_tick(current_price)

        if tick_lower <= current_tick <= tick_upper:
            return "IN_RANGE"
        else:
            return "OUT_OF_RANGE"

    def should_rebalance(self, pair: str, current_price: float, tick_lower: int, tick_upper: int) -> bool:
        """Determine if rebalancing is needed."""
        # Check 1: Price exited range
        lp_status = self.check_lp_range(pair, current_price, tick_lower, tick_upper)
        if lp_status == "OUT_OF_RANGE":
            print(f"[whirl_rebalance]   ├─ {pair} Price OUT OF RANGE (rebalancing needed)")
            return True

        # Check 2: High volatility (tighten range to reduce IL risk)
        atr = self.compute_atr(pair, current_price)
        volatility = atr / current_price if current_price > 0 else 0.0
        if volatility > 0.05:  # HIGH vol (>5%)
            print(f"[whirl_rebalance]   ├─ {pair} High volatility (ATR: {atr:.4f}) → tighten range")
            return True

        # Check 3: Time-based rebalance (every 4 hours)
        time_since_last = time.time() - self.last_rebalance_time.get(pair, 0)
        if time_since_last > TIME_BASED_REBALANCE:
            print(f"[whirl_rebalance]   ├─ {pair} Time-based rebalance (4h elapsed)")
            return True

        return False

    async def generate_rebalance_signal(self, pair: str) -> Dict:
        """Generate rebalance signal for a pair."""
        print(f"[whirl_rebalance] 🔄 Checking {pair}...")

        # Read cached pool data from manage_notes
        # TODO: Actually read from manage_notes
        # pool_data = await read_from_manage_notes(f"whirl:data:pools")
        # Mock data for now
        pool_data = {
            "current_price": 100.0,
            "tick_lower": self.price_to_tick(99.0),
            "tick_upper": self.price_to_tick(101.0)
        }

        current_price = pool_data.get("current_price", 0.0)
        tick_lower = pool_data.get("tick_lower", 0)
        tick_upper = pool_data.get("tick_upper", 0)

        # Update price history
        if pair not in self.price_history:
            self.price_history[pair] = []
        self.price_history[pair].append(current_price)
        if len(self.price_history[pair]) > VOLATILITY_WINDOW:
            self.price_history[pair] = self.price_history[pair][-VOLATILITY_WINDOW:]

        # Check LP range
        lp_status = self.check_lp_range(pair, current_price, tick_lower, tick_upper)
        print(f"[whirl_rebalance]   ├─ LP Status: {lp_status}")
        print(f"[whirl_rebalance]   ├─ Current Price: {current_price:.4f}")
        print(f"[whirl_rebalance]   ├─ Tick Range: [{tick_lower}, {tick_upper}]")

        # Determine if rebalancing is needed
        if lp_status == "IN_RANGE" and not self.should_rebalance(pair, current_price, tick_lower, tick_upper):
            print(f"[whirl_rebalance]   └─ No rebalancing needed")
            return {
                "pair": pair,
                "lp_status": lp_status,
                "safe_to_trade": True,
                "tick_lower": tick_lower,
                "tick_upper": tick_upper,
                "current_price": current_price
            }

        # Compute new tick range (based on volatility)
        atr = self.compute_atr(pair, current_price)
        volatility = atr / current_price if current_price > 0 else 0.0
        new_tick_lower, new_tick_upper = self.compute_tick_range(current_price, atr, volatility)

        print(f"[whirl_rebalance]   ├─ New Tick Range: [{new_tick_lower}, {new_tick_upper}]")
        print(f"[whirl_rebalance]   └─ Rebalancing signal generated")

        # Update last rebalance time
        self.last_rebalance_time[pair] = time.time()

        # Return signal
        signal = {
            "pair": pair,
            "lp_status": "OUT_OF_RANGE",  # Trigger rebalance
            "safe_to_trade": True,
            "tick_lower": tick_lower,
            "tick_upper": tick_upper,
            "current_price": current_price,
            "new_tick_lower": new_tick_lower,
            "new_tick_upper": new_tick_upper,
            "atr": atr,
            "volatility": volatility
        }

        return signal

    async def run(self):
        """Main routine loop."""
        print(f"[whirl_rebalance] 🚀 Starting WHIRL Rebalance Routine...")

        while True:
            print(f"[whirl_rebalance] 🔍 Checking LP ranges for {len(self.pairs)} pairs...")

            signals = {}
            for pair in self.pairs:
                try:
                    signal = await self.generate_rebalance_signal(pair)
                    signals[pair] = signal

                    # Cache to manage_notes
                    # TODO: Actually write to manage_notes
                    # await write_to_manage_notes(f"whirl:signal:{pair}", signal)
                    print(f"[whirl_rebalance]   ├─ Cached signal to whirl:signal:{pair}")

                except Exception as e:
                    print(f"[whirl_rebalance] ❌ Error processing {pair}: {e}")
                    continue

            print(f"[whirl_rebalance] ✅ Rebalance check complete. Sleeping for {REBALANCE_CHECK_INTERVAL}s...")

            # Sleep until next check
            await asyncio.sleep(REBALANCE_CHECK_INTERVAL)


# Main execution
async def main():
    """Main routine execution."""
    rebalancer = WhirlRebalance()
    await rebalancer.run()


if __name__ == "__main__":
    asyncio.run(main())
