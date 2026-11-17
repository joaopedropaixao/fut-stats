# Registro de auditoria: consultas para quem opera

Uso **interno** (o dono): quando alguém mandar um bug, descobrir quem fez o quê, qual passo falhou e quanto
demorou. Os usuários não veem isto. Spec: [`auditoria-da-rodada`](../specs/auditoria-da-rodada.md).

## O que existe

Duas fontes, ligadas pelo `requestId` (o cabeçalho `x-request-id` de cada pedido):

1. **Tabela `AuditLog` (banco).** Uma linha por **escrita aceita** de rodada (placar, etapa, lance, times, votação)
   e de feed (resenha, comentário, reação): quem fez, o quê, quando, antes e depois. Só inserção. Pedido recusado
   (400, 403, 404, 409) não deixa linha. O voto, a presença e o rascunho dos times nunca entram.
2. **Log de pedido (Render).** Uma linha JSON por pedido: `requestId`, `method`, `path`, `status`, `durationMs`,
   `userId`, `groupId` e, quando `status >= 400`, `errorCode` (ex. `NOT_OWN_COMMENT`, `INVALID_TRANSITION`,
   `VALIDATION_FAILED`; `null` se o erro não tem código). Sem corpo, cookie, email nem nome. `/api/health` não loga.

Regra prática: o **log de pedido** diz *qual passo falhou e quanto demorou* (inclusive os pedidos recusados, que
não têm linha no banco); o **banco** diz *o que mudou* (só o que foi aceito).

## Colunas de `AuditLog`

| Coluna | O que é |
|---|---|
| `id` | cuid da linha |
| `groupId` | grupo da pelada |
| `roundId` | rodada (linhas da rodada); `NULL` nas do feed. Apagar a rodada apaga as linhas dela |
| `postId` | resenha (linhas do feed); `NULL` nas da rodada. **Sem chave estrangeira**: sobrevive à resenha apagada |
| `actorId` | `Membership.id` de quem pediu; `NULL` = automático (fechamento da votação sem pedido do admin) |
| `action` | `AuditAction`: rodada (`TEAMS_PUBLISHED`, `TEAMS_UNPUBLISHED`, `MATCH_STARTED`, `SCORE_SET`, `MATCH_FINISHED`, `VOTING_OPENED`, `VOTING_CLOSED`, `EVENT_LAUNCHED`, `EVENT_REMOVED`) e feed (`POST_CREATED`, `POST_EDITED`, `POST_DELETED`, `COMMENT_CREATED`, `COMMENT_DELETED`, `REACTION_SET`, `REACTION_REMOVED`) |
| `before`, `after` | JSON pequeno do que mudou (por ação, tabela no spec). O texto de resenha ou comentário **apagado ou editado** fica em `before` |
| `requestId` | `x-request-id` do pedido; `NULL` quando não há pedido (relógio que fecha votação vencida) |
| `createdAt` | quando (UTC) |

`userId` (a conta Google) não está na tabela: vem de `Membership."userId"` pelo `actorId`.

## Consultas

Rodar no `psql` do banco do ambiente (o painel do Neon dá a conexão). Só leitura: nunca `UPDATE` nem `DELETE` aqui.

### Por `requestId` (o que esse pedido mudou)

O `requestId` vem do corpo do 500 (`{ statusCode, message, requestId }`), do cabeçalho `x-request-id` da resposta ou
do log de pedido.

```sql
SELECT a."createdAt", a.action, m.nickname AS quem, a."roundId", a."postId", a.before, a.after
FROM "AuditLog" a
LEFT JOIN "Membership" m ON m.id = a."actorId"
WHERE a."requestId" = 'COLE-O-REQUEST-ID-AQUI'
ORDER BY a."createdAt", a.id;
```

Sem linha: o pedido não mudou nada (foi recusado, só leu, ou falhou antes de gravar). Aí vale o log de pedido no
Render, filtrando pelo mesmo `requestId`: `status`, `errorCode` e `durationMs` mostram o passo que falhou.

### Por usuário num intervalo (o que essa pessoa fez)

Pelo `userId` da conta (o log de pedido traz `userId`); o intervalo é em UTC.

```sql
SELECT a."createdAt", a.action, g.name AS grupo, m.nickname AS quem,
       a."roundId", a."postId", a."requestId", a.before, a.after
FROM "AuditLog" a
JOIN "Membership" m ON m.id = a."actorId"
JOIN "Group" g ON g.id = a."groupId"
WHERE m."userId" = 'COLE-O-USER-ID-AQUI'
  AND a."createdAt" >= '2026-11-16 00:00:00'
  AND a."createdAt" <  '2026-11-17 00:00:00'
ORDER BY a."createdAt", a.id;
```

Por apelido, quando só se sabe o nome no grupo: troque o filtro por `m.nickname = '...' AND a."groupId" = '...'`.

### Por resenha (a história dela, inclusive depois de apagada)

Funciona com a resenha já apagada: `postId` não tem chave estrangeira.

```sql
SELECT a."createdAt", a.action, m.nickname AS quem, a."requestId", a.before, a.after
FROM "AuditLog" a
LEFT JOIN "Membership" m ON m.id = a."actorId"
WHERE a."postId" = 'COLE-O-POST-ID-AQUI'
ORDER BY a."createdAt", a.id;
```

"Quem apagou a resenha X e o que dizia?": a linha `POST_DELETED` traz o texto em `before` (`title`, `body`, `authorId`,
`reactionCount`, `commentCount`). Comentário apagado: `COMMENT_DELETED`, com `text` e `authorId` em `before`.

Sem o id da resenha, achar pelo texto apagado:

```sql
SELECT a."createdAt", a."postId", m.nickname AS quem_apagou, a.before ->> 'title' AS titulo
FROM "AuditLog" a
LEFT JOIN "Membership" m ON m.id = a."actorId"
WHERE a.action = 'POST_DELETED'
  AND a."groupId" = 'COLE-O-GROUP-ID-AQUI'
  AND a.before ->> 'body' ILIKE '%trecho do texto%'
ORDER BY a."createdAt" DESC;
```

### Da rodada, para o admin

O admin do grupo lê o registro da rodada pela API (`GET /api/groups/:groupId/rounds/:roundId/log`). No banco,
o mesmo, para a rodada inteira:

```sql
SELECT a."createdAt", a.action, m.nickname AS quem, a."requestId", a.before, a.after
FROM "AuditLog" a
LEFT JOIN "Membership" m ON m.id = a."actorId"
WHERE a."roundId" = 'COLE-O-ROUND-ID-AQUI'
ORDER BY a."createdAt", a.id;
```

## Cuidados

- **Ordem:** a hora da linha é a do início da transação. Duas escritas simultâneas podem ter `createdAt` quase
  iguais; o `before` de cada uma encadeia com o `after` da anterior (a reação, por exemplo, é serializada por
  resenha e pessoa).
- **Dado pessoal:** o registro tem texto de resenha e comentário (por decisão do dono, para saber "o que foi
  apagado"). Não colar o resultado em canal aberto.
- **Voto é anônimo:** não há linha de voto, nem "fulano votou". `VOTING_CLOSED` guarda só a contagem (`voted`, `total`) e
  o motivo; o ator é `NULL` no prazo, no último voto e no relógio.
