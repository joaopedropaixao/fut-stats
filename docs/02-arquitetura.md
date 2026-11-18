# Arquitetura e Stack

## Visão geral

```
 Celular / Navegador
   └─ PWA (React)  ── hospedado na Vercel
          │  /api/* (rewrite → mesma origem, cookies sem dor de cabeça)
          ▼
   API (NestJS)    ── Render ou Railway
          │
          ▼
   PostgreSQL      ── Neon (branch "dev" e branch "prod")
```

## Decisões

| Tema | Escolha | Por quê |
|------|---------|---------|
| Repo | **Monorepo** com pnpm workspaces (+ Turborepo) | Front, back e tipos compartilhados num lugar só; fica bonito no portfólio |
| Front | **React + Vite + TypeScript** | O que você já pediu; Vite é o padrão atual |
| UI | Tailwind + shadcn/ui | Componentes bons prontos, fácil de manter com IA |
| Dados no front | TanStack Query + React Router | Cache/refetch prontos |
| "App" | **PWA** (vite-plugin-pwa) | Um código só para web e celular. O pessoal abre o link e usa "Adicionar à tela inicial": ganha ícone, abre em tela cheia e recebe notificação, como um app. Sem loja, sem taxa da Apple (US$ 99/ano), sem revisão. Push funciona inclusive no iPhone com o app instalado. Se um dia fizer falta, migra para Expo (React Native) reaproveitando a API |
| Back | **NestJS + TypeScript** | O que você já pediu; estrutura modular boa para crescer |
| ORM | **Prisma** | Migrations simples, tipos gerados, ótimo com IA |
| Validação | Zod, com schemas em `packages/shared` usados no front e no back | Uma fonte de verdade para contratos |
| Banco | **PostgreSQL** | O que você já pediu |
| Auth | **Login com Google** (OAuth/OpenID Connect com `arctic`, state + PKCE) + sessão JWT em cookie httpOnly | Ninguém precisa criar senha; todo mundo tem Gmail. Entrada no grupo por **link de convite** |
| Notificações | **Web Push** (VAPID, gratuito) + botões "Compartilhar no WhatsApp" (`wa.me`) para o admin mandar no grupo | WhatsApp oficial é pago, exige verificação de empresa e não envia para grupos; libs não-oficiais arriscam banir o número. Fica para o futuro |
| Imagens dos posts | Cloudflare R2 ou Supabase Storage (quando o feed precisar) | Tier gratuito generoso |
| Erros | Sentry (plano free) | Saber quando quebra antes do grupo reclamar |
| Testes | Jest (padrão do Nest) / Vitest (front); Playwright depois | Foco em testar a **lógica de domínio** |

## Hospedagem

| O quê | Onde | Custo aproximado* |
|-------|------|-------------------|
| Front (PWA) | Vercel | Grátis |
| API | Render (free, "dorme" após inatividade, ~1 min para acordar) **ou** Railway (~US$ 5/mês, sem sleep) | 0 – 5 US$/mês |
| Banco | Neon Postgres | Grátis |
| Domínio (opcional) | registro.br (`.com.br`) | ~R$ 40/ano |

\*Confira os preços na hora de contratar; planos gratuitos mudam com frequência.

**Meta: custo zero.** Começar tudo no plano gratuito (Render free inclusive em
produção). Só considerar o Railway se a API "dormindo" incomodar de verdade o pessoal.

### Ambientes

| Ambiente | Branch | Web (Vercel) | API (Render, free) | Banco (Neon) | Sentry | Despertador e backup |
|----------|--------|--------------|--------------------|--------------|--------|----------------------|
| staging | `develop` | `fut-stats-three.vercel.app` | `fut-stats-api-staging` | branch `dev` | `SENTRY_ENVIRONMENT=staging` | nenhum; o relógio interno fecha votações (1 min) |
| produção | `main` | `<DOMINIO>` (domínio próprio `.com.br`; `fut-stats-app.vercel.app` é só o endereço padrão do projeto) | `fut-stats-api` | branch `prod` | `SENTRY_ENVIRONMENT=production` | despertador de 30 em 30 min (GitHub Actions) e backup diário cifrado; relógio interno desligado |
| preview | `feature/*` | endereço do PR (Vercel) | a do staging | branch `dev` | — | — |

Nada é compartilhado entre staging e produção: cada um tem o seu serviço, o seu banco, o segredo de sessão, o client do
Google e o par VAPID. O `render.yaml` e o `apps/web/vercel.json` são os mesmos nas duas branches; a diferença está nas
variáveis de cada painel e na regra de `/api/*` por endereço. Passo a passo: `docs/deploy.md`.

### Tempo real: sinal único de eventos da rodada e canal ao vivo

**O sinal (`apps/api/src/events`).** Toda escrita da rodada que já foi gravada vira um `RoundEvent`
(`{ groupId, roundId, type, scopes, actorMembershipId }`) no `RoundEventsService`, um `EventEmitter` do Node em
memória (`setMaxListeners(0)`). Os services de `rounds`, `lineups`, `match` e `voting` chamam `emit` **depois** que a
transação resolve (nunca dentro); erro ao sinalizar é registrado e engolido, e um ouvinte com erro não impede os
outros. O sinal não carrega dado de domínio e nunca o conteúdo de um voto (`VOTE_CAST` sai sem autor: o voto é
anônimo). Quem se interessa ouve: `on(listener)` para tudo, `subscribe(groupId, roundId, listener)` para uma rodada.

**Os ouvintes.** Hoje, o canal ao vivo (SSE, abaixo). A `pwa-e-push` ouve o mesmo sinal para mandar o push. Um
serviço de notificação futuro entra do mesmo jeito, sem mexer nos services de escrita.

**O canal ao vivo (`apps/api/src/live`).** `GET /api/groups/:groupId/rounds/:roundId/stream` é um fluxo
Server-Sent Events. É só um ouvinte do sinal (`subscribe` por rodada): repassa `{ scopes, at }` (`match`, `voting`,
`status`) e mais nada. Cada aparelho busca a própria visão pela rota de sempre, com as permissões dele.

- **Um processo só:** o emissor vive na memória e serve enquanto a API roda numa instância (Render gratuito). Com
  mais de uma instância, quem escreve numa não alcança quem está conectado na outra.
- **Caminho para crescer:** trocar o `EventEmitter` por `LISTEN/NOTIFY` do Postgres. `emit` vira `NOTIFY` num canal
  com o `RoundEvent` e cada instância, ao receber o `LISTEN`, repassa aos próprios ouvintes. A interface do serviço
  (`emit`, `on`, `subscribe`) e o contrato do fluxo não mudam. O payload do `NOTIFY` tem limite de 8 kB, de sobra
  para um sinal sem dado.
- **Proxy:** o fluxo sai com `Cache-Control: no-cache, no-transform` e `X-Accel-Buffering: no`, e a API manda um
  comentário `: ping` a cada `STREAM_HEARTBEAT_MS` (padrão 20 s) para a conexão não cair parada.

## Estrutura do repositório (planejada)

```
fut-stats/
├─ apps/
│  ├─ api/          # NestJS + Prisma
│  └─ web/          # React + Vite (PWA)
├─ packages/
│  ├─ shared/       # schemas Zod, tipos, enums
│  └─ domain/       # regras de domínio puras (times, notas, Cartola)
├─ docs/
├─ .github/workflows/
├─ AGENTS.md       # regras para agentes (CLAUDE.md importa)
└─ CLAUDE.md
```

## Modelo de dados

Fonte de verdade: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). Enums em inglês,
iguais aos de `packages/domain` (ver `CONTEXT.md`).

**Fase 1 (implementado):**

```
User            id, name, email, avatarUrl, googleId
Group           id, name, slug, inviteCode, votingDeadlineHours
Membership      userId, groupId, role (ADMIN|PLAYER), nickname, photoUrl,
                primaryPosition, secondaryPositions[], initialRating, isHiredGoalkeeper, active
                posições: GOALKEEPER | DEFENDER | WINGER | MIDFIELDER | FORWARD
                (goleiro é posição; "goleiro contratado" é só um dado de cadastro)

Round           id, groupId, number (1, 2, 3... por grupo), scheduledAt, location, whiteGoals, blackGoals,
                status: SCHEDULED → TEAMS_PUBLISHED → IN_PROGRESS → VOTING → CLOSED
                (1 rodada = 1 partida Branco x Preto)
Attendance      roundId, membershipId, confirmed        (única por rodada + membro)
TeamPlayer      roundId, membershipId, team (WHITE|BLACK), position, isReserve
                (única por rodada + membro; quem está aqui jogou)
MatchEvent      roundId, membershipId, type (GOAL|ASSIST|OWN_GOAL; gol sofrido sai do placar), createdById
                (jogador lança os próprios; admin, de qualquer um)
```

**Próximas fases (rascunho):**

```
Rating          roundId, raterId, ratedId, rating     (único por rater+rated+round)
AwardVote       roundId, voterId, votedId, type (MVP|FLOP)   (Craque | Perna de Pau)

Post            id, groupId, authorId, title, body, mediaUrl, roundId?
Reaction        postId, membershipId, emoji
Comment         postId, membershipId, text
```

Tudo que é do grupo carrega `groupId` (direto ou via Round). Isso deixa o app
pronto para várias peladas sem refatorar.

Cartola e Pagamentos adicionam tabelas próprias; ver os docs de cada um.

## Lógica de domínio (onde mora o "cérebro")

Funções puras, bem testadas, sem depender do Nest:

- `balanceTeams(jogadores, historico, config)` gera Branco x Preto na formação 1-2-3-1.
  Ideia: distribui por posição (um goleiro para cada lado, depois zagueiros, alas...)
  + busca local (troca jogadores da mesma posição entre os times) minimizando
  `|diferença de força| + λ · duplas repetidas recentes`.
- `roundScore(notas)` calcula a média aparada.
- `cartolaPoints(scouts, nota)` e `priceVariation(...)`: ver doc do Cartola.

Essa é a parte mais interessante para mostrar no portfólio e a que mais merece testes.
