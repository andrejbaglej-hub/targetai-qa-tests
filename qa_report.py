"""
TargetAI QA verification report (ТЗ).

Проверяет через API (WebRTC data channel), без Playwright/фронтенда:
  1. Транскрибация речи (recognized_speech)
  2. Вызов инструмента (tool_call)
  3. Формирование ответной реплики (content)
"""

from __future__ import annotations

import asyncio
import os
import re
import sys
import time
from dataclasses import dataclass

from dotenv import load_dotenv

from audio_fixtures import default_japan_question_audio
from targetai_client import (
    EmissionType,
    SessionConfig,
    TargetAIClientError,
    TargetAISession,
    drain_messages,
    join_content,
    wait_for_messages,
)

load_dotenv()

JAPAN_QUESTION = "Привет! Расскажи про Японию."


@dataclass
class CheckResult:
    name: str
    description: str
    passed: bool
    detail: str
    duration_sec: float


def _config() -> SessionConfig:
    return SessionConfig.from_env()


def _credentials_ok() -> bool:
    return bool(os.getenv("TARGETAI_API_KEY")) and bool(
        os.getenv("TARGETAI_AGENT_UUID") or os.getenv("TARGETAI_AGENT_ID")
    )


async def _open_chat_session() -> TargetAISession:
    session = TargetAISession(_config())
    await session.connect(response_medium="chat")
    await drain_messages(session, timeout_sec=2.0)
    return session


async def check_speech_transcription() -> CheckResult:
    name = "Транскрибация речи"
    description = "ASR распознаёт речь клиента (recognized_speech)"
    started = time.monotonic()
    audio_path = default_japan_question_audio()
    session = TargetAISession(_config())
    try:
        await session.connect(audio_path=str(audio_path), response_medium="both")
        messages = await wait_for_messages(
            session,
            emission_types={EmissionType.RECOGNIZED_SPEECH.value},
            timeout_sec=session.config.turn_timeout_sec,
            min_count=1,
        )
        transcript = (messages[0].content or "").lower()
        passed = bool(transcript) and ("япон" in transcript or "расскаж" in transcript)
        detail = f'Транскрипт: "{messages[0].content}"' if messages else "Событие recognized_speech не получено"
    except Exception as exc:
        passed = False
        detail = str(exc)
    finally:
        await session.close()

    return CheckResult(name, description, passed, detail, time.monotonic() - started)


async def check_tool_invocation() -> CheckResult:
    name = "Вызов инструмента"
    description = "Агент вызывает tool japan при вопросе о Японии"
    started = time.monotonic()
    session = await _open_chat_session()
    try:
        await session.send_text(JAPAN_QUESTION)
        tool_calls = await wait_for_messages(
            session,
            emission_types={EmissionType.TOOL_CALL.value},
            timeout_sec=session.config.turn_timeout_sec,
            min_count=1,
        )
        call = tool_calls[0].call or {}
        tool_name = call.get("tool_name")
        passed = tool_name == "japan"
        detail = f"tool_name={tool_name!r}, args={call.get('arguments')!r}"
    except Exception as exc:
        passed = False
        detail = str(exc)
    finally:
        await session.close()

    return CheckResult(name, description, passed, detail, time.monotonic() - started)


async def check_assistant_reply() -> CheckResult:
    name = "Ответная реплика"
    description = "Агент формирует текстовый ответ (content)"
    started = time.monotonic()
    session = await _open_chat_session()
    try:
        await session.send_text(JAPAN_QUESTION)
        messages = await wait_for_messages(
            session,
            emission_types={EmissionType.CONTENT.value},
            timeout_sec=session.config.turn_timeout_sec,
            min_count=1,
        )
        reply = join_content(messages)
        passed = bool(reply) and len(reply) > 20 and bool(re.search(r"япон", reply, re.IGNORECASE))
        detail = reply[:200] + ("..." if len(reply) > 200 else "") if reply else "Ответ content не получен"
    except Exception as exc:
        passed = False
        detail = str(exc)
    finally:
        await session.close()

    return CheckResult(name, description, passed, detail, time.monotonic() - started)


async def run_all_checks() -> list[CheckResult]:
    if not _credentials_ok():
        raise TargetAIClientError(
            "Заполните TARGETAI_API_KEY и TARGETAI_AGENT_UUID в файле .env"
        )
    return await asyncio.gather(
        check_speech_transcription(),
        check_tool_invocation(),
        check_assistant_reply(),
    )


def _print_report(results: list[CheckResult]) -> int:
    width = 62
    line = "=" * width
    all_passed = all(r.passed for r in results)

    print()
    print(line)
    print("  TargetAI QA — проверка по ТЗ (API, без Playwright)")
    print(line)
    print(f"  Агент: Страны (5849)")
    print(f"  Протокол: WebRTC + data channel /run/voice/offer")
    print(line)
    print()

    for idx, result in enumerate(results, 1):
        mark = "PASS" if result.passed else "FAIL"
        icon = "+" if result.passed else "x"
        print(f"  [{icon}] {idx}. {result.name}  [{mark}]  ({result.duration_sec:.1f}s)")
        print(f"      {result.description}")
        print(f"      -> {result.detail}")
        print()

    print(line)
    if all_passed:
        print("  ИТОГ: все 3 пункта ТЗ выполнены")
    else:
        failed = sum(1 for r in results if not r.passed)
        print(f"  ИТОГ: провалено {failed} из {len(results)} проверок")
    print(line)
    print()
    print("  Автотесты pytest:  py -m pytest test_agent.py -v")
    print("  Интерактивный чат: py chat.py")
    print("  Демо-сценарий:     py targetai_client.py")
    print()

    return 0 if all_passed else 1


def main() -> int:
    try:
        results = asyncio.run(run_all_checks())
    except TargetAIClientError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return _print_report(results)


if __name__ == "__main__":
    raise SystemExit(main())
