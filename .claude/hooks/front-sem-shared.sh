#!/bin/sh
# PreToolUse: na branch -front, ninguém edita packages/shared (o contrato é do back).
. "$(dirname "$0")/lib.sh"

case $(field .tool_name) in
  Edit | Write | MultiEdit | NotebookEdit) ;;
  *) exit 0 ;;
esac

file=$(field .tool_input.file_path)
[ -n "$file" ] || file=$(field .tool_input.notebook_path)
case $file in
  /*) ;;
  *) file="$cwd/$file" ;;
esac

case $file in
  */packages/shared/*) ;;
  *) exit 0 ;;
esac

case $(branch_of "$(dirname "$file")") in
  *-front) deny "Front não edita packages/shared: o contrato é do back. Anote o furo em Dúvidas e peça a mudança ao TPL." ;;
esac
exit 0
