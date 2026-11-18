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
| 9 ✅ | `auditoria-da-rodada` | Back | `placar-e-lances` | **Onda 5.** Tabela `AuditLog` (quem, o quê, quando, antes/depois; começou como `RoundLog`) gravada na mesma transação de toda escrita de placar, etapa e lance e, depois do `feed`, de resenha, comentário e reação, e `requestId` + usuário nos logs da API (Head de Engenharia, 30 out 2026) |
| 10 ✅ | `ranking` | Par | `votacao` | **Onda 4.** Ranking geral, por posição e de goleiros; perfil do jogador com estatísticas; a nota do seletor passa a acompanhar as rodadas |
| 11 ✅ | `pacote-do-craque` | Front | `votacao` | **Onda 4.** Grande momento: o resultado chega como pacote, que rasga e revela as cartas do Craque (com walkout), do Perna de Pau e a sua (bronze/prata/ouro pela nota), com Compartilhar (fatia nova, 14 nov 2026; reforço 15 nov) |
| 12 ✅ | `feed` | Par | — | **Onda 5.** A tela inicial vira o Feed: avisos (um grande por vez), resenhas do admin, reações e comentários |
| 13 ✅ | `jogo-ao-vivo` | Par | `auditoria-da-rodada` | **Onda 6, junto do lançamento** (decisão do dono, 15 nov 2026). SSE (`GET .../rounds/:roundId/stream`) com `EventEmitter` na API, disparado depois do commit, no lugar do polling no jogo, no rodízio e na votação |
| 14 ✅ | `pwa-e-push` | Par | — | **Onda 6.** Instalar o app e Web Push: rodada marcada, times publicados, votação aberta e resultado, como ouvinte do sinal único de eventos da rodada (da `jogo-ao-vivo`). Pendência do `pacote-do-craque` resolvida (17 nov 2026): o aviso `RESULT` do Feed traz `hasPack` e o card do início não chama mais `GET .../voting/result`; a novidade chega pelo push `RESULT_OUT` (app fechado) e pelo SSE da `jogo-ao-vivo` (app aberto) |
| 15 ✅ | `producao` | Back | — | **Onda 6.** `main` no ar, Sentry, backup do banco e o despertador (webhook chamado de 30 em 30 minutos para a votação fechar no prazo). Depois, a release e **lançar para a pelada** |
| 16 ✅ | `polimento-v1` | Front | — | **Onda 5, antes do `feed`.** Ajustes que vieram dos testes do dono (15 nov 2026): folga no orçamento do JS inicial (148,2 de 150 kB depois do pacote; o `feed` precisa de espaço), frase de impacto para "só 1 assistência" na carta do Craque (hoje cai em "JOGOU DEMAIS"), moldura bronze/prata/ouro (`cardTier`) na figurinha do ranking |

### Próximas prioridades (18 nov 2026)
Entregues até aqui: as fatias 0 a 16. **Release `v1.0.0` no ar em 18 nov 2026** (PR #80, tag `v1.0.0`) em
<https://futstats-app.com.br>: o dono entrou, instalou o app no celular e criou a pelada. Falta do roteiro do dono
(`docs/deploy.md`): R7b (segredos e primeiro backup) e R7c (despertador). Ordem:

1. ✅ **`polimento-v1`** (Front, pequeno): abre espaço no orçamento do JS inicial e fecha os ajustes dos testes. Vem
   antes do `feed` porque ele é a próxima tela grande.
2. ✅ **`auditoria-da-rodada`** (Back) e **`feed`** (Par), em paralelo. As duas mexem no `schema.prisma`
   (`RoundLog` e `Post`/`PostReaction`/`PostComment`): o `feed` entrou primeiro e a auditoria refez a migration por
   cima (o model virou `AuditLog` e passou a cobrir as escritas do feed).
3. ✅ **`jogo-ao-vivo`** (Par), ✅ **`pwa-e-push`** (Par) e ✅ **`producao`** (Back), que coloca a `main` no
   ar no domínio próprio (`futstats-app.com.br`).
4. **Lançar para a pelada** (em andamento): primeiro os admins testam e dão feedback (semana de 18 nov 2026),
   depois os jogadores, na pelada do domingo seguinte. Coletar feedback em 2–3 rodadas. O `docs/lancamento.md` explica como instalar o app
   no Android e no **iPhone** (no Safari: Compartilhar → Adicionar à Tela de Início; sem instalar, o iPhone não
   recebe avisos). A ideia é todo mundo ter o app com ícone na tela, como um app da loja.
5. Depois do lançamento: os ajustes do feedback, as ideias abaixo, Cartola (Fase 5) e pagamentos (Fase 6).

### Depois do lançamento: ideias aprovadas pelo dono
Ainda sem spec nem ordem. Entram na trilha depois do feedback das primeiras rodadas.

| Ideia | O que é | Origem |
|---|---|---|
| Serviço de notificação | Um serviço próprio (p.ex. `fut-stats-app-notification-service`) que ouve o sinal único de eventos da rodada e centraliza tudo: manda os aparelhos se atualizarem, envia os avisos e, no futuro, webhooks para fora. O sinal da `jogo-ao-vivo` já é a costura para isso | Dono, 17 nov 2026 (decisões em `specs/jogo-ao-vivo.md`) |
| Feed e presença ao vivo | Reações, comentários e "vou / não vou" atualizam na hora, pelo mesmo canal da `jogo-ao-vivo` | Dono, 17 nov 2026 |
| Moldura do Perna de Pau | A carta do Perna de Pau ganha moldura própria (madeira, rachada, "pé torto") no lugar da faixa da nota, que continua visível. Hoje a faixa segue a nota (`cardTier`), e um Perna de Pau com 6,5 sai prata | Dono, 18 nov 2026 |
| Resenha-enquete | Uma resenha do tipo votação, para os admins decidirem com o grupo: o que fazer com o dinheiro da pelada, cancelar ou não uma pelada, e coisas do tipo | Dono, 18 nov 2026 |
| Instagram da pelada | Levar resenhas, resultados, votações etc. para um Instagram da pelada, onde o pessoal já está todo dia, para mais gente ficar sabendo e engajar. Bem mais para a frente | Dono, 18 nov 2026 |

Limite de três equipes ao mesmo tempo, somando Claude e Codex; cada orquestrador cuida das equipes que lançou e
os avisos entre equipes vão no quadro (`.claude/scripts/quadro.sh`).

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
- [x] Feed de notícias/resenhas (admin cria), reações e comentários
- [x] Cards de alerta (times publicados, votação aberta) (votação aberta e resultado já no início, pela `votacao` e o `pacote-do-craque`; o resto vem no `feed`)
- [x] PWA instalável + Web Push
- [x] Produção (`main`), Sentry, backup do banco
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
