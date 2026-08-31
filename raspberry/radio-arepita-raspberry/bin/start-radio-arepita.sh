#!/usr/bin/env bash
set -euo pipefail

APP_HOME="${XDG_CONFIG_HOME:-$HOME/.config}/radio-arepita"
ENV_FILE="$APP_HOME/radio-arepita.env"
FALLBACK_PAGE="$APP_HOME/web/no-signal.html"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

RADIO_URL="${RADIO_URL:-https://radio.testivanbarajas.cloud/radio}"
RADIO_VOLUME="${RADIO_VOLUME:-90}"
RADIO_DISPLAY="${RADIO_DISPLAY:-:0}"
RADIO_KIOSK="${RADIO_KIOSK:-1}"
RADIO_CHECK_SIGNAL="${RADIO_CHECK_SIGNAL:-1}"

export DISPLAY="$RADIO_DISPLAY"

find_browser() {
  command -v chromium-browser 2>/dev/null ||
    command -v chromium 2>/dev/null ||
    command -v google-chrome 2>/dev/null ||
    command -v firefox 2>/dev/null
}

BROWSER="$(find_browser || true)"
if [ -z "$BROWSER" ]; then
  echo "No browser found. Install chromium-browser or chromium." >&2
  exit 1
fi

if command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 1 -root >/dev/null 2>&1 &
fi

if command -v amixer >/dev/null 2>&1; then
  amixer sset Master "${RADIO_VOLUME}%" >/dev/null 2>&1 || true
fi

TARGET_URL="$RADIO_URL"
if [ "$RADIO_CHECK_SIGNAL" = "1" ] && command -v curl >/dev/null 2>&1; then
  if ! curl -fsIL --max-time 8 "$RADIO_URL" >/dev/null 2>&1; then
    TARGET_URL="file://$FALLBACK_PAGE"
  fi
fi

COMMON_FLAGS=(
  "--no-first-run"
  "--noerrdialogs"
  "--disable-infobars"
  "--disable-session-crashed-bubble"
  "--autoplay-policy=no-user-gesture-required"
  "--check-for-update-interval=31536000"
  "--user-data-dir=$HOME/.cache/radio-arepita-chromium"
)

if [[ "$BROWSER" == *firefox* ]]; then
  exec "$BROWSER" "$TARGET_URL"
fi

if [ "$RADIO_KIOSK" = "1" ]; then
  exec "$BROWSER" "${COMMON_FLAGS[@]}" --kiosk "$TARGET_URL"
fi

exec "$BROWSER" "${COMMON_FLAGS[@]}" "$TARGET_URL"
