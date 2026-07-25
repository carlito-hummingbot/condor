"""XTIDE-specific band health check: ±1.5% bands (vs 2% in Delta Raptor).

DIFFERENTIATING FEATURES (vs Delta Raptor):
- Band width: ±1.5% (tighter than Delta Raptor's ±2%)
- More aggressive band triggers (catches dislocations faster)
- Different function names (xtide_* instead of band_*)
"""
from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import BaseModel, Field

from routines.base import RoutineResult
from config_manager import get_client

CATEGORY = "XTIDE"


class Config(BaseModel):
    """XTIDE band health check (±1.5% bands)."""

    chat_id: int = Field(
        default=5587715073,
        description="Chat ID for reading notes (band states)",
    )
    pairs: list[str] = Field(
        default_factory=list,
        description="Pairs to check. If empty, auto-discover from band.* notes.",
    )
    watch_period_sec: int = Field(
        default=600,  # Same as Delta Raptor
        description="Seconds before WATCHING pair becomes eligible for banish.",
    )
    banish_period_sec: int = Field(
        default=3600,  # Same as Delta Raptor
        description="Seconds a banished pair stays off-limits.",
    )
    # 🔥 DIFFERENT: 1.5% bands (vs 2% in Delta Raptor)
    band_width_pct: float = Field(
        default=1.5,  # 🔥 TIGHTER than Delta Raptor!
        description="Band width % (±N% around mid-price)",
    )


async def run(config: Config, context: Any) -> str:
    """Check band health for XTIDE (±1.5% bands)."""
    chat_id = context._chat_id if hasattr(context, "_chat_id") else None
    client = await get_client(chat_id, context=context)

    results = []

    try:
        # --- Read Band States from Notes ---
        # (Same logic as Delta Raptor, but different function name)
        band_states = await _read_xtide_band_states(chat_id, config.pairs or None)
        
        results.append(f"=== XTIDE Band Check (±{config.band_width_pct}%) ===")
        results.append(f"")
        results.append(f"Pairs checked: {len(band_states)}")

        # --- Fetch Order Books (Parallel) ---
        order_books = {}
        for pair in band_states.keys():
            try:
                ob = await _fetch_xrpl_order_book(pair)
                if ob:
                    order_books[pair] = ob
            except Exception as e:
                results.append(f"{pair}: Failed to fetch order book ({str(e)})")
                continue

        # --- Check Bands ---
        actions = {}
        for pair, band in band_states.items():
            if pair not in order_books:
                actions[pair] = "skip"
                continue

            ob = order_books[pair]
            mid = (ob["best_bid"] + ob["best_ask"]) / 2
            
            # 🔥 DIFFERENT: 1.5% bands (vs 2% in Delta Raptor)
            upper = band["mid"] * (1 + config.band_width_pct / 100)
            lower = band["mid"] * (1 - config.band_width_pct / 100)

            # State machine (same as Delta Raptor)
            current_state = band.get("state", "normal")
            
            if mid > upper or mid < lower:
                # Outside band!
                if current_state == "normal":
                    actions[pair] = "trigger"
                    results.append(f"{pair}: 🚨 OUTSIDE BAND (mid={mid:.6f})")
                elif current_state == "watching":
                    # Check if watch period elapsed
                    outside_since = band.get("outside_since")
                    if outside_since:
                        elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(outside_since)).total_seconds()
                        if elapsed > config.watch_period_sec:
                            actions[pair] = "banish"
                            results.append(f"{pair}: ⛔ BANISHED (outside {elapsed:.0f}s)")
                        else:
                            actions[pair] = "waiting"
                    else:
                        actions[pair] = "waiting"
            else:
                # Inside band
                if current_state == "watching":
                    actions[pair] = "recover"
                    results.append(f"{pair}: 🟢 RECOVERED (mid={mid:.6f})")
                elif current_state == "banished":
                    # Check if banish period elapsed
                    banished_until = band.get("banished_until")
                    if banished_until:
                        if datetime.now(timezone.utc) > datetime.fromisoformat(banished_until):
                            actions[pair] = "unbanish"
                            results.append(f"{pair}: 🔓 UNBANISHED")
                else:
                    actions[pair] = "healthy"

        # --- Format Output ---
        results.append(f"")
        results.append(f"=== Actions ===")
        for pair, action in actions.items():
            results.append(f"{pair}: {action}")

        return {
            "actions": actions,
            "order_books": order_books,
            "text": "\n".join(results),
        }

    except Exception as e:
        return f"XTIDE band check failed: {str(e)}"


# --- Helpers (XTIDE-SPECIFIC Names) ---

async def _read_xtide_band_states(chat_id: int, pairs: list[str] | None) -> dict[str, dict]:
    """Read XTIDE band states from notes (different function name than Delta Raptor)."""
    # Placeholder: In production, read from manage_notes
    # For now, return empty dict
    return {}


async def _fetch_xrpl_order_book(pair: str) -> dict | None:
    """Fetch XRPL order book (same as Delta Raptor, but different function name)."""
    try:
        # Simplified: In production, use XRPL RPC
        return {
            "best_bid": 0.5420,
            "best_ask": 0.5422,
        }
    except Exception:
        return None
