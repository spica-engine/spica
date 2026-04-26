"""Database change wrapper exposed to user-written Python handlers."""

from __future__ import annotations

import json as _json
from typing import Any


_KIND_NAMES = {0: "insert", 1: "update", 2: "replace", 3: "delete"}


class Change:
    def __init__(self, raw):
        self._raw = raw
        self.kind: str = _KIND_NAMES.get(raw.kind, "unknown")
        self.collection: str = raw.collection
        self.document_key: Any = self._safe_json(raw.documentKey)
        self.document: str = raw.document
        update_description = getattr(raw, "updateDescription", None)
        self.updated_fields: Any = (
            self._safe_json(update_description.updatedFields)
            if update_description is not None
            else None
        )
        self.removed_fields: Any = (
            self._safe_json(update_description.removedFields)
            if update_description is not None
            else None
        )

    @staticmethod
    def _safe_json(blob: str):
        if not blob:
            return None
        try:
            return _json.loads(blob)
        except ValueError:
            return blob
