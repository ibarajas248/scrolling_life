#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${SCROLLINGLIFE_REPO_URL:-https://github.com/ibarajas248/scrolling_life.git}"
BRANCH="${SCROLLINGLIFE_BRANCH:-master}"
BASE_DIR="${SCROLLINGLIFE_BASE_DIR:-/opt/scrollinglife}"
REPO_DIR="$BASE_DIR/repo"
RELEASES_DIR="$BASE_DIR/releases"
CURRENT_LINK="$BASE_DIR/current"
ENV_FILE="$BASE_DIR/.env"
STATE_FILE="$BASE_DIR/.last_deployed_sha"
LOCK_FILE="$BASE_DIR/.autodeploy.lock"
MAX_RELEASES="${SCROLLINGLIFE_MAX_RELEASES:-5}"

mkdir -p "$BASE_DIR" "$RELEASES_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Otro despliegue esta en curso."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "No existe $ENV_FILE" >&2
  exit 1
fi

remote_sha="$(git ls-remote "$REPO_URL" "refs/heads/$BRANCH" | awk '{print $1}')"
if [ -z "$remote_sha" ]; then
  echo "No se pudo leer $BRANCH desde $REPO_URL" >&2
  exit 1
fi

current_sha="$(cat "$STATE_FILE" 2>/dev/null || true)"
if [ "$remote_sha" = "$current_sha" ]; then
  echo "Sin cambios: $remote_sha"
  exit 0
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  rm -rf "$REPO_DIR"
  git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
  git -C "$REPO_DIR" remote set-url origin "$REPO_URL"
  git -C "$REPO_DIR" fetch --depth=1 origin "$BRANCH"
  git -C "$REPO_DIR" checkout -B "$BRANCH" FETCH_HEAD
  git -C "$REPO_DIR" clean -fdx
fi

checked_out_sha="$(git -C "$REPO_DIR" rev-parse HEAD)"
if [ "$checked_out_sha" != "$remote_sha" ]; then
  echo "SHA inesperado: remoto=$remote_sha local=$checked_out_sha" >&2
  exit 1
fi

release_dir="$RELEASES_DIR/$remote_sha"
incoming_dir="$RELEASES_DIR/.incoming-$remote_sha-$$"

cleanup() {
  if [[ -n "${incoming_dir:-}" && "$incoming_dir" == "$RELEASES_DIR"/.incoming-* ]]; then
    rm -rf "$incoming_dir"
  fi
}
trap cleanup EXIT

rm -rf "$incoming_dir"
mkdir -p "$incoming_dir"
git -C "$REPO_DIR" archive "$remote_sha" | tar -x -C "$incoming_dir"

if find "$incoming_dir" \( -name '.env' -o -name '.env.*' -o -name '*.env' -o -name 'credenciales_scrolling_life_privado.docx' \) ! -name '.env.example' | grep -q .; then
  echo "Release rechazada porque contiene secretos." >&2
  exit 1
fi

test -f "$incoming_dir/docker-compose.yml"
test -f "$incoming_dir/Dockerfile"

rm -rf "$release_dir"
mv "$incoming_dir" "$release_dir"

export SCROLLING_LIFE_WEB_CONTEXT="$release_dir"
export GRAPH_BACKEND_CONTEXT="$release_dir/graph-backend"
export TRAFFIC_TRACKER_CONTEXT="$release_dir/traffic-tracker"
export TRAFFIC_DASHBOARD_CONTEXT="$release_dir/traffic-dashboard"
export SERVER_METRICS_CONTEXT="$release_dir/server-metrics"
export ESCRITURA_COLECTIVA_CONTEXT="$release_dir/escritura-colectiva"

docker compose --env-file "$ENV_FILE" -f "$release_dir/docker-compose.yml" config >/dev/null
docker compose --env-file "$ENV_FILE" -f "$release_dir/docker-compose.yml" build \
  web \
  graph-backend \
  traffic-tracker \
  traffic-dashboard \
  server-metrics \
  escritura-colectiva

docker compose --env-file "$ENV_FILE" -f "$release_dir/docker-compose.yml" up -d --remove-orphans \
  web \
  graph-backend \
  traffic-tracker \
  traffic-dashboard \
  server-metrics \
  escritura-colectiva

ln -sfn "$release_dir" "$CURRENT_LINK"
printf '%s\n' "$remote_sha" > "$STATE_FILE"

find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | awk -v max="$MAX_RELEASES" 'NR>max {print $2}' \
  | xargs -r rm -rf

docker compose --env-file "$ENV_FILE" -f "$release_dir/docker-compose.yml" ps
echo "DEPLOY_OK $remote_sha"
