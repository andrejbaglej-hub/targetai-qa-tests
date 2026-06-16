# TargetAI QA

## Установка зависимостей

Создать виртуальное окружение:

```bash
python -m venv .venv
```

Активировать:

Windows:

```bash
.venv\Scripts\activate
```

Установить зависимости:

```bash
pip install -r requirements.txt
```

Создать файл `.env` на основе примера:

```bash
copy .env.example .env
```

Заполнить в `.env`:

```env
TARGETAI_API_KEY=your_api_key
TARGETAI_AGENT_UUID=your_agent_uuid
TARGETAI_BASE_URL=https://app.targetai.ai
```

---

## Запуск проверки по ТЗ

Основная проверка:

```bash
py main.py
```

Проверяет:

- распознавание речи (`recognized_speech`)
- вызов инструмента (`tool_call`)
- формирование ответа агента (`content`)

---

## Запуск проверки + pytest

```bash
py main.py test
```

или напрямую:

```bash
py -m pytest test_agent.py -v
```

---

## Интерактивный чат с агентом

```bash
py chat.py
```

Примеры запросов:

```
ЯПОНИЯ
Расскажи про Италию
до свидания
```

Команды:

```
/help  - помощь
/quit  - выход
```

---

## Демо-сценарий

Автоматический диалог:

```
Япония → Италия → до свидания
```

Запуск:

```bash
py targetai_client.py
```

---

## Структура проекта

```
targetai/
│
├── main.py                 # основной запуск проверок
├── qa_report.py            # отчёт по проверкам ТЗ
├── test_agent.py           # pytest API-тесты
├── chat.py                 # интерактивный чат
├── targetai_client.py      # клиент WebRTC API
├── audio_fixtures.py       # тестовые аудиоданные
│
├── requirements.txt        # зависимости Python
├── .env.example            # пример переменных окружения
└── .gitignore
```

---

## Основные зависимости

Установка:

```bash
pip install -r requirements.txt
```

Используемые библиотеки:

- `aiortc`
- `aiohttp`
- `pytest`
- `pytest-asyncio`
- `python-dotenv`
- `av`