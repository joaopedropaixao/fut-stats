# Roadmap

Este arquivo **é** o quadro de tarefas: marque `[x]` no mesmo PR que entrega o item.
Regra de ouro: **cada fase termina com algo no ar**, não só no seu computador.

## Ondas (o que dá para rodar em paralelo)

As fases dizem **o que** o produto ganha. As ondas dizem **em que ordem** as tarefas entram e quais rodam juntas.
Cada linha é uma tarefa: um worktree, uma branch e um PR. Uma onda começa quando as dependências dela estão
mergeadas na `develop`, e não precisa esperar a onda anterior inteira.

**Limite:** até 3 agentes de código ao mesmo tempo, mais o design. O gargalo é a revisão, não o agente.

### Onda 1: agora
| Branch | Pasta principal | Depende de | Entrega |
|---|---|---|---|
| `feature/auth-sessao` | `apps/api/src/auth` | — | Sessão JWT em cookie httpOnly, guard, `@CurrentUser()`, checagem de membro/admin do grupo e helper de login nos testes |
| `feature/dominio-rodada` | `packages/domain/src/round` | — | Regras puras: ciclo da rodada (`RoundStatus`), abertura/fechamento da votação e quem pode lançar scout |
| `feature/design-system-refino` ✅ | `docs/design` | — | DS v1.3 fechado no repo (PR #23); falta colar no Paper |
| `feature/plugin-harness` | `.mcp.json`, `.gitignore` | — | MCP do Playwright no repo e `.impeccable/` ignorado (sessão dedicada) |
| Você, no Google Cloud | — | — | Projeto e credenciais OAuth (guia passo a passo, como no deploy) |

### Onda 2: depois do `auth-sessao`
| Branch | Pasta principal | Depende de | Entrega |
|---|---|---|---|
| `feature/auth-google` | `apps/api/src/auth` | `auth-sessao` + credenciais | Login com Google em staging |
| `feature/grupos-e-convite` | `apps/api/src/groups` | `auth-sessao` | Criar grupo (quem cria vira admin), link de convite, entrar no grupo |
| `feature/perfil-jogador` | `apps/api/src/members` | `auth-sessao` | Editar perfil; admin define nota inicial, goleiro contratado e ativo/inativo |
| `feature/rodadas-e-presenca` | `apps/api/src/rounds` | `auth-sessao`, `dominio-rodada` | Admin cria rodada; jogador confirma presença |
| Design: telas da Fase 1 | Paper | DS fechado | Entrar/convite, rodada e presença, montar times, placar e scouts, histórico |

### Onda 3: backend da Fase 1 completo + base do front
| Branch | Pasta principal | Depende de | Entrega |
|---|---|---|---|
| `feature/times-e-placar` | `apps/api/src/lineups` | `rodadas-e-presenca` | Admin monta Branco x Preto, publica e lança o placar |
| `feature/scouts` | `apps/api/src/match-events` | `rodadas-e-presenca` | Gols e assistências (jogador os próprios, admin de todos) |
| `feature/historico` | `apps/api/src/history` | `times-e-placar`, `scouts` | Lista de rodadas e detalhe da partida |
| `feature/web-foundation` | `apps/web` | DS fechado ✅ (já pode começar) | Tokens → Tailwind, rotas, TanStack Query, cliente da API, shell do app, PWA |

### Onda 4: telas da Fase 1
Uma tarefa por tela aprovada no Paper, todas depois do `web-foundation` e da rota que a tela usa.
Fecha a Fase 1 no ar. Daí em diante, cada fase segue o mesmo molde: domínio e design em paralelo, depois
API, depois telas.

**Arquivos com dono único:** `schema.prisma` já tem as tabelas da Fase 1, então as ondas 2 e 3 não devem
mexer nele (se precisar, avise antes). `app.module.ts` e os `index.ts` só ganham uma linha por módulo; conflito ali
se resolve no rebase.

## Fase 0: Fundação
- [x] Repositório no GitHub, branches `main` e `develop`, proteção de branch
- [x] Monorepo (pnpm + Turborepo) com `apps/api`, `apps/web` e `packages/shared`
- [x] Lint + Prettier + TypeScript strict
- [x] CI no GitHub Actions (lint, typecheck, testes em todo PR)
- [x] Prisma conectado (schema da Fase 1, Postgres local via Docker, testes de integração no CI)
- [x] Banco no Neon
- [x] **Deploy "hello world"** de front e API (staging a partir da `develop`)
- [x] Login com Google funcionando em staging

## Fase 0.5: Design (Paper + Claude Code)
Roda **em paralelo** com a Fase 0 e o backend da Fase 1. **Bloqueia apenas a implementação das telas no front.**
- [x] Instalar o Paper Desktop e conectar ao Claude Code (plugin/MCP)
- [x] Mini design system: cores (Branco x Preto), tipografia, espaçamentos, componentes base ([docs/design](design/README.md))
- [x] Design system fechado: v1.3 com `DESIGN.md` e `tokens.css` ([docs/design](design/README.md))
- [ ] v1.3 colada no Paper (depende do limite semanal do plano grátis)
- [ ] Telas da Fase 1 (mobile-first): entrar/convite, rodada e presença, montar times, placar e scouts, histórico
- [ ] Telas das Fases 2 a 4: seletor de times, notas, Craque / Perna de Pau, ranking, feed
- [x] MCP do Playwright configurado no repo (`.mcp.json`) antes da primeira tarefa que toca telas
- [x] `docs/design/tokens.css` → tema do Tailwind no `apps/web` (tarefa `feature/web-foundation`)
- [x] Renomear entidades para os nomes do design (mudaram junto com os ícones): MVP → **Craque**,
  Bola Murcha → **Perna de Pau** em `packages/domain`, `packages/shared` (labels), `CONTEXT.md` e docs

## Fase 1: Núcleo do grupo
- [x] Grupo + link de convite
- [ ] Perfil do jogador (apelido, foto, posição, nota inicial definida pelo admin)
- [ ] Cadastro dos goleiros contratados (`isHiredGoalkeeper`; goleiro é a posição `GOALKEEPER`)
- [x] Regras da rodada no domínio: ciclo de status e quem pode lançar scout
- [x] Admin: criar rodada; jogadores: confirmar presença
- [ ] Admin: montar Branco x Preto manualmente e lançar o placar
- [ ] Scouts: jogador lança os próprios gols/assistências; admin lança/corrige de todos
- [x] Histórico de rodadas e partidas

## Fase 2: Seletor de times
- [x] Algoritmo `balanceTeams` (Branco x Preto, 1-2-3-1, um goleiro por time) com testes
- [ ] Tela do admin: gerar, arrastar entre times, regerar, publicar
- [x] Anti-vício: penalizar duplas repetidas nas últimas N rodadas

## Fase 3: Notas e ranking
- [ ] Abertura/fechamento da votação (todos votaram ou prazo expirou)
- [ ] Tela "Dê sua nota" (um jogador por vez, swipe)
- [ ] Craque / Perna de Pau
- [ ] Ranking geral e por posição + perfil com stats

## Fase 4: Feed e lançamento do MVP 🚀
- [ ] Feed de notícias/resenhas (admin cria), reações e comentários
- [ ] Cards de alerta (times publicados, votação aberta)
- [ ] PWA instalável + Web Push
- [ ] Produção (`main`), Sentry, backup do banco
- [ ] **Lançar para a pelada**, coletar feedback em 2–3 rodadas

## Fase 5: Cartola (v1.1)
- [ ] Preços iniciais a partir das notas acumuladas
- [ ] Mercado abre/fecha por rodada
- [ ] Montar escalação + capitão, com orçamento
- [ ] Pontuação e valorização após a votação
  - [x] Regras puras em `packages/domain/src/cartola` (pontos, valorização, validação da escalação)
- [ ] Ranking do Cartola (rodada e geral)

## Fase 6: Pagamentos
- [ ] Mensalidades: quem pagou / quem não pagou (substitui a planilha)
- [ ] Pix copia-e-cola / QR estático gerado pelo app (sem precisar de API de banco)
- [ ] Admin marca como pago; depois, avaliar confirmação automática via PSP

## Futuro
- Notificações via WhatsApp
- Segundo grupo (sua outra pelada)
- App nativo (Expo), se o PWA não bastar
