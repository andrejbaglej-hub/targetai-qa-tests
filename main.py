"""
Точка входа проекта TargetAI QA.

  py main.py          — проверка по ТЗ (3 пункта)
  py main.py test     — то же + pytest
  py main.py chat     — интерактивный чат
  py main.py demo     — демо-сценарий (Япония, Италия, прощание)
"""

from __future__ import annotations

import subprocess
import sys


def _usage() -> None:
    print(__doc__)


def main(argv: list[str] | None = None) -> int:
    args = (argv if argv is not None else sys.argv[1:]) or ["qa"]
    command = args[0].lower()

    if command in {"qa", "test", "check", "verify"}:
        from qa_report import main as qa_main

        code = qa_main()
        if command == "test" and code == 0:
            print("Запуск pytest...\n")
            result = subprocess.run(
                [sys.executable, "-m", "pytest", "test_agent.py", "-v"],
                cwd=str(__import__("pathlib").Path(__file__).parent),
            )
            return result.returncode
        return code

    if command in {"chat", "talk"}:
        from chat import main as chat_main

        chat_main()
        return 0

    if command in {"demo", "run"}:
        from targetai_client import main as demo_main

        demo_main()
        return 0

    if command in {"help", "-h", "--help"}:
        _usage()
        return 0

    print(f"Неизвестная команда: {command}\n")
    _usage()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
