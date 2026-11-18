#!/bin/sh
# Notification e Stop: banner e som no macOS quando a sessão espera o dono.
. "$(dirname "$0")/lib.sh"

msg=$(field .message | tr '"' "'")
msg=${msg:-Esperando você}
title="fut-stats · $(basename "$cwd")"
script="display notification \"$msg\" with title \"$title\" sound name \"Glass\""

if [ -n "$NOTIFICA_DRY" ]; then
  echo "$script"
else
  osascript -e "$script" >/dev/null 2>&1
fi
exit 0
