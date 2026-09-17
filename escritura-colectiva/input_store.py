"""Bounded JSON feed. One server process, concurrent requests serialized by a lock."""
import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path


class InputStore:
    def __init__(self, path, limit=500, max_length=2000):
        self.path = Path(path)
        self.limit = limit
        self.max_length = max_length
        self.lock = threading.Lock()

    def _read(self):
        if not self.path.exists():
            return []
        entries = json.loads(self.path.read_text(encoding='utf-8'))
        if not isinstance(entries, list):
            raise ValueError('Invalid stored feed')
        return entries

    def snapshot(self):
        with self.lock:
            return {'entries': self._read(), 'limit': self.limit, 'maxLength': self.max_length}

    def add(self, payload):
        text = payload.get('text')
        if not isinstance(text, str) or not text.strip():
            raise ValueError('Escribe un texto antes de enviarlo.')
        text = text.replace('\r\n', '\n').replace('\r', '\n').strip()
        if len(text) > self.max_length:
            raise ValueError(f'Máximo {self.max_length} caracteres por entrada.')
        try:
            entry_id = str(uuid.UUID(payload.get('id', '')))
        except (ValueError, TypeError, AttributeError):
            raise ValueError('Identificador de envío inválido.')
        with self.lock:
            entries = self._read()
            existing = next((entry for entry in entries if entry['id'] == entry_id), None)
            if existing:
                return existing
            entry = {'id': entry_id, 'text': text, 'createdAt': datetime.now(timezone.utc).isoformat()}
            entries = [entry, *entries][:self.limit]
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.path.with_suffix('.tmp')
            try:
                with temporary.open('w', encoding='utf-8') as stream:
                    json.dump(entries, stream, ensure_ascii=False, indent=2)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temporary, self.path)
            finally:
                temporary.unlink(missing_ok=True)
            return entry
