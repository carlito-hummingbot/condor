"""Fetch XRPLiquid epoch volume data and leaderboard PnL for tracked XRPL pairs.

Records per-pair epoch volume snapshots AND per-wallet leaderboard stats
from the XRPLiquid API. Designed to run hourly via the agent's manage_routines
MCP tool or Condor cron.

Data sources:
  - https://xrpliquid.com/api/proxy/api/epochs        (market stats + leaderboard)
  - https://xrpliquid.com/api/proxy/api/stats/users/{address}  (per-wallet detail)

Output: JSON history file with cumulative snapshots + delta analysis + wallet PnL.
"""

CATEGORY = "XRPL"

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from pydantic import BaseModel, Field

from routines.base import RoutineResult

logger = logging.getLogger(__name__)

# ── Tracked Pairs ──────────────────────────────────────────────────────────
TRACKED_PAIRS: list[str] = [
    "BBRL-RLUSD",
    "XRP-RLUSD",
    "USDC-RLUSD",
    "EUROP-XRP",
    "XRP-USDC",
    "EUROP-RLUSD",
]

# ── API ────────────────────────────────────────────────────────────────────
XRPLIQUID_EPOCHS = "https://xrpliquid.com/api/proxy/api/epochs"
XRPLIQUID_USER_STATS = "https://xrpliquid.com/api/proxy/api/stats/users"
XRPL_RPC_URL = "https://xrplcluster.com"
REQUEST_TIMEOUT = 20.0


# ── Config ─────────────────────────────────────────────────────────────────
class Config(BaseModel):
    """Configuration for the XRPL volume + PnL tracker routine."""

    output_dir: str = Field(
        default="data",
        description="Directory for volume history JSON output "
        "(relative to project root or absolute)",
    )
    output_file: str = Field(
        default="xrpl_volume_history.json",
        description="Filename for the volume history JSON",
    )
    wallet_address: str = Field(
        default="",
        description="XRPL r-address to track on the leaderboard. "
        "Leave empty to skip PnL tracking.",
    )
    fetch_rlusd_balance: bool = Field(
        default=True,
        description="Query XRPL ledger for RLUSD balance of wallet_address. "
        "Enables on-chain PnL tracking independent of Hummingbot API.",
    )


# ── Helpers ────────────────────────────────────────────────────────────────


def _resolve_output_path(config: Config) -> Path:
    """Resolve the output file path — absolute or relative to project root."""
    p = Path(config.output_dir)
    if not p.is_absolute():
        p = Path(__file__).parent.parent / p
    p.mkdir(parents=True, exist_ok=True)
    return p / config.output_file


def _load_history(path: Path) -> dict[str, Any]:
    """Load existing history or return empty dict."""
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            logger.warning("Corrupted history file, starting fresh")
    return {"snapshots": [], "pair_metadata": {}, "wallet_metadata": {}}


def _save_history(path: Path, history: dict[str, Any]) -> None:
    """Atomically write history to disk."""
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(history, indent=2, default=str))
    tmp.replace(path)


async def _fetch_epoch_data() -> dict[str, Any]:
    """Fetch current epoch stats from XRPLiquid proxy API."""
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await client.get(XRPLIQUID_EPOCHS)
        resp.raise_for_status()
        data = resp.json()

    if not isinstance(data, list) or not data:
        raise ValueError("Unexpected API response: expected non-empty list")

    current = None
    for epoch in data:
        if epoch.get("status") == "current":
            current = epoch
            break
    if current is None:
        current = data[0]

    return current


async def _fetch_wallet_stats(wallet_address: str) -> dict[str, Any] | None:
    """Fetch per-wallet leaderboard stats from XRPLiquid API."""
    if not wallet_address:
        return None
    url = f"{XRPLIQUID_USER_STATS}/{wallet_address}"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


async def _fetch_xrpl_balance(
    wallet_address: str,
) -> dict[str, Any] | None:
    """Fetch RLUSD balance from the XRPL ledger via public RPC.

    Returns dict with rlusd_balance and xrp_balance, or None on failure.
    """
    if not wallet_address:
        return None

    payload = {
        "method": "account_lines",
        "params": [{
            "account": wallet_address,
            "ledger_index": "current",
            "peer": "",
            "limit": 200,
        }],
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(XRPL_RPC_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
        result = data.get("result", {})

    rlusd_balance = 0.0
    xrp_drops = "0"

    for line in result.get("lines", []):
        currency = line.get("currency", "")
        if currency == "524C555344000000000000000000000000000000":  # RLUSD hex
            rlusd_balance = float(line.get("balance", "0"))
        elif currency == "XRP":
            xrp_drops = line.get("balance", "0")

    # Also fetch XRP balance from account_info
    try:
        acct_payload = {
            "method": "account_info",
            "params": [{
                "account": wallet_address,
                "ledger_index": "current",
                "strict": True,
            }],
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp2 = await client.post(XRPL_RPC_URL, json=acct_payload)
            resp2.raise_for_status()
            data2 = resp2.json()
            aresult = data2.get("result", {})
            acct_data = aresult.get("account_data", {})
            xrp_drops = acct_data.get("Balance", xrp_drops)
    except Exception:
        pass

    xrp_balance = float(xrp_drops) / 1_000_000

    return {
        "rlusd_balance": round(rlusd_balance, 6),
        "xrp_balance": round(xrp_balance, 6),
    }


def _extract_pair_stats(
    epoch_data: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    """Extract volume stats for tracked pairs from epoch data."""
    market_stats: list[dict] = epoch_data.get("market_stats", [])
    stats_by_market: dict[str, dict] = {m["market"]: m for m in market_stats}

    result: dict[str, dict[str, Any]] = {}
    for pair in TRACKED_PAIRS:
        stats = stats_by_market.get(pair)
        if stats:
            result[pair] = {
                "total_orders": stats.get("total_orders", 0),
                "total_usd_volume": round(stats.get("total_usd_volume", 0), 4),
                "total_points": round(stats.get("total_points", 0), 2),
                "unique_addresses": stats.get("unique_addresses", 0),
            }
        else:
            logger.warning("Pair %s not found in epoch data", pair)
            result[pair] = {
                "total_orders": 0,
                "total_usd_volume": 0,
                "total_points": 0,
                "unique_addresses": 0,
            }
    return result


def _extract_wallet_leaderboard(
    wallet_data: dict[str, Any] | None,
    epoch_id: str,
) -> dict[str, Any] | None:
    """Extract leaderboard stats for the wallet from the current epoch.

    Returns a compact dict with: rank, reward_amount, reward_token,
    total_volume_usd, total_rewards_usd_all_time, and per-market breakdown.
    """
    if not wallet_data:
        return None

    # All-time totals
    result: dict[str, Any] = {
        "total_rewards_usd": round(
            wallet_data.get("total_rewards_usd", 0), 4
        ),
        "total_volume_usd": round(
            wallet_data.get("total_volume_usd", 0), 4
        ),
        "total_points": round(wallet_data.get("total_points", 0), 2),
        "total_orders": wallet_data.get("total_orders", 0),
    }

    # Current epoch detail
    for epoch in wallet_data.get("epochs", []):
        if epoch.get("epoch_id") == epoch_id:
            result["current_epoch"] = {
                "rank": epoch.get("rank"),
                "reward_amount": round(epoch.get("reward_amount", 0), 6),
                "reward_token": epoch.get("reward_token", ""),
                "total_points": round(epoch.get("total_points", 0), 2),
                "total_volume_usd": round(
                    epoch.get("total_volume_usd", 0), 4
                ),
                "total_orders": epoch.get("total_orders", 0),
                "status": epoch.get("status", "pending"),
                "markets": [
                    {
                        "market": m.get("market_id", "?"),
                        "volume_usd": round(m.get("total_volume_usd", 0), 4),
                        "reward_amount": round(m.get("reward_amount", 0), 6),
                        "contribution_pct": round(
                            m.get("percentage_contribution", 0), 2
                        ),
                    }
                    for m in epoch.get("markets", [])
                ],
            }

            # Per-market reward so agent can see which pair earned what
            result["market_rewards"] = {
                m.get("market_id", "?"): round(
                    m.get("reward_amount", 0), 6
                )
                for m in epoch.get("markets", [])
            }
            break

    return result


def _compute_delta(
    current: dict[str, dict[str, Any]],
    previous_snapshot: dict[str, Any] | None,
    current_epoch: str,
) -> dict[str, dict[str, Any]]:
    """Compute volume delta between current and previous snapshot.

    Detects epoch changes and resets deltas to zero when the epoch rolls
    over, since cross-epoch volume comparisons are meaningless.
    """
    if not previous_snapshot:
        return {
            pair: {"volume_delta": 0, "volume_delta_pct": 0, "epoch_reset": False}
            for pair in current
        }

    previous = previous_snapshot.get("pairs", {})
    prev_epoch = previous_snapshot.get("epoch_id", "")
    epoch_changed = bool(prev_epoch and current_epoch and prev_epoch != current_epoch)

    delta: dict[str, dict[str, Any]] = {}
    for pair, cur in current.items():
        if epoch_changed:
            delta[pair] = {
                "volume_delta": 0,
                "volume_delta_pct": 0,
                "epoch_reset": True,
            }
        else:
            prev = previous.get(pair, {})
            prev_vol = prev.get("total_usd_volume", 0)
            cur_vol = cur["total_usd_volume"]
            vol_delta = round(cur_vol - prev_vol, 4)
            pct = (
                round((vol_delta / prev_vol * 100), 2) if prev_vol > 0 else 0
            )
            delta[pair] = {
                "volume_delta": vol_delta,
                "volume_delta_pct": pct,
                "epoch_reset": False,
            }
    return delta


def _compute_wallet_delta(
    current_wallet: dict[str, Any] | None,
    previous_wallet: dict[str, Any] | None,
    epoch_changed: bool = False,
) -> dict[str, Any] | None:
    """Compute reward delta between current and previous wallet snapshot.

    Returns None on epoch reset since cross-epoch reward comparisons are meaningless.
    """
    if not current_wallet or not previous_wallet:
        return None
    if epoch_changed:
        return None  # Cross-epoch deltas are meaningless

    cur_reward = current_wallet.get("total_rewards_usd", 0)
    prev_reward = previous_wallet.get("total_rewards_usd", 0)
    reward_delta = round(cur_reward - prev_reward, 6)

    cur_vol = current_wallet.get("total_volume_usd", 0)
    prev_vol = previous_wallet.get("total_volume_usd", 0)
    volume_delta = round(cur_vol - prev_vol, 4)

    return {
        "reward_delta": reward_delta,
        "volume_delta": volume_delta,
        "reward_delta_pct": (
            round((reward_delta / prev_reward * 100), 4)
            if prev_reward > 0
            else 0
        ),
    }


def _format_summary(
    pair_stats: dict[str, dict[str, Any]],
    delta: dict[str, dict[str, Any]],
    epoch_id: str,
    wallet_leaderboard: dict[str, Any] | None = None,
    wallet_delta: dict[str, Any] | None = None,
    xrpl_balance: dict[str, Any] | None = None,
) -> str:
    """Build a human-readable summary string."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"📊 XRPLiquid Epoch Volume — {epoch_id}",
        f"Snapshot: {now}",
        "",
    ]

    # ── Wallet section ────────────────────────────────────────────────
    if wallet_leaderboard:
        w = wallet_leaderboard
        ce = w.get("current_epoch", {})
        lines.append("💰 WALLET PnL")
        lines.append(
            f"All-time rewards: ${w['total_rewards_usd']:,.2f} | "
            f"Volume: ${w['total_volume_usd']:,.0f}"
        )
        if ce:
            lines.append(
                f"Current epoch: #{ce.get('rank', '?')} | "
                f"Reward: {ce.get('reward_amount', 0):.4f} {ce.get('reward_token', '?')} | "
                f"Status: {ce.get('status', '?')}"
            )
        if wallet_delta:
            wd = wallet_delta
            lines.append(
                f"Δ since last: +${wd['reward_delta']:,.4f} reward, "
                f"+${wd['volume_delta']:,.0f} volume"
            )
        # On-chain balance (independent of Hummingbot API)
        if xrpl_balance:
            lines.append(
                f"On-chain: {xrpl_balance['rlusd_balance']:,.4f} RLUSD, "
                f"{xrpl_balance['xrp_balance']:,.4f} XRP"
            )
        lines.append("")

    # ── Pair table ────────────────────────────────────────────────────
    lines.append(
        f"{'Pair':<16} {'Volume (USD)':>16} {'Δ Vol':>12} {'Δ%':>8} {'Makers':>8}"
    )
    lines.append("-" * 68)

    sorted_pairs = sorted(
        pair_stats.items(),
        key=lambda x: x[1]["total_usd_volume"],
        reverse=True,
    )

    for pair, stats in sorted_pairs:
        d = delta.get(pair, {})
        epoch_reset = d.get("epoch_reset", False)
        vol_delta = d.get("volume_delta", 0) if not epoch_reset else 0
        vol_delta_pct = d.get("volume_delta_pct", 0) if not epoch_reset else 0
        makers = stats["unique_addresses"]

        vol_str = f"${stats['total_usd_volume']:,.0f}"
        if epoch_reset:
            delta_str = "🔄 reset"
            pct_str = "🔄"
        else:
            delta_str = f"${vol_delta:+,.0f}" if vol_delta else "—"
            pct_str = f"{vol_delta_pct:+.1f}%" if vol_delta_pct else "—"

        # Add reward indicator if wallet has market rewards
        suffix = ""
        mr = (
            wallet_leaderboard.get("market_rewards", {})
            if wallet_leaderboard
            else {}
        )
        if pair in mr:
            suffix = f"  💰{mr[pair]:.2f}"
        lines.append(
            f"{pair:<16} {vol_str:>16} {delta_str:>12} {pct_str:>8} {makers:>8}{suffix}"
        )

    # Hottest pair (skip if all deltas are epoch resets)
    epoch_reset_all = all(d.get("epoch_reset", False) for d in delta.values())
    if not epoch_reset_all:
        hottest = max(delta.items(), key=lambda x: x[1].get("volume_delta", 0))
        lines.append("")
        lines.append(
            f"🔥 Hottest: {hottest[0]} "
            f"(+${hottest[1].get('volume_delta', 0):,.0f}, "
            f"+{hottest[1].get('volume_delta_pct', 0):.1f}%)"
        )
    else:
        lines.append("")
        lines.append("🔄 Epoch rollover — deltas reset. Tracking from this snapshot.")

    return "\n".join(lines)


# ── Main ───────────────────────────────────────────────────────────────────


async def run(config: Config, context: Any) -> RoutineResult:
    """Fetch XRPLiquid epoch volume + wallet leaderboard data, record snapshot.

    Called via the agent's manage_routines MCP tool or Condor cron.
    Returns a RoutineResult with text summary and structured table data.
    """
    t_start = time.time()

    # 1. Fetch current epoch + wallet stats (parallel)
    epoch_data = await _fetch_epoch_data()
    epoch_id = epoch_data.get("id", "unknown")

    wallet_data = None
    xrpl_balance = None
    if config.wallet_address:
        try:
            wallet_data = await _fetch_wallet_stats(config.wallet_address)
        except Exception as e:
            logger.warning("Failed to fetch wallet stats: %s", e)
        if config.fetch_rlusd_balance:
            try:
                xrpl_balance = await _fetch_xrpl_balance(config.wallet_address)
            except Exception as e:
                logger.warning("Failed to fetch XRPL balance: %s", e)

    # 2. Extract stats for tracked pairs
    pair_stats = _extract_pair_stats(epoch_data)

    # 3. Extract wallet leaderboard data
    wallet_leaderboard = _extract_wallet_leaderboard(wallet_data, epoch_id)

    # 4. Load existing history & compute deltas
    output_path = _resolve_output_path(config)
    history = _load_history(output_path)

    previous_snapshot = None
    previous_wallet = None
    if history["snapshots"]:
        previous_snapshot = history["snapshots"][-1]
        previous_wallet = history["snapshots"][-1].get("wallet")

    # Detect epoch rollover for wallet delta
    epoch_changed = (
        bool(previous_snapshot)
        and previous_snapshot.get("epoch_id", "") != epoch_id
    )

    delta = _compute_delta(pair_stats, previous_snapshot, epoch_id)
    wallet_delta = _compute_wallet_delta(wallet_leaderboard, previous_wallet, epoch_changed)

    # 5. Append new snapshot
    snapshot: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "epoch_id": epoch_id,
        "pairs": pair_stats,
        "delta": delta,
    }
    if wallet_leaderboard:
        snapshot["wallet"] = wallet_leaderboard
        if wallet_delta:
            snapshot["wallet_delta"] = wallet_delta
    if xrpl_balance:
        snapshot["xrpl_balance"] = xrpl_balance

    history["snapshots"].append(snapshot)

    # Trim to last 168 snapshots (7 days of hourly data)
    if len(history["snapshots"]) > 168:
        history["snapshots"] = history["snapshots"][-168:]

    # Update metadata
    history["pair_metadata"] = {
        "last_epoch_id": epoch_id,
        "epoch_start": epoch_data.get("start_time", ""),
        "epoch_end": epoch_data.get("end_time", ""),
        "last_updated": snapshot["timestamp"],
    }

    if wallet_leaderboard:
        history["wallet_metadata"] = {
            "address": config.wallet_address,
            "last_rank": (
                wallet_leaderboard.get("current_epoch", {}).get("rank")
            ),
            "last_reward": wallet_leaderboard.get("total_rewards_usd", 0),
            "last_updated": snapshot["timestamp"],
        }

    # 6. Save
    _save_history(output_path, history)

    # 7. Build result
    summary = _format_summary(
        pair_stats, delta, epoch_id, wallet_leaderboard, wallet_delta, xrpl_balance
    )
    elapsed = round(time.time() - t_start, 2)

    logger.info(
        "Snapshot recorded: %d pairs, epoch=%s, wallet=%s (%.2fs)",
        len(pair_stats),
        epoch_id,
        "found" if wallet_leaderboard else "skipped",
        elapsed,
    )

    # Build table data for web dashboard
    epoch_reset_any = any(d.get("epoch_reset", False) for d in delta.values())
    table_data = [
        {
            "pair": pair,
            "volume_usd": stats["total_usd_volume"],
            "orders": stats["total_orders"],
            "makers": stats["unique_addresses"],
            "delta_vol": delta.get(pair, {}).get("volume_delta", 0),
            "delta_pct": delta.get(pair, {}).get("volume_delta_pct", 0),
            "epoch_reset": delta.get(pair, {}).get("epoch_reset", False),
        }
        for pair, stats in pair_stats.items()
    ]

    # Add wallet data as a separate section
    if wallet_leaderboard:
        w = wallet_leaderboard
        ce = w.get("current_epoch", {})
        summary += (
            f"\n\n--- Wallet PnL ---\n"
            f"Rank: #{ce.get('rank', '?')} | "
            f"Reward this epoch: {ce.get('reward_amount', 0)} {ce.get('reward_token', '')}\n"
            f"All-time rewards: ${w['total_rewards_usd']:,.2f} | "
            f"All-time volume: ${w['total_volume_usd']:,.0f}"
        )
        if wallet_delta:
            summary += (
                f"\nHourly reward Δ: +${wallet_delta['reward_delta']:,.4f}"
            )

    return RoutineResult(
        text=summary,
        table_data=table_data,
        table_columns=[
            "pair",
            "volume_usd",
            "orders",
            "makers",
            "delta_vol",
            "delta_pct",
        ],
    )
