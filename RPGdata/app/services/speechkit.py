"""Отложенное распознавание файла в Yandex SpeechKit.

Провайдер спрятан за одним входом: файл, язык ru, фразы с таймкодами.
Без ключа сегмент помечается ошибкой, текст не выдумывается.
"""

from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


RECOGNIZE_URL = "https://stt.api.cloud.yandex.net/stt/v3/recognizeFileAsync"
RESULT_URL = "https://stt.api.cloud.yandex.net/stt/v3/getRecognition"


@dataclass
class Phrase:
    text: str
    start_ms: int
    end_ms: int
    confidence: float | None


def configured() -> bool:
    return bool(os.getenv("YANDEX_API_KEY") and os.getenv("YANDEX_FOLDER_ID"))


def _request(url: str, body: dict | None = None, query: str = "") -> bytes:
    key = os.environ["YANDEX_API_KEY"]
    folder = os.environ["YANDEX_FOLDER_ID"]
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url + query,
        data=data,
        method="POST" if body is not None else "GET",
        headers={
            "Authorization": f"Api-Key {key}",
            "x-folder-id": folder,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()


def recognize_file(path: Path) -> list[Phrase]:
    if not configured():
        raise RuntimeError("YANDEX_API_KEY и YANDEX_FOLDER_ID не заданы")
    payload = path.read_bytes()
    if not payload:
        return []
    started = json.loads(_request(RECOGNIZE_URL, {
        "content": base64.b64encode(payload).decode(),
        "recognitionModel": {
            "model": "general",
            "audioFormat": {"containerAudio": {"containerAudioType": "OGG_OPUS"}},
            "languageRestriction": {
                "restrictionType": "WHITELIST",
                "languageCode": ["ru-RU"],
            },
        },
    }))
    operation_id = started.get("id") or started.get("operationId")
    if not operation_id:
        raise RuntimeError(f"SpeechKit не вернул операцию: {started}")
    deadline = time.monotonic() + 15 * 60
    phrases: list[Phrase] = []
    while time.monotonic() < deadline:
        try:
            raw = _request(RESULT_URL, query=f"?operationId={operation_id}")
        except urllib.error.HTTPError as exc:
            if exc.code in (404, 429, 500, 503):
                time.sleep(3)
                continue
            detail = exc.read().decode("utf-8", "replace")
            raise RuntimeError(f"SpeechKit {exc.code}: {detail}") from exc
        text = raw.decode("utf-8", "replace").strip()
        if not text:
            time.sleep(3)
            continue
        done = False
        for line in text.splitlines():
            event = json.loads(line)
            if event.get("done") or event.get("statusCode") == "CLOSED":
                done = True
            chunk = ((event.get("result") or {}).get("final")
                     or (event.get("result") or {}).get("finalRefinement")
                     or event.get("final"))
            if not isinstance(chunk, dict):
                continue
            for alternative in chunk.get("alternatives") or []:
                words = alternative.get("text") or ""
                if not words.strip():
                    continue
                phrases.append(Phrase(
                    text=words.strip(),
                    start_ms=int(alternative.get("startTimeMs") or chunk.get("startTimeMs") or 0),
                    end_ms=int(alternative.get("endTimeMs") or chunk.get("endTimeMs") or 0),
                    confidence=alternative.get("confidence"),
                ))
        if done or phrases:
            return phrases
        time.sleep(3)
    raise RuntimeError("SpeechKit не успел вернуть результат")
