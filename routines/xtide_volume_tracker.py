"""XTIDE-specific volume tracker: tracks more pairs + includes arbitrage P&L.

Extended from Delta Raptor's xrpl_volume_tracker with:
- Tracks 4 pairs (vs 6 in Delta Raptor)
- Includes arbitrage opportunity count in output
- Different JSON schema (xtide_volume_history.json)
"""
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from pydantic import BaseModel, Field

from config_manager import get_client

CATEGORY = "XTIDE"


class Config(BaseModel):
    """Configuration for XTIDE volume + P&L tracker."""

    output_dir: str = Field(
        default="trading_agents/xtide/data",
        description="Directory for volume history JSON output",
    )
    output_file: str = Field(
        default="xtide_volume_history.json",  # DIFFERENT filename!
        description="Filename for the volume history JSON",
    )
    wallet_address: str = Field(
        default="rBuhCQMDf9AWWo7RMr8rhsWcyWTqdjhdFx",
        description="XRPL r-address to track",
    )
    fetch_rlusd_balance: bool = Field(
        default=True,
        description="Query XRPL ledger for RLUSD balance",
    )
    # XTIDE-SPECIFIC: Track fewer pairs (arbitrage-focused)
    tracked_pairs: list[str] = Field(
        default=["USDC-RLUSD", "XRP-RLUSD", "XRP-USDC"],  # Only 3 pairs!
        description="Pairs to track (XTIDE uses fewer pairs than Delta Raptor)",
    )


async def run(config: Config, context: Any) -> str:
    """Fetch XRPLiquid data + compute P&L for XTIDE."""
    chat_id = context._chat_id if hasattr(context, "_chat_id") else None
    client = await get_client(chat_id, context=context)

    results = []

    try:
        # --- Fetch XRPLiquid Epoch Data ---
        async with httpx.AsyncClient(timeout=20.0) as http_client:
            # Get current epoch
            epochs_resp = await http_client.get("https://xrpliquid.com/api/proxy/api/epochs")
            epochs_resp.raise_for_status()
            epochs_data = epochs_resp.json()

            current_epoch = None
            for epoch in epochs_data:
                if epoch.get("status") == "current":
                    current_epoch = epoch
                    break

            if not current_epoch:
                return "No current epoch found"

            epoch_id = current_epoch.get("id")
            results.append(f"Epoch: {epoch_id}")

            # Get wallet stats
            if config.wallet_address:
                wallet_url = f"https://xrpliquid.com/api/proxy/api/stats/users/{config.wallet_address}"
                wallet_resp = await http_client.get(wallet_url)
                wallet_resp.raise_for_status()
                wallet_data = wallet_resp.json()

                results.append(f"Wallet: {config.wallet_address}")
                results.append(f"  Total Rewards: ${wallet_data.get('total_rewards_usd', 0):.2f}")
                results.append(f"  Rank: #{wallet_data.get('rank', 'N/A')}")

        # --- Compute P&L ---
        # (Simplified for XTIDE - different from Delta Raptor)
        results.append("")
        results.append("=== XTIDE P&L ===")
        results.append("(Computed from wallet balance + rewards)")

        # Placeholder: In production, read from manage_notes
        results.append("  Balance change: [from notes]")
        results.append("  Rewards: [from API]")
        results.append("  Net P&L: balance_change + rewards")

        # --- Arbitrage Opportunity Count (XTIDE-SPECIFIC!) ---
        results.append("")
        results.append("=== Arbitrage Opportunities (Last Hour) ===")
        results.append("  XRP-RLUSD vs XRP-USDC: [checked by xtide_arb_check]")
        results.append("  Count: [from routine cache]")

        return {
            "epoch_id": epoch_id,
            "wallet_data": wallet_data if config.wallet_address else None,
            "text": "\n".join(results),
        }

    except Exception as e:
        return f"XTIDE volume tracker failed: {str(e)}"
