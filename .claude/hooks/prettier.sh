#!/bin/sh
# PostToolUse: formata o arquivo que o agente acabou de editar, com o prettier e o .prettierignore do repo dele.
. "$(dirname "$0")/lib.sh"

file=$(field .tool_input.file_path)
[ -f "$file" ] || exit 0

root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || root=$CLAUDE_PROJECT_DIR
bin="$root/node_modules/.bin/prettier"
[ -x "$bin" ] || bin="$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier"
[ -x "$bin" ] || exit 0

(cd "$root" && "$bin" --write --ignore-unknown "$file") >/dev/null 2>&1
exit 0
