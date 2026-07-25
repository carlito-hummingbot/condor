---
id: whirl
name: WHIRL (Concentrated Liquidity Ranger)
description: >
  Hybrid concentrated liquidity + market making strategy on Orca Whirlpool (CLMM).
  Provides liquidity in tight price ranges (LP), places limit orders outside LP
  range (MM for volume boost), rebalances when price exits range, prioritizes
  RWA token pools, and compounds ORCA rewards.
total_amount_quote: 1000  # $1,000 Builders Cup constraint
leverage: 1  # No leverage (LP + spot MM only)
pairs:
  - BTC_USDC
  - ETH_USDC
  - SOL_USDC
  - GOLD_USDC
  - EUR_USDC
execution_mode: managed_risk  # Rebalancing + RWA focus + IL protection
---

# WHIRL Agent: Concentrated Liquidity Ranger

## Overview

WHIRL is a **hybrid liquidity provision + market making strategy** that:
1. Provides liquidity in tight price ranges (Orca Whirlpool CLMM) — 60% capital
2. Places limit orders OUTSIDE LP range (market making for volume boost) — 40% capital
3. Rebalances when price exits range (active management)
4. Prioritizes RWA token pools (GOLD, OIL, EUR, USD) — 20% allocation
5. Compounds ORCA rewards (snowball effect)

**Goal:** Maximize BOTH volume (LP + MM) AND P&L (fees + rewards + spread capture).

---

## STEP 0: Pre-Flight Checks

```python
# Check if manage_notes has WHIRL signals
signal_btc = read_from_manage_notes("whirl:signal:BTC_USDC")
signal_eth = read_from_manage_notes("whirl:signal:ETH_USDC")
signal_sol = read_from_manage_notes("whirl:signal:SOL_USDC")
signal_gold = read_from_manage_notes("whirl:signal:GOLD_USDC")
signal_eur = read_from_manage_notes("whirl:signal:EUR_USDC")

if not any([signal_btc, signal_eth, signal_sol, signal_gold, signal_eur]):
    PRINT("[WHIRL] ⚠️  No signals available, skipping this tick")
    WAIT(60)  # Wait 60s before retrying
    EXIT()

# Check if safe to trade
for signal in [signal_btc, signal_eth, signal_sol, signal_gold, signal_eur]:
    if signal and not signal.get("safe_to_trade", True):
        PRINT(f"[WHIRL] ⚠️  Safety filters triggered for {signal['pair']}, skipping")
        CONTINUE()
```

---

## STEP 1: Read Signals from manage_notes

```python
# Read pre-computed signals (from whirl_rebalance routine)
signals = {
    "BTC_USDC": read_from_manage_notes("whirl:signal:BTC_USDC"),
    "ETH_USDC": read_from_manage_notes("whirl:signal:ETH_USDC"),
    "SOL_USDC": read_from_manage_notes("whirl:signal:SOL_USDC"),
    "GOLD_USDC": read_from_manage_notes("whirl:signal:GOLD_USDC"),
    "EUR_USDC": read_from_manage_notes("whirl:signal:EUR_USDC")
}

# Filter valid signals
valid_signals = {pair: sig for pair, sig in signals.items() if sig is not None}
PRINT(f"[WHIRL] 📡 Signals received: {len(valid_signals)}/{len(signals)} pairs")
```

---

## STEP 2: Manage LP Positions (60% Capital)

```python
for pair, signal in valid_signals.items():
    lp_status = signal.get("lp_status", "NO_POSITION")
    tick_lower = signal.get("tick_lower")
    tick_upper = signal.get("tick_upper")
    current_price = signal.get("current_price")
    
    if lp_status == "IN_RANGE":
        PRINT(f"[WHIRL] ✅ {pair} LP IN RANGE | Price: {current_price:.4f} | Range: [{tick_lower}, {tick_upper}]")
        PRINT(f"[WHIRL]   └─ Earning fees + ORCA rewards (do nothing)")
        
    elif lp_status == "OUT_OF_RANGE":
        PRINT(f"[WHIRL] ⚠️  {pair} LP OUT OF RANGE | Price: {current_price:.4f} | Range: [{tick_lower}, {tick_upper}]")
        PRINT(f"[WHIRL]   ├─ Closing LP position...")
        PRINT(f"[WHIRL]   ├─ Computing new price range...")
        
        # Rebalance logic (calls Orca Whirlpool API)
        new_tick_lower = signal.get("new_tick_lower")
        new_tick_upper = signal.get("new_tick_upper")
        
        PRINT(f"[WHIRL]   ├─ New range: [{new_tick_lower}, {new_tick_upper}]")
        PRINT(f"[WHIRL]   └─ Opening new LP position...")
        
        # TODO: Execute via Hummingbot API
        # await close_lp_position(pair)
        # await open_lp_position(pair, new_tick_lower, new_tick_upper)
        
    elif lp_status == "NO_POSITION":
        PRINT(f"[WHIRL] 🆕 {pair} NO LP POSITION | Opening new position...")
        PRINT(f"[WHIRL]   ├─ Range: [{tick_lower}, {tick_upper}]")
        PRINT(f"[WHIRL]   └─ Allocating 60% capital to LP")
        
        # TODO: Execute via Hummingbot API
        # await open_lp_position(pair, tick_lower, tick_upper)
```

---

## STEP 3: Manage MM Orders (40% Capital, Outside LP Range)

```python
for pair, signal in valid_signals.items():
    lp_status = signal.get("lp_status")
    tick_lower = signal.get("tick_lower")
    tick_upper = signal.get("tick_upper")
    current_price = signal.get("current_price")
    
    if lp_status == "IN_RANGE":
        # Place limit orders OUTSIDE LP range (MM for volume boost)
        mm_buy_price = signal.get("mm_buy_price")  # Below tick_lower
        mm_sell_price = signal.get("mm_sell_price")  # Above tick_upper
        
        PRINT(f"[WHIRL] 📊 {pair} MM OUTSIDE RANGE")
        PRINT(f"[WHIRL]   ├─ BUY order @ {mm_buy_price:.4f} (below range)")
        PRINT(f"[WHIRL]   ├─ SELL order @ {mm_sell_price:.4f} (above range)")
        
        # TODO: Execute via Hummingbot API
        # await create_limit_order(
        #     exchange="orca",
        #     pair=pair,
        #     side="BUY",
        #     price=mm_buy_price,
        #     amount=mm_amount,
        #     params={"type": "spot", "timeInForce": "GTC"}
        # )
        # await create_limit_order(
        #     exchange="orca",
        #     pair=pair,
        #     side="SELL",
        #     price=mm_sell_price,
        #     amount=mm_amount,
        #     params={"type": "spot", "timeInForce": "GTC"}
        # )
        
    elif lp_status == "OUT_OF_RANGE":
        # Cancel all MM orders (wait for rebalance)
        PRINT(f"[WHIRL] ⚠️  {pair} Canceling MM orders (waiting for rebalance)")
        
        # TODO: Cancel all MM orders
        # await cancel_all_mm_orders(pair)
        
    elif lp_status == "NO_POSITION":
        # Wait for LP to be established first
        PRINT(f"[WHIRL] ⏳ {pair} Waiting for LP position before MM")
```

---

## STEP 4: Compound ORCA Rewards (Optional)

```python
for pair, signal in valid_signals.items():
    orca_rewards = signal.get("orca_rewards", 0.0)
    
    if orca_rewards > 0.01:  # Only compound if > 0.01 ORCA
        PRINT(f"[WHIRL] 💎 {pair} Compounding ORCA rewards: {orca_rewards:.4f} ORCA")
        PRINT(f"[WHIRL]   └─ Reinvesting into LP position (snowball effect)")
        
        # TODO: Execute via Hummingbot API
        # await compound_orca_rewards(pair, orca_rewards)
```

---

## STEP 5: RWA Pool Prioritization (Bonus Criterion)

```python
# RWA tokens list
rwa_tokens = ["GOLD", "OIL", "EUR", "USD", "gUSD", "gEUR", "gBTC", "gETH"]

for pair, signal in valid_signals.items():
    base_token = pair.split("_")[0]
    quote_token = pair.split("_")[1]
    
    is_rwa = base_token in rwa_tokens or quote_token in rwa_tokens
    
    if is_rwa:
        PRINT(f"[WHIRL] 🏆 {pair} is RWA pool (bonus points!)")
        PRINT(f"[WHIRL]   ├─ Weight: 2.0× (prioritized)")
        PRINT(f"[WHIRL]   └─ Allocation: 20% of capital")
        
        # RWA pools get 2× weight in APY calculation
        # (already handled in orca_pool_scanner routine)
```

---

## STEP 6: Journal + Dashboard Logging

```python
# Log to dashboard (visible in Condor dashboard)
for pair, signal in valid_signals.items():
    lp_status = signal.get("lp_status")
    current_price = signal.get("current_price")
    tick_lower = signal.get("tick_lower")
    tick_upper = signal.get("tick_upper")
    
    # Log format: agent.whirl.tick{N}
    PRINT(f"[WHIRL] Tick {CURRENT_TICK} | {pair} | LP: {lp_status} | Price: {current_price:.4f}")
    PRINT(f"[WHIRL]   ├─ Range: [{tick_lower}, {tick_upper}]")
    PRINT(f"[WHIRL]   ├─ MM: BUY @ {signal.get('mm_buy_price', 'N/A')} | SELL @ {signal.get('mm_sell_price', 'N/A')}")
    PRINT(f"[WHIRL]   └─ ORCA Rewards: {signal.get('orca_rewards', 0.0):.4f}")
```

---

## Risk Management

| Risk | Mitigation |
|------|-------------|
| **Impermanent Loss (IL)** | Volatility adaptation (wider range in high vol) |
| **Price Exit** | Rebalancing logic moves liquidity to new range |
| **Gas Fees** | Only rebalance if rewards > gas fees |
| **Low Volume** | Hybrid MM (outside LP range) boosts volume |
| **Slippage** | Limit orders only (no slippage) |
| **Orca Downtime** | Monitor Orca RPC, hedge on another DEX if needed |

---

## Data Requirements

**CRITICAL:** Needs Orca Whirlpool API (for LP positions + tick ranges).

| Data Source | API | Update Frequency |
|-------------|-----|------------------|
| **Orca Whirlpool** | ✅ YES (REST + WebSocket) | Real-time pool data |
| **Orca Rewards** | ✅ YES (REST) | Every epoch (≈ 1 day) |
| **Price Feed** | ✅ YES (WebSocket) | Real-time price |

**Recommendation:** Use Orca Whirlpool WebSocket for real-time LP position monitoring.

---

## Next Steps (Implementation)

1. **✅ Create agent.md** (completed 2026-06-05)
2. **⬜ Implement Orca Whirlpool API integration** (Week 1)
   - Use Hummingbot Gateway Orca connector
   - Implement `open_lp_position()`, `close_lp_position()`
   - Implement `compound_orca_rewards()`
3. **⬜ Implement orca_pool_scanner routine** (Week 1)
   - Scan all Whirlpools (CLMM pools)
   - Compute APY (fees + rewards)
   - Apply RWA weight (2× for RWA tokens)
4. **⬜ Implement whirl_rebalance routine** (Week 2)
   - Check if price is inside LP range
   - If outside → compute new tick range
   - Adjust range based on volatility (ATR)
5. **⬜ Implement whirl_market_make routine** (Week 2)
   - Place limit orders outside LP range
   - Cancel/replace every 5-10 seconds
6. **⬜ Backtest on historical data** (Week 3)
   - Use Orca Whirlpool historical data
   - Factor in: trading fees, ORCA rewards, IL, gas fees, MM spread
7. **⬜ Test on Orca devnet** (Week 4)
   - Deploy to Orca devnet for testing
   - Verify LP positions, rebalancing, MM orders

---

## Status

🚧 **IN DEVELOPMENT** — Orca Whirlpool API integration pending.

**Completed:**
1. ✅ Agent.md created (hybrid LP + MM logic)
2. ✅ RWA focus logic (20% allocation)
3. ✅ Rebalancing logic (price exit + volatility-based)
4. ✅ Compounding logic (ORCA rewards)

**Pending:**
1. ❌ Orca Whirlpool API integration (Hummingbot Gateway)
2. ❌ orca_pool_scanner routine (scans pools, RWA weighting)
3. ❌ whirl_rebalance routine (rebalancing logic)
4. ❌ whirl_market_make routine (MM outside LP range)
5. ❌ Backtest on historical data
6. ❌ Test on Orca devnet

---

**Note:** This is an independent submission for the Orca team. No cross-references to other strategies.
