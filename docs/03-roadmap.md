# Roadmap

Este arquivo **é** o quadro de tarefas: marque `[x]` no mesmo PR que entrega o item.
Regra de ouro: **cada fase termina com algo no ar**, não só no seu computador.

## Trilha (a ordem de entrega daqui em diante)

O backend da Fase 1 que dava para fazer sozinho já está na `develop`. Daqui para a frente, o produto cresce em
**fatias**: cada fatia junta o que falta de backend com a sua tela e entra em **um PR** para a `develop`.

**Uma fatia por vez:** só uma tela fica em construção de cada vez. A próxima copia os padrões da anterior
depois que você a valida no navegador. As telas seguem o `DESIGN.md` e as telas já feitas, sem passar pelo Paper
(decisão de 24 out 2026).

### Modos
- **Front:** a API já está na `develop`. Um agente, branch `feature/<fatia>`.
- **Back:** só backend ou dados, sem tela. Um agente, branch `feature/<fatia>`.
- **Par:** falta backend para a tela. O orquestrador escreve o contrato no brief: rotas, schemas Zod do `shared`
  e códigos de erro. Dois agentes trabalham ao mesmo tempo, cada um no seu worktree:
  - `feature/<fatia>-back`: o **primeiro commit** é só o contrato, em `packages/shared`. Depois vêm domínio (se
    faltar), `schema.prisma`, API e testes de integração. Deixa a API rodando para o front.
  - `feature/<fatia>-front`: sai do commit do contrato, não da `develop`. Faz a tela e a valida no Playwright
    contra a API do back. Não edita o `shared`. Se precisar mudar o contrato, pede ao back, que faz a mudança na
    branch dele, e o front puxa de lá.

  Furo no contrato, um avisa o outro direto. No fim, as duas branches se juntam em `feature/<fatia>`, que abre
  um PR só.
- **Arquivos com dono único:** no par, só o back mexe em `schema.prisma`, no `package.json` da raiz e no
  `pnpm-lock.yaml`.

### Fatias
| # | Fatia | Modo | Parte de | Entrega |
|---|---|---|---|---|
| 0 | `massa-de-dados` | Back | `prisma/seed.ts` | Rodadas passadas com times, placar e lances (inclusive gol contra) para validar as telas |
| 1 ✅ | `montar-times` | Par | PR #33 (fechar) | Admin monta Branco x Preto, arrasta entre times e publica |
| 2 | `placar-e-lances` | Par | PR #32 (fechar) | Placar, gols, assistências e gol contra; jogador lança os próprios, admin de todos |
| 3 | `historico` | Par | PR #31 (fechar) | Lista de rodadas e detalhe da partida |
| 4 | `perfil-jogador` | Par | — | Editar perfil; admin define nota inicial, goleiro contratado e ativo/inativo. **Fecha a Fase 1 no ar** |
| 5 | `seletor-de-times` | Par | `montar-times` | Gerar com `balanceTeams`, arrastar, regerar e publicar |
| 6 | `votacao` | Par | — | Tabelas do voto, abrir/fechar a votação, tela "Dê sua nota", Craque / Perna de Pau |
| 7 | `ranking` | Par | `votacao` | Ranking geral e por posição, perfil com stats |
| 8 | `feed` | Par | — | Resenhas do admin, reações, comentários e cards de alerta |
| 9 | `pwa-e-push` | Par | — | PWA instalável e Web Push |
| 10 | `producao` | Back | — | `main` no ar, Sentry e backup do banco. Depois, **lançar para a pelada** |

Os PRs #31, #32 e #33 viram pares. O back aproveita a API da branch antiga, atualiza com as decisões de
#35/#36 e revisa. O front refaz a tela no padrão das telas de entrar e de rodadas. O PR antigo fecha quando o
da fatia abrir. Cartola (Fase 5) e pagamentos (Fase 6) entram na trilha depois do lançamento.

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
- [x] ~~Telas no Paper antes do código~~: substituído (24 out 2026). As telas seguem o `DESIGN.md` e as telas já
  feitas, e você as valida no navegador (ver Trilha)
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
- [ ] Admin: montar Branco x Preto manualmente e lançar o placar (montar: `montar-times` ✅; placar: `placar-e-lances`)
- [ ] Scouts: jogador lança os próprios gols/assistências; admin lança/corrige de todos
- [ ] Histórico de rodadas e partidas

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
- Segundo grupo (sua outra pelada), com "Criar outra pelada" para quem já está num grupo
- App nativo (Expo), se o PWA não bastar
