#!/usr/bin/env python3
"""
MIDAS Data Routine: Fetch order books from Gate.io (spot + perpetuals) and cross-exchanges.

This routine runs every 1 second (FREE, no LLM cost).
It fetches L2 order books from:
  - Gate.io (spot + perpetuals) via WebSocket
  - Binance (spot + perpetuals) via REST API (cached 1s)
  - OKX (spot + perpetuals) via REST API (cached 1s)

Output: Caches to manage_notes: midas:data:{pair}
"""

import asyncio
import json
import time
from typing import Dict, List, Optional
import websockets
import aiohttp
import numpy as np

# Gate.io WebSocket URI
GATEIO_WS_URI = "wss://fx-ws.gateio.ws/v4/ws/usdt"

# Binance/OKX REST API endpoints
BINANCE_SPOT_API = "https://api.binance.com/api/v3/depth"
BINANCE_PERP_API = "https://fapi.binance.com/fapi/v1/depth"
OKX_SPOT_API = "https://www.okx.com/api/v5/market/books"
OKX_PERP_API = "https://www.okx.com/api/v5/market/books"


class OrderBookFetcher:
    """Fetch and cache order books from multiple exchanges."""

    def __init__(self, pairs: List[str] = ["BTC_USDT", "ETH_USDT", "SOL_USDT"]):
        self.pairs = pairs
        self.gateio_orderbooks = {pair: {"spot": None, "perp": None} for pair in pairs}
        self.binance_orderbooks = {pair: {"spot": None, "perp": None} for pair in pairs}
        self.okx_orderbooks = {pair: {"spot": None, "perp": None} for pair in pairs}
        self.last_binance_fetch = 0
        self.last_okx_fetch = 0
        self.cache_ttl = 1  # Cache TTL in seconds

    async def connect_gateio_websocket(self):
        """Connect to Gate.io WebSocket (spot + perpetuals)."""
        async with websockets.connect(GATEIO_WS_URI) as ws:
            # Subscribe to SPOT order books
            for pair in self.pairs:
                await ws.send(json.dumps({
                    "method": "subscribe",
                    "params": ["spot.order_book", pair, "5"],  # 5 price levels
                    "id": 1
                }))

            # Subscribe to PERPETUALS order books
            for pair in self.pairs:
                await ws.send(json.dumps({
                    "method": "subscribe",
                    "params": ["futures.order_book", pair, "5"],  # 5 price levels
                    "id": 2
                }))

            # Listen for updates
            async for message in ws:
                data = json.loads(message)
                self._parse_gateio_message(data)

    def _parse_gateio_message(self, data: Dict):
        """Parse Gate.io WebSocket message."""
        method = data.get("method", "")
        params = data.get("params", [])

        if not params:
            return

        pair = params[0].get("currency_pair", params[0].get("contract", ""))
        if not pair or pair not in self.pairs:
            return

        if "spot.order_book" in method:
            # Parse spot order book
            bids = params[0].get("bids", [])
            asks = params[0].get("asks", [])
            self.gateio_orderbooks[pair]["spot"] = {
                "bids": [[float(b[0]), float(b[1])] for b in bids],
                "asks": [[float(a[0]), float(a[1])] for a in asks],
                "timestamp": time.time()
            }
        elif "futures.order_book" in method:
            # Parse perpetuals order book
            bids = params[0].get("bids", [])
            asks = params[0].get("asks", [])
            self.gateio_orderbooks[pair]["perp"] = {
                "bids": [[float(b[0]), float(b[1])] for b in bids],
                "asks": [[float(a[0]), float(a[1])] for a in asks],
                "timestamp": time.time()
            }

    async def fetch_binance_orderbook(self, pair: str, market_type: str = "spot") -> Optional[Dict]:
        """Fetch Binance order book (REST API, cached 1s)."""
        current_time = time.time()
        if current_time - self.last_binance_fetch < self.cache_ttl:
            return self.binance_orderbooks.get(pair, {}).get(market_type)

        # Convert pair format: BTC_USDT → BTCUSDT
        binance_pair = pair.replace("_", "")

        if market_type == "spot":
            url = f"{BINANCE_SPOT_API}?symbol={binance_pair}&limit=5"
        else:  # perpetuals
            url = f"{BINANCE_PERP_API}?symbol={binance_pair}&limit=5"

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                data = await response.json()

                bids = [[float(b[0]), float(b[1])] for b in data.get("bids", [])]
                asks = [[float(a[0]), float(a[1])] for a in data.get("asks", [])]

                orderbook = {
                    "bids": bids,
                    "asks": asks,
                    "timestamp": current_time
                }

                self.binance_orderbooks[pair][market_type] = orderbook
                self.last_binance_fetch = current_time
                return orderbook

    async def fetch_okx_orderbook(self, pair: str, market_type: str = "spot") -> Optional[Dict]:
        """Fetch OKX order book (REST API, cached 1s)."""
        current_time = time.time()
        if current_time - self.last_okx_fetch < self.cache_ttl:
            return self.okx_orderbooks.get(pair, {}).get(market_type)

        # Convert pair format: BTC_USDT → BTC-USDT
        okx_pair = pair.replace("_", "-")

        if market_type == "spot":
            url = f"{OKX_SPOT_API}?instId={okx_pair}&sz=5"
        else:  # perpetuals (swap)
            url = f"{OKX_PERP_API}?instId={okx_pair}-SWAP&sz=5"

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                data = await response.json()
                orderbook_data = data.get("data", [{}])[0]

                bids = [[float(b[0]), float(b[1])] for b in orderbook_data.get("bids", [])]
                asks = [[float(a[0]), float(a[1])] for a in orderbook_data.get("asks", [])]

                orderbook = {
                    "bids": bids,
                    "asks": asks,
                    "timestamp": current_time
                }

                self.okx_orderbooks[pair][market_type] = orderbook
                self.last_okx_fetch = current_time
                return orderbook

    def compute_mid_price(self, orderbook: Dict) -> Optional[float]:
        """Compute mid price from order book."""
        if not orderbook or not orderbook.get("bids") or not orderbook.get("asks"):
            return None

        best_bid = orderbook["bids"][0][0]
        best_ask = orderbook["asks"][0][0]
        return (best_bid + best_ask) / 2

    def compute_obi(self, orderbook: Dict, depth: int = 5) -> Optional[float]:
        """Compute Order Book Imbalance (OBI)."""
        if not orderbook or not orderbook.get("bids") or not orderbook.get("asks"):
            return None

        bid_volume = sum(level[1] for level in orderbook["bids"][:depth])
        ask_volume = sum(level[1] for level in orderbook["asks"][:depth])

        if bid_volume + ask_volume == 0:
            return 0.0

        obi = (bid_volume - ask_volume) / (bid_volume + ask_volume)
        return obi

    def detect_cross_exchange_arbitrage(self, pair: str) -> List[Dict]:
        """Detect cross-exchange arbitrage opportunities."""
        opportunities = []

        gateio_spot = self.gateio_orderbooks.get(pair, {}).get("spot")
        gateio_perp = self.gateio_orderbooks.get(pair, {}).get("perp")
        binance_spot = self.binance_orderbooks.get(pair, {}).get("spot")
        binance_perp = self.binance_orderbooks.get(pair, {}).get("perp")

        # SPOT arbitrage: Gate.io bid > Binance ask
        if gateio_spot and binance_spot:
            gateio_best_bid = gateio_spot["bids"][0][0]
            binance_best_ask = binance_spot["asks"][0][0]
            fees = 0.001  # 0.1% taker fee

            if gateio_best_bid > binance_best_ask + fees:
                opportunities.append({
                    "type": "spot_arbitrage",
                    "buy_exchange": "binance",
                    "sell_exchange": "gateio",
                    "buy_price": binance_best_ask,
                    "sell_price": gateio_best_bid,
                    "profit": gateio_best_bid - binance_best_ask - fees
                })

        # PERP arbitrage: Gate.io bid > Binance ask
        if gateio_perp and binance_perp:
            gateio_best_bid = gateio_perp["bids"][0][0]
            binance_best_ask = binance_perp["asks"][0][0]
            fees = 0.001

            if gateio_best_bid > binance_best_ask + fees:
                opportunities.append({
                    "type": "perp_arbitrage",
                    "buy_exchange": "binance",
                    "sell_exchange": "gateio",
                    "buy_price": binance_best_ask,
                    "sell_price": gateio_best_bid,
                    "profit": gateio_best_bid - binance_best_ask - fees
                })

        return opportunities

    async def run(self):
        """Main loop: fetch order books and cache to manage_notes."""
        # Start Gate.io WebSocket (runs forever)
        asyncio.create_task(self.connect_gateio_websocket())

        # Fetch Binance/OKX order books every 1 second
        while True:
            for pair in self.pairs:
                await self.fetch_binance_orderbook(pair, "spot")
                await self.fetch_binance_orderbook(pair, "perp")
                await self.fetch_okx_orderbook(pair, "spot")
                await self.fetch_okx_orderbook(pair, "perp")

                # Compute signals
                gateio_spot_mid = self.compute_mid_price(self.gateio_orderbooks[pair]["spot"])
                gateio_perp_mid = self.compute_mid_price(self.gateio_orderbooks[pair]["perp"])
                gateio_spot_obi = self.compute_obi(self.gateio_orderbooks[pair]["spot"])
                gateio_perp_obi = self.compute_obi(self.gateio_orderbooks[pair]["perp"])

                # Detect arbitrage
                arbitrage_opportunities = self.detect_cross_exchange_arbitrage(pair)

                # Cache to manage_notes
                cache_data = {
                    "pair": pair,
                    "gateio_spot": {
                        "mid": gateio_spot_mid,
                        "obi": gateio_spot_obi,
                        "orderbook": self.gateio_orderbooks[pair]["spot"]
                    },
                    "gateio_perp": {
                        "mid": gateio_perp_mid,
                        "obi": gateio_perp_obi,
                        "orderbook": self.gateio_orderbooks[pair]["perp"]
                    },
                    "arbitrage": arbitrage_opportunities,
                    "timestamp": time.time()
                }

                # TODO: Actually cache to manage_notes
                # await cache_to_manage_notes(f"midas:data:{pair}", cache_data)

                print(f"[MIDAS] {pair} | Spot mid: {gateio_spot_mid:.4f} | Perp mid: {gateio_perp_mid:.4f} | OBI: {gateio_spot_obi:.2f} | Arb: {len(arbitrage_opportunities)}")

            await asyncio.sleep(1)


async def main():
    """Entry point for testing."""
    fetcher = OrderBookFetcher(pairs=["BTC_USDT", "ETH_USDT", "SOL_USDT"])
    await fetcher.run()


if __name__ == "__main__":
    asyncio.run(main())
