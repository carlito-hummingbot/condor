# Delta Raptor — Speaker Script
# per-slide talking points. Natural, not scripted. Use as guide, not teleprompter.

## SLIDE 1 — About Me

"Hi, I'm Kaira Zambo. I go by hbminerfan on Discord."

"I discovered Hummingbot back in late 2022 and honestly, it changed the game for me. I've been a miner on Hummingbot Miner, Dexalot, and now XRPLiquid — that's where this project lives."

"I'm genuinely excited to see Hummingbot embrace AI. Tools like Condor make it possible for someone like me — not a professional quant, not a dev team — to actually build something that competes."

"I can make my dreams come true with this stuff. So... thanks Hummingbot team. For real."

## SLIDE 2 — Title

"Alright, let's talk about what I built. This is Delta Raptor — my entry for the Condor Builders Cup."

"It's an autonomous market maker that trades on the XRPL DEX. The goal is simple: climb the XRPLiquid leaderboard by generating as much volume as possible."

"Six tracked pairs, two active at any time. It makes a decision every 60 seconds. And the best part? The LLM cost for the entire 48-hour competition is about one to three dollars. That's DeepSeek."

## SLIDE 2 — The Hunt

"So why are we doing this? XRPLiquid runs these epochs — basically weekly competitions. You provide liquidity, you generate volume, they pay you in XRP rewards. Proportional to your share of total volume."

"The way I measure success is a single number I call net P&L. It's your balance change plus the rewards you earned. If that number's positive, you're winning."

"And just to give you context — this wallet address on screen right now? It's currently ranked number one on the leaderboard, over two hundred dollars in all-time rewards, almost 900K in volume. We know the playbook works."

## SLIDE 3 — Architecture

"Here's how it actually flies. Every tick — every 60 seconds — the bot pulls live data from the XRPLiquid API. That feeds into a Python routine I wrote called xrpl_volume_tracker, which tells the LLM which pairs are moving fastest."

"The LLM — that's DeepSeek running through PydanticAI — decides: stay on current pairs or rotate. If a rotation happens, it places up to four order executors, two buy and two sell, across two pairs."

"Under the hood there's also price bands, portfolio rebalancing, P&L tracking, and everything gets journaled to the Condor dashboard in real time. Judges can see exactly what the bot is thinking."

## SLIDE 4 — The Kill

"Pair selection is driven by one signal: delta volume. Not total volume — the rate of change. Which pair is accelerating fastest right now? That's where the Raptor hunts."

"When the bot places an order, it doesn't use a grid or multiple levels. It puts one order — one buy, one sell — at the absolute best price. Specifically, 0.01% above the best bid for buys, 0.01% below the best ask for sells. LIMIT_MAKER, post-only, adds liquidity — exactly what the leaderboard rewards."

"It's always the new best bid or best ask on the book. And the order size? Not hardcoded. It reads the live wallet balance every tick and sizes accordingly. More capital, bigger orders. Less capital, it tightens up."

"The six pairs you see at the bottom — that's real live data from the XRPLiquid epoch right now."

## SLIDE 5 — Defensive Instincts

"Okay, offense is great, but you need defense too. Two systems here."

"First, price bands. When the bot enters a pair, it records the mid price and sets a plus or minus two percent band. If price breaks out of that band — maybe some whale just moved the market — it pauses orders immediately. Watches for ten minutes. If price comes back, great, resume. If not — banish the pair for an hour and switch to an alternate. Fresh band on re-entry, never reuse old bands."

"Second, rebalancing. Sometimes you get filled on one side a lot — say you're holding way too much BBRL because all your buy orders filled and sells didn't. If any single asset exceeds 60% of your portfolio, the bot automatically sells the excess. LIMIT order, crosses the spread for immediate fill, max 0.2% buffer, fill-or-cancel in ten seconds."

"Both of these run every tick and both journal to the dashboard."

## SLIDE 6 — 7 Innovations

"I want to call out what I think actually makes this entry different. Seven things."

"One — volume delta rotation instead of static pairs. Two — the price band state machine, three states per pair independently. Three — single-level LIMIT_MAKER, one order at the best price, no grid. Four — the 60% threshold rebalance. Five — live unified P&L that combines balance change plus leaderboard rewards into one number. Six — DeepSeek. I actually had to add DeepSeek support to Condor's PydanticAI client myself, which is part of the submission. And seven — everything is transparent on the dashboard. Judges can watch the bot think in real time."

## SLIDE 7 — Dashboard

"Speaking of which — this is what judges will actually see. This is simulated but the format is real. Every rotation, every band trigger, every P&L update gets a timestamped journal entry."

"You can see here at tick 12, a rotation from EUROP to BBRL, with the reason. At tick 34, XRP broke its upper band — watching. Ten minutes later, tick 44, banished for an hour. And the tick 60 summary shows the full P&L breakdown."

"This isn't a black box. Judges can follow the decision-making in real time."

## SLIDE 8 — Closing

"Delta Raptor. Autonomous, transparent, and — based on the backtesting and live leaderboard data — profitable."

"Built on Condor, powered by DeepSeek, hunting on XRPL."

"Thanks for watching — happy to answer questions."
