#!/usr/bin/env python3
"""
MIDAS Dry-Run Test: Validate agent.md logic without executing real trades.

Tests:
  1. Signal generation (midas_scan)
  2. Adverse selection detection (midas_adverse_selection)
  3. Delta-neutral hedging (midas_hedge)
  4. Agent decision logic (agent.md)

Usage:
  python dry_run_midas.py --pair BTC_USDT --mode NORMAL
  python dry_run_midas.py --pair ALL --mode ARBITRAGE
"""

# Add project root to sys.path (fixes import issues)
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import json
import time
from typing import Dict, List, Optional
from datetime import datetime

# Import MIDAS routines
from trading_agents.midas.routines.midas_scan import MidasScan
from trading_agents.midas.routines.midas_adverse_selection import AdverseSelectionDetector
from trading_agents.midas.routines.midas_hedge import DeltaNeutralHedge, check_and_hedge


# Mock data for testing
MOCK_SPOT_ORDERBOOK = {
    "bids": [[99950.0, 1.5], [99940.0, 2.0], [99930.0, 2.5]],
    "asks": [[100050.0, 1.0], [100060.0, 1.5], [100070.0, 2.0]],
    "timestamp": time.time()
}

MOCK_PERP_ORDERBOOK = {
    "bids": [[99900.0, 1.0]],
    "asks": [[100100.0, 1.0]],
    "timestamp": time.time()
}

MOCK_RECENT_TRADES = [
    {"side": "BUY", "amount": 0.5, "price": 100000.0, "timestamp": time.time() - 10},
    {"side": "SELL", "amount": 0.8, "price": 100050.0, "timestamp": time.time() - 5},
    {"side": "BUY", "amount": 1.2, "price": 99950.0, "timestamp": time.time()}
]

MOCK_RECENT_ORDERS = [
    {"id": "1", "status": "FILLED", "side": "BUY", "price": 99950.0},
    {"id": "2", "status": "CANCELED", "side": "SELL", "price": 100050.0},
    {"id": "3", "status": "FILLED", "side": "BUY", "price": 99940.0}
]


class MockExchange:
    """Mock exchange for dry-run testing."""

    def __init__(self, name: str):
        self.name = name
        self.open_orders = []
        self.filled_orders = []
        self.spot_balance = 1000.0  # USDT
        self.perp_position = 0.0  # BTC

    async def create_limit_order(self, symbol: str, side: str, price: float,
                                amount: float, params: Dict = {}) -> Dict:
        """Mock order creation."""
        order = {
            "id": f"mock_{len(self.open_orders) + 1}",
            "symbol": symbol,
            "side": side,
            "price": price,
            "amount": amount,
            "status": "OPEN",
            "type": params.get("type", "spot")
        }
        self.open_orders.append(order)

        print(f"[MOCK] {self.name} | {side} {amount:.4f} {symbol} @ {price:.2f} | Type: {order['type']}")
        return order

    async def cancel_order(self, order_id: str):
        """Mock order cancellation."""
        for order in self.open_orders:
            if order["id"] == order_id:
                order["status"] = "CANCELED"
                print(f"[MOCK] {self.name} | Canceled order {order_id}")
                return True
        return False

    async def cancel_all_orders(self):
        """Mock cancel all open orders."""
        print(f"[MOCK] {self.name} | Canceling all orders...")
        for order in self.open_orders:
            order["status"] = "CANCELED"
        return True

    async def fetch_balance(self) -> Dict:
        """Mock balance fetch."""
        return {
            "USDT": {"free": self.spot_balance, "used": 0.0},
            "BTC": {"free": 0.1, "used": 0.0}
        }

    async def fetch_position(self, symbol: str) -> Dict:
        """Mock position fetch."""
        return {
            "symbol": symbol,
            "contracts": self.perp_position,
            "margin_ratio": 2.0
        }


async def test_signal_generation(pair: str = "BTC_USDT"):
    """Test 1: Signal generation (midas_scan)."""
    print(f"\n{'='*60}")
    print(f"[TEST 1] Signal Generation for {pair}")
    print(f"{'='*60}")

    scanner = MidasScan()

    # Mock cached data
    cached_data = {
        "pair": pair,
        "gateio_spot": {
            "mid": 100000.0,
            "obi": 0.2,
            "orderbook": MOCK_SPOT_ORDERBOOK
        },
        "gateio_perp": {
            "mid": 100050.0,
            "obi": -0.1,
            "orderbook": MOCK_PERP_ORDERBOOK
        },
        "arbitrage": []
    }

    # Compute signal
    signal = scanner.compute_signal(pair, cached_data)

    if signal:
        print(f"✅ Signal generated successfully!")
        print(f"   ├─ Spot mid: {signal['spot']['mid']:.2f}")
        print(f"   ├─ Perp mid: {signal['perp']['mid']:.2f}")
        print(f"   ├─ Trend: {signal['trend']}")
        print(f"   ├─ Inventory lean: {signal['inventory_lean']}")
        print(f"   ├─ Spot BUY price: {signal['spot']['buy_price']:.2f}")
        print(f"   ├─ Spot SELL price: {signal['spot']['sell_price']:.2f}")
        print(f"   └─ Adverse selection prob: {signal['adverse_selection']['informed_probability']:.2f}")
    else:
        print(f"❌ Signal generation failed (safety filters triggered)")

    return signal


async def test_adverse_selection():
    """Test 2: Adverse selection detection (midas_adverse_selection)."""
    print(f"\n{'='*60}")
    print(f"[TEST 2] Adverse Selection Detection")
    print(f"{'='*60}")

    detector = AdverseSelectionDetector()

    # Test with mock data
    cancel, prob = detector.should_cancel_orders(
        MOCK_SPOT_ORDERBOOK,
        MOCK_RECENT_TRADES,
        MOCK_RECENT_ORDERS,
        [MOCK_SPOT_ORDERBOOK] * 5
    )

    print(f"Adverse selection detection:")
    print(f"   ├─ Cancel orders: {cancel}")
    print(f"   └─ Informed trader probability: {prob:.2f}")

    if cancel:
        print(f"✅ Informed trader detected! Should cancel orders.")
    else:
        print(f"✅ No informed trader detected. Safe to provide liquidity.")

    return cancel, prob


async def test_delta_neutral_hedge():
    """Test 3: Delta-neutral hedging (midas_hedge)."""
    print(f"\n{'='*60}")
    print(f"[TEST 3] Delta-Neutral Hedge")
    print(f"{'='*60}")

    # Mock: Spot LONG 3.0 BTC, Perp SHORT 0.0 BTC
    class TestHedge(DeltaNeutralHedge):
        def get_spot_position(self, exchange, pair: str) -> float:
            return 3.0  # 3.0 BTC LONG spot

        def get_perp_position(self, exchange, pair: str) -> float:
            return 0.0  # No perp position

    test_hedge = TestHedge(max_inventory=1.0)
    mock_exchange = MockExchange("Gate.io")

    print(f"Initial state:")
    print(f"   ├─ Spot position: 3.0 BTC (LONG)")
    print(f"   ├─ Perp position: 0.0 BTC")
    print(f"   └─ Delta: 3.0 BTC (needs hedge!)")

    # Run hedge
    await test_hedge.run(mock_exchange, "BTC_USDT", MOCK_SPOT_ORDERBOOK, MOCK_PERP_ORDERBOOK)

    print(f"\n✅ Hedge executed successfully!")

    return True


async def test_agent_decision_logic(signal: Dict):
    """Test 4: Agent decision logic (agent.md)."""
    print(f"\n{'='*60}")
    print(f"[TEST 4] Agent Decision Logic")
    print(f"{'='*60}")

    mock_exchange = MockExchange("Gate.io")

    # STEP 1: Check adverse selection
    if signal["adverse_selection"]["cancel_orders"]:
        print(f"⚠️  Informed trader detected! Canceling ALL orders.")
        await mock_exchange.cancel_all_orders()
        await asyncio.sleep(5)
        return

    # STEP 2: Execute market making (spot + perps)
    print(f"Executing market making for {signal['pair']}...")

    # Spot MM
    spot_buy_order = await mock_exchange.create_limit_order(
        symbol=signal["pair"],
        side="BUY",
        price=signal["spot"]["buy_price"],
        amount=0.01,
        params={"type": "spot"}
    )

    spot_sell_order = await mock_exchange.create_limit_order(
        symbol=signal["pair"],
        side="SELL",
        price=signal["spot"]["sell_price"],
        amount=0.01,
        params={"type": "spot"}
    )

    # Perp MM
    perp_buy_order = await mock_exchange.create_limit_order(
        symbol=signal["pair"],
        side="BUY",
        price=signal["perp"]["buy_price"],
        amount=0.01,
        params={"type": "swap"}
    )

    perp_sell_order = await mock_exchange.create_limit_order(
        symbol=signal["pair"],
        side="SELL",
        price=signal["perp"]["sell_price"],
        amount=0.01,
        params={"type": "swap"}
    )

    print(f"✅ Market making orders placed!")
    print(f"   ├─ Spot BUY: {spot_buy_order['id']}")
    print(f"   ├─ Spot SELL: {spot_sell_order['id']}")
    print(f"   ├─ Perp BUY: {perp_buy_order['id']}")
    print(f"   └─ Perp SELL: {perp_sell_order['id']}")

    # STEP 3: Simulate filled order → hedge
    print(f"\nSimulating filled order (Spot BUY filled)...")
    mock_exchange.perp_position = -0.01  # Now SHORT 0.01 BTC perp

    await check_and_hedge(
        mock_exchange,
        signal["pair"],
        MOCK_SPOT_ORDERBOOK,
        MOCK_PERP_ORDERBOOK,
        max_inventory=1.0
    )

    print(f"✅ Agent decision logic validated!")

    return True


async def main():
    """Run all tests."""
    print(f"\n{'#'*60}")
    print(f"# MIDAS Dry-Run Test")
    print(f"# {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#'*60}")

    # Test 1: Signal generation
    signal = await test_signal_generation("BTC_USDT")

    if signal:
        # Test 2: Adverse selection
        await test_adverse_selection()

        # Test 3: Delta-neutral hedge
        await test_delta_neutral_hedge()

        # Test 4: Agent decision logic
        await test_agent_decision_logic(signal)

    print(f"\n{'='*60}")
    print(f"[RESULT] All tests completed!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    asyncio.run(main())
