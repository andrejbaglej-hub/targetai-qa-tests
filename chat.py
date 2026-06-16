"""
Интерактивный чат с агентом через API (WebRTC).

Не использует Playwright/браузер — только тот же протокол, что и веб-интерфейс.
"""

from __future__ import annotations

import asyncio
import sys

from dotenv import load_dotenv

from targetai_client import (
    EmissionType,
    SessionConfig,
    TargetAIClientError,
    TargetAISession,
    drain_messages,
    join_content,
    run_turn,
)

load_dotenv()


BANNER = """
+--------------------------------------------------------------+
|           TargetAI — интерактивный чат (API)                 |
|           Агент: Страны / Максим                             |
+--------------------------------------------------------------+
|  Команды:  /quit — выход   /help — подсказка                 |
|  Примеры:  ЯПОНИЯ | Расскажи про Италию | до свидания        |
+--------------------------------------------------------------+
"""


async def chat_loop() -> None:
    config = SessionConfig.from_env()
    if not config.api_key or not config.agent_uuid:
        raise TargetAIClientError("Заполните TARGETAI_API_KEY и TARGETAI_AGENT_UUID в .env")

    print(BANNER)
    print("Подключение...")

    session = TargetAISession(config)
    await session.connect(response_medium="chat")
    print(f"Соединение установлено (interaction_id={session.interaction_id})\n")

    greeting = await drain_messages(session, timeout_sec=3.0)
    greeting_text = join_content(greeting)
    if greeting_text:
        print(f"Максим: {greeting_text}\n")

    while True:
        try:
            user_input = input("Вы: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nВыход.")
            break

        if not user_input:
            continue
        if user_input.lower() in {"/quit", "/exit", "quit", "exit"}:
            print("До свидания!")
            break
        if user_input.lower() == "/help":
            print("  ЯПОНИЯ — база знаний japan")
            print("  Расскажи про Италию — база знаний italy")
            print("  до свидания — завершение диалога")
            continue

        events = await run_turn(session, user_input)

        for msg in events:
            if msg.emission_type == EmissionType.TOOL_CALL.value:
                call = msg.call or {}
                print(f"  [tool] {call.get('tool_name')}({call.get('arguments')})")
            elif msg.emission_type == EmissionType.TOOL_RESPONSE.value:
                response = msg.response or {}
                result = (response.get("result") or {}).get("output")
                if result:
                    print(f"  [kb] {result}")

        reply = join_content(events)
        if reply:
            print(f"Максим: {reply}\n")

        if any(
            m.emission_type == EmissionType.COMPLETION.value
            and m.raw.get("completion_type") == "termination"
            for m in events
        ):
            print("Агент завершил сессию.")
            break

    await session.close()


def main() -> None:
    try:
        asyncio.run(chat_loop())
    except TargetAIClientError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
