# `homologacao`

| | |
|---|---|
| **Fatia** | `homologacao` (pós-release v1.0.0) |
| **Modo** | Back |
| **Parte de** | — |
| **Status** | aprovado em 2026-11-18 |
| **Base** | develop @1a9f744 |
| **Depende de** | — |
| **Toca em** | apps/api/src/seed, apps/api/prisma/demo.ts, apps/api/src/auth/google-auth.service.ts, apps/api/package.json, .github/workflows/homologacao.yml, docs/deploy.md |

## Produto

### Objetivo
O staging (`develop`, https://fut-stats-three.vercel.app) vira o ambiente de homologação dos admins da pelada: um
workflow manual monta uma **pelada de demonstração** completa e deixa os e-mails passados como admins dela, sem tocar
na produção nem nos outros grupos do staging.

### Quem usa
- **Dono:** roda o workflow "Preparar homologação" no GitHub (e-mails dos admins + cenário).
- **Admins convidados:** entram no staging com o Google e já caem como admins da pelada de demonstração.

### Regras
- A pelada de demonstração é um grupo próprio (`slug` `pelada-demo`, "Pelada de Demonstração"), com os 21 jogadores
  fictícios do seed (e-mails `@demo.invalid`), 8 rodadas passadas completas, resenhas e a rodada atual no cenário.
- Rodar de novo apaga **só** esse grupo (resenhas, rodadas, auditoria, memberships) e recria. Usuários reais
  continuam existindo; voltam como admins se estiverem na lista nova.
- Admin real que já entrou no staging: ganha membership `ADMIN` (apelido = primeiro nome, Meia, nota 6).
- Admin que **nunca entrou**: o comando cria um `User` "reservado" com `googleId` = `pendente:<e-mail>` e a membership
  `ADMIN`. No primeiro login com Google, se não há User com aquele `googleId` mas há um reservado com o mesmo e-mail
  (verificado pelo Google), o login **assume** a reserva (grava o `googleId` real). Só reservas com o prefixo
  `pendente:` são assumidas; usuário com outro Google continua recusado como hoje.
- Condições para assumir a reserva: o Google diz `email_verified=true`; o e-mail é comparado normalizado
  (minúsculas, sem espaço); a reserva vira um User normal (googleId real, nome e foto do Google) e o marcador some.
- Esse método do login roda também em produção: lá uma reserva só existiria se o comando da demo rodasse contra a
  produção, o que as travas barram (marcador `ALLOW_DEMO_SEED=staging` + host proibido + workflow só com o segredo
  do staging). Sem reserva, o login é igual ao de hoje.
- Jogador nunca é apagado no app; o reset é só da demonstração, por comando explícito.

### Cenários
| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | `ALLOW_DEMO_SEED` ausente ou ≠ `staging` | roda o comando | recusa antes de abrir o banco | unitário |
| C2 | host da URL igual a um de `DEMO_FORBIDDEN_HOSTS` (o de produção) | roda | recusa sem imprimir a URL | unitário |
| C3 | `DEMO_FORBIDDEN_HOSTS` vazio | roda | recusa (sem saber qual é a produção, não roda) | unitário |
| C4 | e-mails inválidos ou lista vazia | roda | recusa com a mensagem do e-mail ruim | unitário |
| C5 | banco da vaga | roda com `agendada` | grupo `pelada-demo` com 21 + admins, 9 rodadas, resenhas; admins `ADMIN` | integração |
| C6 | outro grupo no banco (o seed de dev) | roda duas vezes | o outro grupo fica igual; a demo é recriada sem duplicar | integração |
| C7 | admin já tem User | roda | ganha membership ADMIN no User existente | integração |
| C8 | admin sem User | roda e depois loga com Google (mesmo e-mail) | o login assume a reserva e entra como admin | integração |
| C9 | User reservado | outra conta Google com e-mail diferente loga | nada muda na reserva | integração |
| C9b | User reservado | loga com o mesmo e-mail mas `email_verified=false` | recusa; reserva intacta | integração |
| C9c | e-mail da reserva com maiúsculas/espaço na lista | loga com o e-mail minúsculo | assume a reserva | integração |
| C9d | sem reserva | login normal (novo e existente) | igual a hoje | integração |
| C10 | seed de dev | `NODE_ENV` production | continua recusando (guarda antiga intacta) | unitário |
| C11 | cada cenário (`times`...`encerrada`) | roda | rodada atual no estado pedido | integração |

## Técnico

### Contrato
Sem rota nova. Comando: `pnpm --filter @fut-stats/api db:demo -- --admins=a@x.com,b@y.com [--cenario=times]`.
Lê `DATABASE_URL`, `ALLOW_DEMO_SEED` e `DEMO_FORBIDDEN_HOSTS` (lista de hosts, separados por vírgula).

### Workflow `.github/workflows/homologacao.yml` ("Preparar homologação")
- `workflow_dispatch` com `admins` (obrigatório) e `cenario` (choice, padrão `agendada`).
- Só roda se `github.ref == refs/heads/develop`. Usa só `secrets.STAGING_DIRECT_URL`; `ALLOW_DEMO_SEED=staging` fixo;
  `DEMO_FORBIDDEN_HOSTS` vem da variável do repositório `PROD_DB_HOST` (só o host da produção, não é segredo).
- Não roda migration (o deploy do Render já faz). Não imprime URL.

### Banco
Sem mudança no `schema.prisma`.

### Decisões
- Reserva por `googleId` `pendente:` em vez de tabela de convite: sem migration, segura (o Google verifica o e-mail
  e só a reserva marcada é assumida) e some sozinha quando a pessoa entra.
- O seed atual vira parametrizável (grupo, e-mails, guarda) e o caminho da demo tem guarda própria; o seed de dev
  continua igual.
- VAPID do staging: terceiro par, só documentação (o código já lê as três `VAPID_*`).

## Fora do escopo
- Tela nova; rodar qualquer coisa contra o Neon/Render nesta fatia.

## Perguntas respondidas pelo dono
- Trava de host? → sim, variável do repositório `PROD_DB_HOST` (trava dupla com o marcador).
- Reserva no login → aprovada com as condições acima e os testes C8, C9, C9b, C9c, C9d.

## QA
<Preenchido no fim.>
