#!/usr/bin/env python3
"""
WHIRL Market Make Routine: Place limit orders outside LP range.

This routine runs every 5 seconds (~$0.005 LLM cost).
It reads rebalance signals from manage_notes (whirl:signal:{pair}),
places limit orders OUTSIDE LP range (for volume boost),
and cancels/replaces orders every 5-10 seconds.

Output: Executes MM orders via Hummingbot API (TODO)
"""

import asyncio
import time
from typing import Dict, List, Optional

# Configuration
MM_ORDER_SIZE_PCT = 0.4  # 40% of capital for MM
TICK_OFFSET = 10  # 10 ticks outside LP range
ORDER_REFRESH_INTERVAL = 5  # Refresh orders every 5 seconds


class WhirlMarketMake:
    """Place limit orders outside LP range (MM for volume boost)."""

    def __init__(self, pairs: List[str] = ["BTC_USDC", "ETH_USDC", "SOL_USDC", "GOLD_USDC", "EUR_USDC"]):
        self.pairs = pairs
        self.active_mm_orders = {pair: {"buy": None, "sell": None} for pair in pairs}
        self.last_order_refresh = {pair: 0 for pair in pairs}

    def compute_mm_prices(self, current_price: float, tick_lower: int, tick_upper: int) -> Tuple[float, float]:
        """Compute MM order prices (outside LP range)."""
        # Convert ticks to prices (simplified - actual formula depends on Whirlpool)
        import math
        price_lower = 1.0001 ** tick_lower
        price_upper = 1.0001 ** tick_upper

        # Place BUY order BELOW LP range (10 ticks below tick_lower)
        mm_buy_price = price_lower * 0.99  # 1% below range (simplified)

        # Place SELL order ABOVE LP range (10 ticks above tick_upper)
        mm_sell_price = price_upper * 1.01  # 1% above range (simplified)

        return mm_buy_price, mm_sell_price

    def should_refresh_orders(self, pair: str) -> bool:
        """Check if MM orders should be refreshed."""
        current_time = time.time()
        last_refresh = self.last_order_refresh.get(pair, 0)

        if current_time - last_refresh >= ORDER_REFRESH_INTERVAL:
            return True
        return False

    async def place_mm_orders(self, pair: str, signal: Dict) -> Dict:
        """Place MM orders outside LP range."""
        lp_status = signal.get("lp_status", "NO_POSITION")
        current_price = signal.get("current_price", 0.0)
        tick_lower = signal.get("tick_lower")
        tick_upper = signal.get("tick_upper")

        # Only place MM orders if LP is IN RANGE
        if lp_status != "IN_RANGE":
            print(f"[whirl_market_make] ⚠️  {pair} LP not in range, skipping MM")
            return {"status": "skipped", "reason": "LP not in range"}

        # Compute MM prices
        mm_buy_price, mm_sell_price = self.compute_mm_prices(current_price, tick_lower, tick_upper)

        print(f"[whirl_market_make] 📊 {pair} Placing MM orders...")
        print(f"[whirl_market_make]   ├─ BUY @ {mm_buy_price:.4f} (below LP range)")
        print(f"[whirl_market_make]   └─ SELL @ {mm_sell_price:.4f} (above LP range)")

        # TODO: Execute via Hummingbot API
        # await create_limit_order(
        #     exchange="orca",
        #     pair=pair,
        #     side="BUY",
        #     price=mm_buy_price,
        #     amount=mm_amount,
        #     params={"type": "spot", "timeInForce": "GTC"}
        # )
        # await create_limit_order(
        #     exchange="orca",
        #     pair=pair,
        #     side="SELL",
        #     price=mm_sell_price,
        #     amount=mm_amount,
        #     params={"type": "spot", "timeInForce": "GTC"}
        # )

        # Update active orders
        self.active_mm_orders[pair] = {
            "buy": {"price": mm_buy_price, "amount": 0.0},  # TODO: Calculate amount
            "sell": {"price": mm_sell_price, "amount": 0.0}
        }
        self.last_order_refresh[pair] = time.time()

        return {
            "status": "placed",
            "pair": pair,
            "buy_price": mm_buy_price,
            "sell_price": mm_sell_price
        }

    async def cancel_mm_orders(self, pair: str) -> Dict:
        """Cancel all MM orders for a pair."""
        print(f"[whirl_market_make] ⚠️  {pair} Canceling MM orders...")

        # TODO: Execute via Hummingbot API
        # await cancel_all_orders(pair, order_type="MM")

        # Clear active orders
        self.active_mm_orders[pair] = {"buy": None, "sell": None}

        return {"status": "canceled", "pair": pair}

    async def refresh_mm_orders(self, pair: str, signal: Dict):
        """Refresh MM orders (cancel + replace)."""
        if not self.should_refresh_orders(pair):
            return

        print(f"[whirl_market_make] 🔄 {pair} Refreshing MM orders...")

        # Cancel existing orders
        await self.cancel_mm_orders(pair)

        # Place new orders
        await self.place_mm_orders(pair, signal)

    async def run(self):
        """Main routine loop."""
        print(f"[whirl_market_make] 🚀 Starting WHIRL Market Make Routine...")

        while True:
            print(f"[whirl_market_make] 🔍 Checking MM orders for {len(self.pairs)} pairs...")

            for pair in self.pairs:
                try:
                    # Read signal from manage_notes
                    # TODO: Actually read from manage_notes
                    # signal = await read_from_manage_notes(f"whirl:signal:{pair}")
                    signal = {
                        "pair": pair,
                        "lp_status": "IN_RANGE",
                        "current_price": 100.0,
                        "tick_lower": 99,
                        "tick_upper": 101
                    }

                    if not signal:
                        print(f"[whirl_market_make] ⚠️  No signal for {pair}, skipping")
                        continue

                    lp_status = signal.get("lp_status")

                    if lp_status == "IN_RANGE":
                        # Refresh MM orders (every 5-10 seconds)
                        await self.refresh_mm_orders(pair, signal)

                    elif lp_status == "OUT_OF_RANGE":
                        # Cancel all MM orders (wait for rebalance)
                        await self.cancel_mm_orders(pair)

                    elif lp_status == "NO_POSITION":
                        # Wait for LP to be established
                        print(f"[whirl_market_make] ⏳ {pair} Waiting for LP position before MM")

                except Exception as e:
                    print(f"[whirl_market_make] ❌ Error processing {pair}: {e}")
                    continue

            print(f"[whirl_market_make] ✅ MM check complete. Sleeping for {ORDER_REFRESH_INTERVAL}s...")

            # Sleep until next check
            await asyncio.sleep(ORDER_REFRESH_INTERVAL)


# Main execution
async def main():
    """Main routine execution."""
    market_maker = WhirlMarketMake()
    await market_maker.run()


if __name__ == "__main__":
    asyncio.run(main())
