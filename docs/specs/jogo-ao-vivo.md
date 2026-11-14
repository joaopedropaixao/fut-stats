# `jogo-ao-vivo`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `jogo-ao-vivo` (onda 5) |
| **Modo** | Par |
| **Parte de** | `auditoria-da-rodada` (os pontos de escrita da rodada já passam por um lugar só) |
| **Status** | aprovado em 2026-11-14 |
| **Base** | develop @1021769 |
| **Depende de** | auditoria-da-rodada, votacao, rodizio-reservas |
| **Toca em** | packages/shared/src/live.ts, packages/shared/src/index.ts, apps/api/src/live, apps/api/src/match, apps/api/src/lineups/lineups.service.ts, apps/api/src/voting, apps/api/src/app.module.ts, apps/api/src/config/env.ts, .env.example, apps/web/src/features/live, apps/web/src/features/match/queries.ts, apps/web/src/features/match/refresh-interval.ts, apps/web/src/features/voting, apps/web/src/app/shell.tsx |

## Produto

### Objetivo
O que acontece na rodada aparece **na hora** no celular de todo mundo: o jogo começou, o placar foi lançado, alguém
lançou um gol na Resenha, o rodízio foi ligado, mais um votou, a votação fechou. Hoje a tela pergunta à API de
tempos em tempos (15 s em jogo, 5 s na Resenha, 15 s na votação). Passa a **receber um aviso** da API e só então
buscar o dado novo. Menos espera, menos pedidos.

### Quem usa
Qualquer membro ativo com o app aberto. Ninguém faz nada diferente: as telas só ficam mais rápidas.
Usuário de outro grupo ou membro inativo: 404 no canal.

### Regras de domínio
Nenhuma regra de negócio nova. Regras técnicas do canal:
- **O aviso não carrega dado.** Ele só diz "mudou" e **o que** mudou (`scopes`). Cada aparelho busca a própria
  visão pela rota de sempre, com as permissões dele. Nada sensível passa pelo canal (voto nunca).
- **Só depois de gravado:** o aviso sai depois que a transação termina. Escrita recusada ou desfeita não avisa.
- **O que avisa** e com qual escopo:

| Escrita | `scopes` |
|---|---|
| publicar / despublicar times | `status` |
| começar o jogo, finalizar, abrir a votação | `match`, `status` |
| placar, lançar e apagar lance, ligar e parar o rodízio | `match` |
| votar (novo ou editado) | `voting` |
| fechar a votação (admin, último voto ou prazo) | `voting`, `status` |

- **Rede ruim não quebra nada:** se o canal cair, o app volta sozinho a perguntar de tempos em tempos, como hoje,
  e tenta o canal de novo depois.

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | membro ativo, rodada do grupo | `GET .../rounds/:roundId/stream` | 200 com `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform` e `X-Accel-Buffering: no`; a primeira mensagem é `event: ready` | integração (app ouvindo numa porta, leitura do corpo em fluxo) |
| C2 | dois membros conectados | admin lança um lance (`POST .../match/events`) | os dois recebem `event: changed` com `{ scopes: ['match'], at }` em menos de 1 s | integração |
| C3 | conectado | cada escrita da tabela acima | o `changed` chega com os escopos da tabela | integração |
| C4 | conectado | escrita recusada (409 passando do placar, 403, 404) | nenhum `changed` | integração |
| C5 | conectado na rodada A | escrita na rodada B do mesmo grupo; escrita em rodada de outro grupo | nenhum `changed` na A | integração |
| C6 | conectado | a votação fecha pelo relógio (`closeDueVotings`) | `changed` com `voting` e `status` | integração |
| C7 | conectado e parado | esperar o intervalo de pulso (`STREAM_HEARTBEAT_MS`, baixado no teste) | chega um comentário `: ping` (mantém a conexão viva atrás de proxy) | integração |
| C8 | cliente fecha a conexão | conferir o emissor | o ouvinte daquela conexão sai (contagem volta ao que era); 30 conexões abertas e fechadas não deixam ouvinte sobrando | integração |
| C9 | sem sessão; usuário de outro grupo; membro inativo; rodada de outro grupo ou inexistente | `GET .../stream` | 401; 404; 404; 404 (resposta comum, sem abrir fluxo) | integração |
| C10 | 50 conexões na mesma rodada | uma escrita | as 50 recebem; a escrita responde no tempo normal (o aviso não segura a resposta) | integração |
| C11 | erro num ouvinte (conexão quebrada no meio) | uma escrita | a escrita responde 200 e os outros ouvintes recebem | integração |
| C12 | o voto de alguém | conferir o `changed` | só `{ scopes: ['voting'], at }`: sem quem votou e sem conteúdo | integração |

**Tela** (dois navegadores no Playwright: A = admin, B = jogador)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C13 | B na tela do jogo, Resenha | A lança um gol | aparece em B em até 2 s (antes: até 5 s) | Playwright |
| C14 | B no início com "Times publicados" | A começa o jogo; depois finaliza com 3x2 | B passa para "Em jogo" e depois para "Hora da Resenha" com o placar, em até 2 s cada, sem recarregar | Playwright |
| C15 | B na tela do jogo, em jogo | A liga o rodízio | o card do rodízio aparece em B em até 2 s | Playwright |
| C16 | B em "Votos enviados" | outro jogador vota | o medidor de B sobe em até 2 s | Playwright |
| C17 | B votando | A encerra a votação | B vê "A votação fechou" ao tentar enviar e o início mostra "O resultado saiu" em até 2 s | Playwright |
| C18 | canal conectado | contar pedidos de B em 60 s parado na Resenha | no máximo 1 pedido de segurança da visão do jogo (antes: 12) | Playwright |
| C19 | canal derrubado (rota do stream abortada no Playwright) | A lança um gol | aparece em B pelo modo antigo, em até 5 s na Resenha (15 s em jogo e na votação) | Playwright |
| C20 | canal volta | esperar a nova tentativa | B reconecta, busca tudo uma vez e volta ao tempo real | Playwright |
| C21 | B esconde a aba | olhar a rede | a conexão fecha; ao voltar, reconecta e atualiza na hora | Playwright |
| C22 | rodada sem nada ao vivo (`SCHEDULED`, `CLOSED`) ou sem rodada | abrir o app | nenhuma conexão de stream aberta | Playwright |
| C23 | qualquer tela, canal conectado e depois derrubado | olhar | nada muda no visual e nenhum aviso de erro aparece para a pessoa; console sem erros de JavaScript (falha de rede do stream não é erro de JS) | Playwright |
| C24 | larguras 320, 375, 390, 430 px e desktop | telas do jogo e da votação recebendo atualização | a atualização não desloca o layout nem cria sobreposição (os dígitos "batem" no lugar) | Playwright |

## Técnico

### Contrato
Schemas em `packages/shared/src/live.ts` (arquivo novo, exportado no `index.ts`).

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/groups/:groupId/rounds/:roundId/stream` | membro | — | fluxo `text/event-stream` | 401; 404 |

Mensagens do fluxo (formato Server-Sent Events):
- `event: ready` + `data: {}`: conexão aceita.
- `event: changed` + `data: RoundStreamEvent`: algo mudou na rodada.
- `: ping`: comentário de pulso a cada `STREAM_HEARTBEAT_MS` (padrão 20 000).
- `retry: 3000`: o navegador tenta reconectar em 3 s.

```ts
// packages/shared/src/live.ts
export const ROUND_STREAM_SCOPES = ['match', 'voting', 'status'] as const;
export type RoundStreamScope = (typeof ROUND_STREAM_SCOPES)[number];

export const roundStreamEventSchema = z.object({
  scopes: z.array(z.enum(ROUND_STREAM_SCOPES)).min(1),
  at: z.iso.datetime(),
});
export type RoundStreamEvent = z.infer<typeof roundStreamEventSchema>;

/** Etapas em que vale manter o canal aberto. */
export const LIVE_ROUND_STATUSES = ['TEAMS_PUBLISHED', 'IN_PROGRESS', 'POST_MATCH', 'VOTING'] as const;
```

Nenhuma rota existente muda.

### Banco (`schema.prisma`)
Sem mudança.

### Domínio
Sem mudança (canal é infraestrutura; não há regra de negócio).

Na API:
- **`apps/api/src/live`:** `RoundEventsService` com um `EventEmitter` do Node (`setMaxListeners(0)`):
  `emit(groupId, roundId, scopes)` e `subscribe(groupId, roundId, listener): () => void`. `LiveController` com o
  `GET` (`@GroupMember()`, confere que a rodada é do grupo antes de abrir o fluxo; `@Sse()` do Nest ou a resposta
  na mão, o que der os cabeçalhos certos). Cancelar a inscrição no `close` da requisição.
- **Avisar depois de gravar:** cada service chama `events.emit(...)` **depois** que o `withRoundLock` (ou a
  transação) resolve, nunca dentro. Pontos: `match.service` (start, score, finish, open-voting, lances, rodízio),
  `lineups.service` (publish, unpublish), `voting` (votar, fechar pelos três caminhos). Erro ao avisar é
  registrado no log e engolido: nunca derruba a escrita.
- **Cobertura:** o teste de C3 percorre a mesma lista de rotas de escrita do teste de cobertura de
  `auditoria-da-rodada` (mais votar e rodízio).
- **Um processo só:** o emissor vive na memória. Serve enquanto a API roda numa instância (Render gratuito). Com
  mais de uma instância, trocar o emissor por `LISTEN/NOTIFY` do Postgres, sem mudar o contrato (fica anotado no
  `docs/02-arquitetura.md`).
- `STREAM_HEARTBEAT_MS` em `src/config/env.ts` e no `.env.example`. Sem dependência nova.

### Tela
Sem mudança visual. Regra 7 do documento de autonomia (sem sobreposição) vale para as telas que passam a se
atualizar sozinhas.
- **`features/live/use-round-stream.ts`:** abre um `EventSource` para a rodada, valida cada mensagem com
  `roundStreamEventSchema` e invalida as consultas pelo escopo:
  - `match` → a visão do jogo (`matchKey`);
  - `voting` → a visão da votação e o resultado;
  - `status` → o detalhe da rodada, os times (`lineup`) e a lista de rodadas **por prefixo** (`roundsKey(groupId)`
    sem `exact`), que leva junto os avisos do Feed.
  Ao (re)conectar, invalida os três escopos (pode ter perdido aviso). A lógica de estado (conectado, tentando,
  modo antigo) é uma máquina pura com teste (`stream-state.ts`): 3 falhas seguidas em 1 min → modo antigo por
  60 s, depois tenta de novo.
- **`features/live/live-rounds.tsx`:** montado no `AppShell`. Lê a lista de rodadas e mantém o canal aberto para
  a rodada da vez e para a rodada em votação (no máximo 2 conexões), só em `LIVE_ROUND_STATUSES` e com a aba
  visível. Assim toda tela se beneficia sem cada uma abrir o seu.
- **Intervalos:** `matchRefreshInterval` e o intervalo da votação recebem o estado do canal: conectado → 60 s
  (rede de segurança); modo antigo → os valores de hoje (15 s / 5 s / 15 s). `refetchOnWindowFocus` continua.
- Em dev, o proxy do Vite já repassa `/api/` (conferir que não segura o fluxo; se segurar, ajustar o proxy).

**Depois do merge (não dá para testar antes):** o staging passa pelo rewrite da Vercel até o Render. O TPL deixa no
PR um roteiro de 3 passos para o orquestrador conferir na `develop`: abrir duas sessões no staging, lançar um
lance e medir o atraso. Se o proxy segurar o fluxo, o app cai no modo antigo sozinho (C19) e nada quebra; aí abre-se
um item para ligar o stream direto no domínio da API.

**Álbum** (`docs/design/prints/jogo-ao-vivo/`): sem tela nova. Dois prints lado a lado de A e B depois de um lance
(`c13-lance-ao-vivo.png`) e a contagem de pedidos de C18 colada no PR.

### Decisões
- Aviso sem dado ("mudou") em vez de mandar o estado — cada pessoa tem permissões diferentes na mesma tela
  (`canRemove`, `permissions`); buscar a própria visão evita duplicar essa lógica e vazar dado.
- Um canal por rodada (`.../rounds/:roundId/stream`), não só do jogo (`.../match/stream`, como estava na Trilha) —
  o mesmo canal serve o jogo, o rodízio e a votação.
- Montado no shell — início, jogo e votação ficam ao vivo com uma conexão, e nenhuma tela esquece de ligar.
- Modo antigo automático — proxy e rede de celular derrubam conexão longa; o app nunca depende do canal para
  estar certo.
- Emissor na memória — uma instância só; o caminho para crescer fica anotado.
- Depois de `auditoria-da-rodada` e `votacao` — todos os pontos de escrita já existem e estão listados num teste.

## Fora do escopo
- Presença e Feed (resenhas, reações, comentários) em tempo real.
- Mandar o dado pelo canal; WebSocket.
- Indicador "ao vivo" novo na tela.
- Mais de uma instância da API.

## Perguntas respondidas pelo dono
- Tempo real com SSE no lugar do polling → aprovado no parecer do Head de Engenharia (30 out 2026).
- P14 · Tempo real depois de `votacao` (onda 5)? → Sim (14 nov 2026).

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
