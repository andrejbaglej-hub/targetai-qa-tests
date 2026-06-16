"""Generate short Russian speech samples for transcription tests."""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def _edge_tts_available() -> bool:
    return shutil.which("edge-tts") is not None


def generate_speech_wav(text: str, output_path: Path) -> Path:
    """
    Create a mono WAV file with Russian speech.

    Prefers edge-tts CLI (pip install edge-tts). Falls back to pyttsx3 on Windows.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if _edge_tts_available():
        mp3_path = output_path.with_suffix(".mp3")
        subprocess.run(
            [
                "edge-tts",
                "--voice",
                "ru-RU-DmitryNeural",
                "--text",
                text,
                "--write-media",
                str(mp3_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        _convert_to_wav(mp3_path, output_path)
        mp3_path.unlink(missing_ok=True)
        return output_path

    try:
        import pyttsx3
    except ImportError as exc:
        raise RuntimeError(
            "Install edge-tts (pip install edge-tts) or pyttsx3 for speech fixtures."
        ) from exc

    engine = pyttsx3.init()
    voices = engine.getProperty("voices")
    for voice in voices:
        if "russian" in voice.name.lower() or "ru" in voice.id.lower():
            engine.setProperty("voice", voice.id)
            break

    tmp_wav = output_path.with_suffix(".tmp.wav")
    engine.save_to_file(text, str(tmp_wav))
    engine.runAndWait()
    if not tmp_wav.exists():
        raise RuntimeError("pyttsx3 failed to generate speech audio")

    _resample_wav(tmp_wav, output_path, sample_rate=24000)
    tmp_wav.unlink(missing_ok=True)
    return output_path


def _convert_to_wav(source: Path, destination: Path, sample_rate: int = 24000) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to convert edge-tts mp3 output to wav")
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            str(sample_rate),
            str(destination),
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def _resample_wav(source: Path, destination: Path, sample_rate: int) -> None:
    try:
        from pydub import AudioSegment
    except ImportError:
        destination.write_bytes(source.read_bytes())
        return

    audio = AudioSegment.from_wav(source)
    audio = audio.set_frame_rate(sample_rate).set_channels(1)
    audio.export(destination, format="wav")


def default_japan_question_audio(cache_dir: Path | None = None) -> Path:
    cache_dir = cache_dir or Path(tempfile.gettempdir()) / "targetai_tests"
    wav_path = cache_dir / "ask_about_japan.wav"
    if wav_path.exists() and wav_path.stat().st_size > 1000:
        return wav_path
    return generate_speech_wav("Расскажи мне про Японию", wav_path)


if __name__ == "__main__":
    path = default_japan_question_audio(Path(sys.argv[1]) if len(sys.argv) > 1 else None)
    print(path)
