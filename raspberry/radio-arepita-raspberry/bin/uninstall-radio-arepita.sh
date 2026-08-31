#!/usr/bin/env bash
set -euo pipefail

SYSTEMD_USER_HOME="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

systemctl --user stop radio-arepita.service 2>/dev/null || true
systemctl --user disable radio-arepita.service 2>/dev/null || true

rm -f "$SYSTEMD_USER_HOME/radio-arepita.service"
rm -f "$HOME/.local/bin/start-radio-arepita.sh"

systemctl --user daemon-reload 2>/dev/null || true

echo "Radio Arepita service removed."
echo "Config files remain at ~/.config/radio-arepita"
