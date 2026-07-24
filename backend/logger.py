"""
logger.py — Centralized structured JSON logging for Pramana backend.

Usage in any module:
    from logger import get_logger
    log = get_logger(__name__)
    log.info("message", extra={"request_id": "abc", "user_id": 1})

System logs (errors, latency, API failures) are separate from the
investigator-facing audit trail (stored in messages.audit_trail).
"""
import logging
import json
import sys
import time
import uuid
import os
from datetime import datetime, timezone

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
LOG_FILE  = os.environ.get("LOG_FILE", "")          # empty = stdout only


class JSONFormatter(logging.Formatter):
    """Emits one JSON object per log line — machine-parseable."""

    KEEP_FIELDS = {"levelname", "name", "message"}

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict = {
            "timestamp":   datetime.now(timezone.utc).isoformat(),
            "level":       record.levelname,
            "logger":      record.name,
            "message":     record.getMessage(),
        }

        # Merge any extra fields the caller passed
        for key, val in record.__dict__.items():
            if key not in (
                "levelname", "name", "msg", "args", "created",
                "filename", "funcName", "levelno", "lineno",
                "module", "msecs", "pathname", "process",
                "processName", "relativeCreated", "stack_info",
                "thread", "threadName", "exc_info", "exc_text",
                "message",
            ):
                log_obj[key] = val

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj, default=str)


def _build_handlers() -> list[logging.Handler]:
    handlers: list[logging.Handler] = []

    # Always log to stdout
    stdout_h = logging.StreamHandler(sys.stdout)
    stdout_h.setFormatter(JSONFormatter())
    handlers.append(stdout_h)

    # Optionally log to a file
    if LOG_FILE:
        file_h = logging.FileHandler(LOG_FILE, encoding="utf-8")
        file_h.setFormatter(JSONFormatter())
        handlers.append(file_h)

    return handlers


# Build root logger once
_root = logging.getLogger("pramana")
_root.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
for _h in _build_handlers():
    _root.addHandler(_h)
_root.propagate = False   # don't double-log through uvicorn's root


def get_logger(name: str) -> logging.Logger:
    """Return a child logger namespaced under 'pramana.<name>'."""
    return _root.getChild(name.replace("pramana.", ""))


def new_request_id() -> str:
    """Generate a short unique ID to correlate all log lines for one request."""
    return uuid.uuid4().hex[:12]


# ── Convenience timing context manager ────────────────────────────────────────

class Timer:
    """Usage: with Timer() as t: ...; log.info("done", extra={"elapsed": t.elapsed})"""
    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.elapsed = round(time.perf_counter() - self._start, 4)
