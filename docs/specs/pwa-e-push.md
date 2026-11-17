# `pwa-e-push`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.
> Dúvidas respondidas pelo dono em lote: `docs/specs/perguntas-v1.md`.

| | |
|---|---|
| **Fatia** | `pwa-e-push` (onda 6) |
| **Modo** | Par |
| **Parte de** | — (o manifesto, os ícones e o service worker do `vite-plugin-pwa` já estão na `develop`) |
| **Status** | aprovado em 2026-11-14 |
| **Base** | develop @1c65574 (checkpoint de início em 17 nov 2026: entraram perfil-jogador #62, ajustes-tela-do-jogo #63, historico #64, votacao #66, ranking #67, rodizio-reservas #68, pacote-do-craque #69, polimento-v1 #72, feed #74 e auditoria-da-rodada #73) |
| **Depende de** | feed, votacao, perfil-jogador |
| **Toca em** | apps/api/prisma/schema.prisma, packages/domain/src/notifications, packages/domain/src/index.ts, packages/shared/src/push.ts, packages/shared/src/index.ts, apps/api/src/push, apps/api/src/events (só o cherry-pick do sinal da jogo-ao-vivo), apps/api/src/feed, packages/shared/src/feed.ts, apps/api/src/config/env.ts, apps/api/src/app.module.ts, apps/api/package.json, pnpm-lock.yaml, .env.example, render.yaml, apps/web/vite.config.ts, apps/web/public/push-sw.js, apps/web/src/features/pwa, apps/web/src/features/feed, apps/web/src/features/voting/result-alert.tsx, apps/web/src/pages/feed, apps/web/src/pages/perfil, apps/web/src/features/group/use-current-group.ts, apps/web/src/app/shell.tsx |

## Produto

### Objetivo
O jogador **instala** o Fut Stats na tela inicial do celular (com ícone, em tela cheia) e **recebe avisos** mesmo
com o app fechado: rodada marcada, times publicados, votação aberta e resultado. Tocar no aviso abre o app na tela
certa. É o que troca o "alguém avisa no WhatsApp" por um toque.

### Quem usa
- **Qualquer usuário logado:** instala o app, liga e desliga os avisos **naquele aparelho** e manda um aviso de
  teste para si.
- **Quem recebe cada aviso** depende do tipo (regras abaixo). Quem causou o aviso (o admin que publicou) não
  recebe o próprio.
- Sem sessão: 401 nas rotas de push.

### Regras de domínio
- **Avisos da v1** (`NOTIFICATION_TYPES`), todos disparados por uma ação que já existe:

| Tipo | Quando | Quem recebe | Texto | Abre |
|---|---|---|---|---|
| `ROUND_CREATED` | o admin cria a rodada | todos os ativos do grupo | "Rodada 13 marcada: sáb, 24 out, 9h. Confirme sua presença." | detalhe da rodada |
| `TEAMS_PUBLISHED` | o admin publica os times | os escalados (titulares e reservas) | "Os times da rodada 13 saíram. Veja em que time você joga." | aba Times |
| `VOTING_OPENED` | o admin abre a votação | quem jogou a rodada | "Votação aberta. Dê suas notas até sáb às 21h." | votar |
| `RESULT_OUT` | a votação fecha (admin, último voto ou prazo) | todos os ativos do grupo | "O resultado da rodada 13 saiu. Quem foi o craque?" | resultado (com o pacote) |

- O título do aviso é o **nome da pelada**. O texto do resultado **não diz quem foi o Craque**: o suspense é do
  pacote.
- Só recebe membro **ativo**. Quem causou a ação fica de fora. Sem destinatário, não envia nada.
- **Avisos são por aparelho.** Ligar num celular não liga no outro. Vale para todas as peladas do usuário (não há
  escolha por tipo nem por grupo na v1).
- **Nunca pedir permissão sem toque:** o navegador só pergunta depois que a pessoa toca em "Ativar avisos".
- **Sair da conta desliga os avisos daquele aparelho** (o próximo que entrar ali não recebe aviso de outro).
- Aviso é cortesia: falhar o envio nunca falha a ação (publicar, abrir votação). Assinatura que o serviço de push
  diz que não existe mais (404 ou 410) é apagada.
- Publicar de novo depois de despublicar avisa de novo; o aviso novo substitui o antigo na bandeja (mesma `tag`).
- Textos seguem as regras de palavras: data real da rodada, nunca um dia da semana fixo.

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | grupo com 20 ativos; admin A cria a rodada | `notificationRecipients('ROUND_CREATED', ...)` | os 19 outros ativos | unitário |
| C2 | 16 escalados (um deles é o admin que publicou) e 4 ativos fora | `'TEAMS_PUBLISHED'` | os 15 escalados que não são o admin | unitário |
| C3 | 16 jogaram, um foi desativado depois | `'VOTING_OPENED'` | os 15 ativos que jogaram, menos quem abriu (se jogou) | unitário |
| C4 | fechamento automático (sem ator); fechamento pelo admin | `'RESULT_OUT'` | todos os ativos; todos menos o admin | unitário |
| C5 | lista vazia de escalados | qualquer tipo | `[]` | unitário |

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C6 | chaves VAPID configuradas | `GET /push/config` | `{ enabled: true, publicKey }` | integração |
| C7 | sem chaves VAPID | `GET /push/config`; subir a API | `{ enabled: false, publicKey: null }`; a API sobe normalmente e nenhuma ação tenta enviar | integração |
| C8 | só duas das três variáveis VAPID | validar o ambiente | a API não sobe e diz qual falta (`env.spec.ts`) | integração |
| C9 | logado | `PUT /push/subscriptions` com `endpoint` e chaves | 204; uma linha ligada ao usuário | integração |
| C10 | o mesmo `endpoint` de novo; o mesmo `endpoint` por **outro** usuário | `PUT` | continua uma linha; passa a ser do outro usuário (o aparelho trocou de conta) | integração |
| C11 | corpo sem `keys`, `endpoint` que não é `https`, `endpoint` com mais de 2000 caracteres | `PUT` | 400 | integração |
| C12 | logado | `DELETE /push/subscriptions` com o `endpoint` dele; com o de outro usuário; com um que não existe | 204 e a linha some; 204 sem apagar a do outro; 204 | integração |
| C13 | sem sessão | qualquer rota de push | 401 | integração |
| C14 | admin cria a rodada; 3 membros com assinatura (um com 2 aparelhos), 1 inativo com assinatura | `POST .../rounds` | o enviador (trocado por um gravador no teste) recebe 4 envios: os aparelhos dos 3 ativos; título = nome da pelada; texto e `url` da tabela; nenhum para o inativo nem para o admin | integração |
| C15 | publicar os times; abrir a votação; encerrar a votação | as três rotas | cada uma dispara o tipo certo, para os destinatários da tabela, com a `url` certa (com `?grupo=<groupId>`) | integração |
| C16 | a votação fecha pelo relógio e pelo último voto | — | `RESULT_OUT` sai nos dois casos, uma vez só | integração |
| C17 | o enviador responde 410 para uma assinatura | qualquer aviso | aquela linha é apagada; as outras recebem; a ação responde 200 | integração |
| C18 | o enviador lança erro (rede) | publicar os times | a rota responde 200 no tempo normal; o erro vai para o log com o `requestId`; a assinatura fica | integração |
| C19 | ação recusada (409 ao publicar com times inválidos) | — | nenhum envio | integração |
| C20 | logado com assinatura | `POST /push/test` | `{ sent: 1 }` e um envio "Aviso de teste. Está funcionando."; sem assinatura, `{ sent: 0 }` | integração |
| C21 | conteúdo de cada tipo | `notificationContent(type, data)` (shared) | título, texto, `url` e `tag` da tabela; datas no formato do app | unitário |

**Tela: instalar** (390 px)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C22 | Chrome no Android, app não instalado (evento `beforeinstallprompt` simulado) | abrir o Perfil | card **"INSTALE O APP"** (grande momento, com o ícone do app em pixel): "Abre em tela cheia e avisa quando sair time e resultado." e a tecla "Instalar"; tocar chama o prompt do navegador | Playwright |
| C23 | iPhone no Safari, não instalado (user agent simulado) | "Instalar" | gaveta com os 2 passos ilustrados com ícones pixel: "1. Toque em Compartilhar" e "2. Adicionar à Tela de Início" | Playwright |
| C24 | app aberto instalado (`display-mode: standalone`) | abrir o Perfil | sem o card de instalar | Playwright |
| C25 | Feed, app não instalado | olhar os avisos | uma linha "INSTALE O APP" no fim da lista de avisos, com "✕" (44 × 44) para dispensar; dispensada, não volta por 14 dias | Playwright |

**Tela: avisos**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C26 | navegador com suporte, permissão ainda não pedida | abrir o Perfil | card **"AVISOS"** com o interruptor "Avisos neste celular" em DESLIGADO (✕) e o texto "Rodada marcada, times, votação e resultado." | Playwright |
| C27 | idem | liga o interruptor | só então o navegador pede a permissão; aceita → assina, chama `PUT /push/subscriptions`, o interruptor vira LIGADO (✓) e aparece "Testar aviso" | Playwright (permissão concedida e `pushManager` simulado) |
| C28 | avisos ligados | "Testar aviso" | chama `POST /push/test` e mostra "Aviso enviado. Deve chegar em instantes." | Playwright |
| C29 | avisos ligados | desliga o interruptor | cancela a assinatura no navegador, chama `DELETE` e volta a DESLIGADO | Playwright |
| C30 | a pessoa nega a permissão | — | o interruptor fica desligado com "Você bloqueou os avisos. Libere nas configurações do navegador." (sem pedir de novo) | Playwright |
| C31 | iPhone no Safari sem instalar | abrir o card | "No iPhone, os avisos só funcionam com o app instalado." e a tecla "Instalar" (C23) | Playwright |
| C32 | navegador sem suporte a push; API com push desligado | abrir o Perfil | "Este navegador não recebe avisos."; com o servidor desligado, o card não aparece | Playwright |
| C33 | Feed, com suporte, sem assinatura e permissão não pedida | olhar | linha de aviso "ATIVE OS AVISOS" com seta para o Perfil e "✕"; some depois de ativar ou de dispensar (14 dias) | Playwright |
| C34 | avisos ligados | "Sair da conta" | o aparelho cancela a assinatura (`DELETE`) antes do logout | Playwright |
| C35 | chega um aviso (evento `push` com o conteúdo de C21) | o service worker trata | mostra a notificação com título, texto, ícone do app, `tag` e a `url` nos dados | unitário (função do `push-sw.js`) |
| C36 | a pessoa toca na notificação | `notificationclick` | se o app está aberto, foca a janela e navega para a `url`; senão, abre a `url` | unitário (função do `push-sw.js`) |
| C37 | `url` com `?grupo=<id>` de outra pelada do usuário | abrir | o app troca a pelada atual para aquela e abre a tela; id de pelada que não é do usuário é ignorado | Playwright |
| C38 | build de produção | conferir o `dist` | o service worker gerado importa o `push-sw.js`; o app continua abrindo sem rede as telas já visitadas | checagem no build + Playwright |
| C39 | reduzir movimento; carregando; erro ao assinar | cards | sem animação; interruptor em carregando; "Não deu para ativar agora. Tente de novo." | Playwright |
| C40 | larguras 320, 375, 390, 430 px e desktop | Perfil com os dois cards, a gaveta do iPhone, o Feed com as duas linhas | sem rolagem horizontal, sem sobreposição, sem texto cortado; interruptor com área de 80 × 48; no desktop, coluna centralizada. Checagem automática passa. Console sem erros no fluxo real | Playwright |

**Pendência do `pacote-do-craque` (resposta do dono em 17 nov 2026: opção A)**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C41 | rodada fechada com votos (há Craque com nota); rodada fechada sem votos | `GET .../feed/alerts` | o aviso `RESULT` traz `hasPack: true`; o da rodada sem votos traz `hasPack: false`; os outros tipos não trazem o campo | integração |
| C42 | Feed com o aviso grande "O resultado saiu", com e sem pacote | abrir o Feed | com pacote: miniatura do pacote e "Abrir pacote"; sem: ícone e "Ver resultado"; **nenhum** `GET .../voting/result` na rede ao abrir o Feed | Playwright |

**Em aparelho real (o Playwright não recebe push de verdade):** o TPL deixa no PR um roteiro curto para o dono
conferir no staging depois do merge: instalar no Android e no iPhone, ligar os avisos, "Testar aviso" com o app
fechado, e tocar no aviso.

## Técnico

### Contrato
Schemas em `packages/shared/src/push.ts` (arquivo novo, exportado no `index.ts`). Primeiro commit da branch `-back`,
com `packages/domain/src/notifications`.

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/push/config` | logado | — | `PushConfig` | 401 |
| `PUT` | `/push/subscriptions` | logado | `PushSubscriptionInput` | 204 | 400; 401 |
| `DELETE` | `/push/subscriptions` | logado | `PushUnsubscribeInput` | 204 | 400; 401 |
| `POST` | `/push/test` | logado | — | `PushTestResult` | 401 |

**`GET .../feed/alerts` (aditivo):** o `feedAlertSchema` em `packages/shared/src/feed.ts` ganha
`hasPack: z.boolean().optional()`, que só vem no tipo `RESULT`: `true` se a rodada tem um Craque com nota
(`TeamPlayer.isMvp` com `roundScore` não nulo; mesma regra do `hasPack` de `features/pack/deck.ts`). O
`ResultAlert` do Feed passa a usar esse campo e deixa de chamar `GET .../voting/result` (pendência do
`pacote-do-craque`; saber na hora que o resultado saiu fica com o push `RESULT_OUT` com o app fechado e com a
`jogo-ao-vivo` com o app aberto). Mudança só aditiva: a `jogo-ao-vivo` pode mexer no Feed para recarregar avisos.

Nenhuma outra rota existente muda de forma: criar rodada, publicar, abrir e fechar a votação só ganham o envio depois de
gravar.

```ts
// packages/shared/src/push.ts
export const pushConfigSchema = z.object({ enabled: z.boolean(), publicKey: z.string().nullable() });

/** O que o navegador devolve em `PushSubscription.toJSON()`. */
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(200) }),
});
export const pushUnsubscribeSchema = z.object({ endpoint: z.string().min(1).max(2000) });
export const pushTestResultSchema = z.object({ sent: z.number().int() });

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/** O que vai dentro do push e o que o service worker mostra. */
export const pushPayloadSchema = z.object({
  type: notificationTypeSchema.or(z.literal('TEST')),
  title: z.string(),   // nome da pelada
  body: z.string(),
  url: z.string(),     // caminho no app, com ?grupo=<groupId>
  tag: z.string(),     // `${type}:${roundId}`: o novo substitui o antigo
});

/** Monta título, texto, url e tag de cada tipo. Fonte única dos textos. */
export function notificationContent(
  type: NotificationType,
  data: { groupId: string; groupName: string; roundId: string; roundNumber: number; scheduledAt: string; votingDeadline?: string },
): PushPayload;
// tipos: PushConfig, PushSubscriptionInput, PushUnsubscribeInput, PushTestResult, PushPayload
```

### Banco (`schema.prisma`)
Model novo **`PushSubscription`** (um aparelho de um usuário):
- `id String @id @default(cuid())`
- `userId String` (→ `User`, `onDelete: Cascade`)
- `endpoint String @unique`
- `p256dh String`, `auth String`
- `userAgent String?`
- `createdAt`, `updatedAt`
- `@@index([userId])`

**`User`** ganha só a relação. Uma migration (`push_subscription`).

### Domínio
`packages/domain/src/notifications/` (pasta nova, exportada no `index.ts`):
- `NOTIFICATION_TYPES = ['ROUND_CREATED', 'TEAMS_PUBLISHED', 'VOTING_OPENED', 'RESULT_OUT'] as const`.
- `notificationRecipients(type: NotificationType, context: { activeMemberIds: readonly string[]; lineupIds?: readonly string[]; actorId: string | null }): string[]`
  (`lineupIds` = escalados da rodada, usados em `TEAMS_PUBLISHED` e `VOTING_OPENED`; sem repetir; sem o ator).
- Não envia nada nem conhece aparelho: só diz quem recebe. Entrada nova no `CONTEXT.md` ("Avisos").

Na API (`apps/api/src/push`):
- `PushController` (as 4 rotas), `PushService` (assinaturas), `NotificationsService.notify(type, { groupId, roundId, actorId })`
  e a interface `PushSender` com a implementação `WebPushSender` (biblioteca `web-push`). Os testes de integração
  trocam o provider `PushSender` por um gravador (não é mock de banco: é a fronteira com o serviço de push de
  fora).
- **Sinal único de eventos da rodada** (decisão do dono, 17 nov 2026): a `pwa-e-push` **não** põe gancho nos
  services de `rounds`, `lineups`, `match` e `voting`. A `jogo-ao-vivo` (dona do sinal) cria o módulo
  `apps/api/src/events` (`RoundEventsService` sobre `EventEmitter`) e dispara, depois do commit, em todas as escritas
  (no mesmo lugar do `AuditService`), o evento `{ groupId, roundId, type, scopes, actorMembershipId | null }`,
  incluindo `ROUND_CREATED`. Esta fatia faz `git cherry-pick` desse commit (`feat(api): sinal único de eventos da
  rodada`; some no rebase final por ser o mesmo patch) e o `NotificationsService` vira **ouvinte**: rodada
  marcada → `ROUND_CREATED`; times publicados → `TEAMS_PUBLISHED` (despublicar não avisa); votação aberta →
  `VOTING_OPENED`; votação fechada (admin, último voto, prazo, relógio) → `RESULT_OUT`, uma vez por fechamento
  (C16). O ator vem do `actorMembershipId`. O envio não espera nem falha a escrita; erro vai para o log com o
  `requestId`. O push não grava no `AuditLog`.
- Variáveis novas, **as três ou nenhuma**, em `src/config/env.ts`, `.env.example` e `render.yaml` (`sync: false`):
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` do dono). Como gerar: `npx web-push
  generate-vapid-keys`, documentado em `docs/deploy.md`. Chave nunca em commit.
- **Dependência nova (justificar no PR):** `web-push` na API. Faz a assinatura VAPID e a criptografia do conteúdo,
  que não vale escrever na mão.

### Tela
Regras de visual do documento de autonomia valem como critério.
- **Service worker:** o `VitePWA` continua em `generateSW`, com `workbox.importScripts: ['push-sw.js']`.
  `apps/web/public/push-sw.js` trata `push` (valida o conteúdo e chama `showNotification`) e `notificationclick`
  (foca ou abre). A lógica fica em funções puras no mesmo arquivo, testadas pelo Vitest importando o arquivo. Se
  o `importScripts` não servir na versão instalada do plugin, trocar para `injectManifest` com o mesmo
  comportamento (decisão do TPL, registrada no spec).
- **`features/pwa/`:** `use-install.ts` (guarda o `beforeinstallprompt`, detecta iPhone e `standalone`),
  `use-push.ts` (suporte, permissão, assinar, cancelar, estado do servidor), `install-card.tsx`,
  `push-card.tsx`, `ios-install-sheet.tsx`. Decisão de "o que mostrar" numa função pura com teste
  (`push-state.ts`: sem suporte, iPhone sem instalar, bloqueado, desligado, ligado, servidor desligado).
- **Perfil** (`pages/perfil`): os cards "Instale o app" e "Avisos" entre a figurinha e as peladas. Interruptor da
  folha (Card/Interruptor: LIGADO com ✓, DESLIGADO com ✕). Referência: a página de Perfil aprovada em
  `perfil-jogador`.
- **Feed:** as duas linhas ("Instale o app", "Ative os avisos") usam a `alert-line.tsx` do `feed`, sempre **depois**
  dos avisos de rodada, e não são contadas na prioridade do domain (são do aparelho, não da pelada). Dispensa
  lembrada em `localStorage` com `try/catch`.
- **Pelada pela URL:** o `AppShell` lê `?grupo=` uma vez, chama `setCurrentGroupId` se a pelada for do usuário e
  limpa o parâmetro da URL.
- **Sair:** o logout do Perfil cancela a assinatura antes de chamar `/auth/logout`.
- Ícones pixel novos (sino, celular com seta) em `pixel-sprite-maps.ts`. Sem dependência nova no web.
- **Orçamento do JS inicial** (118,4 de 150 kB depois do `polimento-v1`, `apps/web/scripts/check-build.mjs`): o
  registro do service worker, o `use-push` e o pedido de permissão ficam fora do pedaço inicial (só no Perfil e nas
  linhas do Feed, que são áreas `lazy`). O `AppShell` (inicial) só lê `?grupo=` e não importa valor de
  `@fut-stats/shared`.
- **Linhas do Feed:** o Feed (#74) é a home; as linhas de instalar e de avisos têm o visual da `AlertLine` (que
  hoje recebe um `FeedAlert`: componente irmão ou `AlertLine` generalizada, decisão do DEV) com o "✕" de dispensar.
  Nenhuma tecla amarela nelas: o amarelo fica só na tecla de ação do aviso grande.

**Álbum** (`docs/design/prints/pwa-e-push/`): um print por cenário de tela (C22–C34, C39) a 390 px, mais um print
de uma notificação real no Android e no iPhone (do roteiro em aparelho real, anexado pelo dono ou pelo TPL se
tiver aparelho); `perfil-320`, `feed-320`, `perfil-desktop`.

### Decisões
- Quatro avisos, todos por evento — resposta do dono à P7; lembrete com hora marcada pede um agendador, e a API gratuita dorme.
- Assinatura por usuário e aparelho, sem preferência por tipo — pouca coisa para ligar e desligar; quatro avisos
  por semana não pedem ajuste fino.
- O resultado não revela o Craque — o aviso chama para o pacote.
- `web-push` é a única dependência nova — criptografia de push não se escreve na mão.
- Chave pública pela rota `/push/config` — o web não ganha variável de build, e dá para desligar o push só pelo
  servidor.
- Envio sem esperar e sem falhar a ação — aviso é cortesia.
- `importScripts` em vez de reescrever o service worker — mantém o que já funciona (cache e atualização).
- `?grupo=` na URL do aviso — o aviso pode ser de outra pelada do usuário.
- Push como ouvinte do sinal único de eventos da rodada (da `jogo-ao-vivo`), sem gancho próprio nos services — decisão do dono (17 nov 2026): um disparo depois do commit, vários ouvintes (SSE, push e, no futuro, um serviço de notificação próprio).
- `hasPack` no aviso `RESULT` do Feed, e o card sem o `GET .../voting/result` — pendência do `pacote-do-craque`, opção A do dono (17 nov 2026); sem o service worker avisar a janela aberta (isso é da `jogo-ao-vivo`).

## Fora do escopo
- Lembretes agendados ("a votação fecha em 2 h", "falta você confirmar"). O despertador de `producao` só garante
  que o `RESULT_OUT` saia na hora, fechando a votação vencida mesmo com a API parada.
- Aviso de resenha nova, de comentário e de jogo começando.
- Preferência por tipo de aviso ou por pelada; central de notificações dentro do app.
- Notificação por WhatsApp (roadmap, "Futuro").
- Modo sem rede além do que já existe.

## Perguntas respondidas pelo dono
- PWA e Web Push no lugar de app de loja e de WhatsApp (decisão de arquitetura, `docs/02-arquitetura.md`).
- P7 · Quais avisos viram notificação? → Os 4 por evento: rodada marcada, times publicados, votação aberta e
  resultado saiu (14 nov 2026).

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
