"""Check triangle arbitrage opportunities between XRPL DEX pairs.

Computes XRP price in each pair (XRP-RLUSD, XRP-USDC, EUROP-XRP) and identifies
price differences > threshold (default: 0.1% = 10 bps). If arbitrage exists,
returns the best opportunity (buy at lower price, sell at higher price).

Output: arbitrage_opportunities list, best_opportunity dict
"""
from decimal import Decimal
from typing import Any

import httpx
from pydantic import BaseModel, Field

from config_manager import get_client

CATEGORY = "XTIDE"


class Config(BaseModel):
    """Check triangle arbitrage between XRPL DEX pairs."""

    pairs: list[str] = Field(
        default=["XRP-RLUSD", "XRP-USDC", "EUROP-XRP"],
        description="Pairs to check for triangle arbitrage",
    )
    arbitrage_threshold_pct: float = Field(
        default=0.08, description="Minimum price difference % to execute arbitrage (lowered from 0.1% to capture more opportunities)"
    )
    check_interval_seconds: int = Field(
        default=60, description="How often to check (seconds)"
    )

    # Execution parameters
    max_position_size_xrp: float = Field(
        default=100.0, description="Max XRP position size for arbitrage"
    )
    execution_slippage_pct: float = Field(
        default=0.05, description="Max slippage for arbitrage execution"
    )


async def run(config: Config, context: Any) -> str:
    """Check arbitrage opportunities between pairs."""
    chat_id = context._chat_id if hasattr(context, "_chat_id") else None
    client = await get_client(chat_id, context=context)

    if not client:
        return "No server available. Configure servers in /config."

    results = []
    arbitrage_opportunities = []
    xrp_prices = {}

    try:
        # --- Fetch Order Books for All Pairs ---
        for pair in config.pairs:
            try:
                data = await client.market_data.get_market_data(
                    connector_name="xrpl",
                    trading_pair=pair,
                    data_type="order_book",
                )

                if not data or "data" not in data:
                    results.append(f"{pair}: No order book data")
                    continue

                order_book = data["data"]
                best_bid = float(order_book.get("bids", [[0]])[0][0])
                best_ask = float(order_book.get("asks", [[999999]])[0][0])
                mid_price = (best_bid + best_ask) / 2

                xrp_prices[pair] = {
                    "mid": mid_price,
                    "best_bid": best_bid,
                    "best_ask": best_ask,
                }

                results.append(
                    f"{pair}: Mid=${mid_price:.6f} (Bid: ${best_bid:.6f}, Ask: ${best_ask:.6f})"
                )

            except Exception as e:
                results.append(f"{pair}: Error fetching order book: {str(e)}")
                continue

        # --- Compute XRP Prices in Each Pair ---
        # XRP-RLUSD: direct XRP price in RLUSD
        # XRP-USDC: direct XRP price in USDC
        # EUROP-XRP: XRP price in EUROP (need EUROP/USD conversion, skip for now)

        results.append(f"")
        results.append(f"=== XRP Price Comparison ===")

        xrp_usd_prices = {}
        for pair, data in xrp_prices.items():
            if "XRP" in pair and "-" in pair:
                # Extract quote token
                quote_token = pair.split("-")[1]

                if quote_token in ["RLUSD", "USDC"]:
                    # Direct XRP/stablecoin pair
                    xrp_usd_prices[pair] = data["mid"]
                    results.append(f"{pair}: ${data['mid']:.6f} (XRP/{quote_token})")
                elif "EUROP" in pair and "XRP" in pair:
                    # EUROP/XRP — need to invert to get XRP price
                    # If EUROP/XRP = 0.5, then XRP = 1/0.5 = 2 EUROP per XRP
                    # But we need USD value — skip for now (would need EUROP/USD feed)
                    results.append(
                        f"{pair}: ${data['mid']:.6f} (EUROP/XRP, need EUROP/USD for XRP USD price)"
                    )

        # --- Check Arbitrage Opportunities ---
        results.append(f"")
        results.append(f"=== Arbitrage Analysis ===")

        # Compare XRP-RLUSD vs XRP-USDC
        if "XRP-RLUSD" in xrp_usd_prices and "XRP-USDC" in xrp_usd_prices:
            price_rlusd = xrp_usd_prices["XRP-RLUSD"]
            price_usdc = xrp_usd_prices["XRP-USDC"]

            # Price difference %
            price_diff_pct = ((price_usdc - price_rlusd) / price_rlusd) * 100

            results.append(f"")
            results.append(f"XRP-RLUSD vs XRP-USDC:")
            results.append(f"  XRP-RLUSD: ${price_rlusd:.6f}")
            results.append(f"  XRP-USDC:  ${price_usdc:.6f}")
            results.append(f"  Diff: {price_diff_pct:+.3f}%")

            if abs(price_diff_pct) > config.arbitrage_threshold_pct:
                if price_diff_pct > 0:
                    # XRP-USDC higher → BUY at XRP-RLUSD, SELL at XRP-USDC
                    buy_pair = "XRP-RLUSD"
                    sell_pair = "XRP-USDC"
                    buy_price = xrp_prices["XRP-RLUSD"]["best_ask"]  # Pay ask
                    sell_price = xrp_prices["XRP-USDC"]["best_bid"]  # Receive bid
                else:
                    # XRP-RLUSD higher → BUY at XRP-USDC, SELL at XRP-RLUSD
                    buy_pair = "XRP-USDC"
                    sell_pair = "XRP-RLUSD"
                    buy_price = xrp_prices["XRP-USDC"]["best_ask"]
                    sell_price = xrp_prices["XRP-RLUSD"]["best_bid"]

                # Calculate profit (before fees)
                profit_per_xrp = sell_price - buy_price
                profit_pct = (profit_per_xrp / buy_price) * 100

                opportunity = {
                    "buy_pair": buy_pair,
                    "sell_pair": sell_pair,
                    "buy_price": buy_price,
                    "sell_price": sell_price,
                    "profit_per_xrp": profit_per_xrp,
                    "profit_pct": profit_pct,
                    "price_diff_pct": abs(price_diff_pct),
                }
                arbitrage_opportunities.append(opportunity)

                results.append(f"")
                results.append(f"🟢 ARBITRAGE OPPORTUNITY:")
                results.append(f"  BUY:  {buy_pair} at ${buy_price:.6f}")
                results.append(f"  SELL: {sell_pair} at ${sell_price:.6f}")
                results.append(f"  Profit: ${profit_per_xrp:.6f}/XRP ({profit_pct:+.3f}%)")
                results.append(
                    f"  Est. Profit (10 XRP): ${profit_per_xrp * 10:.4f}"
                )
            else:
                results.append(f"  No arbitrage (diff < {config.arbitrage_threshold_pct:.1f}%)")

        # --- Select Best Opportunity ---
        best_opportunity = None
        if arbitrage_opportunities:
            # Sort by profit_pct descending
            arbitrage_opportunities.sort(key=lambda x: x["profit_pct"], reverse=True)
            best_opportunity = arbitrage_opportunities[0]

            results.append(f"")
            results.append(f"=== Best Opportunity ===")
            results.append(f"BUY:  {best_opportunity['buy_pair']} at ${best_opportunity['buy_price']:.6f}")
            results.append(f"SELL: {best_opportunity['sell_pair']} at ${best_opportunity['sell_price']:.6f}")
            results.append(
                f"Profit: ${best_opportunity['profit_per_xrp']:.6f}/XRP ({best_opportunity['profit_pct']:+.2f}%)"
            )

        # --- Output ---
        results.append(f"")
        results.append(f"=== Summary ===")
        results.append(f"Opportunities Found: {len(arbitrage_opportunities)}")
        results.append(f"Best Profit: {best_opportunity['profit_pct']:.3f}%" if best_opportunity else "No arbitrage available")

        return {
            "arbitrage_opportunities": arbitrage_opportunities,
            "best_opportunity": best_opportunity,
            "xrp_prices": xrp_prices,
            "text": "\n".join(results),
        }

    except Exception as e:
        return f"XTIDE arbitrage check failed: {str(e)}"
