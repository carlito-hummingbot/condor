"""Check XRP trend to determine XTIDE mode: MARKET_MAKING vs DOWNTREND_ARBITRAGE.

Analyzes XRP price action and RSI to detect downtrends. If XRP declines >2% in 1 hour
OR 15-min RSI < 30, switches to DOWNTREND_ARBITRAGE mode for triangle arbitrage.

Output: recommended_mode, xrp_price_change_pct, xrp_rsi_15m
"""
from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import BaseModel, Field

from config_manager import get_client

CATEGORY = "XTIDE"


class Config(BaseModel):
    """Check XRP price trend for mode switching."""

    pairs: list[str] = Field(
        default=["XRP-RLUSD", "XRP-USDC", "USDC-RLUSD"],
        description="Pairs to analyze (XRP pairs for trend, USDC-RLUSD for base MM)",
    )
    lookback_seconds: int = Field(
        default=3600, description="Lookback period for price change (seconds)"
    )
    rsi_period: int = Field(default=15, description="RSI period (minutes)")

    # Thresholds
    downtrend_price_pct: float = Field(
        default=-2.0, description="Price decline % to trigger downtrend mode"
    )
    oversold_rsi: float = Field(
        default=30.0, description="RSI threshold for oversold (downtrend)"
    )


async def run(config: Config, context: Any) -> str:
    """Check XRP trend and recommend mode."""
    chat_id = context._chat_id if hasattr(context, "_chat_id") else None
    client = await get_client(chat_id, context=context)

    if not client:
        return "No server available. Configure servers in /config."

    results = []

    try:
        # --- Fetch XRP Price Data ---
        # Get current XRP price (use XRP-RLUSD as reference)
        xrp_pair = "XRP-RLUSD"

        # Current price (mid)
        current_data = await client.market_data.get_market_data(
            connector_name="xrpl",
            trading_pair=xrp_pair,
            data_type="order_book",
        )
        if not current_data or "data" not in current_data:
            return f"Failed to fetch order book for {xrp_pair}"

        order_book = current_data["data"]
        best_bid = float(order_book.get("bids", [[0]])[0][0])
        best_ask = float(order_book.get("asks", [[999999]])[0][0])
        current_mid = (best_bid + best_ask) / 2

        # Historical price (lookback)
        # Note: For production, use historical candlestick data
        # For now, approximate using a second API call or cached data
        lookback_minutes = config.lookback_seconds // 60

        # Try to get historical price from candlestick data
        hist_data = await client.market_data.get_market_data(
            connector_name="xrpl",
            trading_pair=xrp_pair,
            data_type="candles",
            interval="1m",
            limit=lookback_minutes + 1,
        )

        price_change_pct = 0.0
        if hist_data and "data" in hist_data and len(hist_data["data"]) > 0:
            candles = hist_data["data"]
            # Most recent candle close = current price, oldest in lookback = historical price
            hist_price = float(candles[-1][4])  # Close price of oldest candle
            price_change_pct = ((current_mid - hist_price) / hist_price) * 100
        else:
            # Fallback: assume no change (conservative)
            price_change_pct = 0.0
            results.append(
                f"Warning: No historical data, using current price as baseline"
            )

        # --- Compute RSI (simplified) ---
        rsi_value = 50.0  # Default neutral
        if hist_data and "data" in hist_data and len(hist_data["data"]) > config.rsi_period:
            candles = hist_data["data"]
            closes = [float(c[4]) for c in candles[-config.rsi_period :]]

            # Simplified RSI calculation
            gains = []
            losses = []
            for i in range(1, len(closes)):
                change = closes[i] - closes[i - 1]
                if change > 0:
                    gains.append(change)
                    losses.append(0)
                else:
                    gains.append(0)
                    losses.append(abs(change))

            avg_gain = sum(gains) / len(gains) if gains else 0
            avg_loss = sum(losses) / len(losses) if losses else 0

            if avg_loss == 0:
                rsi_value = 100.0
            else:
                rs = avg_gain / avg_loss
                rsi_value = 100 - (100 / (1 + rs))

        # --- Determine Mode ---
        # CORRECT LOGIC:
        # - Uptrending/Bullish → ARBITRAGE (exploit XRP price differences)
        # - Downtrend/Choppy → MARKET_MAKING on USDC-RLUSD (safer)
        
        is_uptrend = (
            price_change_pct > abs(config.downtrend_price_pct) or rsi_value > 50.0
        )
        
        is_downtrend = (
            price_change_pct < config.downtrend_price_pct or rsi_value < config.oversold_rsi
        )

        # Priority: Uptrend (arbitrage) > Downtrend (MM) > Sideways (MM = safer)
        if is_uptrend:
            recommended_mode = "ARBITRAGE"  # Bullish → arbitrage
            reason = f"Uptrend (price +{price_change_pct:.1f}%, RSI {rsi_value:.0f})"
        elif is_downtrend:
            recommended_mode = "MARKET_MAKING"  # Bearish/Choppy → MM on USDC-RLUSD
            reason = f"Downtrend/Choppy (price {price_change_pct:.1f}%, RSI {rsi_value:.0f})"
        else:
            recommended_mode = "MARKET_MAKING"  # Sideways → default to MM (safer)
            reason = f"Sideways (price {price_change_pct:+.1f}%, RSI {rsi_value:.0f})"

        # --- Format Output ---
        results.append(f"=== XTIDE Mode Check ===")
        results.append(f"")
        results.append(f"XRP Price Analysis:")
        results.append(f"  Current Mid:     ${current_mid:.6f}")
        results.append(f"  {config.lookback_seconds // 3600}h Change:   {price_change_pct:+.2f}%")
        results.append(f"  RSI ({config.rsi_period}m): {rsi_value:.1f}")
        results.append(f"")
        results.append(f"Mode Decision:")
        results.append(f"  Uptrend (Arbitrage): Price > +{abs(config.downtrend_price_pct):.1f}% OR RSI > 50")
        results.append(f"  Downtrend (MM):    Price < {config.downtrend_price_pct:.1f}% OR RSI < {config.oversold_rsi:.0f}")
        results.append(f"  Detection: {reason}")
        results.append(f"")
        results.append(f"Recommended Mode: **{recommended_mode}**")
        results.append(f"")

        if recommended_mode == "DOWNTREND_ARBITRAGE":
            results.append(f"→ Switching to triangle arbitrage (XRP-RLUSD, XRP-USDC, EUROP-XRP)")
        else:
            results.append(f"→ Continuing market making (Base: USDC-RLUSD)")

        # Return structured data for agent to parse
        return {
            "recommended_mode": recommended_mode,
            "xrp_price_change_pct": price_change_pct,
            "xrp_rsi_15m": rsi_value,
            "current_xrp_mid": current_mid,
            "is_downtrend": is_downtrend,
            "text": "\n".join(results),
        }

    except Exception as e:
        return f"XTIDE mode check failed: {str(e)}"
