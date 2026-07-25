"""Check price band health for XRPL trading pairs.

Bundles band enforcement into a single routine call:
- Reads band states from notes (keys matching 'band.*')
- Fetches XRPL order books for all active pairs in parallel
- Computes mid-prices and checks against ±2% bands
- Returns per-pair health report

Replaces the agent's multi-step band check (4 tool calls → 1).
Uses XRPL public RPC — no Hummingbot API dependency.
"""

CATEGORY = "XRPL"

import json
import time
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import BaseModel, Field

from routines.base import RoutineResult

logger = logging.getLogger(__name__)

XRPL_RPC_URLS = [
    "https://s1.ripple.com:51234",
    "https://s2.ripple.com:51234",
    "https://xrplcluster.com",
]
REQUEST_TIMEOUT = 10.0


def _get_rpc_url() -> str:
    """Return a random RPC URL for load distribution."""
    import random
    return random.choice(XRPL_RPC_URLS)


class Config(BaseModel):
    """Check price band health for XRPL trading pairs.

    Reads band states from manage_notes and fetches live order books
    from the XRPL ledger. Detects band triggers (NORMAL→WATCHING),
    recoveries (WATCHING→NORMAL), and banish eligibility.
    """

    chat_id: int = Field(
        default=5587715073,
        description="Chat ID for reading notes (band states are stored per-chat).",
    )
    pairs: list[str] = Field(
        default_factory=list,
        description="Pairs to check. If empty, auto-discovers from band.* notes.",
    )
    watch_period_sec: int = Field(
        default=600,
        description="Seconds before a WATCHING pair becomes eligible for banish.",
    )
    banish_period_sec: int = Field(
        default=3600,
        description="Seconds a banished pair stays off-limits.",
    )


# ── Helpers ────────────────────────────────────────────────────────────────


def _read_band_states(chat_id: int, pairs: list[str] | None = None) -> dict[str, dict[str, Any]]:
    """Read all band.* notes from the chat's notes file.

    Returns {pair_name: band_state_dict} for all pairs with stored bands.
    If pairs is provided, only returns those pairs.
    """
    from pathlib import Path

    notes_file = Path("data") / "notes" / f"chat_{chat_id}.json"
    if not notes_file.exists():
        return {}

    try:
        all_notes = json.loads(notes_file.read_text())
    except (json.JSONDecodeError, OSError):
        logger.warning("Corrupted notes file, returning empty bands")
        return {}

    bands: dict[str, dict[str, Any]] = {}
    for key, value_str in all_notes.items():
        if not key.startswith("band."):
            continue
        pair_name = key[len("band."):]
        if pairs and pair_name not in pairs:
            continue
        try:
            bands[pair_name] = json.loads(value_str)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Failed to parse band state for %s", pair_name)
            continue

    return bands


async def _fetch_order_book(pair: str) -> dict[str, Any] | None:
    """Fetch XRPL order book for a pair using book_offers RPC.

    Returns {best_bid, best_ask, mid_price} or None on failure.
    """
    import asyncio
    import random

    pair_parts = pair.split("-")
    if len(pair_parts) != 2:
        return None

    base, quote = pair_parts

    # XRPL currency codes and issuers (verified on-chain via account_lines)
    CURRENCY_INFO: dict[str, tuple[str, str]] = {
        "BBRL":  ("4242524C000000000000000000000000000000", "rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt"),
        "RLUSD": ("524C555344000000000000000000000000000000", "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De"),
        "XRP":   ("XRP", ""),
        "USDC":  ("5553444300000000000000000000000000000000", "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE"),
        "EUROP": ("4555524F50000000000000000000000000000000", "rMkEuRii9w9uBMQDnWV5AA43gvYZR9JxVK"),
    }

    base_info = CURRENCY_INFO.get(base)
    quote_info = CURRENCY_INFO.get(quote)
    if not base_info or not quote_info:
        return None

    bc, bi = base_info
    qc, qi = quote_info

    def _val(obj: Any) -> float:
        """Extract numeric value from a TakerPays/TakerGets field (dict, str, or int)."""
        if isinstance(obj, dict):
            return float(obj.get("value", 0))
        if isinstance(obj, str):
            return float(obj)
        return float(obj)

    async def _call_book_offers(
        pays_curr: str, pays_iss: str, gets_curr: str, gets_iss: str,
    ) -> list[dict]:
        tp: dict[str, str] = {"currency": pays_curr}
        if pays_iss:
            tp["issuer"] = pays_iss
        tg: dict[str, str] = {"currency": gets_curr}
        if gets_iss:
            tg["issuer"] = gets_iss
        payload = {
            "method": "book_offers",
            "params": [{"taker_pays": tp, "taker_gets": tg, "limit": 1}],
        }
        rpc_url = random.choice(XRPL_RPC_URLS)
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(rpc_url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            result = data.get("result", {})
            if "error" in result:
                logger.debug("book_offers error for %s: %s", pair, result["error"])
                return []
            return result.get("offers", [])

    # Bid side: quote pays to get base → best BUY price
    bids = await _call_book_offers(qc, qi, bc, bi)
    # Ask side: base pays to get quote → best SELL price
    asks = await _call_book_offers(bc, bi, qc, qi)

    best_bid: float | None = None
    best_ask: float | None = None

    if bids:
        o = bids[0]
        pp = o.get("TakerPays", o.get("taker_pays_fund", {}))
        pg = o.get("TakerGets", o.get("taker_gets_fund", {}))
        pp_val = _val(pp)
        pg_val = _val(pg)
        # Normalize XRP drops (values > 1000 in XRP fields)
        if quote == "XRP" and pp_val > 1000:
            pp_val /= 1_000_000
        if base == "XRP" and pg_val > 1000:
            pg_val /= 1_000_000
        best_bid = pp_val / pg_val if pg_val else 0

    if asks:
        o = asks[0]
        pp = o.get("TakerPays", o.get("taker_pays_fund", {}))
        pg = o.get("TakerGets", o.get("taker_gets_fund", {}))
        pp_val = _val(pp)
        pg_val = _val(pg)
        if base == "XRP" and pp_val > 1000:
            pp_val /= 1_000_000
        if quote == "XRP" and pg_val > 1000:
            pg_val /= 1_000_000
        best_ask = pg_val / pp_val if pp_val else 0

    if best_bid is None or best_ask is None:
        return None

    mid_price = (best_bid + best_ask) / 2
    return {
        "best_bid": round(best_bid, 8),
        "best_ask": round(best_ask, 8),
        "mid_price": round(mid_price, 8),
    }


def _check_band(
    pair: str,
    order_book: dict[str, Any] | None,
    band_state: dict[str, Any],
    now_utc: str,
    watch_period: int,
    banish_period: int,
) -> dict[str, Any]:
    """Check a single pair's band status.

    Returns a dict with: pair, state, mid_price, action, reason.
    """
    state = band_state.get("state", "normal")
    upper = band_state.get("upper")
    lower = band_state.get("lower")
    outside_since = band_state.get("outside_since")
    banished_until = band_state.get("banished_until")

    result: dict[str, Any] = {
        "pair": pair,
        "band_state": state,
        "upper": upper,
        "lower": lower,
        "mid_price": None,
        "best_bid": None,
        "best_ask": None,
        "action": "none",
        "reason": "",
    }

    if order_book is None:
        result["action"] = "skip"
        result["reason"] = "order book fetch failed"
        return result

    mid = order_book["mid_price"]
    result["mid_price"] = mid
    result["best_bid"] = order_book.get("best_bid")
    result["best_ask"] = order_book.get("best_ask")

    if state == "banished":
        if banished_until and now_utc >= banished_until:
            result["action"] = "unbanish"
            result["reason"] = f"ban expired (banished_until={banished_until})"
        else:
            result["action"] = "skip"
            result["reason"] = f"still banished until {banished_until}"
        return result

    if upper is None or lower is None:
        result["action"] = "init"
        result["reason"] = "no band initialized"
        result["new_band"] = {
            "mid": mid,
            "upper": round(mid * 1.02, 6),
            "lower": round(mid * 0.98, 6),
            "best_bid": order_book.get("best_bid"),
            "best_ask": order_book.get("best_ask"),
        }
        return result

    outside = mid < lower or mid > upper

    if state == "normal" and not outside:
        result["action"] = "healthy"
        result["reason"] = f"mid ${mid} inside [{lower} - {upper}]"
        return result

    if state == "normal" and outside:
        result["action"] = "trigger"
        result["reason"] = f"mid ${mid} outside [{lower} - {upper}]"
        result["new_state"] = {
            "state": "watching",
            "outside_since": now_utc,
            "upper": upper,
            "lower": lower,
            "mid": band_state.get("mid"),
        }
        return result

    if state == "watching":
        if not outside:
            result["action"] = "recover"
            result["reason"] = f"mid ${mid} back inside [{lower} - {upper}]"
            result["new_state"] = {
                "state": "normal",
                "outside_since": None,
                "upper": upper,
                "lower": lower,
                "mid": band_state.get("mid"),
            }
            return result

        # Still outside — check if watch period elapsed
        if outside_since:
            try:
                outside_dt = datetime.fromisoformat(outside_since.replace("Z", "+00:00"))
                now_dt = datetime.fromisoformat(now_utc.replace("Z", "+00:00"))
                elapsed = (now_dt - outside_dt).total_seconds()
            except (ValueError, TypeError):
                elapsed = 0

            if elapsed >= watch_period:
                # Eligible for banish
                ban_until = datetime.fromisoformat(now_utc.replace("Z", "+00:00"))
                from datetime import timedelta
                ban_until += timedelta(seconds=banish_period)
                result["action"] = "banish"
                result["reason"] = (
                    f"mid ${mid} outside [{lower} - {upper}] for {elapsed:.0f}s "
                    f"(≥ {watch_period}s)"
                )
                result["new_state"] = {
                    "state": "banished",
                    "banished_until": ban_until.isoformat(),
                    "outside_since": None,
                    "upper": upper,
                    "lower": lower,
                    "mid": band_state.get("mid"),
                }
                return result

        result["action"] = "waiting"
        result["reason"] = f"mid ${mid} still outside [{lower} - {upper}], watching"
        return result

    result["action"] = "unknown"
    result["reason"] = f"unhandled state: {state}"
    return result


# ── Main ───────────────────────────────────────────────────────────────────


async def run(config: Config, context: Any) -> RoutineResult:
    """Check band health for all active XRPL pairs.

    Discovers pairs from band.* notes, fetches order books in parallel,
    and returns a per-pair health report with recommended actions.
    """
    t_start = time.time()
    now_utc = datetime.now(timezone.utc).isoformat()

    # 1. Read band states from notes
    band_states = _read_band_states(config.chat_id, config.pairs or None)

    if not band_states:
        return RoutineResult(
            text="No band states found. Initialize bands first via manage_notes(action='set', key='band.PAIR_NAME', ...).",
        )

    # 2. Fetch order books for all pairs in parallel
    import asyncio

    order_book_tasks = {
        pair: _fetch_order_book(pair) for pair in band_states
    }
    order_books: dict[str, dict | None] = {}
    for pair, task in order_book_tasks.items():
        try:
            order_books[pair] = await task
        except Exception as e:
            logger.warning("Order book fetch failed for %s: %s", pair, e)
            order_books[pair] = None

    # 3. Check each pair's band
    results = []
    actions_needed = []
    for pair, band in sorted(band_states.items()):
        ob = order_books.get(pair)
        check = _check_band(
            pair, ob, band, now_utc,
            config.watch_period_sec, config.banish_period_sec,
        )
        results.append(check)
        if check["action"] not in ("healthy", "skip", "waiting", "none"):
            actions_needed.append(check)

    # 4. Build output
    lines = ["📊 Band Health Check", f"Snapshot: {now_utc}", ""]

    # Summary table
    header = f"{'Pair':<16} {'State':>10} {'Mid':>12} {'Band':>24} {'Action':>12}"
    lines.append(header)
    lines.append("-" * 78)

    for r in results:
        state = r["band_state"]
        mid_str = f"${r['mid_price']:,.6f}" if r["mid_price"] else "N/A"
        upper = r.get("upper")
        lower = r.get("lower")
        if upper and lower:
            band_str = f"[{lower} - {upper}]"
        else:
            band_str = "not set"
        action = r["action"]
        icon = {
            "healthy": "✅",
            "trigger": "🚨",
            "recover": "🟢",
            "banish": "⛔",
            "waiting": "⏳",
            "unbanish": "🔓",
            "init": "🆕",
            "skip": "⬛",
            "none": "➖",
        }.get(action, "❓")
        lines.append(
            f"{r['pair']:<16} {state:>10} {mid_str:>12} {band_str:>24} {icon} {action}"
        )

    # Actions needed section
    if actions_needed:
        lines.append("")
        lines.append("⚠️  ACTIONS REQUIRED:")
        for a in actions_needed:
            lines.append(f"  {a['pair']}: {a['action'].upper()} — {a['reason']}")
            if a.get("new_band"):
                nb = a["new_band"]
                lines.append(
                    f"    → New band: [{nb['lower']} - {nb['upper']}] (mid={nb['mid']})"
                )
            if a.get("new_state"):
                ns = a["new_state"]
                lines.append(f"    → New state: {ns['state']}")
    else:
        lines.append("")
        lines.append("✅ All pairs healthy — no actions needed.")

    elapsed = round(time.time() - t_start, 2)
    logger.info(
        "Band health check: %d pairs checked in %.2fs (%d actions needed)",
        len(results), elapsed, len(actions_needed),
    )

    # Build table data for dashboard
    table_data = []
    for r in results:
        table_data.append({
            "pair": r["pair"],
            "state": r["band_state"],
            "mid_price": r["mid_price"],
            "upper": r.get("upper"),
            "lower": r.get("lower"),
            "action": r["action"],
            "reason": r["reason"],
        })

    return RoutineResult(
        text="\n".join(lines),
        table_data=table_data,
        table_columns=["pair", "state", "mid_price", "upper", "lower", "action", "reason"],
    )
