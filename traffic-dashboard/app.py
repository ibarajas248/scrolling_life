import os
from datetime import datetime

import pandas as pd
import requests
import streamlit as st


API_BASE_URL = os.getenv("API_BASE_URL", "http://traffic_tracker:8090").rstrip("/")
API_ADMIN_TOKEN = os.getenv("API_ADMIN_TOKEN", "")
SERVER_METRICS_URL = os.getenv("SERVER_METRICS_URL", "http://server_metrics:8091").rstrip("/")
SERVER_METRICS_TOKEN = os.getenv("SERVER_METRICS_TOKEN", "")
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "12"))


st.set_page_config(
    page_title="Indicadores de trafico",
    layout="wide",
)


st.markdown(
    """
    <style>
      :root { color-scheme: dark; }
      .main .block-container { padding-top: 1.25rem; padding-bottom: 2rem; max-width: 1480px; }
      [data-testid="stMetric"] {
        background: #121821;
        border: 1px solid #263241;
        border-radius: 8px;
        padding: 14px 16px;
      }
      [data-testid="stMetricLabel"] { color: #aab7c7; }
      [data-testid="stMetricValue"] { color: #f6f8fb; }
      div[data-testid="stDataFrame"] { border: 1px solid #263241; border-radius: 8px; overflow: hidden; }
      .stAlert { border-radius: 8px; }
    </style>
    """,
    unsafe_allow_html=True,
)


def as_int(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def fetch_dashboard(days):
    if not API_ADMIN_TOKEN:
        raise RuntimeError("Falta API_ADMIN_TOKEN en el entorno del dashboard.")

    response = requests.get(
        f"{API_BASE_URL}/admin/dashboard.json",
        headers={"X-Admin-Token": API_ADMIN_TOKEN},
        params={"days": days},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def fetch_server_metrics():
    if not SERVER_METRICS_TOKEN:
        raise RuntimeError("Falta SERVER_METRICS_TOKEN en el entorno del dashboard.")

    response = requests.get(
        f"{SERVER_METRICS_URL}/metrics",
        headers={"X-Metrics-Token": SERVER_METRICS_TOKEN},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def fetch_server_history(hours):
    if not SERVER_METRICS_TOKEN:
        raise RuntimeError("Falta SERVER_METRICS_TOKEN en el entorno del dashboard.")

    response = requests.get(
        f"{SERVER_METRICS_URL}/history",
        headers={"X-Metrics-Token": SERVER_METRICS_TOKEN},
        params={"hours": hours},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def dataframe(rows):
    frame = pd.DataFrame(rows or [])
    return frame


def day_chart(rows, metric, label):
    frame = dataframe(rows)
    if frame.empty or metric not in frame.columns:
        st.info("Sin datos suficientes todavia.")
        return

    frame["day"] = pd.to_datetime(frame["day"]).dt.date
    frame[metric] = pd.to_numeric(frame[metric], errors="coerce").fillna(0)
    st.line_chart(frame.set_index("day")[[metric]], height=280)


def metric_row(items):
    columns = st.columns(len(items))
    for column, (label, value) in zip(columns, items):
        column.metric(label, f"{as_int(value):,}".replace(",", "."))


def metric_text_row(items):
    columns = st.columns(len(items))
    for column, (label, value) in zip(columns, items):
        column.metric(label, value)


def format_bytes(value):
    number = float(value or 0)
    units = ["B", "KB", "MB", "GB", "TB"]
    index = 0
    while number >= 1024 and index < len(units) - 1:
        number /= 1024
        index += 1
    return f"{number:.1f} {units[index]}"


def format_rate(value):
    if value is None:
        return "calculando"
    return f"{format_bytes(value)}/s"


def format_percent(value):
    try:
        return f"{float(value):.1f}%"
    except (TypeError, ValueError):
        return "0.0%"


def format_duration(seconds):
    total = as_int(seconds)
    days, remainder = divmod(total, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)
    if days:
        return f"{days}d {hours}h"
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def history_bucket(hours):
    if hours <= 3:
        return "1min", "1 minuto"
    if hours <= 24:
        return "5min", "5 minutos"
    if hours <= 72:
        return "15min", "15 minutos"
    return "1h", "1 hora"


def prepare_smoothed_history(history_frame, hours):
    bucket, bucket_label = history_bucket(hours)
    frame = history_frame.copy()
    frame["sampled_at"] = pd.to_datetime(frame["sampled_at"])
    for column in ["cpu_percent", "memory_percent", "disk_percent", "load_1m"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    indexed = frame.set_index("sampled_at").sort_index()
    grouped = indexed.resample(bucket).agg(
        {
            "cpu_percent": ["mean", "max"],
            "memory_percent": "mean",
            "disk_percent": "mean",
            "load_1m": "mean",
        }
    )
    grouped.columns = [
        "CPU promedio %",
        "CPU pico %",
        "Memoria promedio %",
        "Disco promedio %",
        "Carga promedio 1m",
    ]
    grouped = grouped.dropna(how="all")

    if grouped.empty:
        return grouped, bucket_label

    # Small rolling window over aggregated points to calm one-sample spikes without hiding trends.
    smoothed = grouped.copy()
    for column in ["CPU promedio %", "Memoria promedio %", "Disco promedio %", "Carga promedio 1m"]:
        smoothed[column] = grouped[column].rolling(window=3, min_periods=1).mean()
    return smoothed.round(2), bucket_label


def render_server_dashboard():
    try:
        server = fetch_server_metrics()
    except requests.HTTPError as exc:
        st.error(f"El API de servidor respondio con HTTP {exc.response.status_code}.")
        return
    except requests.RequestException as exc:
        st.error(f"No pude conectar con el API interno de servidor: {exc}")
        return
    except RuntimeError as exc:
        st.error(str(exc))
        return

    cpu = server.get("cpu", {})
    memory = server.get("memory", {})
    swap = server.get("swap", {})
    load = server.get("load", {})
    disk_root = server.get("disk", {}).get("root", {})

    st.subheader("Servidor VPS")
    if server.get("stale"):
        st.warning("La muestra del servidor está demorada. Se muestran los últimos datos disponibles.")
    st.caption(
        f"Muestra: {server.get('generated_at', 'sin fecha')} | "
        f"Actualización en segundo plano cada {server.get('sample_interval_seconds', 30)} segundos"
    )
    metric_text_row(
        [
            ("CPU", format_percent(cpu.get("percent"))),
            ("Memoria", format_percent(memory.get("percent"))),
            ("Disco", format_percent(disk_root.get("percent"))),
            ("Carga 1m", f"{float(load.get('one_min') or 0):.2f}"),
            ("Uptime", format_duration(server.get("uptime_seconds"))),
        ]
    )

    st.markdown("#### Serie temporal")
    history_hours = st.slider("Horas de historico", min_value=1, max_value=168, value=24)
    try:
        history = fetch_server_history(history_hours)
        history_frame = dataframe(history.get("rows"))
    except requests.HTTPError as exc:
        st.error(f"El historico respondio con HTTP {exc.response.status_code}.")
        history_frame = pd.DataFrame()
    except requests.RequestException as exc:
        st.error(f"No pude cargar el historico: {exc}")
        history_frame = pd.DataFrame()

    if history_frame.empty:
        st.info("El historico se esta construyendo. Refresca en unos minutos para ver la curva.")
    else:
        smoothed_history, bucket_label = prepare_smoothed_history(history_frame, history_hours)
        chart_frame = smoothed_history[
            ["CPU promedio %", "Memoria promedio %", "Disco promedio %"]
        ]
        st.line_chart(chart_frame, height=320)
        st.caption(
            f"{len(history_frame)} muestras crudas | agrupado cada {bucket_label} | "
            f"muestra base: {history.get('sample_interval_seconds', 30)} segundos"
        )
        with st.expander("Ver picos y tabla tecnica"):
            st.line_chart(smoothed_history[["CPU pico %", "Carga promedio 1m"]], height=240)
            st.dataframe(smoothed_history.tail(60).reset_index(), use_container_width=True, hide_index=True)

    left, right = st.columns(2)
    with left:
        st.markdown("#### CPU por nucleo")
        per_cpu = cpu.get("per_cpu_percent") or []
        if per_cpu:
            cpu_frame = pd.DataFrame(
                [{"nucleo": f"CPU {index + 1}", "uso": value} for index, value in enumerate(per_cpu)]
            )
            st.bar_chart(cpu_frame.set_index("nucleo"), height=260)
        else:
            st.info("Sin datos de CPU.")

    with right:
        st.markdown("#### Memoria y swap")
        memory_rows = [
            {
                "recurso": "Memoria",
                "total": format_bytes(memory.get("total")),
                "usado": format_bytes(memory.get("used")),
                "disponible": format_bytes(memory.get("available")),
                "uso": format_percent(memory.get("percent")),
            },
            {
                "recurso": "Swap",
                "total": format_bytes(swap.get("total")),
                "usado": format_bytes(swap.get("used")),
                "disponible": format_bytes(max((swap.get("total") or 0) - (swap.get("used") or 0), 0)),
                "uso": format_percent(swap.get("percent")),
            },
        ]
        st.dataframe(pd.DataFrame(memory_rows), use_container_width=True, hide_index=True)

    st.markdown("#### Disco principal")
    disk_rows = [
        {
            "punto": disk_root.get("mount", "/"),
            "total": format_bytes(disk_root.get("total")),
            "usado": format_bytes(disk_root.get("used")),
            "libre": format_bytes(disk_root.get("free")),
            "uso": format_percent(disk_root.get("percent")),
        }
    ]
    st.dataframe(pd.DataFrame(disk_rows), use_container_width=True, hide_index=True)

    st.markdown("#### Trafico de red")
    network_rows = []
    for iface, values in (server.get("network", {}).get("interfaces") or {}).items():
        network_rows.append(
            {
                "interfaz": iface,
                "rx_total": format_bytes(values.get("rx_bytes")),
                "tx_total": format_bytes(values.get("tx_bytes")),
                "rx_s": format_rate(values.get("rx_bytes_per_second")),
                "tx_s": format_rate(values.get("tx_bytes_per_second")),
                "rx_paquetes": as_int(values.get("rx_packets")),
                "tx_paquetes": as_int(values.get("tx_packets")),
                "errores": as_int(values.get("rx_errors")) + as_int(values.get("tx_errors")),
            }
        )
    st.dataframe(pd.DataFrame(network_rows), use_container_width=True, hide_index=True)

    st.markdown("#### Procesos con mas memoria")
    if server.get("processes_generated_at"):
        st.caption(f"Procesos tomados: {server['processes_generated_at']}")
    else:
        st.caption("Recopilando procesos en segundo plano; las demás métricas ya están disponibles.")
    process_rows = dataframe(server.get("top_processes"))
    st.dataframe(process_rows, use_container_width=True, hide_index=True)


st.title("Indicadores de trafico")

with st.sidebar:
    st.header("Periodo")
    days = st.slider("Dias", min_value=1, max_value=90, value=14)
    refresh = st.button("Actualizar", use_container_width=True)

try:
    data = fetch_dashboard(days)
except requests.HTTPError as exc:
    st.error(f"El API respondio con error HTTP {exc.response.status_code}.")
    st.stop()
except requests.RequestException as exc:
    st.error(f"No pude conectar con el API interno: {exc}")
    st.stop()
except RuntimeError as exc:
    st.error(str(exc))
    st.stop()

traffic = data.get("traffic", {})
lienzo = data.get("lienzo", {})
traffic_totals = traffic.get("totals", {})
traffic_last24 = traffic.get("last24h", {})
lienzo_totals = lienzo.get("totals", {})
lienzo_last24 = lienzo.get("last24h", {})

generated_at = data.get("generatedAt") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
st.caption(f"Actualizado: {generated_at} | Zona horaria: {data.get('timezone', 'America/Bogota')}")

tab_summary, tab_web, tab_lienzo, tab_server, tab_tables = st.tabs(
    ["Resumen", "Scrolling Life", "Lienzo", "Servidor", "Tablas"]
)

with tab_summary:
    st.subheader("Ultimas 24 horas")
    metric_row(
        [
            ("Visitantes web", traffic_last24.get("visitors")),
            ("Sesiones web", traffic_last24.get("sessions")),
            ("Pageviews", traffic_last24.get("pageviews")),
            ("Sesiones lienzo", lienzo_last24.get("sessions")),
            ("Usuarios autenticados", lienzo_last24.get("unique_authenticated_users")),
        ]
    )

    left, right = st.columns(2)
    with left:
        st.markdown("#### Trafico web por dia")
        day_chart(traffic.get("byDay"), "pageviews", "Pageviews")
    with right:
        st.markdown("#### Lienzo por dia")
        day_chart(lienzo.get("byDay"), "sessions", "Sesiones")

with tab_web:
    st.subheader("Scrolling Life Traffic")
    metric_row(
        [
            ("Visitantes", traffic_totals.get("visitors")),
            ("Sesiones", traffic_totals.get("sessions")),
            ("Eventos", traffic_totals.get("events")),
            ("Pageviews", traffic_totals.get("pageviews")),
            ("Paginas indexadas", traffic_totals.get("tracked_pages")),
        ]
    )

    left, right = st.columns(2)
    with left:
        st.markdown("#### Paises")
        countries = dataframe(traffic.get("countries"))
        st.dataframe(countries, use_container_width=True, hide_index=True)
    with right:
        st.markdown("#### Referidos")
        referrers = dataframe(traffic.get("referrers"))
        st.dataframe(referrers, use_container_width=True, hide_index=True)

    st.markdown("#### Paginas con mas visitas")
    top_pages = dataframe(traffic.get("topPages"))
    st.dataframe(top_pages, use_container_width=True, hide_index=True)

with tab_lienzo:
    st.subheader("Lienzo Analytics")
    metric_row(
        [
            ("Sesiones", lienzo_totals.get("sessions")),
            ("Usuarios autenticados", lienzo_totals.get("unique_authenticated_users")),
            ("Sesiones activas", lienzo_totals.get("active_sessions")),
            ("Trazos", lienzo_totals.get("strokes")),
            ("Eventos dibujo", lienzo_totals.get("draw_events")),
        ]
    )

    left, right = st.columns(2)
    with left:
        st.markdown("#### Uso por lienzo")
        by_canvas = dataframe(lienzo.get("byCanvas"))
        st.dataframe(by_canvas, use_container_width=True, hide_index=True)
    with right:
        st.markdown("#### Tipo de usuario")
        session_types = dataframe(lienzo.get("sessionTypes"))
        st.dataframe(session_types, use_container_width=True, hide_index=True)

    st.markdown("#### Sesiones recientes sin datos sensibles")
    recent_sessions = dataframe(lienzo.get("recentSessions"))
    st.dataframe(recent_sessions, use_container_width=True, hide_index=True)

with tab_server:
    render_server_dashboard()

with tab_tables:
    st.subheader("Datos consolidados")
    st.markdown("#### Trafico web diario")
    st.dataframe(dataframe(traffic.get("byDay")), use_container_width=True, hide_index=True)

    st.markdown("#### Lienzo diario")
    st.dataframe(dataframe(lienzo.get("byDay")), use_container_width=True, hide_index=True)

    st.markdown("#### Eventos por tipo")
    st.dataframe(dataframe(traffic.get("eventsByType")), use_container_width=True, hide_index=True)

if refresh:
    st.rerun()
