import asyncio
import os
import time
from typing import Optional
from pathlib import Path
from fastapi import UploadFile
from uuid import uuid4


MEDIA_ROOT       = Path(os.environ.get("MEDIA_ROOT", "/app/media"))
MEDIA_URL_PREFIX = os.environ.get("MEDIA_URL_PREFIX", "/media")
BASE_URL         = os.environ.get("BASE_URL", "http://localhost:6602/api")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}
AUDIO_EXTENSIONS = {".mp3", ".ogg", ".wav", ".flac", ".aac", ".m4a", ".opus"}
AUDIO_MIME_PREFIXES = {"audio/"}


def _public_url(relative: str) -> str:
    return f"{BASE_URL}{MEDIA_URL_PREFIX}/{relative}"


def _versioned_stem(name: str, *, extra: Optional[str] = None) -> str:
    """Имя файла с меткой времени — браузерный кэш видит новый URL при каждой загрузке."""
    ts = int(time.time() * 1000)  # ms — уникальность при быстрых перезагрузках
    if extra is not None:
        return f"{name}_{extra}_{ts}"
    return f"{name}_{ts}"


def _path_from_url(url: str) -> Optional[Path]:
    """Извлечь путь на диске из URL любого формата."""
    if not url:
        return None
    # Drop query/fragment if present (cache-bust params, etc.)
    url = url.split("?", 1)[0].split("#", 1)[0]
    marker = MEDIA_URL_PREFIX + "/"
    idx = url.find(marker)
    if idx == -1:
        return None
    relative = url[idx + len(marker):]

    # Хвост URL приходит из БД и из запросов, поэтому нормализуем и проверяем
    # границу каталога: путь уходит в unlink(), то есть промах означает удаление
    # произвольного файла, а не только чтение.
    root = MEDIA_ROOT.resolve()
    try:
        candidate = (root / relative).resolve()
    except OSError:
        return None
    if candidate != root and root not in candidate.parents:
        return None
    return candidate


def _cleanup_old_versions(dest_dir: Path, name: str, keep: Path) -> None:
    """Удалить предыдущие файлы того же логического имени в папке."""
    if not dest_dir.exists():
        return
    prefix = f"{name}_"
    for p in dest_dir.iterdir():
        if not p.is_file() or p.resolve() == keep.resolve():
            continue
        stem = p.stem
        if stem == name or stem.startswith(prefix):
            try:
                p.unlink()
            except OSError:
                pass


async def upload_file(file: UploadFile, folder: str, name: Optional[str] = None) -> str:
    """Загружает файл, возвращает публичный URL с timestamp в имени."""
    suffix = Path(file.filename or "file").suffix or ".bin"
    dest_dir = MEDIA_ROOT / folder
    dest_dir.mkdir(parents=True, exist_ok=True)

    base = name or str(uuid4())
    filename = f"{_versioned_stem(base)}{suffix}"
    dest = dest_dir / filename

    content = await file.read()
    await asyncio.to_thread(dest.write_bytes, content)
    await asyncio.to_thread(_cleanup_old_versions, dest_dir, base, dest)

    return _public_url(f"{folder}/{filename}")


async def upload_file_with_path(file: UploadFile, folder: str, name: Optional[str] = None) -> tuple[str, str]:
    """Загружает файл, возвращает (url, path_on_disk)."""
    suffix = Path(file.filename or "file").suffix or ".bin"
    dest_dir = MEDIA_ROOT / folder
    dest_dir.mkdir(parents=True, exist_ok=True)

    base = name or str(uuid4())
    filename = f"{_versioned_stem(base)}{suffix}"
    dest = dest_dir / filename

    content = await file.read()
    await asyncio.to_thread(dest.write_bytes, content)
    await asyncio.to_thread(_cleanup_old_versions, dest_dir, base, dest)

    url  = _public_url(f"{folder}/{filename}")
    path = str(dest)
    return url, path


async def upload_extra_image(file: UploadFile, folder: str, name: str, index: int) -> tuple[str, str]:
    """Загружает одну из дополнительных картинок. Возвращает (url, path)."""
    suffix = Path(file.filename or "file").suffix or ".bin"
    dest_dir = MEDIA_ROOT / folder
    dest_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{_versioned_stem(name, extra=str(index))}{suffix}"
    dest = dest_dir / filename

    content = await file.read()
    await asyncio.to_thread(dest.write_bytes, content)
    await asyncio.to_thread(_cleanup_old_versions, dest_dir, f"{name}_{index}", dest)

    return _public_url(f"{folder}/{filename}"), str(dest)


def delete_file(url: str) -> None:
    path = _path_from_url(url)
    if path and path.exists():
        path.unlink()


def delete_file_by_path(path_str: str) -> None:
    path = Path(path_str)
    if path.exists():
        path.unlink()


def list_images(folder: Optional[str] = None) -> list[str]:
    root = MEDIA_ROOT / folder if folder else MEDIA_ROOT
    if not root.exists():
        return []
    return [
        _public_url(p.relative_to(MEDIA_ROOT).as_posix())
        for p in sorted(root.rglob("*"))
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    ]


def list_audio(folder: Optional[str] = None) -> list[str]:
    root = MEDIA_ROOT / folder if folder else MEDIA_ROOT
    if not root.exists():
        return []
    return [
        _public_url(p.relative_to(MEDIA_ROOT).as_posix())
        for p in sorted(root.rglob("*"))
        if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS
    ]


def is_audio_file(content_type: str, filename: str) -> bool:
    if content_type and any(content_type.startswith(p) for p in AUDIO_MIME_PREFIXES):
        return True
    if filename:
        return Path(filename).suffix.lower() in AUDIO_EXTENSIONS
    return False
