"""HTTP request/response wrappers exposed to user-written Python handlers."""

from __future__ import annotations

import json as _json
from typing import Any, Iterable, Optional, Tuple

from .queue import HttpQueueClient


class Request:
    """Read-only view over an :class:`Http.Request` proto.

    The shape mirrors the Node devkit ``Request`` so user code looks the same
    across runtimes.
    """

    def __init__(self, raw):
        self._raw = raw
        self.headers: dict = {h.key: h.value for h in raw.headers}
        self.params: dict = {p.key: p.value for p in raw.params}
        try:
            self.query: dict = _json.loads(raw.query) if raw.query else {}
        except ValueError:
            self.query = {}
        self.method: str = raw.method
        self.url: str = raw.url
        self.path: str = raw.path
        self._body: bytes = bytes(raw.body) if raw.body else b""

    @property
    def body(self) -> Any:
        if not self._body:
            return None
        ct = self.headers.get("content-type") or self.headers.get("Content-Type") or ""
        if "application/json" in ct.lower():
            try:
                return _json.loads(self._body.decode("utf-8"))
            except ValueError:
                return self._body
        return self._body

    @property
    def raw_body(self) -> bytes:
        return self._body


class Response:
    """Minimal Express-like response. Phase 1 supports ``send`` / ``status`` /
    ``json``.
    """

    def __init__(self, queue: HttpQueueClient, event_id: str):
        self._queue = queue
        self._event_id = event_id
        self._status = 200
        self._status_message = ""
        self._headers: list[Tuple[str, str]] = []
        self.headers_sent = False

    def status(self, code: int, message: str = "") -> "Response":
        self._status = code
        if message:
            self._status_message = message
        return self

    def set(self, key: str, value: str) -> "Response":
        self._headers.append((key, value))
        return self

    def _flush_headers(self) -> None:
        if self.headers_sent:
            return
        self._queue.write_head(
            id=self._event_id,
            status_code=self._status,
            status_message=self._status_message,
            headers=self._headers,
        )
        self.headers_sent = True

    def send(self, body: Any = None) -> None:
        payload: bytes
        if body is None:
            payload = b""
        elif isinstance(body, (bytes, bytearray)):
            payload = bytes(body)
        elif isinstance(body, str):
            payload = body.encode("utf-8")
            if not any(k.lower() == "content-type" for k, _ in self._headers):
                self._headers.append(("Content-Type", "text/plain; charset=utf-8"))
        else:
            payload = _json.dumps(body).encode("utf-8")
            if not any(k.lower() == "content-type" for k, _ in self._headers):
                self._headers.append(("Content-Type", "application/json"))
        self._flush_headers()
        self._queue.end(id=self._event_id, data=payload)

    def json(self, body: Any) -> None:
        if not any(k.lower() == "content-type" for k, _ in self._headers):
            self._headers.append(("Content-Type", "application/json"))
        self._flush_headers()
        self._queue.end(
            id=self._event_id, data=_json.dumps(body).encode("utf-8")
        )

    def write(self, chunk) -> None:
        self._flush_headers()
        if isinstance(chunk, str):
            chunk = chunk.encode("utf-8")
        self._queue.write(id=self._event_id, data=bytes(chunk))

    def end(self, chunk: Optional[Any] = None) -> None:
        if chunk is None:
            self._flush_headers()
            self._queue.end(id=self._event_id)
            return
        if isinstance(chunk, str):
            chunk = chunk.encode("utf-8")
        self._flush_headers()
        self._queue.end(id=self._event_id, data=bytes(chunk))
