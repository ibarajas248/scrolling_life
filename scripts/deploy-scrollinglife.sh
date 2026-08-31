#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${SCROLLINGLIFE_PROJECT_DIR:-$(pwd)}"
ENV_FILE="${SCROLLINGLIFE_ENV_FILE:-/opt/scrollinglife/.env}"
COMPOSE_FILE="${SCROLLINGLIFE_COMPOSE_FILE:-${PROJECT_DIR}/docker-compose.yml}"

cd "$PROJECT_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "No existe el compose: $COMPOSE_FILE" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "No existe el archivo de entorno del servidor: $ENV_FILE" >&2
  exit 1
fi

export SCROLLING_LIFE_WEB_CONTEXT="${SCROLLING_LIFE_WEB_CONTEXT:-$PROJECT_DIR}"
export GRAPH_BACKEND_CONTEXT="${GRAPH_BACKEND_CONTEXT:-$PROJECT_DIR/graph-backend}"
export TRAFFIC_TRACKER_CONTEXT="${TRAFFIC_TRACKER_CONTEXT:-$PROJECT_DIR/traffic-tracker}"
export TRAFFIC_DASHBOARD_CONTEXT="${TRAFFIC_DASHBOARD_CONTEXT:-$PROJECT_DIR/traffic-dashboard}"
export SERVER_METRICS_CONTEXT="${SERVER_METRICS_CONTEXT:-$PROJECT_DIR/server-metrics}"
export ESCRITURA_COLECTIVA_CONTEXT="${ESCRITURA_COLECTIVA_CONTEXT:-$PROJECT_DIR/escritura-colectiva}"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build \
  web \
  graph-backend \
  traffic-tracker \
  traffic-dashboard \
  server-metrics \
  escritura-colectiva

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans \
  web \
  graph-backend \
  traffic-tracker \
  traffic-dashboard \
  server-metrics \
  escritura-colectiva

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
