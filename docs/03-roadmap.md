# Roadmap

Este arquivo **é** o quadro de tarefas: marque `[x]` no mesmo PR que entrega o item.
Regra de ouro: **cada fase termina com algo no ar**, não só no seu computador.

## Trilha (a ordem de entrega daqui em diante)

O backend da Fase 1 que dava para fazer sozinho já está na `develop`. Daqui para a frente, o produto cresce em
**fatias**: cada fatia junta o que falta de backend com a sua tela e entra em **um PR** para a `develop`.

**Uma tela de referência por vez:** uma tela de tipo novo só entra em construção depois que a referência dela foi
validada. As telas seguem o `DESIGN.md` e as telas já feitas, sem passar pelo Paper (decisão de 24 out 2026). Desde
14 nov 2026 a validação é pelo álbum de prints do PR, e fatias que não se parecem rodam em paralelo, em ondas (ver
abaixo).

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
| 0 ✅ | `massa-de-dados` | Back | `prisma/seed.ts` | Rodadas passadas com times, placar e lances (inclusive gol contra) para validar as telas |
| 1 ✅ | `montar-times` | Par | PR #33 (fechar) | Admin monta Branco x Preto tocando no jogador e na vaga, e publica |
| 2 ✅ | `seletor-de-times` | Par | `montar-times` | Gerar com `balanceTeams`, ajustar tocando, regerar e publicar. Subiu para depois de `montar-times` (24 out 2026): ajuda a testar as telas seguintes |
| 3 ✅ | `placar-e-lances` | Par | PR #32 (fechar) | Placar, gols, assistências e gol contra; jogador lança os próprios, admin de todos |
| 4 ✅ | `perfil-jogador` | Par | — | **Onda 1.** Bonequinho pixel ao escolher o apelido (cor da pele e cabelo), que vira o rosto do jogador em todo lugar; editar perfil; admin cuida do elenco (nota inicial, goleiro contratado, admin, ativo/inativo). **Fecha a Fase 1** |
| 5 ✅ | `orcamento-de-bundle` | Front | — | **Onda 1.** Rotas com `lazy` e limite de tamanho do bundle conferido no build (e no CI) |
| 6 ✅ | `rodizio-reservas` | Par | `placar-e-lances` | **Onda 2.** Botão opcional na tela do jogo: cronômetro (60 min por padrão) que divide o tempo entre os jogadores de linha de cada time e avisa quem entra e quem sai (pedido do dono, 25 out 2026) |
| 7 ✅ | `historico` | Par | PR #31 (fechar) | **Onda 2.** Aba Histórico: partidas finalizadas com placar e o resultado de quem vê; detalhe com o campo e os lances |
| 8 ✅ | `votacao` | Par | — | **Onda 3.** Tabelas do voto, tela "Dê sua nota", Craque / Perna de Pau, fechar a votação (todos votaram, prazo ou admin), apuração gravada e resultado da rodada |
| 9 | `auditoria-da-rodada` | Back | `placar-e-lances` | **Onda 4.** Tabela `RoundLog` (quem, o quê, quando, antes/depois) gravada na mesma transação de toda escrita de placar, etapa e lance, e `requestId` + usuário nos logs da API (Head de Engenharia, 30 out 2026) |
| 10 ✅ | `ranking` | Par | `votacao` | **Onda 4.** Ranking geral, por posição e de goleiros; perfil do jogador com estatísticas; a nota do seletor passa a acompanhar as rodadas |
| 11 | `pacote-do-craque` | Front | `votacao` | **Onda 4.** Grande momento: o resultado chega como pacote, que rasga e revela a carta do Craque, com Compartilhar (fatia nova, 14 nov 2026) |
| 12 | `feed` | Par | — | **Onda 5.** A tela inicial vira o Feed: avisos (um grande por vez), resenhas do admin, reações e comentários |
| 13 | `jogo-ao-vivo` | Par | `auditoria-da-rodada` | **Onda 5.** SSE (`GET .../rounds/:roundId/stream`) com `EventEmitter` na API, disparado depois do commit, no lugar do polling no jogo, no rodízio e na votação |
| 14 | `pwa-e-push` | Par | — | **Onda 6.** Instalar o app e Web Push: rodada marcada, times publicados, votação aberta e resultado |
| 15 | `producao` | Back | — | **Onda 6.** `main` no ar, Sentry, backup do banco e o despertador (webhook chamado de 15 em 15 minutos para a votação fechar na hora). Depois, a release e **lançar para a pelada** |

**Ondas (14 nov 2026):** o que falta roda em 6 ondas de até 3 fatias em paralelo, com uma dona do `schema.prisma`
por onda. Ordem, dependências e telas de referência: [`specs/ondas-v1.md`](specs/ondas-v1.md). Cada fatia tem o
spec em `docs/specs/<fatia>.md`, escrito em lote pelo líder da v1; as dúvidas e as respostas do dono estão em
[`specs/perguntas-v1.md`](specs/perguntas-v1.md). A numeração mudou: `auditoria-da-rodada` e `jogo-ao-vivo` passaram
para depois de `votacao`.

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
- [x] Perfil do jogador (apelido, bonequinho pixel no lugar da foto, posição, nota inicial definida pelo admin) (`perfil-jogador` ✅)
- [x] Cadastro dos goleiros contratados (`isHiredGoalkeeper`; goleiro é a posição `GOALKEEPER`)
- [x] Regras da rodada no domínio: ciclo de status e quem pode lançar scout
- [x] Admin: criar rodada; jogadores: confirmar presença
- [x] Admin: montar Branco x Preto manualmente e lançar o placar (montar: `montar-times` ✅; placar: `placar-e-lances` ✅)
- [x] Scouts: jogador lança os próprios gols/assistências (na Resenha pós-jogo); admin lança/corrige de todos
- [x] Histórico de rodadas e partidas

## Fase 2: Seletor de times
- [x] Algoritmo `balanceTeams` (Branco x Preto, 1-2-3-1, um goleiro por time) com testes
- [x] Tela do admin: gerar, ajustar tocando entre times, regerar, publicar (arrastar ficou de fora: tocar e tocar)
- [x] Anti-vício: penalizar duplas repetidas nas últimas N rodadas

## Fase 3: Notas e ranking
- [x] Abertura/fechamento da votação (todos votaram, prazo expirou ou o admin encerrou)
- [x] Tela "Dê sua nota" (um jogador por vez; stepper e régua no lugar do swipe)
- [x] Craque / Perna de Pau
- [x] Ranking geral e por posição + perfil com stats

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
- Calibrar o seletor com dados reais: gravar a sugestão x o que o admin publicou e a nota de cada um no dia da
  rodada (muda o banco), e recalibrar λ, μ e τ com `pnpm --filter @fut-stats/api simular:seletor` e os placares reais
- Notificações via WhatsApp
- Segundo grupo (sua outra pelada), com "Criar outra pelada" para quem já está num grupo
- App nativo (Expo), se o PWA não bastar
