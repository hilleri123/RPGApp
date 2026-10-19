"""Черновик истории и картинки по репликам, хронике и логам ходов.

Хроника не перезаписывается: результат — отдельная запись черновика.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import time
import urllib.request
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.services.table_session import MEDIA_ROOT, utterances_of


def draft_from_sources(
    *,
    utterances: list[tuple[str, str, str | None]],
    chronicle: list[str],
    moves: list[str],
) -> str:
    """Собрать читаемый черновик без модели. utterances: (имя, текст, игровое время)."""
    lines = ["Черновик стола.", ""]
    if utterances:
        lines.append("Реплики")
        for name, text, game_time in utterances:
            stamp = f" [{game_time}]" if game_time else ""
            lines.append(f"- {name}{stamp}: {text}")
        lines.append("")
    if chronicle:
        lines.append("Хроника")
        lines.extend(f"- {line}" for line in chronicle)
        lines.append("")
    if moves:
        lines.append("Ходы")
        lines.extend(f"- {line}" for line in moves)
        lines.append("")
    if len(lines) <= 2:
        lines.append("За этот стол ещё нет реплик, хроники и ходов.")
    return "\n".join(lines).strip() + "\n"


def paragraphs_of(text: str) -> list[str]:
    chunks = [part.strip() for part in text.split("\n\n") if part.strip()]
    return chunks[:6]


def _yandex(url: str, body: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "Authorization": f"Api-Key {os.environ['YANDEX_API_KEY']}",
            "x-folder-id": os.environ["YANDEX_FOLDER_ID"],
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode())


def polish_with_model(draft: str) -> str:
    if not (os.getenv("YANDEX_API_KEY") and os.getenv("YANDEX_FOLDER_ID")):
        return draft
    folder = os.environ["YANDEX_FOLDER_ID"]
    result = _yandex("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
        "modelUri": f"gpt://{folder}/yandexgpt/latest",
        "completionOptions": {"stream": False, "temperature": 0.4, "maxTokens": "2000"},
        "messages": [
            {"role": "system", "text": "Собери черновик истории настольной игры по репликам, хронике и ходам. Не выдумывай события, которых нет во входе. Хронику мастера не заменяй, это отдельный черновик."},
            {"role": "user", "text": draft},
        ],
    })
    alternatives = ((result.get("result") or {}).get("alternatives") or [])
    if not alternatives:
        return draft
    text = ((alternatives[0].get("message") or {}).get("text") or "").strip()
    return text or draft


def _save_png(recap_id: UUID, index: int, payload: bytes) -> str:
    folder = MEDIA_ROOT / "table" / "recap"
    folder.mkdir(parents=True, exist_ok=True)
    relative = f"table/recap/{recap_id}-{index}.png"
    (MEDIA_ROOT / relative).write_bytes(payload)
    return f"/media/{relative}"


def illustrate(recap_id: UUID, paragraphs: list[str]) -> list[dict]:
    images: list[dict] = []
    enabled = bool(os.getenv("YANDEX_API_KEY") and os.getenv("YANDEX_FOLDER_ID"))
    folder = os.getenv("YANDEX_FOLDER_ID", "")
    for index, paragraph in enumerate(paragraphs):
        prompt = paragraph[:500]
        item = {"paragraph": paragraph, "prompt": prompt, "url": None, "error": None}
        if not enabled:
            item["error"] = "YANDEX_API_KEY не задан, картинка не запрошена"
            images.append(item)
            continue
        try:
            started = _yandex(
                "https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync",
                {
                    "modelUri": f"art://{folder}/yandex-art/latest",
                    "generationOptions": {"seed": str(index), "aspectRatio": {"widthRatio": "1", "heightRatio": "1"}},
                    "messages": [{"text": prompt}],
                },
            )
            operation = started.get("id")
            image_b64 = None
            deadline = time.monotonic() + 180
            while operation and time.monotonic() < deadline and not image_b64:
                polled = json.loads(urllib.request.urlopen(urllib.request.Request(
                    f"https://operation.api.cloud.yandex.net/operations/{operation}",
                    headers={"Authorization": f"Api-Key {os.environ['YANDEX_API_KEY']}"},
                ), timeout=30).read().decode())
                image_b64 = ((polled.get("response") or {}).get("image"))
                if polled.get("done") and not image_b64:
                    item["error"] = polled.get("error") or "пустой ответ"
                    break
                if not image_b64:
                    time.sleep(2)
            if image_b64:
                item["url"] = _save_png(recap_id, index, base64.b64decode(image_b64))
        except Exception as exc:
            item["error"] = str(exc)
        images.append(item)
    return images


async def build_recap(db: AsyncSession, table: models.TableSession) -> models.TableRecap:
    session = await db.get(models.GameSession, table.game_session_id)
    names = {row.id: row.display_name for row in (await db.execute(
        select(models.TableParticipant).where(models.TableParticipant.table_session_id == table.id)
    )).scalars().all()}
    said = [
        (names.get(row.participant_id, "участник"), row.text, row.game_time)
        for row in await utterances_of(db, table.id)
        if row.text.strip()
    ]
    chronicle_lines: list[str] = []
    move_lines: list[str] = []
    if session is not None and session.scenario_id is not None:
        rows = (await db.execute(
            select(models.ChronicleLine)
            .where(models.ChronicleLine.scenario_id == session.scenario_id)
            .order_by(models.ChronicleLine.real_at.asc())
        )).scalars().all()
        for row in rows:
            stamp = row.game_time or ""
            line = f"{stamp} {row.text}".strip()
            if row.kind and ("move" in row.kind or "roll" in row.kind or row.kind.startswith("plugin:")):
                move_lines.append(line)
            else:
                chronicle_lines.append(line)
    raw = draft_from_sources(
        utterances=said,
        chronicle=chronicle_lines[-40:],
        moves=move_lines[-40:],
    )
    draft = await asyncio.to_thread(polish_with_model, raw)
    recap = models.TableRecap(table_session_id=table.id, text=draft, images=[])
    db.add(recap)
    await db.flush()
    recap.images = await asyncio.to_thread(illustrate, recap.id, paragraphs_of(draft))
    return recap
