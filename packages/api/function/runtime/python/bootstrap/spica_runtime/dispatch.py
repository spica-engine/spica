"""Per-event-type argument builders for the bootstrap loop."""

from __future__ import annotations

from typing import Callable, List, Optional, Tuple

from ._pb import event_pb2
from .database import Change
from .http import Request, Response
from .queue import DatabaseQueueClient, EventQueueClient, HttpQueueClient


def build_call_arguments(
    ev,
    queue: EventQueueClient,
) -> Tuple[Optional[List], Optional[Callable]]:
    """Return ``(args, callback)`` for ``ev`` or ``(None, None)`` on error.

    ``callback`` is invoked with the user handler's return value and is
    responsible for writing back to the corresponding wire (e.g. HTTP
    response). It may be ``None`` for trigger types that don't have a return
    channel (database, schedule).
    """

    if ev.type == event_pb2.HTTP:
        http = HttpQueueClient()
        try:
            request = http.pop(ev.id)
        except Exception:
            queue.complete(ev.id, succeeded=False)
            return None, None
        response = Response(http, ev.id)

        def _http_callback(result):
            if response.headers_sent or result is None:
                return
            response.send(result)

        return [Request(request), response], _http_callback

    if ev.type == event_pb2.DATABASE:
        db = DatabaseQueueClient()
        change = db.pop(ev.id)
        return [Change(change)], None

    if ev.type == event_pb2.SCHEDULE or ev.type == event_pb2.SYSTEM:
        return [], None

    # Phase 1 supports HTTP / SCHEDULE / DATABASE only. Anything else is a
    # configuration error that should fail loudly so the user reaches for a
    # supported trigger.
    queue.complete(ev.id, succeeded=False)
    raise RuntimeError(
        f"Trigger type '{event_pb2.Type.Name(ev.type)}' is not supported by "
        "the Python runtime in this release."
    )
