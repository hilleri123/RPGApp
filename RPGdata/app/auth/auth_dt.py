from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import pytz


def get_moscow_time() -> datetime:
    return datetime.now(timezone.utc)(ZoneInfo("Europe/Moscow"))


def get_moscow_expiration(hours: int) -> int:
    return int((get_moscow_time() + timedelta(hours=hours)).timestamp())

