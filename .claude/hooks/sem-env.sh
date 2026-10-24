#!/bin/sh
# PreToolUse: ninguém lê .env. Só passa .env.example e cópia simples (cp / ln -s) para montar worktree.
. "$(dirname "$0")/lib.sh"

motivo="Bloqueado: nunca abrir .env (regra do projeto). Use o .env.example e apps/api/src/config/env.ts."

case $(field .tool_name) in
  Read | Edit | Write | MultiEdit | Grep)
    path=$(field .tool_input.file_path)
    [ -n "$path" ] || path=$(field .tool_input.path)
    case $(basename "$path") in
      .env.example) ;;
      .env | .env.*) deny "$motivo" ;;
    esac
    ;;
  Bash)
    cmd=$(field .tool_input.command)
    # Busca recursiva que ignora o .gitignore lê o .env sem citar o nome.
    busca="$motivo Para buscar no código, use a ferramenta Grep (respeita o .gitignore) ou grep -r com --include=<padrão>."
    if printf '%s' "$cmd" | grep -Eq '(^|[^A-Za-z0-9_-])grep[[:space:]]([^|;&]*[[:space:]])?(-[A-Za-z]*[rR][A-Za-z]*|--recursive|--dereference-recursive)([[:space:]]|$)' &&
      ! printf '%s' "$cmd" | grep -q -- '--include'; then
      deny "$busca"
    fi
    printf '%s' "$cmd" | grep -Eq '(^|[^A-Za-z0-9_-])rg[[:space:]]([^|;&]*[[:space:]])?(-[A-Za-z]*u[A-Za-z]*|--no-ignore[A-Za-z-]*|--hidden)([[:space:]]|$)' &&
      deny "$busca"

    sem_example=$(printf '%s' "$cmd" | sed 's/\.env\.example//g')
    printf '%s' "$sem_example" | grep -Eq '(^|[^A-Za-z0-9_])\.env([.-][A-Za-z0-9_-]+)*([^A-Za-z0-9_.-]|$)' || exit 0
    # Exceção: um cp ou ln -s sozinho, sem pipe, redirecionamento, encadeamento nem argumento em /dev/
    # (só o argumento que começa com /dev/: o checkout principal fica em ~/dev/...).
    if printf '%s' "$cmd" | grep -Eq '^[[:space:]]*(cp|ln[[:space:]]+-s)[[:space:]]' &&
      ! printf '%s' "$cmd" | grep -q '[|<>;&`$]' &&
      ! printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])/dev/' &&
      [ "$(printf '%s' "$cmd" | wc -l)" -eq 0 ]; then
      exit 0
    fi
    deny "$motivo Se o comando só cita .env num texto (commit, PR), escreva o texto num arquivo e use -F / --body-file."
    ;;
esac
exit 0
