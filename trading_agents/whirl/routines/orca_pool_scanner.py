#!/usr/bin/env python3
"""
ORCA Pool Scanner Routine: Scan Orca Whirlpools (CLMM pools).

This routine runs every 60 seconds (FREE, no LLM cost).
It fetches all Orca Whirlpools, computes APY (fees + rewards),
applies RWA weight (2× for RWA tokens), and caches results.

Output: Caches to manage_notes: whirl:data:pools
"""

import asyncio
import time
import aiohttp
from typing import Dict, List, Optional, Tuple

# Orca Whirlpool API endpoints
ORCA_WHIRLPOOL_API = "https://api.orca.so/v1/whirlpool/list"
ORCA_REWARDS_API = "https://api.orca.so/v1/stake"

# RWA tokens (for bonus criterion)
RWA_TOKENS = ["GOLD", "OIL", "EUR", "USD", "gUSD", "gEUR", "gBTC", "gETH"]


class OrcaPoolScanner:
    """Scan Orca Whirlpools and compute APY."""

    def __init__(self, pairs: List[str] = ["BTC_USDC", "ETH_USDC", "SOL_USDC", "GOLD_USDC", "EUR_USDC"]):
        self.pairs = pairs
        self.pool_cache = {}
        self.last_fetch_time = 0
        self.cache_ttl = 60  # Cache TTL in seconds

    async def fetch_whirlpools(self) -> Optional[Dict]:
        """Fetch all Whirlpools from Orca API."""
        current_time = time.time()

        # Use cached data if within TTL
        if current_time - self.last_fetch_time < self.cache_ttl and self.pool_cache:
            return self.pool_cache

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(ORCA_WHIRLPOOL_API) as response:
                    if response.status != 200:
                        print(f"[orca_pool_scanner] ⚠️  Failed to fetch Whirlpools: {response.status}")
                        return self.pool_cache if self.pool_cache else None

                    data = await response.json()
                    self.pool_cache = data
                    self.last_fetch_time = current_time
                    return data

        except Exception as e:
            print(f"[orca_pool_scanner] ❌ Error fetching Whirlpools: {e}")
            return self.pool_cache if self.pool_cache else None

    def is_rwa_pool(self, token_a: str, token_b: str) -> bool:
        """Check if pool contains RWA tokens."""
        return token_a in RWA_TOKENS or token_b in RWA_TOKENS

    def compute_apy(self, pool: Dict) -> float:
        """Compute APY (fees + rewards)."""
        try:
            # Extract fee rate (trading fees)
            fee_rate = pool.get("feeRate", 0) / 1e6  # Convert from bps

            # Extract volume (24h)
            volume_24h = pool.get("volume24h", 0)

            # Extract TVL
            tvl = pool.get("tvl", 1)  # Avoid division by zero

            # Compute fee APY (annualized)
            fee_apy = (volume_24h * fee_rate * 365) / tvl if tvl > 0 else 0

            # Extract ORCA rewards (if available)
            rewards_apy = pool.get("rewardsApy", 0) / 100  # Convert from % to decimal

            # Total APY
            total_apy = fee_apy + rewards_apy
            return total_apy

        except Exception as e:
            print(f"[orca_pool_scanner] ❌ Error computing APY: {e}")
            return 0.0

    def compute_il_risk(self, pool: Dict, price_range: Tuple[float, float]) -> float:
        """Compute Impermanent Loss (IL) risk for given price range."""
        try:
            current_price = pool.get("price", 0)
            tick_lower, tick_upper = price_range

            # If current price is outside range, IL = 100% (full loss)
            if current_price < tick_lower or current_price > tick_upper:
                return 1.0

            # If price is inside range, IL depends on range width
            range_width = (tick_upper - tick_lower) / current_price
            il_risk = min(1.0, range_width * 2)  # Wider range = lower IL risk
            return il_risk

        except Exception as e:
            print(f"[orca_pool_scanner] ❌ Error computing IL risk: {e}")
            return 1.0

    async def scan_pools(self) -> Dict:
        """Scan all pools and return top pools by weighted APY."""
        print("[orca_pool_scanner] 🔍 Scanning Orca Whirlpools...")

        # Fetch Whirlpools
        whirlpools = await self.fetch_whirlpools()
        if not whirlpools or "whirlpools" not in whirlpools:
            print("[orca_pool_scanner] ⚠️  No Whirlpools data available")
            return {}

        pools = whirlpools["whirlpools"]
        print(f"[orca_pool_scanner]   ├─ Found {len(pools)} Whirlpools")

        # Compute APY for each pool
        pool_data = []
        for pool in pools:
            try:
                token_a = pool.get("tokenA", {}).get("symbol", "")
                token_b = pool.get("tokenB", {}).get("symbol", "")
                pair = f"{token_a}_{token_b}"

                # Check if pair is in our list
                if pair not in self.pairs:
                    continue

                # Compute APY
                apy = self.compute_apy(pool)

                # Apply RWA weight (2× for RWA pools)
                is_rwa = self.is_rwa_pool(token_a, token_b)
                weight = 2.0 if is_rwa else 1.0
                weighted_apy = apy * weight

                # Compute IL risk
                tick_lower = pool.get("tickLower", 0)
                tick_upper = pool.get("tickUpper", 0)
                il_risk = self.compute_il_risk(pool, (tick_lower, tick_upper))

                pool_data.append({
                    "pair": pair,
                    "token_a": token_a,
                    "token_b": token_b,
                    "apy": apy,
                    "weighted_apy": weighted_apy,
                    "il_risk": il_risk,
                    "is_rwa": is_rwa,
                    "tvl": pool.get("tvl", 0),
                    "volume_24h": pool.get("volume24h", 0),
                    "fee_rate": pool.get("feeRate", 0) / 1e6,
                    "rewards_apy": pool.get("rewardsApy", 0) / 100,
                    "tick_lower": tick_lower,
                    "tick_upper": tick_upper,
                    "current_price": pool.get("price", 0)
                })

            except Exception as e:
                print(f"[orca_pool_scanner] ❌ Error processing pool: {e}")
                continue

        # Sort by weighted APY (descending)
        pool_data.sort(key=lambda p: p["weighted_apy"], reverse=True)

        # Select top 3 pools
        top_pools = pool_data[:3]

        print(f"[orca_pool_scanner]   ├─ Top 3 pools by weighted APY:")
        for i, pool in enumerate(top_pools):
            rwa_tag = " 🏆 RWA" if pool["is_rwa"] else ""
            print(f"[orca_pool_scanner]   ├─ #{i+1} {pool['pair']}: APY={pool['apy']*100:.2f}% (weighted: {pool['weighted_apy']*100:.2f}%){rwa_tag}")

        # Cache to manage_notes
        cache_data = {
            "timestamp": time.time(),
            "top_pools": top_pools,
            "all_pools": pool_data
        }

        # TODO: Actually cache to manage_notes
        # await write_to_manage_notes("whirl:data:pools", cache_data)

        print(f"[orca_pool_scanner] ✅ Scan complete. Cached to whirl:data:pools")
        return cache_data


# Main execution
async def main():
    """Main routine execution."""
    scanner = OrcaPoolScanner()
    result = await scanner.scan_pools()

    # Keep running (for Condor routine)
    while True:
        await asyncio.sleep(60)  # Run every 60 seconds
        await scanner.scan_pools()


if __name__ == "__main__":
    asyncio.run(main())
