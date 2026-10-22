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
| Auth | **Login com Google** (OAuth via Passport) + sessão JWT em cookie httpOnly | Ninguém precisa criar senha; todo mundo tem Gmail. Entrada no grupo por **link de convite** |
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

| Branch | Ambiente | Banco |
|--------|----------|-------|
| `develop` | staging (preview) | Neon branch `dev` |
| `main` | produção | Neon branch `prod` |
| `feature/*` | preview da Vercel por PR | Neon branch `dev` |

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
└─ CLAUDE.md
```

## Modelo de dados (rascunho do MVP)

```
User            id, nome, email, avatarUrl, googleId
Group           id, nome, slug, inviteCode, prazoVotacaoHoras
Membership      userId, groupId, papel (ADMIN|JOGADOR), tipo (MENSALISTA|GOLEIRO),
                apelido, posicaoPrincipal, posicoesSecundarias[], notaInicial, ativo
                posições: GOLEIRO | ZAGUEIRO | ALA | MEIO | ATACANTE

Round (Rodada)  id, groupId, data, local, golsBranco, golsPreto,
                status: AGENDADA → TIMES_PUBLICADOS → EM_JOGO → VOTACAO → ENCERRADA
                (1 rodada = 1 partida Branco x Preto)
Attendance      roundId, membershipId, confirmado
TeamPlayer      roundId, membershipId, time (BRANCO|PRETO), posicao
MatchEvent      roundId, membershipId, tipo (GOL|ASSISTENCIA|GOL_SOFRIDO|DEFESA|...),
                lancadoPorId   (jogador lança os próprios; admin, de qualquer um)

Rating          roundId, raterId, ratedId, nota       (único por rater+rated+round)
AwardVote       roundId, voterId, votedId, tipo (MVP|BOLA_MURCHA)

Post            id, groupId, autorId, titulo, corpo, midiaUrl, roundId?
Reaction        postId, membershipId, emoji
Comment         postId, membershipId, texto
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
