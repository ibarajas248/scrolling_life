from __future__ import annotations

import json
import mimetypes
import os
import queue
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


APP_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = APP_DIR / "public"
DATA_DIR = Path(os.environ.get("COLLECTIVE_SCROLL_DATA", "/data"))
DB_PATH = DATA_DIR / "scroll_literario.sqlite3"
PORT = int(os.environ.get("PORT", "8080"))

MAX_TEXT_LENGTH = 2400
MAX_AUTHOR_LENGTH = 48
MAX_BODY_BYTES = 32 * 1024

db_lock = threading.Lock()
clients_lock = threading.Lock()
event_clients: set[queue.Queue[dict]] = set()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with connect_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS fragments (
                id TEXT PRIMARY KEY,
                author TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                revision INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        conn.execute("INSERT OR IGNORE INTO meta (key, value) VALUES ('revision', '0')")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fragments_live ON fragments (deleted_at, created_at)")


def next_revision(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT value FROM meta WHERE key = 'revision'").fetchone()
    revision = int(row["value"]) + 1
    conn.execute("UPDATE meta SET value = ? WHERE key = 'revision'", (str(revision),))
    return revision


def current_revision(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT value FROM meta WHERE key = 'revision'").fetchone()
    return int(row["value"])


def normalize_text(value: object, max_length: int) -> str:
    if not isinstance(value, str):
        return ""
    text = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    return text[:max_length]


def normalize_author(value: object) -> str:
    author = normalize_text(value, MAX_AUTHOR_LENGTH)
    return author or "anonimo"


def fragment_from_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "author": row["author"],
        "text": row["text"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "revision": row["revision"],
    }


def get_fragments() -> dict:
    with db_lock:
        with connect_db() as conn:
            rows = conn.execute(
                """
                SELECT id, author, text, created_at, updated_at, revision
                FROM fragments
                WHERE deleted_at IS NULL
                ORDER BY created_at ASC, revision ASC
                LIMIT 1200
                """
            ).fetchall()
            return {
                "revision": current_revision(conn),
                "fragments": [fragment_from_row(row) for row in rows],
            }


def get_stats() -> dict:
    with db_lock:
        with connect_db() as conn:
            live = conn.execute("SELECT COUNT(*) AS value FROM fragments WHERE deleted_at IS NULL").fetchone()["value"]
            deleted = conn.execute("SELECT COUNT(*) AS value FROM fragments WHERE deleted_at IS NOT NULL").fetchone()["value"]
            return {
                "revision": current_revision(conn),
                "liveFragments": live,
                "deletedFragments": deleted,
            }


def create_fragment(payload: dict) -> tuple[HTTPStatus, dict]:
    text = normalize_text(payload.get("text"), MAX_TEXT_LENGTH)
    if not text:
        return HTTPStatus.BAD_REQUEST, {"error": "El fragmento no puede estar vacio."}

    author = normalize_author(payload.get("author"))
    now = utc_now()
    fragment_id = uuid.uuid4().hex

    with db_lock:
        with connect_db() as conn:
            revision = next_revision(conn)
            conn.execute(
                """
                INSERT INTO fragments (id, author, text, created_at, updated_at, deleted_at, revision)
                VALUES (?, ?, ?, ?, ?, NULL, ?)
                """,
                (fragment_id, author, text, now, now, revision),
            )
            row = conn.execute(
                """
                SELECT id, author, text, created_at, updated_at, revision
                FROM fragments
                WHERE id = ?
                """,
                (fragment_id,),
            ).fetchone()

    fragment = fragment_from_row(row)
    broadcast({"action": "created", "revision": fragment["revision"], "fragment": fragment})
    return HTTPStatus.CREATED, {"fragment": fragment, "revision": fragment["revision"]}


def update_fragment(fragment_id: str, payload: dict) -> tuple[HTTPStatus, dict]:
    text = normalize_text(payload.get("text"), MAX_TEXT_LENGTH)
    if not text:
        return HTTPStatus.BAD_REQUEST, {"error": "El fragmento no puede estar vacio."}

    now = utc_now()

    with db_lock:
        with connect_db() as conn:
            existing = conn.execute(
                "SELECT id FROM fragments WHERE id = ? AND deleted_at IS NULL",
                (fragment_id,),
            ).fetchone()
            if existing is None:
                return HTTPStatus.NOT_FOUND, {"error": "Fragmento no encontrado."}

            revision = next_revision(conn)
            conn.execute(
                """
                UPDATE fragments
                SET text = ?, updated_at = ?, revision = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (text, now, revision, fragment_id),
            )
            row = conn.execute(
                """
                SELECT id, author, text, created_at, updated_at, revision
                FROM fragments
                WHERE id = ?
                """,
                (fragment_id,),
            ).fetchone()

    fragment = fragment_from_row(row)
    broadcast({"action": "updated", "revision": fragment["revision"], "fragment": fragment})
    return HTTPStatus.OK, {"fragment": fragment, "revision": fragment["revision"]}


def delete_fragment(fragment_id: str) -> tuple[HTTPStatus, dict]:
    now = utc_now()

    with db_lock:
        with connect_db() as conn:
            existing = conn.execute(
                "SELECT id FROM fragments WHERE id = ? AND deleted_at IS NULL",
                (fragment_id,),
            ).fetchone()
            if existing is None:
                return HTTPStatus.NOT_FOUND, {"error": "Fragmento no encontrado."}

            revision = next_revision(conn)
            conn.execute(
                """
                UPDATE fragments
                SET deleted_at = ?, updated_at = ?, revision = ?
                WHERE id = ? AND deleted_at IS NULL
                """,
                (now, now, revision, fragment_id),
            )

    broadcast({"action": "deleted", "revision": revision, "id": fragment_id})
    return HTTPStatus.OK, {"id": fragment_id, "revision": revision}


def broadcast(event: dict) -> None:
    with clients_lock:
        clients = list(event_clients)

    for client in clients:
        try:
            if client.full():
                client.get_nowait()
            client.put_nowait(event)
        except queue.Empty:
            continue


class CollectiveScrollHandler(BaseHTTPRequestHandler):
    server_version = "CollectiveScroll/1.0"
    protocol_version = "HTTP/1.1"

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        path = self.request_path()
        if path == "/healthz":
            self.send_json({"ok": True, **get_stats()})
            return
        if path == "/api/fragments":
            self.send_json(get_fragments())
            return
        if path == "/api/stats":
            self.send_json(get_stats())
            return
        if path == "/api/events":
            self.stream_events()
            return

        self.serve_static(path)

    def do_POST(self) -> None:
        if self.request_path() != "/api/fragments":
            self.send_json({"error": "Ruta no encontrada."}, HTTPStatus.NOT_FOUND)
            return
        payload = self.read_json_body()
        if payload is None:
            return
        status, body = create_fragment(payload)
        self.send_json(body, status)

    def do_PATCH(self) -> None:
        fragment_id = self.fragment_id_from_path()
        if fragment_id is None:
            self.send_json({"error": "Ruta no encontrada."}, HTTPStatus.NOT_FOUND)
            return
        payload = self.read_json_body()
        if payload is None:
            return
        status, body = update_fragment(fragment_id, payload)
        self.send_json(body, status)

    def do_DELETE(self) -> None:
        fragment_id = self.fragment_id_from_path()
        if fragment_id is None:
            self.send_json({"error": "Ruta no encontrada."}, HTTPStatus.NOT_FOUND)
            return
        status, body = delete_fragment(fragment_id)
        self.send_json(body, status)

    def request_path(self) -> str:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if len(path) > 1 and path.endswith("/"):
            return path.rstrip("/")
        return path or "/"

    def fragment_id_from_path(self) -> str | None:
        path = self.request_path()
        prefix = "/api/fragments/"
        if not path.startswith(prefix):
            return None
        fragment_id = path[len(prefix):].strip()
        if not fragment_id or "/" in fragment_id:
            return None
        return fragment_id

    def read_json_body(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            self.send_json({"error": "Content-Length invalido."}, HTTPStatus.BAD_REQUEST)
            return None

        if length <= 0:
            self.send_json({"error": "Cuerpo vacio."}, HTTPStatus.BAD_REQUEST)
            return None
        if length > MAX_BODY_BYTES:
            self.send_json({"error": "Cuerpo demasiado grande."}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            return None

        raw_body = self.rfile.read(length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json({"error": "JSON invalido."}, HTTPStatus.BAD_REQUEST)
            return None

        if not isinstance(payload, dict):
            self.send_json({"error": "JSON debe ser un objeto."}, HTTPStatus.BAD_REQUEST)
            return None
        return payload

    def send_json(self, body: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def serve_static(self, path: str) -> None:
        if path == "/":
            relative = "index.html"
        else:
            relative = path.lstrip("/")

        target = (PUBLIC_DIR / relative).resolve()
        public_root = PUBLIC_DIR.resolve()
        if not str(target).startswith(str(public_root)) or not target.is_file():
            target = PUBLIC_DIR / "index.html"

        content = target.read_bytes()
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store" if target.name == "index.html" else "public, max-age=300")
        self.end_headers()
        self.wfile.write(content)

    def stream_events(self) -> None:
        event_queue: queue.Queue[dict] = queue.Queue(maxsize=10)
        with clients_lock:
            event_clients.add(event_queue)

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        try:
            self.write_sse({"action": "hello", **get_stats()})
            while True:
                try:
                    event = event_queue.get(timeout=25)
                    self.write_sse(event)
                except queue.Empty:
                    self.wfile.write(b": heartbeat\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass
        finally:
            with clients_lock:
                event_clients.discard(event_queue)

    def write_sse(self, event: dict) -> None:
        payload = json.dumps(event, ensure_ascii=False)
        self.wfile.write(f"data: {payload}\n\n".encode("utf-8"))
        self.wfile.flush()

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}", flush=True)


def main() -> None:
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), CollectiveScrollHandler)
    print(f"Collective scroll listening on :{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
