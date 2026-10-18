# Fut Stats

App de pelada (times, notas, ranking, feed, Cartola). Contexto completo em `docs/`.

## Convenções
- Idioma: código (nomes, identificadores) em inglês; textos de UI, commits e docs em português.
- Git Flow: `main` (prod), `develop` (staging), `feature/<descricao>`. Nunca commitar direto em `main`/`develop`.
- Tarefas vivem em `docs/03-roadmap.md`; marcar `[x]` no PR que entrega o item.
- Domínio: fut7 semanal, uma partida por rodada (Branco x Preto), formação 1-2-3-1.
- Commits: Conventional Commits (`feat(escopo): ...`).
- Todo dado de domínio pertence a um grupo (`groupId`). Nunca vazar dados entre grupos.
- Lógica de domínio (balanceamento de times, notas, pontuação/preço do Cartola) em funções puras com testes unitários.
- Schemas de validação compartilhados em `packages/shared` (Zod).
- Segredos só em `.env` (nunca commitados); manter `.env.example` atualizado.
