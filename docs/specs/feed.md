# `feed`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.
> Dúvidas respondidas pelo dono em lote: `docs/specs/perguntas-v1.md`.

| | |
|---|---|
| **Fatia** | `feed` (onda 5) |
| **Modo** | Par |
| **Parte de** | — |
| **Status** | aprovado em 2026-11-14 |
| **Base** | develop @e97ee8d (checkpoint de início em 2026-11-15; antes @1021769) |
| **Depende de** | votacao, pacote-do-craque, perfil-jogador |
| **Toca em** | apps/api/prisma/schema.prisma, apps/api/prisma/migrations/*_feed, apps/api/prisma/seed.ts, packages/domain/src/feed, packages/domain/src/group, packages/domain/src/index.ts, packages/shared/src/feed.ts, packages/shared/src/index.ts, apps/api/src/feed, apps/api/src/app.module.ts, apps/api/src/seed, apps/web/src/pages/feed, apps/web/src/features/feed, apps/web/src/pages/rounds/home.tsx (removido), apps/web/src/pages/{rounds,voting,elenco}/routes, apps/web/src/features/voting, apps/web/src/features/match, apps/web/src/features/lineup, apps/web/src/features/rounds, apps/web/src/components/ui/{pixel-sprite-maps,text-field,text-area,row-menu}, apps/web/src/app/preload.ts, apps/web/src/router.tsx |

## Produto

### Objetivo
A tela inicial vira o **Feed** da pelada. Em cima, os **avisos** do que está acontecendo (jogo rolando, resultado,
votação, times, presença): um aviso grande por vez e os outros em linha. Embaixo, as **resenhas** que os admins
escrevem, com reações e comentários de todo mundo. É o que dá vida ao app entre um jogo e outro.

### Quem usa
- **Qualquer membro ativo:** vê avisos e resenhas, reage (uma reação por resenha) e comenta; apaga o próprio
  comentário.
- **Admin:** escreve, edita e apaga resenhas (de qualquer admin), apaga qualquer comentário e compartilha a resenha
  no WhatsApp.
- **Usuário de outro grupo, ou membro inativo:** 404 em tudo.

### Regras de domínio
- **Avisos saem do estado das rodadas, não ficam gravados.** Tipos, na **ordem de prioridade** (`FEED_ALERT_TYPES`;
  a folha fixa "resultado > votação > presença", e o jogo ao vivo vem antes de tudo):
  1. `IN_PROGRESS`: tem jogo rolando.
  2. `POST_MATCH`: hora da Resenha.
  3. `RESULT`: o resultado saiu (até 7 dias, `pickLatestResult`).
  4. `VOTING`: votação aberta (`pickVotingRound`).
  5. `TEAMS_PUBLISHED`: os times saíram.
  6. `PRESENCE`: presença aberta para a próxima rodada (`SCHEDULED`).
  Os tipos 1, 2, 5 e 6 olham a **rodada da vez** (`pickCurrentRound`); no máximo um aviso por tipo. O primeiro da
  lista é o aviso grande; os outros aparecem em linha.
- **Resenha:** só admin escreve (visão do produto). Título opcional com até 60 caracteres; texto obrigatório com
  até 1000, com quebra de linha. **Só texto na v1** (imagem pede um serviço de arquivos novo).
- **Reação:** uma por pessoa por resenha, de uma lista fechada de 5 (`POST_REACTIONS`): bola ("golaço, curti o lance"), bagre
  (a zoeira de "joga mal hoje"), OSS! (respeito e raça), cartão amarelo ("essa foi feia") e pipocou ("amarelou, fugiu
  da dividida"). Tocar em outra troca; tocar na mesma tira.
- **Comentário:** qualquer membro, até 280 caracteres, sem edição. Apaga o autor ou um admin.
- Textos passam pela mesma regra de caractere inválido do apelido (`hasInvalidCharacters`), liberando a quebra de
  linha; sem espaço nas pontas; em NFC.
- Apagar a resenha apaga reações e comentários dela. Autor que ficou inativo continua aparecendo como autor.
- Grupo de confiança: sem moderação além do admin apagar
  ([CONTEXT.md › Decisões fixas](../../CONTEXT.md#decisões-fixas-não-rediscutir)).

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | rodada da vez `SCHEDULED`, uma rodada em `VOTING` e uma encerrada ontem | `feedAlerts` | `RESULT`, `VOTING`, `PRESENCE`, nessa ordem, cada um com o id da rodada certa | unitário |
| C2 | rodada da vez `IN_PROGRESS` e uma em `VOTING` | `feedAlerts` | `IN_PROGRESS`, `VOTING` | unitário |
| C3 | rodada da vez `POST_MATCH`; `TEAMS_PUBLISHED` | `feedAlerts` | `POST_MATCH`; `TEAMS_PUBLISHED` | unitário |
| C4 | só rodadas encerradas há mais de 7 dias; nenhuma rodada | `feedAlerts` | `[]` | unitário |
| C5 | título com 61 caracteres; texto vazio (só espaços); texto com 1001; texto com `\0`; texto com quebra de linha | `validatePostInput` | `TITLE_TOO_LONG`; `BODY_EMPTY`; `BODY_TOO_LONG`; `INVALID_CHARACTERS`; `[]` | unitário |
| C6 | comentário vazio; com 281; com emoji composto contando 1 | `validateCommentText` | `EMPTY`; `TOO_LONG`; `null` | unitário |
| C7 | admin / jogador | `canManagePost`; `canDeleteComment` do próprio e de outro | admin sim / jogador não; autor sim, admin sim, outro jogador não | unitário |

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C8 | cenário de C1, quem pede jogou a rodada em votação e não votou, e não respondeu a presença | `GET /groups/:groupId/feed/alerts` | os três avisos na ordem, cada um com `roundId`, `roundNumber`, `scheduledAt` e o `me` do tipo (`played`, `voted`, `attendance`, `team`) | integração |
| C9 | admin | `POST /groups/:groupId/posts` `{ title, body }` | 201 `Post` com autor (apelido, `avatar`), `reactions` zeradas, `myReaction: null`, `commentCount: 0`, `canManage: true` | integração |
| C10 | admin | `POST` sem título; com cada caso inválido de C5 | 201 com `title: null`; 400 com o texto do shared | integração |
| C11 | jogador comum | `POST`, `PATCH`, `DELETE` de resenha | 403; nada muda | integração |
| C12 | outro admin do grupo | `PATCH .../posts/:postId` com texto novo | 200; `editedAt` preenchido; o autor continua o original | integração |
| C13 | admin | `DELETE .../posts/:postId` | 204; reações e comentários somem do banco; `GET` dá 404 | integração |
| C14 | 25 resenhas | `GET .../posts`; depois com `cursor` | 10 da mais nova para a mais antiga e `nextCursor`; as seguintes; a última página com `nextCursor: null`; nenhuma repetida | integração |
| C15 | membro | `PUT .../posts/:postId/reaction` `{ reaction: 'CATFISH' }`; depois `'BALL'`; depois `DELETE .../reaction` | `reactions.CATFISH: 1` e `myReaction: 'CATFISH'`; troca para `BALL` (CATFISH volta a 0); sem reação | integração |
| C16 | dois `PUT` de reação do mesmo membro ao mesmo tempo | `Promise.all` | uma reação só no banco; nunca 500 | integração |
| C17 | reação fora da lista | `PUT` | 400 | integração |
| C18 | membro | `POST .../posts/:postId/comments` `{ text }` | 201 `Comment` com autor e `canDelete: true`; o `commentCount` da resenha sobe | integração |
| C19 | comentários de várias pessoas | `GET .../comments` | em ordem de envio; `canDelete` verdadeiro só nos meus (ou em todos, para admin) | integração |
| C20 | jogador | `DELETE` do próprio comentário; do comentário de outro | 204; 403 `NOT_OWN_COMMENT` | integração |
| C21 | admin | `DELETE` de comentário de outro | 204 | integração |
| C22 | comentário vazio ou com 281 caracteres | `POST` | 400 com o texto do shared | integração |
| C23 | resenha de outro grupo; `postId` inexistente; comentário de outra resenha | qualquer rota | 404; nada muda | integração |
| C24 | usuário de outro grupo, não membro, membro inativo | qualquer rota | 404 | integração |
| C25 | autor da resenha desativado depois | `GET .../posts` | a resenha continua, com o apelido e o bonequinho dele | integração |
| C26 | seed | rodar | 3 resenhas de exemplo (uma sem título, uma longa com quebra de linha), com reações e comentários | integração (`seed.spec.ts`) |

**Tela: avisos** (`/`, 390 px)

> Checkpoint 2026-11-15: o início de hoje já tem `ResultAlert` ("O RESULTADO SAIU", pacote em miniatura e
> "Abrir pacote"; sem votos, "Ver resultado" e sem pacote; depois de aberto vira `ResultLine`), `VotingCard`
> (que foi neutro por decisão do dono e voltou a ter cor na volta de design de 16/11) e `GameCard`. O "já abri o pacote" é
> **por aparelho** (`hasOpenedResult`, guardado no navegador): a API sempre manda o `RESULT` dentro dos 7 dias, e
> o front rebaixa o `RESULT` aberto para linha, promovendo o próximo da lista a aviso grande. Os cards existentes
> são reaproveitados como aviso grande (sem duplicar), ganhando o que faltar do padrão de grande momento.

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C27 | resultado novo (pacote fechado) + votação aberta + presença aberta | abrir o Feed | **um** card grande (o `ResultAlert` de hoje, com o pacote em miniatura e "Abrir pacote"; rodada sem votos: "Ver resultado", sem pacote) e duas **linhas de aviso** abaixo: "VOTAÇÃO ABERTA · FALTA O SEU VOTO" e "PRESENÇA ABERTA · RESPONDA". Cada linha tem ícone, o tipo escrito, cor do tipo e seta; alvo ≥ 44 px | Playwright |
| C28 | abri o pacote (neste aparelho) | voltar ao Feed | o resultado vira linha ("RESULTADO · RODADA 12") e a votação sobe para card grande (o `VotingCard`, agora com a tecla amarela "Dar minhas notas" se joguei e não votei) | Playwright |
| C29 | só presença aberta | abrir | card grande da presença (o de hoje: data, local, CONFIRMAR / AUSÊNCIA, contagem), com uma fileira de rostos de quem vai ("+9" no fim) que leva ao detalhe da rodada. CONFIRMAR / AUSÊNCIA iguais aos do detalhe da rodada (volta de design 5): CONFIRMAR verde, ausência em vermelho, nenhum amarelo em estado nenhum (confirmado, ausência, sem resposta) | Playwright |
| C30 | times publicados e estou escalado | abrir | card grande **"TIMES PUBLICADOS"** com "VOCÊ JOGA NO PRETO" (faixa com o meu bonequinho) e a tecla "Ver os times"; não escalado: "Você não está escalado" | Playwright |
| C31 | jogo rolando; Resenha | abrir | o card do jogo de hoje ("Em jogo" / "Hora da Resenha") como aviso grande; votação de outra rodada, se houver, em linha | Playwright |
| C32 | nenhuma rodada ativa | abrir | sem avisos: "Nenhuma rodada marcada" (admin: tecla "Criar rodada") e as resenhas logo abaixo | Playwright |
| C33 | linha de aviso | tocar | leva à tela do tipo: votar, resultado, times, jogo ou detalhe da rodada | Playwright |
| C34 | a tela inteira | contar teclas amarelas | no máximo uma (a do aviso grande; com a presença como aviso grande, nenhuma: o CONFIRMAR é verde, exceção do dono de 17/11). "Nova resenha" e "Todas as rodadas" são de contorno. **Exceção (dono, 16/11):** na página da votação, a ação de quem vota e o "Encerrar votação" do admin podem ser amarelas juntas, com o bloco do admin separado (rótulo ADMIN e divisor); fora disso, a regra vale | Playwright |

**Tela: resenhas**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C35 | grupo com resenhas | rolar o Feed | seção "RESENHAS"; cada resenha é um card de grande momento (contorno de 3 px, sombra dura, entrada em degraus nos 3 primeiros): rosto e apelido do autor, selo ADMIN, quando ("HOJE, 21H" / "SÁB, 17 OUT"), título em pixel, texto corrido em Chakra Petch com as quebras de linha, "editada" quando foi | Playwright |
| C36 | resenha | tocar numa reação | o contador sobe com o dígito "batendo"; a minha fica com contorno grosso e ✓; tocar em outra troca; tocar na mesma tira. Cada botão tem ícone pixel (desenho próprio; o OSS! é mais largo), sem nome visível (volta de design 5, 17/11: só o ícone + o contador, com o ✓ da minha ao lado do contador, nunca sobre o ícone); o nome (Bola, Bagre, OSS!, Cartão amarelo, Pipocou) fica no `title` e no nome para leitor de tela ("Bagre, 3 reações, a sua"); em 320 px os 5 botões cabem numa linha com ≥ 44 px cada | Playwright |
| C37 | resenha com 3 comentários | tocar em "COMENTÁRIOS · 3" | abre embaixo do card: rosto, apelido, quando e texto de cada um; campo "Escreva um comentário" com contador e "Enviar" | Playwright |
| C38 | comentando | enviar | o comentário entra no fim, o campo limpa e o contador do card sobe; vazio não envia; 281 caracteres mostra o erro do shared | Playwright |
| C39 | meu comentário (ou qualquer um, como admin) | lixeira (44 × 44) → gaveta "Apagar comentário?" | some da lista com aviso | Playwright |
| C40 | admin | "Nova resenha" | `/resenhas/nova`: título (opcional, contador de 60), texto (contador de 1000) e a tecla amarela "Publicar"; publicada, volta ao Feed com a resenha no topo e o aviso "Resenha publicada" | Playwright |
| C41 | admin escrevendo | sair com texto digitado | gaveta "Sair sem publicar?"; Voltar mantém o texto | Playwright |
| C42 | admin | "⋯" da resenha → Editar | `/resenhas/:postId/editar` com os campos preenchidos; Salvar volta ao Feed com "editada" | Playwright |
| C43 | admin | "⋯" → Apagar | gaveta de perigo "Apagar a resenha?" ("Reações e comentários vão junto."); confirmada, some | Playwright |
| C44 | admin | "⋯" → Compartilhar no WhatsApp | abre `https://wa.me/?text=` com o título, o texto e o link do app | Playwright |
| C45 | jogador comum | olhar a resenha e abrir `/resenhas/nova` pela URL | sem "⋯" e sem "Nova resenha"; a URL volta para o Feed | Playwright |
| C46 | mais de 10 resenhas | "Carregar mais" | entram as próximas, sem pular a rolagem | Playwright |
| C47 | grupo sem resenha | olhar | "Nenhuma resenha ainda" e, para o admin, "Conte como foi a última pelada." com a tecla | Playwright |
| C48 | texto com 1000 caracteres sem espaço e apelido de 10 letras | olhar o card | o texto quebra dentro do card (sem estourar a largura) | Playwright |
| C49 | reduzir movimento | abrir | cards com fade; contador sem bater | Playwright (`emulateMedia`) |
| C50 | carregando; erro nos avisos; erro nas resenhas | abrir | esqueleto; cada bloco com o próprio erro e "Tentar de novo" (um não derruba o outro). Console sem erros no fluxo real | Playwright |
| C51 | larguras 320, 375, 390, 430 px e desktop | Feed (aviso grande de cada tipo, linhas, resenha com comentários abertos), nova resenha | sem rolagem horizontal, sem sobreposição, sem texto cortado; os 5 botões de reação (só ícone + contador, sem nome visível) cabem numa linha em 320 px com ≥ 44 px cada, nada sobreposto (o ✓ não cobre o ícone do OSS!); no desktop, coluna centralizada. Checagem automática passa | Playwright |

## Técnico

### Contrato
Schemas em `packages/shared/src/feed.ts` (arquivo novo, exportado no `index.ts`). Primeiro commit da branch `-back`,
com `packages/domain/src/feed`.

| Método | Rota (sob `/api/groups/:groupId`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/feed/alerts` | membro | — | `FeedAlert[]` | 404 |
| `GET` | `/posts` | membro | query `PostsQuery` | `PostList` | 400; 404 |
| `GET` | `/posts/:postId` | membro | — | `Post` | 404 |
| `POST` | `/posts` | admin | `PostInput` | `Post` (201) | 400; 403; 404 |
| `PATCH` | `/posts/:postId` | admin | `PostInput` | `Post` | 400; 403; 404 |
| `DELETE` | `/posts/:postId` | admin | — | 204 | 403; 404 |
| `PUT` | `/posts/:postId/reaction` | membro | `ReactionInput` | `Post` | 400; 404 |
| `DELETE` | `/posts/:postId/reaction` | membro | — | `Post` | 404 |
| `GET` | `/posts/:postId/comments` | membro | — | `Comment[]` | 404 |
| `POST` | `/posts/:postId/comments` | membro | `CommentInput` | `Comment` (201) | 400; 404 |
| `DELETE` | `/posts/:postId/comments/:commentId` | autor ou admin | — | 204 | 403 `NOT_OWN_COMMENT`; 404 |

`GET /posts/:postId` serve a tela de editar aberta direto pela URL; dá 404 para resenha de outro grupo, inexistente,
não membro ou membro inativo (mesmas regras de C23 e C24).

**Limites e tipos saem do shared.** `packages/shared/src/feed.ts` reexporta do domain `POST_TITLE_MAX_LENGTH`,
`POST_BODY_MAX_LENGTH`, `COMMENT_MAX_LENGTH`, `FEED_ALERT_TYPES` e `POST_REACTIONS` (valores) e os tipos
`FeedAlertType` e `PostReaction`. O front importa de `@fut-stats/shared` (contadores, ordem dos botões) e não copia
número.

```ts
// packages/shared/src/feed.ts
export const feedAlertTypeSchema = z.enum(FEED_ALERT_TYPES);
export const FEED_ALERT_LABELS: Record<FeedAlertType, string>;
// IN_PROGRESS 'Em jogo', POST_MATCH 'Hora da Resenha', RESULT 'O resultado saiu', VOTING 'Votação aberta',
// TEAMS_PUBLISHED 'Times publicados', PRESENCE 'Presença aberta'

export const feedAlertSchema = z.object({
  type: feedAlertTypeSchema,
  roundId: z.string(),
  roundNumber: z.number().int(),
  scheduledAt: z.iso.datetime(),
  /** O que quem pede tem a ver com o aviso; cada campo só vem no tipo em que faz sentido. */
  me: z.object({
    attendance: z.boolean().nullable().optional(),  // PRESENCE: true vou, false não vou, null não respondi
    team: teamSchema.nullable().optional(),          // TEAMS_PUBLISHED, IN_PROGRESS, POST_MATCH: null = não escalado
    played: z.boolean().optional(),                  // VOTING
    voted: z.boolean().optional(),                   // VOTING
  }),
});

export const postReactionSchema = z.enum(POST_REACTIONS);       // 'BALL' | 'CATFISH' | 'OSS' | 'YELLOW_CARD' | 'POPCORN'
export const POST_REACTION_LABELS: Record<PostReaction, string>; // Bola, Bagre, OSS!, Cartão amarelo, Pipocou
export const POST_INPUT_ERROR_LABELS: Record<PostInputError, string>;
export const COMMENT_ERROR_LABELS: Record<TextFieldError, string>;
export const NOT_OWN_COMMENT_LABEL = 'Você só apaga o seu próprio comentário';

export const postInputSchema = z.object({
  title: z.string().trim().normalize('NFC').transform((v) => v || null).nullable().optional(),
  body: z.string().trim().normalize('NFC'),
}); // + superRefine com validatePostInput (mensagens de POST_INPUT_ERROR_LABELS)
export const reactionInputSchema = z.object({ reaction: postReactionSchema });
export const commentInputSchema = z.object({ text: z.string().trim().normalize('NFC') }); // + validateCommentText

export const POSTS_PAGE_DEFAULT = 10;
export const POSTS_PAGE_MAX = 30;
export const postsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(POSTS_PAGE_MAX).default(POSTS_PAGE_DEFAULT),
  cursor: z.string().min(1).optional(),
});

export const authorSchema = z.object({ membershipId: z.string(), nickname: z.string(), avatar: avatarSchema, role: roleSchema });

export const postSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  author: authorSchema,
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  reactions: z.record(postReactionSchema, z.number().int()),  // sempre as 5 chaves
  myReaction: postReactionSchema.nullable(),
  commentCount: z.number().int(),
  canManage: z.boolean(),      // admin
});
export const postListSchema = z.object({ items: z.array(postSchema), nextCursor: z.string().nullable() });

export const commentSchema = z.object({
  id: z.string(), author: authorSchema, text: z.string(), createdAt: z.iso.datetime(),
  canDelete: z.boolean(),      // autor ou admin
});
// tipos: FeedAlert, PostInput, ReactionInput, CommentInput, PostsQuery, Post, PostList, Comment
```

### Banco (`schema.prisma`)
Três models novos e um enum:
- **`Post`**: `id`, `groupId` (→ `Group`), `authorId` (→ `Membership`), `title String?`, `body String`,
  `createdAt`, `updatedAt`, `editedAt DateTime?`; `@@index([groupId, createdAt])`.
- **`PostReaction`**: `postId` (→ `Post`, `onDelete: Cascade`), `membershipId` (→ `Membership`),
  `reaction PostReactionType`, `createdAt`; `@@id([postId, membershipId])` (uma por pessoa por resenha).
- **`PostComment`**: `id`, `postId` (→ `Post`, `onDelete: Cascade`), `membershipId` (→ `Membership`), `text String`,
  `createdAt`; `@@index([postId, createdAt])`.
- Enum `PostReactionType`, igual a `POST_REACTIONS` do domain.

**`Group`** e **`Membership`** ganham só as relações. Uma migration (`feed`).

### Domínio
`packages/domain/src/feed/` (pasta nova, exportada no `index.ts`):
- `alerts.ts`: `FEED_ALERT_TYPES` (na ordem de prioridade) e
  `feedAlerts(rounds: readonly { id: string; status: RoundStatus; scheduledAt: Date; closedAt: Date | null }[], now: Date): { type: FeedAlertType; roundId: string }[]`,
  compondo `pickCurrentRound`, `pickVotingRound` e `pickLatestResult`.
- `posts.ts`: `POST_TITLE_MAX_LENGTH = 60`, `POST_BODY_MAX_LENGTH = 1000`, `COMMENT_MAX_LENGTH = 280`;
  `POST_INPUT_ERRORS = ['TITLE_TOO_LONG', 'BODY_EMPTY', 'BODY_TOO_LONG', 'INVALID_CHARACTERS']`;
  `validatePostInput(input: { title: string | null; body: string }): PostInputError[]`;
  `validateCommentText(text: string): TextFieldError | null` (contagem por caractere visível, como o apelido;
  quebra de linha vale); `POST_REACTIONS`; `canManagePost(actor: RoundActor): boolean`;
  `canDeleteComment(actor: RoundActor, authorId: string): boolean`.
- `CONTEXT.md`: entrada nova "Feed: avisos e resenhas".

Na API (`apps/api/src/feed`): `FeedController` (avisos), `PostsController`, `FeedService`, `PostsService`. A
reação é um `upsert` na chave `(postId, membershipId)`. Contagens de reação com `groupBy`; a lista de resenhas
resolve reações, a minha e o número de comentários em consultas por página (sem N+1). Comentários: no máximo os 200
mais recentes.

### Tela
Regras de visual do documento de autonomia valem como critério. Peças da folha: "Feed e ranking" (Aviso/Resultado,
Aviso/Votação, Aviso/Presença) e "Avisos e estados".
- **Feed** (`pages/feed/feed-page.tsx` entra no lugar de `pages/rounds/home.tsx` na rota `/`): título "Feed";
  bloco de avisos; atalho de contorno "Todas as rodadas"; seção de resenhas.
  - **Aviso grande** (`features/feed/alert-card.tsx`): escolhe o card pelo tipo e reusa os que já existem
    (`GameCard`, card de votação e de resultado de `votacao`/`pacote-do-craque`, card da presença do início de
    hoje). Novo: o card de times publicados, no padrão `moment-frame` com a `you-banner`.
  - **Linha de aviso** (`features/feed/alert-line.tsx`): 56 px, ícone do tipo + título em pixel + situação curta
    + seta; contorno neutro de 2 px e faixa à esquerda na cor do tipo (volta de design 1). O texto de cada
    situação sai de uma função pura com teste (`alert-text.ts`).
  - **Cores de identidade (volta de design 1, 16/11, decisão do dono; vale no lugar da votação neutra):** jogo
    vermelho com o selo AO VIVO piscando em degraus, Resenha laranja, resultado ouro, votação prata
    (`--color-silver`, com a urna e a faixa listrada), times em branco e preto com o corte diagonal, presença verde. A cor vai na moldura, na faixa
    do cabeçalho e no ícone (na linha, faixa à esquerda e ícone); **o aviso grande sempre tem a tecla amarela e a
    cor de identidade nunca vai nela** (exceção: a presença, abaixo). Sempre com ícone e o tipo por escrito. Detalhe em `docs/design/DESIGN.md`.
  - **Volta de design 5 (17/11, decisão do dono): exceção da presença.** No aviso grande da presença, CONFIRMAR e
    AUSÊNCIA usam o mesmo visual e os mesmos estados do detalhe da rodada (`PresenceChoice` sem tecla amarela):
    verde para confirmar, vermelho na ausência, e nada amarelo aceso em estado nenhum. O dono: "Sei que vai contra o
    amarelo para ação, mas ficou meio estranho, sem contar que quando seleciona o Ausência, o amarelo ainda fica
    aceso." O aviso de presença é o único aviso grande sem tecla amarela.
  - **Volta de design 3 (16/11, decisão do dono):** o azul da votação foi retirado (`--color-vote` não existe mais) por
    ficar disruptivo; vale o **prata** (`--color-silver`) com a urna e uma faixa de cabeçalho listrada, para não
    parecer o prata do pódio. **Fechado em 17/11:** fica o prata (opção A, a do código); a opção B, o verde-luz do
    refletor (`#d6fabe`), foi descartada e os prints dela saíram de `design-2/opcoes/` (fica só o da A). A 4ª reação é o **cartão amarelo**, único ícone com o amarelo
    (ícone, não tecla); o OSS! ganhou letras retas na mesma linha de base. O "Encerrar votação" do admin é a tecla
    amarela (a gaveta de confirmação continua), e a exceção ao C34 está na linha do C34.
  - **Feedback do dono (15/11):** os cards do início ficaram "bem simples as letras e em cores diferentes". Cada
    card é grande momento (contorno grosso, sombra dura, entrada animada, tipografia com hierarquia: rótulo pequeno,
    título grande em pixel com sombra, texto corrido). **Ouro é recompensa; o amarelo fica só na tecla de ação;
    nunca os dois competindo no mesmo card.** (Exceção autorizada pelo dono: o ícone da reação cartão amarelo é
    amarelo; é ícone, não tecla.) Um aviso grande por vez. Rostos sempre com o bonequinho
    (`MemberAvatar`).
  - Peso inicial: o Feed é um pedaço `lazy` (`pages/feed/feed-area.ts`, que substitui `pages/rounds/home` no
    `app/preload.ts`); import de valor de `@fut-stats/shared` só dentro dele, nunca em `app/`, `components/ui` ou
    `features/session` (JS inicial de 118,4 kB, polimento-v1).
  - A lista "Quem vai" sai do início e fica no detalhe da rodada; o card da presença ganha a fileira de rostos.
  - A consulta dos avisos usa uma chave **sob a da lista de rodadas** (`[...roundsKey(groupId), 'alerts']`): tudo
    que já invalida a lista de rodadas (mudança de etapa, e o tempo real de `jogo-ao-vivo`) atualiza os avisos sem
    código a mais.
- **Resenha** (`features/feed/post-card.tsx`): referência = o card de grande momento do início e a lista de
  presença para a linha do autor. Reações: 5 ícones pixel novos (12 × 12) em `pixel-sprite-maps.ts`. Comentários
  abrem no lugar (sem gaveta), carregados na primeira abertura. Atualização otimista na reação, com volta em caso
  de erro.
- **Escrever** (`pages/feed/post-form-page.tsx`, rotas `resenhas/nova` e `resenhas/:postId/editar`): referência =
  o formulário da rodada (`pages/rounds/form.tsx`). Campo de texto novo de várias linhas no padrão do
  `TextField` (foco, erro, contador).
- Data relativa numa função pura com teste (`post-when.ts`): hoje, ontem, e a data no formato do app. Nenhum dia
  da semana fixo em texto escrito à mão.
- Menu "⋯" e gavetas no padrão atual (180 ms / ~100 ms). Rotas novas com `lazy`. Nada de regra no front:
  `canManage` e `canDelete` vêm da API; os limites de texto vêm do shared. Sem dependência nova.

**Álbum** (`docs/design/prints/feed/`): um print por cenário de tela (C27–C50) a 390 px; `feed-320`,
`resenha-comentarios-320`, `nova-resenha-320` e os mesmos em `-desktop`.

### Decisões
- Avisos calculados, não gravados — o estado das rodadas já diz tudo; nada para sincronizar nem limpar.
- Prioridade completa com o jogo ao vivo na frente — a folha só ordena resultado, votação e presença; quem abre o
  app com a bola rolando quer o jogo.
- Uma rota de avisos com o `me` de cada tipo — as linhas não precisam carregar a tela inteira de cada rodada.
- Uma reação por pessoa, com 5 ícones pixel próprios — simples de entender e com a cara do app; emoji do sistema
  quebra a estética pixel.
- Reações sem o nome visível embaixo do ícone (volta de design 5, 17/11, decisão do dono: "agora que os emojis
  ficaram bem claros, pode tirar os nomes deles e deixar só o emoji mesmo") — o botão fica só com o ícone pixel e o
  contador; o nome segue no `title` e no leitor de tela. O ✓ da minha reação fica ao lado do contador (c1dfcb3).
- Cor da votação fechada no prata com a faixa listrada (17/11) — o verde-luz do refletor foi descartado.
- CONFIRMAR da presença no Feed volta ao verde (17/11) — a tecla amarela ali destoava do detalhe da rodada e ficava
  acesa mesmo com a Ausência escolhida; a presença é a exceção à tecla amarela do aviso grande.
- Comentários abrem no card — conversa curta não pede outra tela.
- "Quem vai" sai do início — o Feed precisa de espaço para avisos e resenhas; a lista completa continua a um toque.
- Qualquer admin edita e apaga qualquer resenha — os admins são a "redação" do grupo.

### Cruzamento com `auditoria-da-rodada` (onda 5)
As duas mexem em `schema.prisma`, `apps/api/src/app.module.ts` e `packages/shared/src/index.ts`. A auditoria entra
primeiro (model `RoundLog`, dona do schema nesta onda). O feed faz a sua migration normalmente; quando a auditoria
entrar, rebase, junta o `schema.prisma` mantendo os dois e confere que `prisma migrate dev` não acusa drift (se
acusar, recria a migration do feed por cima). O feed não escreve em placar, etapa ou lance.

## Fora do escopo
- Imagem e vídeo na resenha (decisão do dono, P6); link clicável e menção no texto.
- Responder comentário, editar comentário, reagir a comentário.
- Resenha gerada sozinha a partir do resultado da rodada.
- Push de resenha nova (`pwa-e-push` decide quais avisos viram push).
- Tempo real nas reações e comentários (atualiza ao voltar para a aba e ao recarregar).

## Perguntas respondidas pelo dono
- Feed: um aviso grande por vez, na ordem resultado > votação > presença; os outros em linha (22 out 2026).
- P6 · Resenha com imagem na v1? → Não: só texto; imagem fica para a v1.1 (14 nov 2026).

## QA
**Veredito: APROVADO na volta 2** (16 nov 2026). Volta 1 (relançada do zero na retomada) reprovou por 2 critérios de
front; os 51 cenários já funcionavam.

| Volta | Falha | Correção |
|---|---|---|
| 1 | JS inicial 118,6 kB > 118,4 kB da base (3 rotas lazy novas, cada uma com lista de deps no pedaço inicial) | `loadFeedArea` único, `resenhas/*` resolvida dentro do pedaço do Feed (`postScreen`), preload percorre `router.routes`: 118,4 kB (118.437 bytes gzip) |
| 1 | Ouro (rótulo e traço) colado à tecla amarela no `ResultAlert` | rótulo e traço neutros; ouro só no pacote |
| 1 (obs.) | Sem aviso grande, o admin perdia "Nenhuma rodada marcada"/"Criar rodada" | decisão do TPL: sem aviso grande (nada, ou só resultados abertos) vale o estado de C32, com as linhas abaixo |

Tabela final (volta 2 sobre a volta 1):

| Id | Resultado |
|---|---|
| C1–C26 (domínio, API, seed) | OK — testes com o id no nome; domain 491, shared 4, api 513 verdes |
| C27, C28 | OK — um card grande, ouro só no pacote; aberto, a votação sobe com "Dar minhas notas" |
| C29–C31, C33 | OK |
| C32 | OK — admin com "Criar rodada", jogador sem tecla, linhas abaixo |
| C34 | OK — no máximo 1 tecla amarela em todos os estados |
| C35–C50 | OK |
| C51 | OK — checagem automática verde em 320/375/390/430/1280 |
| Visual do dono (15/11) | OK |
| Peso inicial | OK — 118,4 kB, sem import de valor do shared no caminho inicial |
| Pronto na raiz | OK — lint, typecheck, test (web 569), build |

Observações para o dono: no C32 admin, a linha RESULTADO (borda ouro) fica logo abaixo da tecla amarela "Criar
rodada" (elementos separados); o JS inicial está no limite do arredondamento (sem folga para o próximo pedaço).
