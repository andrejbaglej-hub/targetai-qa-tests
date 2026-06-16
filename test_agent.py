"""
API-тесты агента TargetAI «Страны» (5849).

ТЗ работодателя — стабильные воспроизводимые API-тесты (без Playwright):

  test_agent_transcribes_speech      → транскрибация речи
  test_agent_calls_japan_tool        → вызов инструмента
  test_agent_generates_text_response → формирование ответной реплики
  test_full_dialog_flow              → полный цикл (все три пункта сразу)
"""

from __future__ import annotations

import os
import re

import pytest
from dotenv import load_dotenv

from audio_fixtures import default_japan_question_audio
from targetai_client import (
    EmissionType,
    SessionConfig,
    TargetAISession,
    drain_messages,
    join_content,
    wait_for_messages,
)

load_dotenv()

pytestmark = [pytest.mark.asyncio, pytest.mark.integration]

JAPAN_QUESTION = "Привет! Расскажи про Японию."


def _has_api_credentials() -> bool:
    return bool(os.getenv("TARGETAI_API_KEY")) and bool(
        os.getenv("TARGETAI_AGENT_UUID") or os.getenv("TARGETAI_AGENT_ID")
    )


skip_without_credentials = pytest.mark.skipif(
    not _has_api_credentials(),
    reason="Set TARGETAI_API_KEY and TARGETAI_AGENT_UUID in .env",
)


def _config(**overrides: object) -> SessionConfig:
    cfg = SessionConfig.from_env()
    for key, value in overrides.items():
        setattr(cfg, key, value)
    return cfg


async def _open_session(**overrides: object) -> TargetAISession:
    session = TargetAISession(_config(**overrides))
    await session.connect(response_medium="chat")
    await drain_messages(session, timeout_sec=2.0)
    return session


@skip_without_credentials
async def test_agent_transcribes_speech() -> None:
    """ТЗ п.1: транскрибация речи — WebRTC audio → recognized_speech."""
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
        assert transcript, "ASR must return recognized_speech content"
        assert "япон" in transcript or "расскаж" in transcript
    finally:
        await session.close()


@skip_without_credentials
async def test_agent_calls_japan_tool() -> None:
    """ТЗ п.2: вызов инструмента — tool_call japan."""
    session = await _open_session()
    try:
        await session.send_text(JAPAN_QUESTION)

        tool_calls = await wait_for_messages(
            session,
            emission_types={EmissionType.TOOL_CALL.value},
            timeout_sec=session.config.turn_timeout_sec,
            min_count=1,
        )
        call = tool_calls[0].call or {}
        assert call.get("tool_name") == "japan", f"Expected japan tool, got {call!r}"
    finally:
        await session.close()


@skip_without_credentials
async def test_agent_generates_text_response() -> None:
    """ТЗ п.3: формирование ответной реплики — content от ассистента."""
    session = await _open_session()
    try:
        await session.send_text(JAPAN_QUESTION)

        messages = await wait_for_messages(
            session,
            emission_types={EmissionType.CONTENT.value},
            timeout_sec=session.config.turn_timeout_sec,
            min_count=1,
        )
        reply = join_content(messages)
        assert reply, "Agent must emit at least one content chunk"
        assert len(reply) > 20
    finally:
        await session.close()


@skip_without_credentials
async def test_full_dialog_flow() -> None:
    """ТЗ: полный цикл — ASR-текст + tool + content в одном диалоге."""
    session = await _open_session()
    try:
        await session.send_text(JAPAN_QUESTION)

        collected = await drain_messages(
            session,
            timeout_sec=session.config.turn_timeout_sec,
        )

        types = {m.emission_type for m in collected}
        assert EmissionType.RECOGNIZED_SPEECH.value in types
        assert EmissionType.TOOL_CALL.value in types
        assert EmissionType.CONTENT.value in types

        tool_call = next(
            m for m in collected if m.emission_type == EmissionType.TOOL_CALL.value
        )
        assert (tool_call.call or {}).get("tool_name") == "japan"

        reply = join_content(collected)
        assert re.search(r"япон", reply, re.IGNORECASE), f"No Japan-related reply: {reply!r}"
    finally:
        await session.close()


if __name__ == "__main__":
    from qa_report import main

    raise SystemExit(main())
