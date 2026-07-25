"""
Evaluate market conditions and switch APEX between 3 modes:
1. FUNDING_NEAR: 30min before funding timestamp → delta-neutral arbitrage
2. QUIET_MM: Low volatility → pure market making (volume boost)
3. VOLATILE_DIR: Bollinger breakout → directional scalping (profit boost)

This routine is called by the APEX Agent each tick to determine which
mode to operate in and allocate capital accordingly.
"""

from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import json
from condor.routines import register_routine
from condor.connectors.gate_io import GateIOConnector
from condor.connectors.binance_perpetual import BinancePerpetualConnector
import numpy as np

CATEGORY = "APEX"


class MarketCondition(str, Enum):
    """Market condition states that determine APEX's operating mode."""
    FUNDING_NEAR = "funding_near"  # 30min before funding timestamp
    QUIET_MM = "quiet_mm"          # Low volatility, range-bound
    VOLATILE_DIR = "volatile_dir"    # Bollinger breakout, high volume


class Config(BaseModel):
    """Configuration for market condition evaluation."""
    pairs: list[str] = Field(
        default_factory=lambda: ["BTC_USDT", "ETH_USDT", "SOL_USDT", "XRP_USDT", "ADA_USDT"],
        description="Trading pairs to evaluate (Gate.io format)."
    )
    funding_near_minutes: int = Field(
        default=30,
        description="Minutes before funding timestamp to switch to FUNDING_NEAR mode."
    )
    volatility_bb_width_threshold: float = Field(
        default=0.5,
        description="Bollinger Band width threshold for QUIET_MM mode (below = quiet)."
    )
    volatility_breakout_threshold: float = Field(
        default=2.0,
        description="Bollinger Band width threshold for VOLATILE_DIR mode (above = volatile)."
    )
    volume_spike_threshold: float = Field(
        default=50000.0,
        description="Volume spike threshold (USD) for VOLATILE_DIR mode."
    )
    bb_period: int = Field(
        default=20,
        description="Bollinger Bands period for volatility calculation."
    )
    cache_duration_sec: int = Field(
        default=60,
        description="How long to cache market condition before re-evaluating."
    )


class MarketEvaluator:
    """Evaluates market conditions and returns optimal trading mode."""
    
    def __init__(self, config: Config):
        self.config = config
        self.gateio = GateIOConnector()
        self.binance = BinancePerpetualConnector()
        self._cache = {}
        self._cache_timestamp = 0
    
    def get_funding_timestamps(self) -> list[datetime]:
        """Get next 3 funding timestamps (Gate.io: 00:00, 08:00, 16:00 UTC)."""
        now = datetime.now(timezone.utc)
        timestamps = []
        
        for hour in [0, 8, 16]:
            next_ts = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            if next_ts <= now:
                # Already passed, get next day
                from datetime import timedelta
                next_ts += timedelta(days=1)
            timestamps.append(next_ts)
        
        return sorted(timestamps)[:3]
    
    def minutes_to_next_funding(self) -> float:
        """Return minutes until next funding timestamp."""
        timestamps = self.get_funding_timestamps()
        now = datetime.now(timezone.utc)
        next_funding = timestamps[0]
        delta = next_funding - now
        return delta.total_seconds() / 60
    
    def compute_bb_width(self, pair: str, period: int = 20) -> float:
        """Compute Bollinger Bands width (std / mean) for volatility."""
        # Fetch historical data (last `period` candles)
        candles = self.gateio.get_candles(pair, interval="5m", limit=period + 10)
        
        if len(candles) < period:
            return 1.0  # Default: moderate volatility
        
        closes = [float(c["close"]) for c in candles[-period:]]
        mean = np.mean(closes)
        std = np.std(closes)
        
        if mean == 0:
            return 1.0
        
        bb_width = (std * 4) / mean  # 4 std = full BB width
        return bb_width * 100  # Return as percentage
    
    def check_volume_spike(self, pair: str, period: int = 5) -> float:
        """Check for volume spike in last `period` candles (5m interval)."""
        candles = self.gateio.get_candles(pair, interval="5m", limit=period + 5)
        
        if len(candles) < period + 1:
            return 0.0
        
        recent_volume = sum(float(c["volume"]) for c in candles[-period:])
        previous_volume = sum(float(c["volume"]) for c in candles[-(period * 2):-period])
        
        if previous_volume == 0:
            return 0.0
        
        spike_ratio = recent_volume / previous_volume
        return spike_ratio * 100  # Return as percentage
    
    def evaluate(self, pair: str) -> Dict[str, Any]:
        """
        Evaluate market condition for a specific pair.
        Returns: {"condition": MarketCondition, "metrics": {...}}
        """
        # Check cache
        cache_key = f"{pair}_{int(datetime.now().timestamp() / self.config.cache_duration_sec)}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        # 1. Check if near funding timestamp
        minutes_to_funding = self.minutes_to_next_funding()
        
        if 0 <= minutes_to_funding <= self.config.funding_near_minutes:
            condition = MarketCondition.FUNDING_NEAR
            metrics = {
                "minutes_to_funding": minutes_to_funding,
                "reason": f"Within {self.config.funding_near_minutes}min of funding timestamp"
            }
        else:
            # 2. Check volatility (Bollinger Bands width)
            bb_width = self.compute_bb_width(pair, self.config.bb_period)
            
            # 3. Check volume spike
            volume_spike = self.check_volume_spike(pair, period=5)
            
            if bb_width < self.config.volatility_bb_width_threshold:
                # Quiet market → Market Making mode
                condition = MarketCondition.QUIET_MM
                metrics = {
                    "bb_width": bb_width,
                    "volume_spike": volume_spike,
                    "reason": f"Low volatility (BB width {bb_width:.2f}% < {self.config.volatility_bb_width_threshold}%)"
                }
            elif bb_width > self.config.volatility_breakout_threshold or volume_spike > self.config.volume_spike_threshold:
                # Volatile market → Directional mode
                condition = MarketCondition.VOLATILE_DIR
                metrics = {
                    "bb_width": bb_width,
                    "volume_spike": volume_spike,
                    "reason": f"High volatility (BB width {bb_width:.2f}% > {self.config.volatility_breakout_threshold}%)"
                }
            else:
                # Default: Quiet MM (safe bet for volume)
                condition = MarketCondition.QUIET_MM
                metrics = {
                    "bb_width": bb_width,
                    "volume_spike": volume_spike,
                    "reason": f"Moderate volatility (BB width {bb_width:.2f}%) → default to MM"
                }
        
        result = {
            "condition": condition.value,
            "metrics": metrics,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Cache result
        self._cache[cache_key] = result
        
        return result


@register_routine
async def run(config: Config) -> dict:
    """
    Main routine: Evaluate market conditions across all pairs,
    determine optimal mode, and return capital allocation plan.
    """
    evaluator = MarketEvaluator(config)
    
    # Evaluate all pairs
    pair_conditions = {}
    for pair in config.pairs:
        try:
            result = evaluator.evaluate(pair)
            pair_conditions[pair] = result
        except Exception as e:
            pair_conditions[pair] = {
                "condition": MarketCondition.QUIET_MM.value,  # Default to MM on error
                "metrics": {"error": str(e)},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    # Determine dominant condition (majority vote)
    condition_counts = {}
    for pair, data in pair_conditions.items():
        cond = data["condition"]
        condition_counts[cond] = condition_counts.get(cond, 0) + 1
    
    dominant_condition = max(condition_counts, key=condition_counts.get)
    
    # Capital allocation based on dominant condition
    capital_allocation = _allocate_capital(dominant_condition)
    
    # Build result
    result = {
        "dominant_condition": dominant_condition,
        "pair_conditions": pair_conditions,
        "capital_allocation": capital_allocation,
        "next_funding_in_minutes": evaluator.minutes_to_next_funding(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Cache to manage_notes for agent to read
    from condor.tools import manage_notes
    manage_notes(
        action="set",
        key="apex:data:market_condition",
        value=json.dumps(result),
        ttl=300  # 5 minutes
    )
    
    return result


def _allocate_capital(condition: str) -> dict:
    """
    Allocate $1,000 capital based on market condition.
    
    Constraints:
    - Max $1,000 total
    - Delta-neutral needs $600 margin ($300 × 2)
    - MM needs available capital for order placement
    """
    TOTAL_CAPITAL = 1000
    
    if condition == MarketCondition.FUNDING_NEAR.value:
        # Delta-neutral arbitrage: $600 margin + $400 MM
        return {
            "mode": "FUNDING_ARB",
            "arbitrage_margin": 600,  # $300 Gate.io + $300 Binance
            "mm_capital": 400,        # Market make while holding
            "directional_capital": 0,
            "position_notional_each_side": 900,  # $300 × 3x leverage
            "notes": "30min before funding → open delta-neutral, MM with $400"
        }
    elif condition == MarketCondition.QUIET_MM.value:
        # Pure market making: ALL capital to MM
        return {
            "mode": "MARKET_MAKING",
            "arbitrage_margin": 0,
            "mm_capital": TOTAL_CAPITAL,  # $1,000 → max volume!
            "directional_capital": 0,
            "position_notional_each_side": 0,
            "notes": "Low volatility → pure MM for volume boost"
        }
    elif condition == MarketCondition.VOLATILE_DIR.value:
        # Directional scalping: ALL capital to directional
        return {
            "mode": "DIRECTIONAL",
            "arbitrage_margin": 0,
            "mm_capital": 0,
            "directional_capital": TOTAL_CAPITAL,  # $1,000 → 3x = $3,000 notional
            "position_notional_each_side": 3000,  # $1,000 × 3x
            "notes": "High volatility → directional scalping for P&L boost"
        }
    else:
        # Fallback: MM (safe)
        return {
            "mode": "MARKET_MAKING",
            "arbitrage_margin": 0,
            "mm_capital": TOTAL_CAPITAL,
            "directional_capital": 0,
            "position_notional_each_side": 0,
            "notes": "Unknown condition → default to MM"
        }


if __name__ == "__main__":
    # Test routine
    import asyncio
    
    config = Config()
    result = asyncio.run(run(config))
    
    print("=== APEX Market Condition Evaluation ===")
    print(f"Dominant Condition: {result['dominant_condition']}")
    print(f"Next Funding In: {result['next_funding_in_minutes']:.1f} minutes")
    print(f"\nCapital Allocation:")
    for key, value in result['capital_allocation'].items():
        print(f"  {key}: {value}")
    
    print(f"\nPer-Pair Conditions:")
    for pair, data in result['pair_conditions'].items():
        print(f"  {pair}: {data['condition']} ({data['metrics'].get('reason', 'N/A')})")
