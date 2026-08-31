import os
import heapq
import shutil
import sqlite3
import socket
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import psutil
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
import uvicorn


HOST_PROC = os.getenv("HOST_PROC", "/host/proc")
HOST_ROOT = os.getenv("HOST_ROOT", "/host/root")
PORT = int(os.getenv("PORT", "8091"))
DB_PATH = os.getenv("DB_PATH", "/data/server_metrics.sqlite")
SAMPLE_INTERVAL_SECONDS = int(os.getenv("SAMPLE_INTERVAL_SECONDS", "30"))
PROCESS_INTERVAL_SECONDS = max(int(os.getenv("PROCESS_INTERVAL_SECONDS", "60")), 30)
SERVER_METRICS_TOKEN = os.getenv("SERVER_METRICS_TOKEN", "")
COLOMBIA_TZ = timezone(timedelta(hours=-5))

if os.path.exists(HOST_PROC):
    psutil.PROCFS_PATH = HOST_PROC

@asynccontextmanager
async def lifespan(application):
    start_history_thread()
    try:
        yield
    finally:
        sampler_stop.set()


app = FastAPI(title="Scrolling Life Server Metrics", version="1.1.0", lifespan=lifespan)
last_network_snapshot = None
history_thread_started = False
history_lock = threading.Lock()
snapshot_lock = threading.Lock()
sampler_stop = threading.Event()
latest_metrics = None
latest_metrics_at = None
latest_processes = []
latest_processes_at = None
latest_processes_generated_at = None


def colombia_now():
    return datetime.now(COLOMBIA_TZ).strftime("%Y-%m-%d %H:%M:%S")


def require_token(authorization=None, x_metrics_token=None):
    candidate = x_metrics_token or ""
    if authorization and authorization.lower().startswith("bearer "):
        candidate = authorization[7:].strip()
    if not SERVER_METRICS_TOKEN or candidate != SERVER_METRICS_TOKEN:
        raise HTTPException(status_code=401, detail="No autorizado.")


def db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with db_connection() as connection:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS metric_samples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sampled_at TEXT NOT NULL,
                cpu_percent REAL NOT NULL,
                memory_percent REAL NOT NULL,
                disk_percent REAL NOT NULL,
                load_1m REAL NOT NULL,
                rx_bytes INTEGER NOT NULL,
                tx_bytes INTEGER NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_metric_samples_sampled_at ON metric_samples(sampled_at)"
        )


def read_proc_numbers(path, count):
    try:
        with open(os.path.join(HOST_PROC, path), "r", encoding="utf-8") as handle:
            values = handle.read().strip().split()
    except OSError:
        values = []
    result = []
    for index in range(count):
        try:
            result.append(float(values[index]))
        except (IndexError, ValueError):
            result.append(0.0)
    return result


def uptime_seconds():
    return read_proc_numbers("uptime", 1)[0]


def load_average():
    one_min, five_min, fifteen_min = read_proc_numbers("loadavg", 3)
    return {
        "one_min": one_min,
        "five_min": five_min,
        "fifteen_min": fifteen_min,
    }


def disk_usage():
    target = HOST_ROOT if os.path.exists(HOST_ROOT) else "/"
    usage = shutil.disk_usage(target)
    percent = (usage.used / usage.total * 100) if usage.total else 0
    return {
        "root": {
            "mount": "/",
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
            "percent": round(percent, 2),
        }
    }


def read_network_interfaces():
    interfaces = {}
    path = os.path.join(HOST_PROC, "net", "dev")
    try:
        with open(path, "r", encoding="utf-8") as handle:
            lines = handle.readlines()[2:]
    except OSError:
        return interfaces

    for line in lines:
        if ":" not in line:
            continue
        name, raw_values = line.split(":", 1)
        iface = name.strip()
        values = raw_values.split()
        if len(values) < 16:
            continue
        interfaces[iface] = {
            "rx_bytes": int(values[0]),
            "rx_packets": int(values[1]),
            "rx_errors": int(values[2]),
            "tx_bytes": int(values[8]),
            "tx_packets": int(values[9]),
            "tx_errors": int(values[10]),
        }
    return interfaces


def network_totals():
    rx_bytes = 0
    tx_bytes = 0
    for iface, values in read_network_interfaces().items():
        if iface == "lo":
            continue
        rx_bytes += int(values.get("rx_bytes", 0))
        tx_bytes += int(values.get("tx_bytes", 0))
    return rx_bytes, tx_bytes


def network_with_rates():
    global last_network_snapshot

    now = time.time()
    interfaces = read_network_interfaces()
    previous = last_network_snapshot
    last_network_snapshot = (now, interfaces)

    if not previous:
        for values in interfaces.values():
            values["rx_bytes_per_second"] = None
            values["tx_bytes_per_second"] = None
        return {"interfaces": interfaces}

    previous_time, previous_interfaces = previous
    elapsed = max(now - previous_time, 0.001)
    for iface, values in interfaces.items():
        old = previous_interfaces.get(iface, {})
        values["rx_bytes_per_second"] = round(max(values["rx_bytes"] - old.get("rx_bytes", 0), 0) / elapsed, 2)
        values["tx_bytes_per_second"] = round(max(values["tx_bytes"] - old.get("tx_bytes", 0), 0) / elapsed, 2)

    return {"interfaces": interfaces}


def resource_sample(snapshot):
    interfaces = snapshot["network"]["interfaces"]
    return {
        "sampled_at": snapshot["generated_at"],
        "cpu_percent": snapshot["cpu"]["percent"],
        "memory_percent": snapshot["memory"]["percent"],
        "disk_percent": snapshot["disk"]["root"]["percent"],
        "load_1m": snapshot["load"]["one_min"],
        "rx_bytes": sum(values["rx_bytes"] for name, values in interfaces.items() if name != "lo"),
        "tx_bytes": sum(values["tx_bytes"] for name, values in interfaces.items() if name != "lo"),
    }


def save_sample(sample):
    retention_cutoff = (datetime.now(COLOMBIA_TZ) - timedelta(days=14)).strftime("%Y-%m-%d %H:%M:%S")
    with history_lock:
        with db_connection() as connection:
            connection.execute(
                """
                INSERT INTO metric_samples
                    (sampled_at, cpu_percent, memory_percent, disk_percent, load_1m, rx_bytes, tx_bytes)
                VALUES
                    (:sampled_at, :cpu_percent, :memory_percent, :disk_percent, :load_1m, :rx_bytes, :tx_bytes)
                """,
                sample,
            )
            connection.execute(
                "DELETE FROM metric_samples WHERE sampled_at < ?",
                (retention_cutoff,),
            )


def sample_loop():
    global latest_metrics, latest_metrics_at

    while not sampler_stop.is_set():
        started_at = time.monotonic()
        try:
            snapshot = collect_metrics()
            with snapshot_lock:
                latest_metrics = snapshot
                latest_metrics_at = time.monotonic()
            # Publish first: disk/database delays must not block the live API.
            init_db()
            save_sample(resource_sample(snapshot))
        except Exception as exc:
            print(f"metric sample failed: {exc}", flush=True)
        elapsed = time.monotonic() - started_at
        sampler_stop.wait(max(max(SAMPLE_INTERVAL_SECONDS, 5) - elapsed, 1))


def process_loop():
    global latest_processes, latest_processes_at, latest_processes_generated_at

    while not sampler_stop.is_set():
        started_at = time.monotonic()
        try:
            processes = top_processes()
            with snapshot_lock:
                latest_processes = processes
                latest_processes_at = time.monotonic()
                latest_processes_generated_at = colombia_now()
        except Exception as exc:
            print(f"process sample failed: {exc}", flush=True)
        sampler_stop.wait(max(PROCESS_INTERVAL_SECONDS - (time.monotonic() - started_at), 5))


def start_history_thread():
    global history_thread_started
    if history_thread_started:
        return
    history_thread_started = True
    sampler_stop.clear()
    threading.Thread(target=sample_loop, name="metric-sampler", daemon=True).start()
    threading.Thread(target=process_loop, name="process-sampler", daemon=True).start()


def metric_history(hours=24):
    bounded_hours = min(max(int(hours or 24), 1), 336)
    cutoff = (datetime.now(COLOMBIA_TZ) - timedelta(hours=bounded_hours)).strftime("%Y-%m-%d %H:%M:%S")
    init_db()
    with history_lock:
        with db_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    sampled_at,
                    cpu_percent,
                    memory_percent,
                    disk_percent,
                    load_1m,
                    rx_bytes,
                    tx_bytes
                FROM metric_samples
                WHERE sampled_at >= ?
                ORDER BY sampled_at ASC
                """,
                (cutoff,),
            ).fetchall()
    return {
        "hours": bounded_hours,
        "sample_interval_seconds": SAMPLE_INTERVAL_SECONDS,
        "rows": [dict(row) for row in rows],
    }


def top_processes(limit=20):
    candidates = []
    # Read only RSS for the full host. Resolve names/users/commands for the top
    # few processes, not thousands of host PIDs (including zero-RSS zombies).
    for process in psutil.process_iter(["pid", "memory_info"], ad_value=None):
        memory_info = process.info.get("memory_info")
        if memory_info is not None and memory_info.rss > 0:
            candidates.append((memory_info.rss, process))

    processes = []
    for rss, process in heapq.nlargest(limit, candidates, key=lambda item: item[0]):
        try:
            details = process.as_dict(attrs=["pid", "name", "username", "status", "cmdline"], ad_value=None)
            command = " ".join(details.get("cmdline") or [])[:180]
            processes.append(
                {
                    "pid": details.get("pid"),
                    "nombre": details.get("name") or "",
                    "usuario": details.get("username") or "",
                    "estado": details.get("status") or "",
                    "memoria_mb": round(rss / 1024 / 1024, 1),
                    "comando": command,
                }
            )
        except (psutil.AccessDenied, psutil.NoSuchProcess, OSError):
            continue

    return processes


def collect_metrics():
    cpu_percent = psutil.cpu_percent(interval=0.25)
    per_cpu_percent = psutil.cpu_percent(interval=None, percpu=True)
    memory = psutil.virtual_memory()
    swap = psutil.swap_memory()

    return {
        "generated_at": colombia_now(),
        "timezone": "America/Bogota",
        "host": {
            "hostname": socket.gethostname(),
            "cpu_count": psutil.cpu_count(logical=True),
        },
        "uptime_seconds": int(uptime_seconds()),
        "load": load_average(),
        "cpu": {
            "percent": round(cpu_percent, 2),
            "per_cpu_percent": [round(value, 2) for value in per_cpu_percent],
        },
        "memory": {
            "total": memory.total,
            "available": memory.available,
            "used": memory.used,
            "percent": round(memory.percent, 2),
        },
        "swap": {
            "total": swap.total,
            "used": swap.used,
            "free": swap.free,
            "percent": round(swap.percent, 2),
        },
        "disk": disk_usage(),
        "network": network_with_rates(),
    }


def cached_metrics():
    with snapshot_lock:
        if latest_metrics is None:
            raise HTTPException(status_code=503, detail="Preparando la primera muestra de servidor.")
        payload = dict(latest_metrics)
        sampled_at = latest_metrics_at
        payload["top_processes"] = list(latest_processes)
        processes_at = latest_processes_at
        payload["processes_generated_at"] = latest_processes_generated_at

    age = max(time.monotonic() - sampled_at, 0)
    payload["sample_interval_seconds"] = max(SAMPLE_INTERVAL_SECONDS, 5)
    payload["snapshot_age_seconds"] = round(age, 1)
    payload["stale"] = age > max(SAMPLE_INTERVAL_SECONDS * 2, 60)
    payload["processes_age_seconds"] = (
        round(max(time.monotonic() - processes_at, 0), 1) if processes_at is not None else None
    )
    return payload


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/metrics")
async def metrics(authorization: str | None = Header(default=None), x_metrics_token: str | None = Header(default=None)):
    require_token(authorization=authorization, x_metrics_token=x_metrics_token)
    return JSONResponse(cached_metrics())


@app.get("/history")
def history(
    hours: int = 24,
    authorization: str | None = Header(default=None),
    x_metrics_token: str | None = Header(default=None),
):
    require_token(authorization=authorization, x_metrics_token=x_metrics_token)
    return JSONResponse(metric_history(hours))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
