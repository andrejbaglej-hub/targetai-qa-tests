"""
TargetAI agent session client for API-level QA tests.

Protocol (same as targetai-client-js-sdk):
  1. POST /api/token/generate  (Bearer API key)
  2. POST /run/voice/offer       (WebRTC SDP + agent_uuid)
  3. Data channel "messages" (negotiated, id=0)
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import aiohttp
from aiortc import RTCIceServer, RTCPeerConnection, RTCSessionDescription, RTCConfiguration
from aiortc.contrib.media import MediaPlayer


class EmissionType(str, Enum):
    CONTENT = "content"
    RECOGNIZED_SPEECH = "recognized_speech"
    TOOL_CALL = "tool_call"
    TOOL_RESPONSE = "tool_response"
    COMPLETION = "completion"
    ERROR = "error"


DEFAULT_ICE_SERVERS = [
    RTCIceServer(
        urls=["turn:130.193.55.198:3478?transport=tcp"],
        username="glebd",
        credential="pwdcdtfdghf",
    )
]


@dataclass
class AgentMessage:
    emission_type: str
    role: str | None = None
    content: str | None = None
    call: dict[str, Any] | None = None
    response: dict[str, Any] | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> AgentMessage | None:
        if "content" not in payload:
            return None

        data = payload["content"]
        emission = data.get("emission_type")
        if not emission:
            return None

        roles = {
            "content": "assistant",
            "recognized_speech": "user",
            "tool_call": "tool",
            "tool_response": "tool",
            "completion": "system",
            "error": "error",
        }

        return cls(
            emission_type=emission,
            role=roles.get(emission),
            content=data.get("content"),
            call=data.get("call"),
            response=data.get("response"),
            raw=data,
        )


@dataclass
class SessionConfig:
    base_url: str = "https://app.targetai.ai"
    api_key: str = ""
    agent_uuid: str = ""
    response_medium: str = "chat"
    ice_servers: list[Any] = field(default_factory=lambda: list(DEFAULT_ICE_SERVERS))
    connection_timeout_sec: float = 60.0
    turn_timeout_sec: float = 90.0

    @classmethod
    def from_env(cls) -> SessionConfig:
        return cls(
            base_url=os.getenv("TARGETAI_BASE_URL", "https://app.targetai.ai"),
            api_key=os.getenv("TARGETAI_API_KEY", ""),
            agent_uuid=os.getenv(
                "TARGETAI_AGENT_UUID",
                os.getenv("TARGETAI_AGENT_ID", ""),
            ),
            response_medium=os.getenv("TARGETAI_RESPONSE_MEDIUM", "chat"),
            connection_timeout_sec=float(
                os.getenv("TARGETAI_CONNECTION_TIMEOUT", "60")
            ),
            turn_timeout_sec=float(os.getenv("TARGETAI_TURN_TIMEOUT", "90")),
        )


class TargetAIClientError(Exception):
    pass


class TargetAISession:
    def __init__(self, config: SessionConfig) -> None:
        self.config = config
        self._pc: RTCPeerConnection | None = None
        self._channel = None
        self._player: MediaPlayer | None = None
        self._messages: asyncio.Queue[AgentMessage] = asyncio.Queue()
        self._errors: asyncio.Queue[str] = asyncio.Queue()
        self._connected = asyncio.Event()
        self._channel_open = asyncio.Event()
        self._ready = asyncio.Event()
        self.interaction_id: int | None = None

    @property
    def messages(self) -> asyncio.Queue[AgentMessage]:
        return self._messages

    @property
    def errors(self) -> asyncio.Queue[str]:
        return self._errors

    async def __aenter__(self) -> TargetAISession:
        await self.connect()
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.close()

    async def connect(
        self,
        audio_path: str | None = None,
        *,
        response_medium: str | None = None,
    ) -> None:
        if not self.config.api_key:
            raise TargetAIClientError(
                "TARGETAI_API_KEY is required. Set it in environment or .env."
            )
        if not self.config.agent_uuid:
            raise TargetAIClientError("TARGETAI_AGENT_UUID is required.")

        medium = response_medium or self.config.response_medium
        token = await self._fetch_token()

        self._pc = RTCPeerConnection(
            RTCConfiguration(iceServers=self.config.ice_servers)
        )

        @self._pc.on("connectionstatechange")
        async def on_connection_state() -> None:
            if self._pc and self._pc.connectionState == "connected":
                self._connected.set()

        self._channel = self._pc.createDataChannel(
            "messages",
            negotiated=True,
            id=0,
        )

        @self._channel.on("open")
        def on_open() -> None:
            self._channel_open.set()

        @self._channel.on("message")
        def on_message(data: str | bytes) -> None:
            if isinstance(data, bytes):
                data = data.decode()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                return
            self._handle_payload(payload)

        if audio_path:
            self._player = MediaPlayer(audio_path)
            if self._player.audio:
                self._pc.addTrack(self._player.audio)

        offer = await self._pc.createOffer()
        await self._pc.setLocalDescription(offer)
        await self._wait_for_ice_gathering()

        answer = await self._send_offer(token, self._pc.localDescription, medium)
        await self._pc.setRemoteDescription(
            RTCSessionDescription(sdp=answer["sdp"], type=answer["type"])
        )

        await asyncio.wait_for(
            self._connected.wait(),
            timeout=self.config.connection_timeout_sec,
        )
        await asyncio.wait_for(
            self._channel_open.wait(),
            timeout=self.config.connection_timeout_sec,
        )
        await asyncio.wait_for(
            self._ready.wait(),
            timeout=self.config.connection_timeout_sec,
        )

    async def send_text(self, text: str) -> None:
        if not self._channel:
            raise TargetAIClientError("Data channel is not open.")
        while self._channel.readyState != "open":
            await asyncio.sleep(0.05)

        self._channel.send(
            json.dumps({"text": text, "stream": True}, ensure_ascii=False)
        )

    async def close(self) -> None:
        if self._player:
            self._player = None
        if self._pc:
            await self._pc.close()
            self._pc = None

    def _handle_payload(self, payload: dict[str, Any]) -> None:
        if payload.get("status") == "ready":
            self.interaction_id = payload.get("interaction_id")
            self._ready.set()
            return

        if "error" in payload:
            self._errors.put_nowait(str(payload["error"]))
            return

        msg = AgentMessage.from_payload(payload)
        if msg:
            self._messages.put_nowait(msg)

    async def _wait_for_ice_gathering(self) -> None:
        if not self._pc:
            return
        if self._pc.iceGatheringState == "complete":
            return

        done = asyncio.Event()

        @self._pc.on("icegatheringstatechange")
        async def on_ice_gathering_state() -> None:
            if self._pc and self._pc.iceGatheringState == "complete":
                done.set()

        await asyncio.wait_for(done.wait(), timeout=self.config.connection_timeout_sec)

    async def _fetch_token(self) -> str:
        url = f"{self.config.base_url}/api/token/generate"
        headers = {"Authorization": f"Bearer {self.config.api_key}"}
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json={}) as response:
                data = await response.json()
                if response.status != 200 or "token" not in data:
                    raise TargetAIClientError(
                        f"Token request failed ({response.status}): {data}"
                    )
                return data["token"]

    async def _send_offer(
        self,
        token: str,
        local_description,
        response_medium: str,
    ) -> dict[str, Any]:
        url = f"{self.config.base_url}/run/voice/offer"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {
            "sdp": local_description.sdp,
            "type": local_description.type,
            "agent_uuid": self.config.agent_uuid,
            "data_input": {},
            "messages": [],
            "response_medium": response_medium,
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload) as response:
                data = await response.json()
                if response.status != 200:
                    raise TargetAIClientError(
                        f"Offer request failed ({response.status}): {data}"
                    )
                return data


async def wait_for_messages(
    session: TargetAISession,
    emission_types: set[str] | None = None,
    timeout_sec: float = 20.0,
    min_count: int = 1,
) -> list[AgentMessage]:
    result: list[AgentMessage] = []
    try:
        while len(result) < min_count:
            msg = await asyncio.wait_for(
                session.messages.get(),
                timeout=timeout_sec,
            )
            if emission_types is None or msg.emission_type in emission_types:
                result.append(msg)
    except asyncio.TimeoutError:
        pass
    return result


async def drain_messages(
    session: TargetAISession,
    timeout_sec: float = 5.0,
) -> list[AgentMessage]:
    result: list[AgentMessage] = []
    while True:
        try:
            msg = await asyncio.wait_for(
                session.messages.get(),
                timeout=timeout_sec,
            )
            result.append(msg)
        except asyncio.TimeoutError:
            break
    return result


def join_content(messages: list[AgentMessage]) -> str:
    parts = [m.content for m in messages if m.emission_type == EmissionType.CONTENT.value and m.content]
    return "".join(parts).strip()


def format_message(msg: AgentMessage) -> str:
    if msg.emission_type == EmissionType.CONTENT.value:
        return f"[assistant] {msg.content}"
    if msg.emission_type == EmissionType.RECOGNIZED_SPEECH.value:
        return f"[user/asr] {msg.content}"
    if msg.emission_type == EmissionType.TOOL_CALL.value:
        call = msg.call or {}
        return f"[tool_call] {call.get('tool_name')} args={call.get('arguments')}"
    if msg.emission_type == EmissionType.TOOL_RESPONSE.value:
        response = msg.response or {}
        result = response.get("result") or {}
        output = result.get("output")
        if isinstance(output, dict):
            output = json.dumps(output, ensure_ascii=False)
        return f"[tool_response] {response.get('tool_name')}: {output}"
    if msg.emission_type == EmissionType.COMPLETION.value:
        completion_type = msg.raw.get("completion_type", "turn")
        return f"[completion] {completion_type}"
    if msg.emission_type == EmissionType.ERROR.value:
        return f"[error] {msg.content or msg.raw}"
    return f"[{msg.emission_type}] {msg.content or msg.raw}"


async def run_turn(
    session: TargetAISession,
    text: str,
    *,
    idle_timeout_sec: float = 8.0,
    max_wait_sec: float | None = None,
) -> list[AgentMessage]:
    """Send one user message and collect events until the turn completes."""
    max_wait_sec = max_wait_sec or session.config.turn_timeout_sec
    await session.send_text(text)

    collected: list[AgentMessage] = []
    deadline = time.monotonic() + max_wait_sec
    turn_done = False

    while time.monotonic() < deadline and not turn_done:
        remaining = min(idle_timeout_sec, deadline - time.monotonic())
        if remaining <= 0:
            break
        try:
            msg = await asyncio.wait_for(session.messages.get(), timeout=remaining)
        except asyncio.TimeoutError:
            break

        collected.append(msg)
        if (
            msg.emission_type == EmissionType.COMPLETION.value
            and msg.raw.get("completion_type") == "turn"
        ):
            turn_done = True
        if (
            msg.emission_type == EmissionType.COMPLETION.value
            and msg.raw.get("completion_type") == "termination"
        ):
            turn_done = True
            break

    return collected


async def run_demo_dialog() -> None:
    """Interactive demo: greeting, Japan, Italy, goodbye."""
    from dotenv import load_dotenv

    load_dotenv()
    config = SessionConfig.from_env()
    if not config.api_key or not config.agent_uuid:
        raise TargetAIClientError(
            "Fill TARGETAI_API_KEY and TARGETAI_AGENT_UUID in .env before running."
        )

    turns = [
        ("ЯПОНИЯ", "japan"),
        ("Расскажи про Италию", "italy"),
        ("до свидания", "goodbye_func"),
    ]

    print("=" * 60)
    print("TargetAI demo dialog (agent: Страны / 5849)")
    print(f"Agent UUID: {config.agent_uuid}")
    print("=" * 60)

    session = TargetAISession(config)
    await session.connect(response_medium="chat")
    print(f"Connected. interaction_id={session.interaction_id}")

    greeting = await drain_messages(session, timeout_sec=3.0)
    if greeting:
        print("\n--- Greeting ---")
        for msg in greeting:
            line = format_message(msg)
            if line:
                print(line)

    for user_text, expected_tool in turns:
        print(f"\n--- User: {user_text!r} ---")
        events = await run_turn(session, user_text)
        tool_names = [
            (m.call or {}).get("tool_name")
            for m in events
            if m.emission_type == EmissionType.TOOL_CALL.value
        ]
        for msg in events:
            print(format_message(msg))

        reply = join_content(events)
        if reply:
            print(f"=> Reply: {reply}")

        if expected_tool == "goodbye_func":
            if expected_tool not in tool_names:
                print(f"WARNING: expected tool {expected_tool}, got {tool_names}")
        elif expected_tool not in tool_names:
            print(f"WARNING: expected tool {expected_tool}, got {tool_names}")
        else:
            print(f"OK: tool {expected_tool} called")

        if any(
            m.emission_type == EmissionType.COMPLETION.value
            and m.raw.get("completion_type") == "termination"
            for m in events
        ):
            print("Session terminated by agent.")
            break

    await session.close()
    print("\nDone.")


def main() -> None:
    asyncio.run(run_demo_dialog())


if __name__ == "__main__":
    main()
