# Fluxo de Trabalho

## Git Flow

```
main  ─────●───────────────●──────────  produção (só recebe merge da develop / hotfix)
            \             /
develop ─────●──●──●──●──●──────────────  staging
              \   /  \  /
feature/xxx    ●─●    ●●               uma branch por card do Trello
```

- `main`: produção, protegida, só via PR.
- `develop`: integração/staging, protegida, só via PR com CI verde.
- `feature/<descricao>`, ex.: `feature/seletor-de-times`.
- `fix/...` para bugs e `hotfix/...` saindo da `main` para urgências.
- Release: PR `develop → main` com tag `vX.Y.Z`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português:

```
feat(times): gera times equilibrados por posição
fix(notas): impede jogador de votar em si mesmo
chore: configura CI
docs: atualiza roadmap
```

## Pull Requests
- Mesmo trabalhando sozinho: **sempre PR**. Isso deixa histórico, roda o CI e fica
  ótimo no portfólio.
- Descrição curta: o quê, por quê, print da tela quando tiver UI.
- Antes de pedir merge, peça uma revisão à IA (`/code-review`).

## Tarefas
O [roadmap](03-roadmap.md) é o quadro de tarefas: pegue o próximo item da fase
atual, crie a branch e marque `[x]` no PR que entrega. Custo zero, tudo no repo.

## Desenvolvendo com IA (sem perder o controle)
- O `AGENTS.md` na raiz guarda as regras do projeto para todos os agentes (o `CLAUDE.md` só importa ele). Mantenha enxuto e atualizado.
- Peça uma funcionalidade por vez, numa branch, e **leia o diff** antes de commitar.
- Lógica de domínio (times, notas, Cartola) sempre com testes. Peça os testes junto.
- Quando algo não fizer sentido, pergunte "por quê?". O objetivo também é aprender.
