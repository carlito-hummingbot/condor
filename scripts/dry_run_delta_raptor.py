"""Dry-run Delta Raptor strategy — tests prompt + LLM response, no Hummingbot server needed.

Tests:
  1. Strategy loads from agent.md
  2. Builds the dry-run prompt
  3. Sends to DeepSeek via PydanticAI
  4. Captures LLM reasoning and tool calls

Usage: uv run python scripts/dry_run_delta_raptor.py
"""

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env so TELEGRAM_TOKEN etc. are available to MCP subprocesses
from dotenv import load_dotenv
load_dotenv()

os.environ["DEEPSEEK_API_KEY"] = "sk-824522f3434e43dfb28331bd0334013e"

logging.basicConfig(
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("dry_run")

# ── Helpers ────────────────────────────────────────────────────────────────

_CORE_DATA_STUB = """\
Active Executors: none running (dry run)
  Realized: $0.00 | Unrealized: $0.00 | Total PnL: $0.00 | Volume: $0

Active Positions: none (dry run)
"""


def _build_mcp_servers() -> list[dict]:
    """Build MCP server configs — hummingbot will fail, but condor works locally."""
    return [
        {
            "name": "mcp-hummingbot",
            "command": "uv",
            "args": [
                "run", "python", "-m", "mcp_servers.hummingbot_api",
                "--url", "http://localhost:8000",
                "--username", "admin",
                "--password", "admin",
                "--server-name", "local",
            ],
            "env": [],
        },
        {
            "name": "condor",
            "command": "uv",
            "args": [
                "run", "python", "-m", "mcp_servers.condor",
                "--chat-id", "5587715073",
                "--user-id", "5587715073",
                "--bot-token", os.environ.get("TELEGRAM_TOKEN", ""),
                "--agent-slug", "delta_raptor",
            ],
            "env": [],
        },
    ]


async def main() -> None:
    from condor.trading_agent.strategy import StrategyStore
    from condor.trading_agent.prompts import build_tick_prompt
    from condor.acp.pydantic_ai_client import PydanticAIClient

    # 1. Load strategy
    store = StrategyStore()
    strategy = store.get_by_slug("delta_raptor")
    assert strategy, "Strategy 'delta_raptor' not found!"
    log.info("Loaded: %s (agent_key=%s)", strategy.name, strategy.agent_key)

    # 2. Build config
    config = dict(strategy.default_config)
    config["execution_mode"] = "dry_run"
    config["server_name"] = "local"
    config["total_amount_quote"] = 0.0

    # 3. Build the prompt
    tick_num = 1
    agent_id = f"{strategy.slug}_e1"

    # Pre-build routines section
    from condor.trading_agent.prompts import _build_routines_section

    routines_section = _build_routines_section(strategy)
    log.info("Routines section: %d chars", len(routines_section or ""))

    prompt = build_tick_prompt(
        strategy=strategy,
        config=config,
        core_data={"executors": _CORE_DATA_STUB, "positions": "Active Positions: none (dry run)"},
        learnings="",
        summary="",
        recent_decisions="",
        risk_state={
            "total_exposure": 0.0,
            "executor_count": 0,
            "drawdown_pct": 0.0,
            "is_blocked": False,
            "block_reason": "",
            "max_position_size": 490,
            "max_open_executors": 4,
            "max_drawdown_pct": 10.0,
        },
        tick_number=tick_num,
        agent_id=agent_id,
        cached_routines_section=routines_section,
    )

    log.info("Prompt built: %d chars", len(prompt))

    print("\n" + "=" * 72)
    print("  🧪 DELTA RAPTOR — DRY RUN PROMPT")
    print("=" * 72)
    # Show first 3000 chars of prompt
    print(prompt[:3000])
    if len(prompt) > 3000:
        print(f"\n  ... (truncated, {len(prompt)} chars total)")
    print("=" * 72)

    # 4. Build DeepSeek client
    mcp_servers = _build_mcp_servers()

    client = PydanticAIClient(
        model=strategy.agent_key,
        mcp_servers=mcp_servers,
        base_url=strategy.default_config.get("model_base_url"),
    )

    # 5. Run the prompt
    log.info("Starting ACP client...")
    await client.start()
    log.info("ACP client started, sending prompt...")

    response_chunks: list[str] = []
    tool_calls: list[dict] = []
    tool_call_map: dict[str, dict] = {}
    t_start = time.time()

    try:
        from condor.acp.client import TextChunk, ToolCallEvent, ToolCallUpdate, PromptDone

        async with asyncio.timeout(300):  # 5 min timeout
            async for event in client.prompt_stream(prompt):
                if isinstance(event, TextChunk):
                    response_chunks.append(event.text)
                    # Print chunks as they arrive for live feedback
                    sys.stdout.write(event.text)
                    sys.stdout.flush()
                elif isinstance(event, ToolCallEvent):
                    if event.tool_call_id in tool_call_map:
                        tc = tool_call_map[event.tool_call_id]
                        tc["status"] = event.status
                        if event.title:
                            tc["name"] = event.title
                        if event.input:
                            tc["input"] = event.input
                    else:
                        tc = {
                            "id": event.tool_call_id,
                            "name": event.title,
                            "status": event.status,
                            "kind": event.kind,
                        }
                        if event.input:
                            tc["input"] = event.input
                        tool_calls.append(tc)
                        tool_call_map[event.tool_call_id] = tc
                    icon = {"completed": "✅", "error": "❌", "running": "⏳"}.get(
                        event.status, "❓"
                    )
                    print(f"\n  {icon} TOOL: {event.title}")
                    if event.input:
                        inp = json.dumps(event.input, indent=2)
                        print(f"     Input: {inp[:300]}")
                elif isinstance(event, ToolCallUpdate):
                    if event.tool_call_id in tool_call_map:
                        tc = tool_call_map[event.tool_call_id]
                        if event.status:
                            tc["status"] = event.status
                        if event.title:
                            tc["name"] = event.title
                        if event.output:
                            tc["output"] = event.output
                            out = event.output[:200]
                            print(f"     Output: {out}")
                elif isinstance(event, PromptDone):
                    print(f"\n  🏁 Prompt done (stop_reason={event.stop_reason})")
                    break
    except asyncio.TimeoutError:
        log.warning("Prompt timed out after 300s")
        response_chunks.append("(timed out)")
    finally:
        await client.stop()

    elapsed = time.time() - t_start
    response_text = "".join(response_chunks)

    # 6. Summary
    print("\n" + "=" * 72)
    print("  🧪 DRY RUN SUMMARY")
    print("=" * 72)
    print(f"  Duration:     {elapsed:.1f}s")
    print(f"  Response:     {len(response_text)} chars")
    print(f"  Tool calls:   {len(tool_calls)}")
    for tc in tool_calls:
        status = tc.get("status", "?")
        name = tc.get("name", "?")
        icon = {"completed": "✅", "error": "❌", "running": "⏳"}.get(status, "❓")
        print(f"    {icon} {name} ({status})")
    print("=" * 72)

    log.info("Dry run complete.")


if __name__ == "__main__":
    asyncio.run(main())
