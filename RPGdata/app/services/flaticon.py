"""Поиск иконок через публичный поиск Flaticon. Ключ API не нужен."""

from __future__ import annotations

import asyncio
import http.client
import json
import re
import socket
import ssl
import urllib.parse
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models

SITE = "https://www.flaticon.com"
FLATICON_HOME = "https://www.flaticon.com/ru/free-icons/"
_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
}


class FlaticonError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


@dataclass(frozen=True)
class IconHit:
    id: int
    preview_url: str
    author_name: str
    author_url: str


def author_page(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    if not slug:
        return FLATICON_HOME
    return f"https://www.flaticon.com/authors/{slug}"


def icon_author(item: dict) -> tuple[str, str]:
    author = item.get("author")
    if isinstance(author, dict):
        name = str(author.get("name") or "").strip()
        url = str(author.get("url") or "").strip()
        if name:
            return name, url or author_page(name)
    name = str(item.get("team_name") or item.get("teamName") or "").strip()
    if not name:
        return "Flaticon", FLATICON_HOME
    return name, author_page(name)


def credit_author(name: str) -> tuple[str, str]:
    clean = " ".join((name or "").split())[:80]
    if not clean:
        return "Flaticon", FLATICON_HOME
    return clean, author_page(clean)


def preview_url(item: dict) -> str:
    images = item.get("images") if isinstance(item.get("images"), dict) else {}
    for size in ("128", "64", "256", "32"):
        url = images.get(size)
        if isinstance(url, str) and url:
            return url.replace("\\/", "/")
    for key in ("png", "png512"):
        url = item.get(key)
        if isinstance(url, str) and url:
            return url.replace("\\/", "/")
    return ""


def cdn_png_url(icon_id: int) -> str:
    return f"https://cdn-icons-png.flaticon.com/256/{icon_id // 1000}/{icon_id}.png"


def parse_search(payload: dict) -> list[IconHit]:
    raw = None
    if isinstance(payload, dict):
        raw = payload.get("items")
        if not isinstance(raw, list):
            raw = payload.get("data")
    if not isinstance(raw, list):
        return []
    hits: list[IconHit] = []
    for item in raw:
        if not isinstance(item, dict) or item.get("id") is None:
            continue
        preview = preview_url(item)
        if not preview:
            continue
        name, url = icon_author(item)
        hits.append(IconHit(id=int(item["id"]), preview_url=preview, author_name=name, author_url=url))
        if len(hits) >= 24:
            break
    return hits


def download_target(content_type: str, body: bytes) -> bytes | str:
    """PNG-байты сразу, либо временная ссылка из JSON-ответа."""
    kind = (content_type or "").split(";")[0].strip().lower()
    if kind.startswith("image/"):
        return body
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        if body[:8] == b"\x89PNG\r\n\x1a\n":
            return body
        raise FlaticonError(502, "Flaticon вернул ответ без картинки")
    if not isinstance(payload, dict):
        raise FlaticonError(502, "Flaticon вернул ответ без картинки")
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    for key in ("url", "download_url", "link"):
        url = data.get(key) if isinstance(data, dict) else None
        if isinstance(url, str) and url.startswith("https://"):
            return url
    raise FlaticonError(502, "Flaticon вернул ответ без картинки")


def _ipv4s(host: str) -> list[str]:
    found: list[str] = []
    try:
        infos = socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)
    except socket.gaierror:
        return found
    for info in infos:
        ip = info[4][0]
        if ip not in found:
            found.append(ip)
    return found


def _http_via(host: str, ip: str, path: str, headers: dict[str, str]) -> tuple[int, str, bytes]:
    context = ssl.create_default_context()
    connection = http.client.HTTPSConnection(host, 443, timeout=8, context=context)
    try:
        sock = socket.create_connection((ip, 443), 8)
        connection.sock = context.wrap_socket(sock, server_hostname=host)
        connection.request("GET", path, headers=headers)
        response = connection.getresponse()
        return response.status, response.getheader("Content-Type", ""), response.read()
    finally:
        connection.close()


def _http(url: str, headers: dict[str, str]) -> tuple[int, str, bytes]:
    parsed = urllib.parse.urlsplit(url)
    host = parsed.hostname or ""
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    addresses = _ipv4s(host) or [host]
    last = (0, "", b"")
    for ip in addresses:
        try:
            status, content_type, body = _http_via(host, ip, path, headers)
        except (TimeoutError, OSError, ssl.SSLError, http.client.HTTPException):
            continue
        last = (status, content_type, body)
        if status == 200 or status not in (403, 429):
            return last
    return last


def _search_headers(term: str) -> dict[str, str]:
    return {
        **_BROWSER,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{SITE}/search?word={urllib.parse.quote(term)}",
    }


async def search_icons(query: str) -> list[IconHit]:
    term = " ".join(query.split())[:80]
    if not term:
        raise FlaticonError(400, "Введите запрос")
    url = f"{SITE}/ajax/search/1?{urllib.parse.urlencode({'word': term})}"
    status, _, body = await asyncio.to_thread(_http, url, _search_headers(term))
    if status != 200:
        raise FlaticonError(502, "Flaticon не ответил на поиск")
    return parse_search(json.loads(body.decode("utf-8")))


async def _png(icon_id: int) -> bytes:
    headers = {**_BROWSER, "Accept": "image/png,image/*;q=0.8", "Referer": f"{SITE}/"}
    status, content_type, body = await asyncio.to_thread(_http, cdn_png_url(icon_id), headers)
    if status != 200 or not body:
        raise FlaticonError(502, "Не удалось скачать иконку")
    fetched = download_target(content_type, body)
    if not isinstance(fetched, bytes):
        raise FlaticonError(502, "Не удалось скачать иконку")
    return fetched


async def remember_author(db: AsyncSession, icon_id: int, author_name: str, author_url: str) -> None:
    row = await db.get(models.FlaticonCredit, icon_id)
    if row is None:
        db.add(models.FlaticonCredit(icon_id=icon_id, author_name=author_name, author_url=author_url))
    else:
        row.author_name = author_name
        row.author_url = author_url
    await db.commit()


async def download_icon(db: AsyncSession, icon_id: int, author_name: str = "") -> bytes:
    name, url = credit_author(author_name)
    png = await _png(icon_id)
    await remember_author(db, icon_id, name, url)
    return png


async def list_credits(db: AsyncSession) -> list[dict[str, str]]:
    rows = (await db.execute(select(models.FlaticonCredit).order_by(models.FlaticonCredit.author_name))).scalars().all()
    seen: dict[str, str] = {}
    for row in rows:
        seen.setdefault(row.author_name, row.author_url or FLATICON_HOME)
    return [{"author_name": name, "author_url": url} for name, url in seen.items()]
