
import logging
from datetime import datetime, timedelta, timezone

# Россия без летнего времени: все строки логов в +03, даже если в образе нет tzdata.
MSK = timezone(timedelta(hours=3))
EU_TIME = "%d.%m.%Y %H:%M:%S+03"


def _eu_clock(seconds: float):
    return datetime.fromtimestamp(seconds, MSK).timetuple()


logging.Formatter.converter = staticmethod(_eu_clock)


LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": EU_TIME,
            "use_colors": True,
        },
        "access": {
            "()": "uvicorn.logging.AccessFormatter",
            "fmt": '%(asctime)s [%(levelname)s] %(client_addr)s - "%(request_line)s" %(status_code)s',
            "datefmt": EU_TIME,
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
        "access": {
            "formatter": "access",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"level": "INFO", "propagate": True},
        "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
        "myapp": {"handlers": ["default"], "level": "DEBUG", "propagate": False},
    },
    "root": {"handlers": ["default"], "level": "INFO"},
}



logger = logging.getLogger("myapp")