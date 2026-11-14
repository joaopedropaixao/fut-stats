# `perfil-jogador`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.
> Dúvidas respondidas pelo dono em lote: `docs/specs/perguntas-v1.md`.

| | |
|---|---|
| **Fatia** | `perfil-jogador` (onda 1) |
| **Modo** | Par |
| **Parte de** | — |
| **Status** | aprovado em 2026-11-14 |
| **Base** | develop @ec7b977 |
| **Depende de** | — |
| **Toca em** | apps/api/prisma/schema.prisma, packages/domain/src/group, packages/shared/src/group.ts, packages/shared/src/auth.ts, packages/shared/src/round.ts, packages/shared/src/match.ts, apps/api/src/groups, apps/api/src/auth, apps/api/src/rounds, apps/api/src/lineups, apps/api/src/match, apps/api/src/seed, apps/web/src/components/ui/avatar.tsx, apps/web/src/components/ui/pixel-sprite, apps/web/src/features/group, apps/web/src/features/lineup, apps/web/src/features/match, apps/web/src/features/rounds, apps/web/src/pages/entrar-e-grupo, apps/web/src/pages/perfil, apps/web/src/pages/elenco, apps/web/src/router.tsx |

## Produto

### Objetivo
Ao escolher o apelido, o jogador monta o seu **bonequinho pixel** (cor da pele e cabelo). Esse bonequinho vira o
rosto dele em todo lugar: listas, campo, banco, VS, faixa "VOCÊ" e card de resultado. Depois ele edita o próprio
perfil quando quiser, e o admin cuida do elenco: nota inicial, goleiro contratado, admin e ativo/inativo.
**Fecha a Fase 1.**

### Quem usa
- **Jogador:** monta o bonequinho ao entrar (criar pelada ou convite) e edita o próprio perfil: apelido, bonequinho,
  posição principal e secundárias.
- **Admin:** tudo do jogador, e no **Elenco** edita qualquer membro: os campos do perfil mais nota inicial, goleiro
  contratado, papel (admin ou jogador) e ativo/inativo. Não muda o próprio papel nem se desativa.
- **Usuário de outro grupo, ou membro inativo:** 404 em tudo.

### Regras de domínio
- Apelido com até 10 letras, validado por `validateNickname`
  ([CONTEXT.md › Grupo, convite e entrada](../../CONTEXT.md#grupo-convite-e-entrada-toslug--validatenickname--validatejoingroup--comparenicknames--default_initial_rating-)).
- **Apelido único no grupo**: entre os membros **ativos**, dois apelidos iguais não passam. Igual =
  `compareNicknames(a, b) === 0` (ignora maiúscula e acento). Vale para criar, entrar pelo convite, editar e
  reativar. Texto da folha (Campo/Erro): "Esse apelido já está em uso no grupo."
- **Bonequinho**: três escolhas, cada uma de uma lista fechada no domain:
  - pele (`AVATAR_SKINS`): 5 tons, do mais claro ao mais escuro;
  - cabelo (`AVATAR_HAIRS`): careca, curto, cacheado, black power, comprido e moicano;
  - cor do cabelo (`AVATAR_HAIR_COLORS`): preto, castanho, loiro, ruivo e grisalho. Careca ignora a cor.
  Todo membro tem bonequinho: quem já existe ganha o padrão (`DEFAULT_AVATAR`) e troca no perfil.
- **O bonequinho é da participação** (`Membership`), como o apelido: é o jogador **naquela pelada**.
- **Posições**: a principal é uma das 5. As secundárias são no máximo 2 (`MAX_SECONDARY_POSITIONS`), sem
  repetir, diferentes da principal e nunca `GOALKEEPER`; quem tem `GOALKEEPER` como principal não tem secundária
  (o seletor não põe goleiro na linha nem jogador de linha no gol:
  [CONTEXT.md › Seletor de times](../../CONTEXT.md#seletor-de-times-balanceteams-)).
- **Nota inicial:** de 0 a 10, de 0,5 em 0,5 (`validateRating`), só o admin muda. Padrão 6 (decisão fixa).
- **Admins**: o grupo pode ter mais de um admin. Um admin **não muda o próprio papel nem se desativa**
  (`SELF_CHANGE`): assim sempre sobra pelo menos um admin ativo.
- **Remover = desativar.** A participação nunca é apagada (decisão fixa: o histórico aponta para ela). O inativo
  some das listas, perde o acesso (404) e não volta pelo convite; quem reativa é o admin, no Elenco.
- **Foto**: fica de fora. O bonequinho é o rosto; `photoUrl` segue no banco e nos contratos, sem uso.

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | as três listas do bonequinho | `isPlayerAvatar` com valores da lista / com `'GREEN'` / sem um campo | `true` / `false` / `false` | unitário |
| C2 | `DEFAULT_AVATAR` | conferir | está nas três listas (`isPlayerAvatar` = `true`) | unitário |
| C3 | principal `DEFENDER`, secundárias `[]`, `['WINGER']`, `['WINGER','MIDFIELDER']` | `validatePlayerPositions` | `[]` nos três | unitário |
| C4 | secundária igual à principal; repetida; `GOALKEEPER` como secundária; 3 secundárias | `validatePlayerPositions` | `SECONDARY_IS_PRIMARY`; `DUPLICATE_SECONDARY`; `GOALKEEPER_AS_SECONDARY`; `TOO_MANY_SECONDARIES`. Vários problemas vêm todos na lista | unitário |
| C5 | principal `GOALKEEPER` com uma secundária | `validatePlayerPositions` | `['GOALKEEPER_HAS_SECONDARY']` | unitário |
| C6 | apelidos do grupo `['Zé', 'Beto']` | `isNicknameTaken('ze', ...)`; `'ZÉ '`; `'Zeca'` | `true`; `true`; `false` | unitário |
| C7 | admin mudando o papel ou o ativo de outro membro | `validateMemberAdminChange` | `[]` | unitário |
| C8 | admin mudando o próprio papel ou o próprio ativo | `validateMemberAdminChange` | `['SELF_CHANGE']`; mudar a própria nota inicial ou goleiro contratado: `[]` | unitário |

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C9 | usuário logado sem grupo | `POST /groups` com `avatar` | 201; `GET /me` traz o grupo com `nickname` e `avatar` iguais aos enviados | integração |
| C10 | convite válido | `POST /invites/:code/join` sem `avatar` | 201 com o `DEFAULT_AVATAR` (clientes antigos não quebram) | integração |
| C11 | grupo com o apelido "Beto" ativo | `join` nesse grupo com "beto" | 409 `NICKNAME_TAKEN` com o texto do shared; nada criado. Em outro grupo, "Beto" passa | integração |
| C12 | dois `join` ao mesmo tempo com o mesmo apelido (`Promise.all`) | — | um 201 e um 409 `NICKNAME_TAKEN` (checagem e gravação na mesma transação, com a linha do grupo travada) | integração |
| C13 | membro ativo | `PATCH /groups/:groupId/members/:id` (o próprio) com apelido, `avatar`, principal e secundárias | 200 `Member` atualizado; `GET .../members` e o detalhe da rodada já mostram o novo | integração |
| C14 | membro ativo | `PATCH` do próprio com apelido de outro ativo; com o **próprio** apelido mudando só maiúscula | 409 `NICKNAME_TAKEN`; 200 | integração |
| C15 | membro ativo | `PATCH` com posições inválidas (cada caso de C4 e C5) | 400 de validação com o texto do shared | integração |
| C16 | jogador comum | `PATCH` de **outro** membro | 403 `NOT_OWN_PROFILE`; nada muda | integração |
| C17 | jogador comum | `PATCH` do próprio com `initialRating`, `isHiredGoalkeeper`, `role` ou `active` | 403 `NOT_ADMIN`; nada muda (nem os campos permitidos do mesmo pedido) | integração |
| C18 | admin | `PATCH` de outro membro com `initialRating: 7.5`, `isHiredGoalkeeper: true` | 200; a lista de presença da rodada mostra nota 7,5 e o ranking recalculado | integração |
| C19 | admin | `PATCH` com `initialRating: 7.3` ou `11` | 400 | integração |
| C20 | admin | `PATCH` de outro com `role: 'ADMIN'`; depois o novo admin chama uma rota de admin | 200; a rota passa | integração |
| C21 | admin | `PATCH` do próprio com `role: 'PLAYER'` ou `active: false` | 409 `SELF_CHANGE`; nada muda | integração |
| C22 | admin | `PATCH` de outro com `active: false` | 200; o membro some de `GET .../members`, leva 404 nas rotas do grupo e 409 `MEMBERSHIP_INACTIVE` no convite; segue no `GET .../roster` com `active: false` | integração |
| C23 | membro inativo com apelido que outro ativo pegou depois | admin `PATCH` com `active: true` | 409 `NICKNAME_TAKEN`; com `active: true` e apelido novo no mesmo pedido, 200 | integração |
| C24 | admin | `GET /groups/:groupId/roster` | todos os membros (ativos primeiro, cada bloco em ordem de `compareNicknames`), com `initialRating`, `active`, `role`, `isHiredGoalkeeper` e `avatar` | integração |
| C25 | jogador comum | `GET .../roster` | 403 | integração |
| C26 | membro | `GET .../members/:id` de um ativo; de um inativo (como jogador / como admin) | 200 `Member`; 404 / 200 | integração |
| C27 | usuário de outro grupo, não membro, membro inativo; `:id` de outro grupo | qualquer rota | 404; nada muda | integração |
| C28 | rodada com times e lances | `GET .../rounds/:id`, `.../lineup`, `.../match` | todo jogador vem com `avatar` (presença, escalados, `players` e `events` do jogo) | integração |
| C29 | seed | rodar | cada membro do seed tem um bonequinho variado e fixo (mesmo resultado em toda execução) | integração (`seed.spec.ts`) |

**Tela** (390 px; como jogador e como admin)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C30 | logado sem grupo, em `/comecar` (e em `/convite/:code`) | preenche o apelido | abaixo do apelido aparece o card **"Monte seu boneco"**: o bonequinho de corpo inteiro grande, com o apelido embaixo, e três fileiras de opções (Pele, Cabelo, Cor do cabelo). Já vem com o padrão selecionado | Playwright |
| C31 | montando | toca numa pele, num cabelo e numa cor | o bonequinho troca na hora, com um "pulinho" em degraus (≤ 250 ms); a opção escolhida ganha contorno grosso e ✓ (não só cor). "Careca" desabilita a fileira de cor, com o texto "Careca não tem cor" | Playwright |
| C32 | montando | toca em **"Sortear"** (dado pixel) | sai uma combinação aleatória, com o mesmo pulinho; dá para sortear de novo | Playwright |
| C33 | montou e escolheu a posição | "Criar pelada" / "Entrar na pelada" | entra no app; a aba Perfil mostra a **figurinha** com o bonequinho escolhido | Playwright |
| C34 | apelido já em uso (convite) | enviar | erro no campo do apelido com o texto do shared; o bonequinho montado não se perde | Playwright |
| C35 | aba Perfil (`/perfil`) | abrir | card de grande momento com a figurinha do jogador: bonequinho de corpo inteiro, apelido, posição por extenso, selo ADMIN se for, etiqueta **"VOCÊ"**; tecla "Editar perfil". Abaixo, o que já existe (peladas, convite, sair). Admin vê a tecla de contorno "Elenco" | Playwright |
| C36 | `/perfil/editar` | muda apelido, bonequinho, posição principal e marca até 2 secundárias; Salvar | volta ao Perfil com o aviso "Perfil salvo"; a figurinha e as listas mostram o novo | Playwright |
| C37 | `/perfil/editar` | marca a 3ª secundária; escolhe Goleiro como principal | a 3ª não marca e aparece "No máximo 2 posições secundárias"; com Goleiro, as secundárias somem com "Goleiro joga só no gol" | Playwright |
| C38 | admin em `/elenco` | abrir | lista "Ativos · n" (bonequinho, apelido, posição, selo Admin ou Jogador, "G" no contratado, nota em dígitos pixel, botão ⋯ de 44 × 44) e, se houver, "Inativos · n". A própria linha tem a etiqueta "VOCÊ" | Playwright |
| C39 | admin | ⋯ de um jogador → "Editar jogador" | `/elenco/:id`: os campos do perfil mais **Nota inicial** (− / + de 0,5, dígitos pixel que "batem"), interruptor **Goleiro contratado** e interruptor **Admin** (LIGADO/DESLIGADO com ✓ e ✕). Salvar volta à lista com aviso | Playwright |
| C40 | admin | ⋯ → "Tornar admin" (ou "Tirar admin") | o selo troca na hora, com aviso e Desfazer | Playwright |
| C41 | admin | ⋯ → "Remover jogador" | gaveta de perigo "Remover Zagueirão?" com "Ele sai do elenco e perde o acesso. O histórico dele fica. Dá para reativar depois."; Remover move a linha para Inativos | Playwright |
| C42 | admin, na seção Inativos | ⋯ → "Reativar" | volta para Ativos; se o apelido foi tomado, aviso com o texto do shared e link para editar | Playwright |
| C43 | admin, na própria linha | ⋯ | só "Editar jogador"; na edição, o interruptor Admin aparece travado com "Você não muda o próprio papel" | Playwright |
| C44 | jogador comum | abre `/elenco` ou `/elenco/:id` pela URL | vai para `/perfil` (a API já responde 403) | Playwright |
| C45 | times publicados (seed `times`) | aba Times | no **campo**, cada vaga mostra o rosto pixel do jogador dentro do anel do time; no banco e nas reservas também; a faixa "VOCÊ JOGA NO ..." usa o **meu** bonequinho | Playwright |
| C46 | times publicados, primeira vez | VS | os bonequinhos que entram são os dos titulares de cada time (pele e cabelo de cada um, camisa do time) | Playwright |
| C47 | admin montando os times | tela de montar e seletor | banco, campo e jogador "na mão" mostram os rostos; nada muda no toque (toca no jogador, depois na vaga) | Playwright |
| C48 | Resenha (seed `resenha`) | tela do jogo e card YOU WIN | linhas por jogador e lista de lances com os rostos; o bonequinho do card de resultado é o meu | Playwright |
| C49 | início e detalhe da rodada | listas de presença | rostos no lugar das iniciais | Playwright |
| C50 | reduzir movimento | montar o bonequinho | troca sem pulinho | Playwright (`emulateMedia`) |
| C51 | carregando, erro da API, membro não encontrado | Perfil, Editar, Elenco | esqueleto; erro com "Tentar de novo"; vazio de não encontrado. Console sem erros no fluxo real | Playwright |
| C52 | larguras 320, 375, 390, 430 px e desktop (1280) | `/comecar` com o card do boneco, `/perfil`, `/perfil/editar`, `/elenco`, `/elenco/:id`, aba Times | sem rolagem horizontal, sem texto ou botão por cima de outro, sem texto cortado; alvos ≥ 44 px; no desktop, coluna centralizada. Checagem automática de sobreposição do QA passa em todas | Playwright |

## Técnico

### Contrato
Schemas em `packages/shared/src/group.ts` (o resto é acréscimo de `avatar` nos arquivos citados). Primeiro commit da
branch `-back`, junto com as listas do domain que ele importa.

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `POST` | `/groups` | logado | `CreateGroupInput` (+ `avatar`) | `GroupResponse` | 400 |
| `POST` | `/invites/:code/join` | logado | `JoinGroupInput` (+ `avatar`) | `GroupResponse` | 400; 404; 409 `MEMBERSHIP_INACTIVE` / `NICKNAME_TAKEN` |
| `GET` | `/groups/:groupId/members` | membro | — | `Member[]` (+ `avatar`) | 404 |
| `GET` | `/groups/:groupId/members/:membershipId` | membro (inativo: só admin) | — | `Member` | 404 |
| `PATCH` | `/groups/:groupId/members/:membershipId` | o próprio ou admin | `UpdateMemberInput` | `RosterMember` (admin) ou `Member` (o próprio) | 400; 403 `NOT_OWN_PROFILE` / `NOT_ADMIN`; 404; 409 `NICKNAME_TAKEN` / `SELF_CHANGE` |
| `GET` | `/groups/:groupId/roster` | admin | — | `RosterMember[]` | 403; 404 |

Erro de regra vem como `{ code, message }`, com a `message` dos labels do shared. Permissão → 403; conflito de
dados → 409; validação de campo → 400.

```ts
// packages/domain/src/group/avatar.ts
export const AVATAR_SKINS = ['LIGHT', 'FAIR', 'TAN', 'BROWN', 'DARK'] as const;
export const AVATAR_HAIRS = ['BALD', 'SHORT', 'CURLY', 'AFRO', 'LONG', 'MOHAWK'] as const;
export const AVATAR_HAIR_COLORS = ['BLACK', 'BROWN', 'BLOND', 'RED', 'GRAY'] as const;
export interface PlayerAvatar { skin: AvatarSkin; hair: AvatarHair; hairColor: AvatarHairColor }
export const DEFAULT_AVATAR: PlayerAvatar = { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' };

// packages/shared/src/group.ts (acréscimos)
export const avatarSchema = z.object({
  skin: z.enum(AVATAR_SKINS), hair: z.enum(AVATAR_HAIRS), hairColor: z.enum(AVATAR_HAIR_COLORS),
});
export const AVATAR_SKIN_LABELS: Record<AvatarSkin, string>;           // 'Pele clara' ... 'Pele escura' (leitor de tela)
export const AVATAR_HAIR_LABELS: Record<AvatarHair, string>;           // Careca, Curto, Cacheado, Black power, Comprido, Moicano
export const AVATAR_HAIR_COLOR_LABELS: Record<AvatarHairColor, string>; // Preto, Castanho, Loiro, Ruivo, Grisalho
export const PLAYER_POSITIONS_ERROR_LABELS: Record<PlayerPositionsError, string>;
export const MEMBER_ADMIN_CHANGE_ERROR_LABELS: Record<MemberAdminChangeError, string>; // SELF_CHANGE: 'Você não muda o próprio papel nem se desativa'
export const NICKNAME_TAKEN_LABEL = 'Esse apelido já está em uso no grupo';
export const NOT_OWN_PROFILE_LABEL = 'Você só edita o seu próprio perfil';

const playerEntrySchema = z.object({
  nickname: nicknameSchema,
  primaryPosition: positionSchema,
  avatar: avatarSchema.default(DEFAULT_AVATAR),
});

export const memberSchema = z.object({ /* como hoje */, avatar: avatarSchema });

/** Linha do Elenco (admin): o membro mais o que só o admin vê. */
export const rosterMemberSchema = memberSchema.extend({
  initialRating: ratingSchema,
  active: z.boolean(),
});

/** Corpo do PATCH: só o que muda. Os 4 últimos campos são só do admin. */
export const updateMemberSchema = z
  .object({
    nickname: nicknameSchema,
    avatar: avatarSchema,
    primaryPosition: positionSchema,
    secondaryPositions: z.array(positionSchema),
    initialRating: ratingSchema,
    isHiredGoalkeeper: z.boolean(),
    role: roleSchema,
    active: z.boolean(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, { message: 'Informe o que mudar' });
// As posições são validadas no service com o estado final (o que veio + o que já estava), via
// validatePlayerPositions; erro vira 400 com PLAYER_POSITIONS_ERROR_LABELS.
// tipos: PlayerAvatar (re-export), RosterMember, UpdateMemberInput

// packages/shared/src/auth.ts
myGroupSchema = z.object({ /* como hoje */, nickname: z.string(), avatar: avatarSchema });

// packages/shared/src/round.ts → attendanceMemberSchema ganha `avatar: avatarSchema`
//   (lineupPlayerSchema herda)
// packages/shared/src/match.ts → matchPlayerSchema e matchEventSchema ganham `avatar: avatarSchema`
```

### Banco (`schema.prisma`)
Model **`Membership`** ganha três colunas, com enums novos iguais às listas do domain (`domain-enums.spec.ts`
passa a conferir os três):
- `avatarSkin AvatarSkin @default(TAN)`
- `avatarHair AvatarHair @default(SHORT)`
- `avatarHairColor AvatarHairColor @default(BLACK)`

Enums novos: `AvatarSkin`, `AvatarHair`, `AvatarHairColor`. Uma migration (`membership_avatar`); os membros que já
existem ficam com o padrão. Nenhum outro model muda.

### Domínio
Em `packages/domain/src/group/`:
- `avatar.ts`: as três listas, `PlayerAvatar`, `DEFAULT_AVATAR` e `isPlayerAvatar(value: unknown): value is PlayerAvatar`.
- `positions.ts`: `MAX_SECONDARY_POSITIONS = 2`; `PLAYER_POSITIONS_ERRORS = ['SECONDARY_IS_PRIMARY',
  'DUPLICATE_SECONDARY', 'GOALKEEPER_AS_SECONDARY', 'GOALKEEPER_HAS_SECONDARY', 'TOO_MANY_SECONDARIES']`;
  `validatePlayerPositions(primary: Position, secondaries: readonly Position[], options?: { maxSecondaries?: number }): PlayerPositionsError[]`
  (lista todos os problemas, sem repetir código).
- `members.ts`: `isNicknameTaken(nickname: string, others: readonly string[]): boolean` (com `compareNicknames`);
  `MEMBER_ADMIN_CHANGE_ERRORS = ['SELF_CHANGE']`;
  `validateMemberAdminChange(actorId: string, targetId: string, change: { role?: Role; active?: boolean }): MemberAdminChangeError[]`.
- Nada lança; textos no shared. Registrar no `CONTEXT.md` (seção "Grupo, convite e entrada" e uma entrada nova
  "Bonequinho: `PlayerAvatar`"), e atualizar "Não faz: editar perfil".

Na API (`apps/api/src/groups`): o `PATCH` confere nesta ordem: é o próprio ou admin (`NOT_OWN_PROFILE`); campos de
admin vindos de não admin (`NOT_ADMIN`); `validateMemberAdminChange`; posições; apelido único. Apelido único roda
numa transação que trava a linha do grupo (`SELECT 1 FROM "Group" WHERE id = $1 FOR UPDATE`), no `PATCH`, no `join`
e na reativação. Os services de `rounds`, `lineups`, `match` e `auth` passam a selecionar e devolver o `avatar`.
Seed: bonequinho por membro, escolhido por índice (determinístico).

### Tela
Regras de visual do documento de autonomia valem como critério (o QA confere uma a uma).

**Peças novas (`apps/web/src/components/ui/`):**
- **Sprite de corpo** (`pixel-sprite.tsx`, 8 × 12): o `PlayerSprite` ganha a prop `avatar`. Pele e cor do cabelo
  trocam a paleta (`s` e `h`); o estilo troca as linhas de cima do mapa (careca = pele no lugar do cabelo; black
  power e comprido podem usar uma linha a mais para cima ou para os lados, mantendo a escala inteira). Sem
  `avatar`, usa o `DEFAULT_AVATAR`. Camisa, calção e chuteira seguem o time.
- **Rosto** (`pixel-face.tsx`, grade 12 × 12, `shape-rendering: crispEdges`): cabeça e ombros, com olhos de 1 px,
  para caber no círculo do avatar. Os 6 cabelos têm que ser distinguíveis a 40 px. A camisa (ombros) usa a cor do
  time; sem time, o tom neutro de `--color-surface-3`.
- **Paleta:** tons de pele e de cabelo entram como tokens em `tokens.css` e no tema (`--color-skin-1..5`,
  `--color-hair-black|brown|blond|red|gray`), nunca hex solto no componente. Cada tom de pele tem contraste
  visível com os dois fundos de camisa e com o gramado; o cabelo preto sobre a pele mais escura ganha 1 px de
  contorno mais claro para não sumir.
- **`Avatar` e `MemberAvatar`** passam a receber `avatar` e desenham o rosto dentro do círculo, em escala inteira
  (32 → ×2, 40 → ×3, 56 → ×4), mantendo o anel do time, o selo "G" e o `aria-label` com o apelido. As iniciais
  saem (o apelido está sempre escrito ao lado). Todos os usos trocam: `pitch.tsx`, `bench.tsx`, `reserves.tsx`,
  `lineup-builder.tsx`, `player-lines.tsx`, `event-list.tsx`, `attendance-lists.tsx`, `home.tsx`.
- **`AvatarBuilder`** (`features/group/avatar-builder.tsx`): card de grande momento (`moment-frame`) com o
  bonequinho de corpo inteiro em escala 8 sobre um trecho de gramado com linha de giz, o apelido em pixel embaixo
  (mostra o que está digitado; vazio = "SEU APELIDO") e três fileiras de opções em grade, cada opção com 48 × 48:
  amostra de pele; cabeça em miniatura com o cabelo; amostra de cor. Selecionada = contorno de 3 px
  (`--color-border-strong`) + ✓ no canto. Fileiras são `radiogroup` nativos (setas trocam), com rótulo para leitor
  de tela dos labels do shared. Tecla de contorno **"Sortear"** com um dado pixel. Em 320 px as fileiras quebram em
  duas linhas, nunca rolam para o lado.

**Telas:**
- **Entrar** (`/comecar`, `/convite/:code`): o `usePlayerFields` ganha o `AvatarBuilder` entre o apelido e a
  posição. A tecla amarela continua sendo a única da tela.
- **Perfil** (`/perfil`, `pages/perfil/`; sai de `pages/entrar-e-grupo/profile-page.tsx`): no topo, a **figurinha**
  (folha: Figurinhas › Figurinha/Jogador) em `moment-frame`, com entrada em degraus: bonequinho em escala 6,
  apelido em pixel 24, posição por extenso, selos e a etiqueta "VOCÊ". Nome e email do Google ficam em texto
  pequeno abaixo. "Editar perfil" é tecla de contorno (a tela não tem ação amarela: o Sair não é principal).
- **Editar perfil** (`/perfil/editar`): apelido, `AvatarBuilder`, posição principal (`PositionPicker`) e
  secundárias (mesma peça em modo múltiplo, até 2, com selo "PRINCIPAL" na principal para não depender de cor).
  "Salvar" é a tecla amarela. Sair com mudança sem salvar abre a gaveta "Sair sem salvar?".
- **Elenco** (`/elenco`, `pages/elenco/`): referência = lista de presença de `rodadas` e a folha (Configurações e
  admin › Card/Elenco, Menu do jogador, Gaveta/Remover jogador). Linha de 72 px; a nota em dígitos pixel à direita,
  antes do ⋯. O menu ⋯ é o quadro flutuante da folha (contorno + sombra dura, `menu-in`).
- **Editar jogador** (`/elenco/:membershipId`): o formulário de Editar perfil mais o bloco "Só o admin": nota
  inicial (stepper da folha, Stepper/Menos e Stepper/Mais, com o dígito que "bate"), Goleiro contratado e Admin
  (interruptor da folha). "Salvar" amarela.
- **VS** (`vs-board.tsx`): recebe os titulares de cada time (com `avatar`) no lugar das contagens.
  **Faixa VOCÊ** (`you-banner.tsx`) e **card de resultado** (`result-card.tsx`) recebem o `avatar` de quem vê
  (de `useCurrentGroup`, que passa a expor `nickname` e `avatar` do `/me`).
- Gavetas: 180 ms para abrir e ~100 ms para fechar (o `Sheet` atual). Toque, nunca arrasto.
- Rotas novas entram com `lazy` (ver `orcamento-de-bundle`; se ela ainda não entrou, rota normal).
- Sem regra no front: o que o jogador pode editar vem do papel no `/me`; erros vêm da API com o texto do shared.
  Sem dependência nova.

**Álbum** (`docs/design/prints/perfil-jogador/`): um print por cenário de tela (C30–C51) a 390 px; `comecar-320`,
`perfil-320`, `editar-320`, `elenco-320`, `times-320` e os mesmos em `-desktop`.

### Decisões
- Três enums no banco, iguais ao domain — segue o padrão do projeto; opção nova de cabelo é uma migration pequena.
- Bonequinho com padrão para todo mundo, sem estado "não montou" — todo contrato devolve `avatar` sempre, e nenhuma
  tela precisa de plano B.
- Bonequinho na `Membership`, não no `User` — é o jogador naquela pelada, como o apelido.
- Rosto 12 × 12 separado do corpo 8 × 12 — a cabeça do corpo tem 4 px de largura e não mostra o cabelo; os dois
  desenhos saem das mesmas três escolhas.
- Um `PATCH` só para o próprio e para o admin — a permissão é por campo, e a tela do admin reaproveita o formulário.
- `SELF_CHANGE` em vez de contar admins — admin não mexe em si mesmo, então sempre sobra um.
- Apelido único só entre ativos, com trava no grupo — inativo não prende apelido; a trava evita dois iguais em
  pedidos simultâneos.
- `avatar` opcional no `join`/`create`, com padrão — a coleção do Bruno e os testes atuais seguem valendo.

## Fora do escopo
- Foto do jogador (upload e storage).
- Estatísticas na figurinha e perfil de outros jogadores (`ranking`).
- Sair do grupo por conta própria; apagar participação.
- Tema Noite nas configurações; configurações do grupo (nome, prazo da votação).
- Mais opções de bonequinho (barba, acessório, uniforme).

## Perguntas respondidas pelo dono
- Bonequinho no perfil? → Sim: ao escolher o apelido, com cor da pele e cabelo; é o rosto em todo lugar, inclusive
  no campo (14 nov 2026).
- P1 · Cabelo é estilo, cor ou os dois? → Os dois: 5 tons de pele, 6 cabelos e 5 cores de cabelo (14 nov 2026).
- P9 · Apelido único no grupo? → Sim: apelido igual não pode, entre os ativos, ignorando maiúscula e acento
  (confirmado, 14 nov 2026).
- P10 · Quem define as posições? → O jogador edita a principal e até 2 secundárias; o admin ajusta as de qualquer
  um (14 nov 2026).
- P11 · Mais de um admin? → Sim, com "Tornar admin"; um admin não muda o próprio papel nem se desativa
  (14 nov 2026).
- P13 · Foto fica de fora da v1? → Sim: o bonequinho é o rosto (14 nov 2026).

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
