"""Thin gRPC clients for the function event/http/database queues.

Generated stubs are produced by the ``codegen`` Nx target into
``spica_runtime/_pb`` at build time. They are imported lazily so import errors
surface clearly when codegen has not been run.
"""

from __future__ import annotations

import os
from typing import Optional

import grpc

from ._pb import event_pb2, event_pb2_grpc
from ._pb import http_pb2, http_pb2_grpc
from ._pb import database_pb2, database_pb2_grpc


def _channel() -> grpc.Channel:
    address = os.environ["FUNCTION_GRPC_ADDRESS"]
    max_size = int(
        os.environ.get("FUNCTION_GRPC_MAX_MESSAGE_SIZE", str(25 * 1024 * 1024))
    )
    return grpc.insecure_channel(
        address,
        options=[
            ("grpc.max_receive_message_length", max_size),
            ("grpc.max_send_message_length", max_size),
        ],
    )


class EventQueueClient:
    def __init__(self, channel: Optional[grpc.Channel] = None):
        self._channel = channel or _channel()
        self._stub = event_pb2_grpc.QueueStub(self._channel)

    def pop(self, worker_id: str) -> "event_pb2.Event":
        return self._stub.pop(event_pb2.Pop(id=worker_id))

    def complete(self, event_id: str, succeeded: bool) -> None:
        # NOTE: the proto field is misspelled as ``succedded``; preserve as-is.
        self._stub.complete(event_pb2.Complete(id=event_id, succedded=succeeded))


class HttpQueueClient:
    def __init__(self, channel: Optional[grpc.Channel] = None):
        self._channel = channel or _channel()
        self._stub = http_pb2_grpc.QueueStub(self._channel)

    def pop(self, event_id: str):
        return self._stub.pop(http_pb2.Request.Pop(id=event_id))

    def write_head(self, *, id: str, status_code: int, status_message: str, headers):
        return self._stub.writeHead(
            http_pb2.WriteHead(
                id=id,
                statusCode=status_code,
                statusMessage=status_message,
                headers=[http_pb2.Header(key=k, value=v) for k, v in headers],
            )
        )

    def write(self, *, id: str, data: bytes, encoding: str = "utf-8"):
        return self._stub.write(http_pb2.Write(id=id, data=data, encoding=encoding))

    def end(self, *, id: str, data: bytes = b"", encoding: str = "utf-8"):
        return self._stub.end(http_pb2.End(id=id, data=data, encoding=encoding))


class DatabaseQueueClient:
    def __init__(self, channel: Optional[grpc.Channel] = None):
        self._channel = channel or _channel()
        self._stub = database_pb2_grpc.QueueStub(self._channel)

    def pop(self, event_id: str):
        return self._stub.pop(database_pb2.Change.Pop(id=event_id))
