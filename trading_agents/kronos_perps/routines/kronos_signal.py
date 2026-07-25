"""Fetch Gate.io perpetuals K-lines, run Kronos prediction, store signals.

This routine is called by the Kronos Perps Agent each tick. It:
1. Checks cached signals in manage_notes — returns immediately if <10 min old
2. If stale: fetches recent 5m K-lines for configured pairs from Gate.io API
3. Sends them to the Kronos inference server on JarvisLabs (batch /predict_batch)
4. Parses OHLCV predictions into directional trading signals
5. Stores structured signals in manage_notes for the agent to consume
6. Returns reasoning narrative for journal transparency

Cost optimization: Kronos predicts 4h ahead — running every 60s is 97.5% waste.
The cache reduces GPU calls from 2,880/48h to ~288/48h (80-91% cost savings).

Based on Delta Raptor's xrpl_volume_tracker pattern.
"""

CATEGORY = "KRONOS"

import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx
import pandas as pd
from pydantic import BaseModel, Field

from routines.base import RoutineResult

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

GATEIO_FUTURES_API = "https://api.gateio.ws/api/v4/futures/usdt"
DEFAULT_PAIRS = ["BTC_USDT", "SOL_USDT", "XAU_USDT"]
INTERVAL = "5m"
LOOKBACK = 400
PRED_LEN = 48
MAX_CONTEXT = 512


class Config(BaseModel):
    """Fetch data, call Kronos, and store prediction signals with caching."""

    kronos_api_url: str = Field(
        default="http://localhost:8000/predict",
        description="URL of the Kronos inference server (FastAPI on JarvisLabs).",
    )
    pairs: list[str] = Field(
        default_factory=lambda: ["BTC_USDT", "SOL_USDT", "XAU_USDT"],
        description="Gate.io perpetual pairs to predict.",
    )
    lookback: int = Field(
        default=400,
        description="Number of historical 5m candles to send to Kronos.",
    )
    pred_len: int = Field(
        default=48,
        description="Number of future periods to predict (48 × 5min = 4h).",
    )
    sample_count: int = Field(
        default=5,
        description="Number of prediction paths to average.",
    )
    max_signal_age_sec: int = Field(
        default=1200,
        description="Maximum age of cached signal in seconds (1200 = 20 min). "
                    "If signals are fresher than this, skip the Kronos API call.",
    )
    force_refresh: bool = Field(
        default=False,
        description="If True, bypass cache and force a fresh prediction.",
    )
    timeout: int = Field(
        default=30,
        description="HTTP timeout for Kronos API call.",
    )


# ── Gate.io Data Fetching ──────────────────────────────────────────────────


def _fetch_klines(pair: str, limit: int = 400) -> pd.DataFrame | None:
    """Fetch recent 5m K-lines from Gate.io futures API."""
    url = f"{GATEIO_FUTURES_API}/candlesticks"
    params = {"contract": pair, "interval": INTERVAL, "limit": limit}

    try:
        resp = httpx.get(url, params=params, timeout=15.0)
        resp.raise_for_status()
        candles = resp.json()
    except Exception as e:
        logger.error(f"Failed to fetch {pair} klines: {e}")
        return None

    if not candles:
        logger.warning(f"No klines returned for {pair}")
        return None

    rows = []
    for c in candles:
        if isinstance(c, list):
            t, v, close, high, low, open_price, amount = (
                int(c[0]), float(c[1]), float(c[2]), float(c[3]),
                float(c[4]), float(c[5]), float(c[6]) if len(c) > 6 else 0.0
            )
        else:
            t = int(c["t"])
            v = float(c["v"])
            close = float(c["c"])
            high = float(c["h"])
            low = float(c["l"])
            open_price = float(c["o"])
            amount = float(c.get("sum", 0))

        rows.append({
            "timestamps": datetime.fromtimestamp(t, tz=timezone.utc).strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            "open": open_price,
            "high": high,
            "low": low,
            "close": close,
            "volume": v,
            "amount": amount,
        })

    df = pd.DataFrame(rows)
    df["timestamps"] = pd.to_datetime(df["timestamps"])
    return df


# ── Signal Extraction ──────────────────────────────────────────────────────


def _extract_signal(
    pair: str,
    df_hist: pd.DataFrame,
    pred_df: pd.DataFrame,
    sample_paths: int = 1,
) -> dict[str, Any]:
    """Convert Kronos OHLCV predictions into structured trading signals."""

    current_close = float(df_hist["close"].iloc[-1])
    pred_close = float(pred_df["close"].iloc[-1])
    pred_high = float(pred_df["high"].max())
    pred_low = float(pred_df["low"].min())

    # Direction and magnitude
    predicted_return = (pred_close / current_close) - 1

    if predicted_return > 0.005:
        direction = "LONG"
    elif predicted_return < -0.005:
        direction = "SHORT"
    else:
        direction = "FLAT"

    # Confidence: tighter range relative to predicted move = higher confidence
    predicted_range = pred_high - pred_low
    if predicted_range > 0:
        amplitude = abs(predicted_return) / (predicted_range / current_close + 1e-8)
    else:
        amplitude = 0.0

    path_boost = min(sample_paths / 5.0, 1.0)
    confidence = min(amplitude * 0.5 + path_boost * 0.5, 1.0)

    # Entry zone
    first_pred_open = float(pred_df["open"].iloc[0])
    first_pred_close = float(pred_df["close"].iloc[0])
    entry_price = (first_pred_open + first_pred_close) / 2

    # Target: predicted close at end of horizon
    target_price = pred_close

    # Stop: 1.5x the predicted low-high range from entry
    vol_stop = predicted_range * 1.5

    # Midpoint trend confirmation
    mid_idx = len(pred_df) // 2
    mid_price = float(pred_df["close"].iloc[mid_idx])
    trend_confirm = (mid_price - current_close) / current_close
    trend_aligned = (
        (direction == "LONG" and trend_confirm > 0)
        or (direction == "SHORT" and trend_confirm < 0)
    )

    if not trend_aligned and direction != "FLAT":
        confidence *= 0.5  # penalty for non-aligned trend

    # Build reasoning narrative for journal
    pred_path = [round(float(pred_df["close"].iloc[i]), 2) for i in range(0, len(pred_df), max(1, len(pred_df)//4))]
    stop_loss = entry_price - vol_stop if direction == "LONG" else entry_price + vol_stop

    reasoning = {
        "narrative": (
            f"{direction} bias: {predicted_return*100:+.2f}% over {len(pred_df)} periods. "
            f"Mid-point {'confirms' if trend_aligned else 'DOES NOT confirm'} direction. "
            f"{sample_paths} paths, range \${pred_low:.0f}–\${pred_high:.0f} ({predicted_range/current_close*100:.1f}%)."
        ),
        "path": pred_path,
        "trend_aligned": trend_aligned,
        "sample_paths": sample_paths,
    }

    return {
        "pair": pair,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "current_price": current_close,
        "direction": direction,
        "predicted_return_pct": round(predicted_return * 100, 3),
        "confidence": round(confidence, 3),
        "entry_price": round(entry_price, 2),
        "target_price": round(target_price, 2),
        "stop_loss": round(stop_loss, 2),
        "predicted_high": round(pred_high, 2),
        "predicted_low": round(pred_low, 2),
        "predicted_range_pct": round(predicted_range / current_close * 100, 3),
        "trend_confirmed": trend_aligned,
        "sample_paths": sample_paths,
        "pred_len_periods": len(pred_df),
        "interval": INTERVAL,
        "reasoning": reasoning,
    }


# ── Cache Helpers ──────────────────────────────────────────────────────────


def _read_cached_signals() -> dict[str, dict | None]:
    """Read all kronos.* notes from the notes store.
    
    Returns {pair_name: signal_dict} for cached signals, {} if none.
    Assumes notes are readable via filesystem (routine context).
    """
    from pathlib import Path
    import os

    # Try common notes locations
    notes_paths = [
        Path("data/notes"),
        Path("trading_agents/kronos_perps/data"),
    ]
    cached = {}
    for base in notes_paths:
        for f in base.glob("*.json") if base.exists() else []:
            try:
                notes = json.loads(f.read_text())
                for key, val in notes.items():
                    if key.startswith("kronos."):
                        pair = key[len("kronos."):]
                        try:
                            cached[pair] = json.loads(val) if isinstance(val, str) else val
                        except (json.JSONDecodeError, TypeError):
                            pass
            except (OSError, json.JSONDecodeError):
                pass
        if cached:
            break
    return cached


def _is_signal_fresh(signal: dict, max_age_sec: int) -> bool:
    """Check if a cached signal is still fresh."""
    if not signal or "timestamp" not in signal:
        return False
    try:
        sig_time = datetime.fromisoformat(signal["timestamp"])
        age = (datetime.now(timezone.utc) - sig_time).total_seconds()
        return age < max_age_sec
    except (ValueError, TypeError):
        return False


# ── Main Routine ───────────────────────────────────────────────────────────


async def run(config: Config, context: Any) -> RoutineResult:
    """Execute Kronos signal generation with caching.

    Returns a RoutineResult with per-pair signals and a summary table.
    Includes reasoning narratives for journal transparency.
    """
    now = datetime.now(timezone.utc)
    results = []
    errors = []
    from_cache = False
    cache_hit_pairs = []

    # ── STEP 0: Check cache ────────────────────────────────────────────────
    if not config.force_refresh:
        cached = _read_cached_signals()
        all_fresh = True
        for pair in config.pairs:
            sig = cached.get(pair)
            if _is_signal_fresh(sig, config.max_signal_age_sec):
                results.append(sig)
                cache_hit_pairs.append(pair)
                logger.info(f"{pair}: using cached signal ({sig['direction']}, conf={sig['confidence']:.0%})")
            else:
                all_fresh = False

        if all_fresh and len(results) == len(config.pairs):
            from_cache = True
            logger.info(f"All {len(results)} signals from cache (age < {config.max_signal_age_sec}s)")

    # ── STEP 1: Fetch & predict stale pairs ─────────────────────────────────
    if not from_cache:
        stale_pairs = [p for p in config.pairs if p not in cache_hit_pairs]
        if not stale_pairs:
            stale_pairs = config.pairs  # force refresh: redo all

        for pair in stale_pairs:
            try:
                logger.info(f"Fetching {config.lookback} candles for {pair}...")
                df = _fetch_klines(pair, limit=config.lookback + 10)
                if df is None or len(df) < config.lookback:
                    errors.append(f"{pair}: insufficient data ({len(df) if df is not None else 0} rows)")
                    continue

                df_price = df[["open", "high", "low", "close", "volume", "amount"]]
                x_ts = df["timestamps"]

                last_ts = x_ts.iloc[-1]
                y_ts = pd.date_range(
                    start=last_ts + pd.Timedelta(minutes=5),
                    periods=config.pred_len,
                    freq="5min",
                )

                payload = {
                    "pair": pair.replace("_", "-"),
                    "klines": df_price.tail(config.lookback).to_dict(orient="records"),
                    "timestamps": x_ts.tail(config.lookback).astype(str).tolist(),
                    "y_timestamps": y_ts.astype(str).tolist(),
                    "pred_len": config.pred_len,
                    "sample_count": config.sample_count,
                }

                logger.info(f"Calling Kronos API for {pair}...")
                async with httpx.AsyncClient(timeout=config.timeout) as client:
                    resp = await client.post(config.kronos_api_url, json=payload)
                    if resp.status_code != 200:
                        errors.append(f"{pair}: Kronos API error {resp.status_code}")
                        continue
                    pred_data = resp.json()

                pred_df = pd.DataFrame(pred_data["prediction"])
                signal = _extract_signal(
                    pair, df_price.tail(config.lookback), pred_df, config.sample_count
                )

                # Replace cached entry if it exists, or append
                replaced = False
                for i, r in enumerate(results):
                    if r["pair"] == pair:
                        results[i] = signal
                        replaced = True
                        break
                if not replaced:
                    results.append(signal)

                logger.info(
                    f"{pair}: {signal['direction']} "
                    f"(ret={signal['predicted_return_pct']:+.2f}%, "
                    f"conf={signal['confidence']:.2f})"
                )

            except Exception as e:
                logger.exception(f"Error processing {pair}")
                errors.append(f"{pair}: {e}")

    # ── STEP 2: Build output ───────────────────────────────────────────────
    text_lines = []
    table_data = []

    if from_cache:
        text_lines.append(f"📦 CACHED SIGNALS (age < {config.max_signal_age_sec}s ago)")
    else:
        text_lines.append(f"🔮 FRESH PREDICTIONS ({len(stale_pairs)} pairs, {config.sample_count} paths each)")

    text_lines.append(f"   Age threshold: {config.max_signal_age_sec}s | Force: {config.force_refresh}")
    text_lines.append("")

    for s in results:
        dir_emoji = {"LONG": "🟢", "SHORT": "🔴", "FLAT": "⚪"}.get(s["direction"], "❓")
        age_str = ""
        if s["pair"] in cache_hit_pairs:
            try:
                age = (now - datetime.fromisoformat(s["timestamp"])).total_seconds()
                age_str = f" [cached {age:.0f}s ago]"
            except (ValueError, TypeError):
                pass

        text_lines.append(
            f"{dir_emoji} {s['pair']}: {s['direction']} "
            f"({s['predicted_return_pct']:+.2f}%, conf={s['confidence']:.0%}){age_str}"
        )
        if "reasoning" in s:
            text_lines.append(f"   ↳ {s['reasoning']['narrative']}")

        table_data.append({
            "pair": s["pair"],
            "direction": s["direction"],
            "return_%": s["predicted_return_pct"],
            "confidence": f"{s['confidence']:.0%}",
            "entry": f"${s['entry_price']:,.2f}",
            "target": f"${s['target_price']:,.2f}",
            "stop": f"${s['stop_loss']:,.2f}",
            "source": "cache" if s["pair"] in cache_hit_pairs else "fresh",
        })

    if errors:
        text_lines.append(f"\n⚠️ Errors: {len(errors)}")
        for e in errors:
            text_lines.append(f"  - {e}")

    # ── Store signals back to notes for next cache hit ─────────────────────
    # Note: In practice, the agent calls manage_notes(action="set") per pair.
    # The routine returns signals; the agent stores them.

    return RoutineResult(
        text="\n".join(text_lines) if text_lines else "No signals generated.",
        table_data=table_data,
        sections={
            "raw_signals": results,
            "errors": errors,
            "pairs_processed": len(results),
            "from_cache": from_cache,
            "cache_hits": cache_hit_pairs,
            "timestamp": now.isoformat(),
        },
    )
