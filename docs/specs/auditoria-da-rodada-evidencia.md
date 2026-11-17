# Evidência: `auditoria-da-rodada`

> Montada pelo QA (volta 1) em 2026-11-16, branch `feature/auditoria-da-rodada` @6ba5ab1, modo paralelo vaga 1
> (banco `fut_stats_auditoria_da_rodada`). Dados do seed de dev (pessoas fictícias).

## Fluxo rodado

Rodada nova (nº 10) criada pelo admin Carlão no grupo do seed; presença de 16, sugestão e rascunho dos times
(nada disso gera linha: o `GET .../log` respondeu `[]` antes de publicar). Depois, contra a API de dev (`:3100`) e
a mesma build em `NODE_ENV=production` (`:3101`, só para ver o log em JSON), todos com `x-request-id` conhecido:

| # | Quem | Pedido | Status | `x-request-id` |
|---|---|---|---|---|
| 1 | admin | `POST lineup/publish` (`:3101`) | 200 | `qa-evid-publicar-01` |
| 2 | admin | `POST lineup/unpublish` | 200 | `qa-evid-despublicar-02` |
| 3 | admin | `POST lineup/publish` | 200 | `qa-evid-publicar-03` |
| 4 | admin | `POST match/start` | 200 | `qa-evid-comecar-04` |
| 5 | admin | `PUT match/score` 1x0 | 200 | `qa-evid-placar-05` |
| 6 | admin | `PUT match/score` 2x0 | 200 | `qa-evid-placar-06` |
| — | jogador | `PUT match/score` (recusado) | 403 | `qa-evid-recusa-403` |
| — | admin | `POST match/start` fora de ordem (recusado) | 409 | `qa-evid-recusa-409` |
| 7 | admin | `POST match/finish` 2x0 | 200 | `qa-evid-finalizar-07` |
| 8 | Leleco | `POST match/events` gol dele | 200 | `qa-evid-lance-08` |
| 9 | Leleco | `DELETE match/events/:id` o mesmo gol (`:3101`) | 200 | `qa-evid-apagar-lance-09` |
| 10 | Leleco | `POST match/events` gol dele de novo | 200 | `qa-evid-lance-10` |
| 11 | admin | `POST match/events` gol do Luquinha | 200 | `qa-evid-lance-11` |
| — | Leleco | `POST match/events` gol de outro (recusado) | 403 | `qa-evid-recusa-lance-403` |
| — | Leleco | `POST match/events` gol passando do placar (recusado) | 409 | `qa-evid-recusa-lance-409` |
| 12 | admin | `POST match/open-voting` | 200 | `qa-evid-abrir-votacao-12` |
| — | 3 jogadores | `PUT voting/vote` (1º no `:3101`) | 200 | `qa-evid-voto-1..3` |
| — | jogador | `GET .../log` | 403 | `qa-evid-log-jogador-403` |
| 13 | admin | `POST voting/close` (`:3101`) | 200 | `qa-evid-fechar-votacao-13` |
| — | admin | `GET .../log` (`:3101`) | 200 | `qa-evid-ler-registro-14` |

Resultado: 13 linhas no registro, uma por escrita aceita; nenhuma pelos 4 pedidos recusados, nenhuma pelos 3 votos,
pela presença, pelo rascunho ou pela criação da rodada. No banco, cada linha guarda o `requestId` do próprio pedido
(`qa-evid-publicar-01` … `qa-evid-fechar-votacao-13`) e o `actorId` de quem pediu.

## (a) Log da API (`NODE_ENV=production`, uma linha JSON por pedido)

Linhas de pedido do `:3101`, como saíram no stdout (sem corpo, cookie, email nem nome; `/api/health` não aparece):

```jsonl
{"level":"log","pid":75807,"timestamp":1794793832523,"message":{"requestId":"qa-evid-publicar-01","method":"POST","path":"/api/groups/cmwil9d3w0000nkqi65o1s3ki/rounds/cmwilvn4e00001zqirh5br310/lineup/publish","status":200,"durationMs":128.52,"userId":"cmwil9d430001nkqi3boijsbx","groupId":"cmwil9d3w0000nkqi65o1s3ki"},"context":"HTTP"}
{"level":"log","pid":75807,"timestamp":1794793832645,"message":{"requestId":"qa-evid-apagar-lance-09","method":"DELETE","path":"/api/groups/cmwil9d3w0000nkqi65o1s3ki/rounds/cmwilvn4e00001zqirh5br310/match/events/cmwilwofi00131zqigdjhpr9j","status":200,"durationMs":18.46,"userId":"cmwil9d5u000znkqil0xyuo1d","groupId":"cmwil9d3w0000nkqi65o1s3ki"},"context":"HTTP"}
{"level":"log","pid":75807,"timestamp":1794793850109,"message":{"requestId":"qa-evid-voto-1","method":"PUT","path":"/api/groups/cmwil9d3w0000nkqi65o1s3ki/rounds/cmwilvn4e00001zqirh5br310/voting/vote","status":200,"durationMs":34.71,"userId":"cmwil9d5y0013nkqi2ghambif","groupId":"cmwil9d3w0000nkqi65o1s3ki"},"context":"HTTP"}
{"level":"log","pid":75807,"timestamp":1794793850156,"message":{"requestId":"qa-evid-log-jogador-403","method":"GET","path":"/api/groups/cmwil9d3w0000nkqi65o1s3ki/rounds/cmwilvn4e00001zqirh5br310/log","status":403,"durationMs":1.65,"userId":"cmwil9d5y0013nkqi2ghambif","groupId":null},"context":"HTTP"}
{"level":"log","pid":75807,"timestamp":1794793850176,"message":{"requestId":"qa-evid-fechar-votacao-13","method":"POST","path":"/api/groups/cmwil9d3w0000nkqi65o1s3ki/rounds/cmwilvn4e00001zqirh5br310/voting/close","status":200,"durationMs":19.81,"userId":"cmwil9d430001nkqi3boijsbx","groupId":"cmwil9d3w0000nkqi65o1s3ki"},"context":"HTTP"}
{"level":"log","pid":75807,"timestamp":1794793850182,"message":{"requestId":"qa-evid-ler-registro-14","method":"GET","path":"/api/groups/cmwil9d3w0000nkqi65o1s3ki/rounds/cmwilvn4e00001zqirh5br310/log","status":200,"durationMs":4.26,"userId":"cmwil9d430001nkqi3boijsbx","groupId":"cmwil9d3w0000nkqi65o1s3ki"},"context":"HTTP"}
```

Na linha do 403 o `groupId` sai `null`: o guard de grupo recusa antes de anotar o contexto (o `userId` aparece).

## (b) `GET /api/groups/:groupId/rounds/:roundId/log` da rodada

`GET /api/groups/cmwil9d3w0000nkqi65o1s3ki/rounds/cmwilvn4e00001zqirh5br310/log` (admin, `x-request-id: qa-evid-ler-registro-14`) → 200:

```json
[
  {
    "id": "cmwilwoc30000hrqijvmglkxz",
    "action": "TEAMS_PUBLISHED",
    "label": "Times publicados",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": {
      "status": "SCHEDULED"
    },
    "after": {
      "status": "TEAMS_PUBLISHED"
    },
    "createdAt": "2026-11-16T01:50:32.499Z"
  },
  {
    "id": "cmwilwod1000x1zqia1763sh0",
    "action": "TEAMS_UNPUBLISHED",
    "label": "Times despublicados",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": {
      "status": "TEAMS_PUBLISHED"
    },
    "after": {
      "status": "SCHEDULED"
    },
    "createdAt": "2026-11-16T01:50:32.533Z"
  },
  {
    "id": "cmwilwodk000y1zqi53ts83rn",
    "action": "TEAMS_PUBLISHED",
    "label": "Times publicados",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": {
      "status": "SCHEDULED"
    },
    "after": {
      "status": "TEAMS_PUBLISHED"
    },
    "createdAt": "2026-11-16T01:50:32.552Z"
  },
  {
    "id": "cmwilwoe1000z1zqi6q2br6an",
    "action": "MATCH_STARTED",
    "label": "Jogo começou",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": {
      "status": "TEAMS_PUBLISHED"
    },
    "after": {
      "status": "IN_PROGRESS"
    },
    "createdAt": "2026-11-16T01:50:32.569Z"
  },
  {
    "id": "cmwilwoek00101zqia155attq",
    "action": "SCORE_SET",
    "label": "Placar lançado",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": {
      "score": null
    },
    "after": {
      "score": {
        "BLACK": 0,
        "WHITE": 1
      }
    },
    "createdAt": "2026-11-16T01:50:32.588Z"
  },
  {
    "id": "cmwilwoeu00111zqiow854khe",
    "action": "SCORE_SET",
    "label": "Placar lançado",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": {
      "score": {
        "BLACK": 0,
        "WHITE": 1
      }
    },
    "after": {
      "score": {
        "BLACK": 0,
        "WHITE": 2
      }
    },
    "createdAt": "2026-11-16T01:50:32.598Z"
  },
  {
    "id": "cmwilwofa00121zqiujemtq04",
    "action": "MATCH_FINISHED",
    "label": "Jogo finalizado",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": {
      "score": {
        "BLACK": 0,
        "WHITE": 2
      },
      "status": "IN_PROGRESS"
    },
    "after": {
      "score": {
        "BLACK": 0,
        "WHITE": 2
      },
      "status": "POST_MATCH"
    },
    "createdAt": "2026-11-16T01:50:32.614Z"
  },
  {
    "id": "cmwilwofi00141zqiewpuiwxi",
    "action": "EVENT_LAUNCHED",
    "label": "Lance lançado",
    "actor": {
      "membershipId": "cmwil9d5v0010nkqig5whjopt",
      "nickname": "Leleco"
    },
    "before": null,
    "after": {
      "type": "GOAL",
      "eventId": "cmwilwofi00131zqigdjhpr9j",
      "playerId": "cmwil9d5v0010nkqig5whjopt"
    },
    "createdAt": "2026-11-16T01:50:32.622Z"
  },
  {
    "id": "cmwilwofw0001hrqijxm7kbkb",
    "action": "EVENT_REMOVED",
    "label": "Lance apagado",
    "actor": {
      "membershipId": "cmwil9d5v0010nkqig5whjopt",
      "nickname": "Leleco"
    },
    "before": {
      "type": "GOAL",
      "eventId": "cmwilwofi00131zqigdjhpr9j",
      "playerId": "cmwil9d5v0010nkqig5whjopt",
      "createdById": "cmwil9d5v0010nkqig5whjopt"
    },
    "after": null,
    "createdAt": "2026-11-16T01:50:32.636Z"
  },
  {
    "id": "cmwilwoga00161zqim8d718rc",
    "action": "EVENT_LAUNCHED",
    "label": "Lance lançado",
    "actor": {
      "membershipId": "cmwil9d5v0010nkqig5whjopt",
      "nickname": "Leleco"
    },
    "before": null,
    "after": {
      "type": "GOAL",
      "eventId": "cmwilwog900151zqioznhhe0i",
      "playerId": "cmwil9d5v0010nkqig5whjopt"
    },
    "createdAt": "2026-11-16T01:50:32.650Z"
  },
  {
    "id": "cmwilwogh00181zqira8s6m4g",
    "action": "EVENT_LAUNCHED",
    "label": "Lance lançado",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": null,
    "after": {
      "type": "GOAL",
      "eventId": "cmwilwogh00171zqi9s7931ph",
      "playerId": "cmwil9d5h000qnkqikj1xbnp0"
    },
    "createdAt": "2026-11-16T01:50:32.657Z"
  },
  {
    "id": "cmwilwogy00191zqiw7wotsht",
    "action": "VOTING_OPENED",
    "label": "Votação aberta",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": {
      "status": "POST_MATCH"
    },
    "after": {
      "status": "VOTING"
    },
    "createdAt": "2026-11-16T01:50:32.674Z"
  },
  {
    "id": "cmwilx1z0000ihrqi0idyw9nw",
    "action": "VOTING_CLOSED",
    "label": "Votação fechada",
    "actor": {
      "membershipId": "cmwil9d470002nkqiids8cpg0",
      "nickname": "Carlão"
    },
    "before": {
      "status": "VOTING"
    },
    "after": {
      "total": 16,
      "voted": 3,
      "reason": "ADMIN_CLOSED",
      "status": "CLOSED"
    },
    "createdAt": "2026-11-16T01:50:50.172Z"
  }
]
```

## Volta 2 (extensão do feed), 2026-11-17, @ebc58ce sobre develop 1b9afa5

Vaga 1 (banco `fut_stats_auditoria_da_rodada`), login de dev na `:3100`, pedidos na mesma build em
`NODE_ENV=production` (`:3101`, `VOTING_CLOSER_INTERVAL_MS=0`) para ver o log em JSON. Pessoas do seed.

| # | Quem | Pedido | Status | `x-request-id` | Linha |
|---|---|---|---|---|---|
| 1 | Carlão (admin) | `POST posts` | 201 | `qa2-resenha-criar-01` | `POST_CREATED` |
| 2 | Carlão | `PATCH posts/:id` | 200 | `qa2-resenha-editar-02` | `POST_EDITED` (texto antigo e novo) |
| 3 | Dedé | `POST comments` "Foi sem querer ⚽️ kkk" | 201 | `qa2-comentar-03` | `COMMENT_CREATED` (`length: 21`, sem texto) |
| 4 | Bruninho | `POST comments` "Impedido!" | 201 | `qa2-comentar-04` | `COMMENT_CREATED` |
| — | Dedé | `DELETE` comentário do Bruninho | 403 `NOT_OWN_COMMENT` | `qa2-recusa-not-own-403` | nenhuma |
| — | Dedé | `POST comments` texto vazio | 400 | `qa2-recusa-validacao-400` | nenhuma |
| — | Dedé | `POST posts` (jogador) | 403 | `qa2-recusa-jogador-resenha-403` | nenhuma |
| 5 | Dedé | `DELETE` o próprio comentário | 204 | `qa2-apagar-proprio-05` | `COMMENT_DELETED` (texto + autor) |
| — | Dedé | `DELETE` o mesmo de novo | 404 | `qa2-apagar-repetido-06` | nenhuma |
| 6 | Carlão | `DELETE` comentário do Bruninho | 204 | `qa2-admin-apaga-07` | `COMMENT_DELETED` |
| 7 | Dedé | `PUT reaction` BALL | 200 | `qa2-reagir-ball-08` | `REACTION_SET` null→BALL |
| — | Dedé | `PUT reaction` BALL de novo | 200 | `qa2-reagir-ball-repetido-09` | nenhuma |
| 8 | Dedé | `PUT reaction` CATFISH | 200 | `qa2-trocar-catfish-10` | `REACTION_SET` BALL→CATFISH |
| 9 | Dedé | `DELETE reaction` | 200 | `qa2-tirar-11` | `REACTION_REMOVED` |
| — | Dedé | `DELETE reaction` de novo | 200 | `qa2-tirar-repetido-12` | nenhuma |
| — | Bru (admin de outro grupo) | `PATCH`/`DELETE`/`PUT reaction`/`POST comments` na resenha via o grupo dele | 404 ×4 | `qa2-cross-*-404` | nenhuma |
| 10 | Carlão | `DELETE posts/:id` | 204 | `qa2-resenha-apagar-15` | `POST_DELETED` (texto, autor, 1 reação, 1 comentário) |
| 11 | Dedé, depois Bruninho | `GET feed/alerts` com a votação da rodada 9 vencida | 200 ×2 | `qa2-avisos-dede-01`, `qa2-avisos-bruno-02` | uma `VOTING_CLOSED` (`DEADLINE_PASSED`, ator nulo, `requestId` = `qa2-avisos-dede-01`) |

As linhas da resenha continuam depois de apagada (12 pela consulta "por resenha" de `docs/operacao/registro.md`).
8 `PUT` de reação simultâneos do mesmo membro: 6 linhas, cada `before` igual ao `after` anterior, último `after` =
reação gravada. As cinco consultas de `docs/operacao/registro.md` rodaram no banco e devolveram o esperado.
O `GET .../rounds/:roundId/log` da rodada 9 trouxe as 13 linhas da rodada e nenhuma do feed.

Log de pedido (`:3101`, ids encurtados):

```jsonl
{"requestId":"qa2-recusa-not-own-403","method":"DELETE","path":"/api/groups/<g>/posts/<p>/comments/<c>","status":403,"durationMs":3.13,"userId":"<dede>","groupId":"<g>","errorCode":"NOT_OWN_COMMENT"}
{"requestId":"qa2-recusa-validacao-400","method":"POST","path":"/api/groups/<g>/posts/<p>/comments","status":400,"durationMs":1.77,"userId":"<dede>","groupId":"<g>","errorCode":"VALIDATION_FAILED"}
{"requestId":"qa2-tirar-repetido-12","method":"DELETE","path":"/api/groups/<g>/posts/<p>/reaction","status":200,"durationMs":5.17,"userId":"<dede>","groupId":"<g>"}
{"requestId":"qa2-sem-sessao-401","method":"GET","path":"/api/me","status":401,"durationMs":0.33,"userId":null,"groupId":null,"errorCode":null}
```

Migration: `20261117174123_feed` intacta em relação à develop; `20261117175943_audit_log` a última;
`prisma migrate status` em dia e `migrate diff` do banco para o schema sem diferença.
