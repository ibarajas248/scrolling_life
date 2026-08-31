#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_HOME="${XDG_CONFIG_HOME:-$HOME/.config}/radio-arepita"
BIN_HOME="$HOME/.local/bin"
SYSTEMD_USER_HOME="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

echo "Installing Radio Arepita..."

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y chromium-browser unclutter x11-xserver-utils alsa-utils curl || \
    sudo apt-get install -y chromium unclutter x11-xserver-utils alsa-utils curl
fi

mkdir -p "$APP_HOME" "$APP_HOME/web" "$BIN_HOME" "$SYSTEMD_USER_HOME"

cp "$ROOT_DIR/config/radio-arepita.env" "$APP_HOME/radio-arepita.env"
cp "$ROOT_DIR/web/no-signal.html" "$APP_HOME/web/no-signal.html"
cp "$ROOT_DIR/bin/start-radio-arepita.sh" "$BIN_HOME/start-radio-arepita.sh"
cp "$ROOT_DIR/systemd/radio-arepita.service" "$SYSTEMD_USER_HOME/radio-arepita.service"

chmod +x "$BIN_HOME/start-radio-arepita.sh"

systemctl --user daemon-reload
systemctl --user enable radio-arepita.service
systemctl --user restart radio-arepita.service

if command -v loginctl >/dev/null 2>&1; then
  loginctl enable-linger "$USER" >/dev/null 2>&1 || true
fi

echo "Radio Arepita installed."
echo "Config: $APP_HOME/radio-arepita.env"
echo "Status: systemctl --user status radio-arepita.service"
