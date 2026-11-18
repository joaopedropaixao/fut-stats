# `producao`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.
> Dúvidas respondidas pelo dono em lote: `docs/specs/perguntas-v1.md`.

| | |
|---|---|
| **Fatia** | `producao` (onda 6) |
| **Modo** | Back |
| **Parte de** | — (staging já está no ar: `docs/deploy.md`) |
| **Status** | aprovado em 2026-11-14; endereço de produção decidido pelo dono em 17 nov 2026 (`fut-stats-app.vercel.app`) |
| **Base** | develop @2105544 (checkpoint de início em 18 nov 2026; antes, @1021769) |
| **Depende de** | auditoria-da-rodada, orcamento-de-bundle, votacao, pwa-e-push, jogo-ao-vivo, polimento-v1 (todas na develop) |
| **Toca em** | render.yaml, apps/web/vercel.json, .github/workflows, scripts, docs/deploy.md, docs/lancamento.md, docs/02-arquitetura.md, .env.example, apps/api/src/config/env.ts, apps/api/src/main.ts, apps/api/src/setup-app.ts, apps/api/src/common, apps/api/src/internal, apps/api/src/app.module.ts, packages/shared/src/internal.ts, apps/api/src/seed, apps/api/collections/dev-session.ts, apps/api/package.json, apps/web/src/main.tsx, apps/web/src/app, apps/web/src/router.tsx, apps/web/scripts/check-build.mjs, apps/web/package.json, package.json, pnpm-lock.yaml, CONTEXT.md, docs/03-roadmap.md |

## Produto

### Objetivo
A `main` fica no ar como **produção**, separada do staging: endereço próprio, banco próprio, login próprio. Erro em
produção chega ao dono pelo **Sentry** antes de o grupo reclamar, e o banco tem **backup diário** que já foi
restaurado uma vez de teste. Um **despertador** chama a API de 30 em 30 minutos (15 no pedido; ver Decisões) para a votação fechar na hora e
o aviso do resultado sair mesmo com ninguém usando o app (pedido do dono, 14 nov 2026). No fim, um roteiro de
lançamento para chamar a pelada.

### Quem usa
- **O dono:** segue o passo a passo para criar os serviços (ninguém mais tem acesso aos painéis), acompanha os
  erros no Sentry e sabe restaurar um backup.
- **O orquestrador:** faz a release (`develop` → `main`) com o ok do dono.
- **A pelada:** usa o endereço de produção. Nenhuma tela muda, fora a tela de erro geral.

### Regras de domínio
Nenhuma regra de negócio. Regras de operação:
- **Dois ambientes, nada compartilhado:** staging (`develop`, Neon `dev`) e produção (`main`, Neon `prod`), cada um
  com o seu serviço no Render, o seu projeto na Vercel, o seu segredo de sessão e o seu client do Google.
- **Custo zero** continua a meta (`docs/02-arquitetura.md`): Render gratuito inclusive em produção (a API dorme
  depois de um tempo parada e leva cerca de 1 minuto para acordar), Vercel e Neon gratuitos, Sentry gratuito.
- **Endereço de produção: `fut-stats-app.vercel.app`** (dono, 17 nov 2026). Entra no `vercel.json`, no `APP_URL` de
  produção, no client do Google e no R1. O staging segue em `fut-stats-three.vercel.app`. A instalação do app e os
  avisos ficam presos ao endereço: trocar depois do lançamento obriga o grupo a reinstalar e ligar os avisos de novo.
- **Login em produção**: o app do Google sai de "Testing" (qualquer conta Google entra; só entra na pelada
  quem tem o convite).
- **Backup**: todo dia, cópia do banco de produção, **cifrada**, guardada por 30 dias como artefato do GitHub
  Actions. Cifrada porque o repositório é de portfólio: sem a senha, o arquivo não serve para ninguém.
- **Dado pessoal fora do Sentry:** vai só o id do usuário e o `requestId`. Nunca email, nome, cookie nem corpo do
  pedido.
- **Só erro de verdade vai para o Sentry:** falha não tratada e resposta 5xx. Erro de regra (400, 401, 403, 404,
  409) não vai.
- **Seed nunca roda em produção.** Rotas de desenvolvimento não existem em produção (já é assim).

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**API e scripts**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | ambiente sem `SENTRY_DSN` | subir a API e forçar um erro 500 | a API sobe; nada é enviado (o Sentry nem é iniciado) | integração |
| C2 | `SENTRY_DSN` inválido (não é URL) | validar o ambiente | a API não sobe e diz o motivo | integração (`env.spec.ts`) |
| C3 | `SENTRY_DSN` definido e transporte trocado por um gravador | erro 500 forçado numa rota autenticada de grupo | um evento com `environment`, as tags `requestId` e `groupId` e `user: { id }`; sem email, nome, cookie, cabeçalho de autorização nem corpo | integração |
| C4 | idem | respostas 400, 401, 403, 404 e 409 | nenhum evento | integração |
| C5 | idem | a API sobe | uma mensagem de nível info "API no ar" com o ambiente (prova que o Sentry está ligado a cada deploy) | integração |
| C6 | `NODE_ENV=production` | `GET /api/dev/...` | 404 (regressão do que já existe) | integração |
| C7 | `NODE_ENV=production` | rodar o seed | recusa com "O seed não roda em produção" e sai com código 1, sem tocar no banco | integração (`seed.spec.ts`) |
| C8 | `GET /api/health` | chamar com o banco fora do ar | continua 200 (o health não consulta o banco: o Render chama a cada poucos segundos e o Neon gratuito suspende banco parado) | integração |
| C9 | `render.yaml` | checagem de configuração (`scripts/check-deploy-config.mjs`, roda no `pnpm test` da raiz) | dois serviços: staging na `develop` e produção na `main`; os dois com `healthCheckPath`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, as do Google, `APP_URL`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT` e as três `VAPID_*`; o de produção com `APP_URL=https://fut-stats-app.vercel.app`, `TICK_SECRET` (`sync: false`) e `VOTING_CLOSER_INTERVAL_MS=0`; o staging sem `TICK_SECRET`; nenhum valor de segredo escrito no arquivo | checagem |
| C10 | `apps/web/vercel.json` | a mesma checagem | o `/api/*` do endereço de produção vai para a API de produção, e o resto para a de staging; a regra do `index.html` continua por último | checagem |
| C11 | banco local com o seed | `scripts/backup-db.sh` com `BACKUP_PASSPHRASE` | gera `fut-stats-<data>.sql.gz.gpg`; o arquivo não tem texto legível (`strings` não acha nomes de tabela) | integração (script, no Postgres de teste) |
| C12 | o arquivo de C11 | `scripts/restore-db.sh` num banco vazio, com a senha certa | o banco restaurado tem as mesmas contagens por tabela do original | integração (script) |
| C13 | senha errada; variável faltando; banco de destino não vazio | `restore-db.sh` / `backup-db.sh` | falha com mensagem clara e código ≠ 0; o destino não vazio é recusado sem `--force` | integração (script) |
| C14 | `.github/workflows/backup.yml` | checagem de configuração | roda todo dia e por `workflow_dispatch`; usa os segredos `PROD_DIRECT_URL` e `BACKUP_PASSPHRASE`; sobe o artefato com retenção de 30 dias; nenhum passo imprime segredo | checagem |

**Despertador** (pedido do dono, 14 nov 2026)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C19 | `TICK_SECRET` configurado; uma rodada em `VOTING` com o prazo vencido e outra ainda no prazo, em grupos diferentes | `POST /api/internal/tick` com `Authorization: Bearer <segredo>`, **sem sessão** | 200 `{ closedVotings: 1 }`; a vencida passa a `CLOSED` com `DEADLINE_PASSED` e o resultado gravado; a outra segue em `VOTING` | integração |
| C20 | idem, com membros com assinatura de push | o mesmo `tick` | o aviso `RESULT_OUT` sai para os ativos do grupo (enviador trocado pelo gravador), uma vez só | integração |
| C21 | nada vencido | `tick` | 200 `{ closedVotings: 0 }`, sem escrever nada | integração |
| C22 | segredo errado; sem o cabeçalho; segredo certo em outro formato (`Basic`, query) | `tick` | 401, sem dizer o motivo e sem fechar nada | integração |
| C23 | ambiente **sem** `TICK_SECRET` | `tick` | 404 (a rota não existe); `TICK_SECRET` com menos de 32 caracteres: a API não sobe (`env.spec.ts`) | integração |
| C24 | dois `tick` ao mesmo tempo com uma votação vencida | `Promise.all` | fecha uma vez; a soma dos `closedVotings` é 1; um só aviso de resultado | integração |
| C25 | `tick` com sessão de usuário comum e sem o segredo | — | 401 (sessão não vale nessa rota) | integração |
| C26 | `.github/workflows/despertador.yml` | checagem de configuração | agenda de 30 em 30 minutos (`*/30 * * * *`, ver Decisões) e `workflow_dispatch`; chama `PROD_TICK_URL` com `TICK_SECRET` dos segredos; espera até 2 minutos e tenta de novo uma vez (a API pode estar acordando); falha com resposta diferente de 200; nenhum passo imprime o segredo | checagem |

**Endurecimento e correções** (checkpoint de início, 18 nov 2026)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C27 | `NODE_ENV=production`; pedido com `x-request-id: abc-123_DEF45` (formato válido) | chamar a API | a resposta e o log trazem um UUID novo, não o valor do cliente (em produção o id é sempre do servidor: ninguém de fora escolhe o id que vai para o registro da rodada e para o Sentry) | integração |
| C28 | `NODE_ENV` development ou test | o mesmo pedido | segue como hoje: o valor válido recebido é usado (C16 da `auditoria-da-rodada`, útil para o QA e para o Bruno) | integração (regressão) |
| C29 | banco de teste com os usuários de dev | a ferramenta `collections/dev-session.ts` (usada com o `/dev/entrar`) cria o grupo "Pelada Inativa" | o grupo é criado com o avatar padrão (`DEFAULT_AVATAR`) e o usuário inativo fica inativo nele; antes falhava porque `groups.create` era chamado sem `avatar` | integração (reproduz o defeito) |
| C30 | rodada em `VOTING` vencida, com membros com assinatura de push | `tick` | o fechamento sai pelo mesmo `closeDueVotings` do relógio: uma linha `VOTING_CLOSED` sem autor no registro da rodada e um sinal único `VOTING_CLOSED` (o canal ao vivo recebe `changed`); junto com C20, o push `RESULT_OUT` sai uma vez | integração |

**Web**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C15 | build sem `VITE_SENTRY_DSN` | abrir o app | nenhum pedido ao Sentry e nenhum pedaço do Sentry baixado | Playwright |
| C16 | build com `VITE_SENTRY_DSN` | abrir o app e olhar a rede | o Sentry entra por import dinâmico **depois** da primeira tela; o orçamento do JS inicial (`orcamento-de-bundle`) passa sem subir limite | checagem no build + Playwright |
| C17 | erro de renderização forçado numa tela (rota de teste só em dev) | abrir | tela de erro geral no padrão do app: título pixel "Deu ruim aqui", texto "Já avisamos quem cuida do app. Tente recarregar." e a tecla "Recarregar"; com o Sentry ligado, o erro é enviado com o id do usuário | Playwright |
| C18 | larguras 320, 375, 390, 430 px e desktop | a tela de erro geral | sem rolagem horizontal nem sobreposição; tecla ≥ 44 px; console só com o erro forçado | Playwright |

**Roteiro (o que só o dono consegue fazer; o TPL entrega escrito e conferido no staging)**

| Id | Passo | Conferência |
|---|---|---|
| R1 | Criar o projeto de produção na Vercel com o nome `fut-stats-app` (branch `main`, raiz `apps/web`), com `VITE_SENTRY_DSN` e `VITE_SENTRY_ENVIRONMENT` | o endereço é `fut-stats-app.vercel.app` (o mesmo do `vercel.json` e do `APP_URL`) |
| R2 | Neon: copiar as duas URLs da branch `prod` (com e sem `-pooler`) | guardadas no gerenciador de senhas |
| R3 | Render: sincronizar o Blueprint (aparece o serviço `fut-stats-api`, plano gratuito) e colar as variáveis, inclusive **um par VAPID novo, só de produção** (`npx web-push generate-vapid-keys`; o do staging não serve) | o serviço aparece e as variáveis ficam salvas; o primeiro deploy só fica "Live" depois do R7 (a `main` ainda não tem o app), quando `GET /api/health` responde 200 pelo endereço de produção; se o Render der outro endereço que não `fut-stats-api.onrender.com`, o `vercel.json` é corrigido antes da release |
| R4 | Google Cloud: client OAuth novo "Fut Stats produção" com a origem e a callback de produção; publicar o app (sair de "Testing") | login com uma conta que não está na lista de teste |
| R5 | Sentry: criar a conta e dois projetos (API e web); colar os DSN no Render e na Vercel | a mensagem "API no ar" aparece no Sentry |
| R6 | GitHub: criar os segredos `PROD_DIRECT_URL` e `BACKUP_PASSPHRASE` e rodar o backup à mão uma vez | artefato gerado; restaurar numa branch descartável do Neon com `restore-db.sh` e conferir |
| R6b | Despertador: gerar um segredo (`openssl rand -base64 48`), colar como `TICK_SECRET` no Render (produção) e nos segredos do GitHub, criar o segredo `PROD_TICK_URL` (o endereço direto da API de produção no Render + `/api/internal/tick`) e rodar o workflow à mão uma vez | o job fica verde e responde `{ closedVotings: 0 }` |
| R6c | Tempo real no staging (os 3 passos do PR #75): duas sessões, admin e jogador, na mesma rodada; o admin lança um gol | o gol aparece no jogador em até 2 s e o `.../stream` fica aberto na aba Rede; se o rewrite da Vercel segurar o fluxo, o gol aparece em até 5 s pelo modo antigo e abre-se um item para ligar o stream direto na API |
| R7 | Release: PR `develop` → `main` (o orquestrador abre e mergeia com o ok do dono), tag `v1.0.0` | produção no ar com as migrations aplicadas |
| R8 | Fumaça em produção: entrar, criar a pelada, gerar o convite e o roteiro em aparelho real do PR #76 (Android e iPhone: instalar, abrir pelo ícone, ligar os avisos, "Testar aviso" com o app fechado, tocar na notificação; com um admin em outro aparelho, marcar rodada, publicar times, abrir e encerrar a votação; "Sair da conta" para de receber) | tudo funciona; nenhum erro novo no Sentry |
| R9 | Lançar para a pelada com o `docs/lancamento.md` | — |

## Técnico

### Contrato
Uma rota nova, interna (não é para o app): o **webhook do despertador**. Schema em
`packages/shared/src/internal.ts`.

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `POST` | `/internal/tick` | quem tem o `TICK_SECRET` (`Authorization: Bearer`); sem sessão | — | `TickResult` | 401; 404 sem `TICK_SECRET` no ambiente |

```ts
// packages/shared/src/internal.ts
/** Resposta de POST /api/internal/tick: quantas votações vencidas foram fechadas agora. Sem dado de grupo. */
export const tickResultSchema = z.object({ closedVotings: z.number().int() });
export type TickResult = z.infer<typeof tickResultSchema>;
```

Variáveis de ambiente novas (todas opcionais; sem elas o comportamento é o de hoje):

| Variável | Onde | Para quê |
|---|---|---|
| `SENTRY_DSN` | API (Render) | liga o Sentry da API |
| `SENTRY_ENVIRONMENT` | API | `staging` ou `production` (padrão: `NODE_ENV`) |
| `VITE_SENTRY_DSN` | web (Vercel, no build) | liga o Sentry do web |
| `VITE_SENTRY_ENVIRONMENT` | web | idem |
| `TICK_SECRET` | API (Render, produção) | liga o webhook do despertador; mínimo de 32 caracteres |

Schema em `apps/api/src/config/env.ts`; exemplos comentados no `.env.example`.

### Banco (`schema.prisma`)
Sem mudança. A produção usa a branch `prod` do Neon; as migrations rodam no build do Render, como no staging.

### Domínio
Sem mudança.

Na API e na infraestrutura:
- **`render.yaml`:** segundo serviço `fut-stats-api` (plano `free`, `branch: main`, mesma região, mesmo
  `buildCommand`, `startCommand`, `healthCheckPath` e `buildFilter`), com as variáveis `sync: false` e
  `JWT_SECRET` com `generateValue`. `APP_URL` de produção com o endereço do R1. Os dois serviços ganham
  `SENTRY_DSN`, `SENTRY_ENVIRONMENT` e as `VAPID_*` (de `pwa-e-push`).
- **`apps/web/vercel.json`:** a regra do `/api/:path*` vira duas: a primeira com `has` do tipo `host` igual ao
  endereço de produção, apontando para `https://fut-stats-api.onrender.com/api/:path*`; a segunda, sem condição,
  continua no staging. Conferir a sintaxe na documentação atual da Vercel antes de escrever; se `has` por host não
  servir para rewrite externo, a alternativa é um `vercel.json` gerado no build a partir de uma variável do
  projeto (decisão do TPL, registrada aqui).
- **Sentry na API:** `@sentry/node` (ou `@sentry/nestjs`, o que a versão atual recomendar para Nest), iniciado no
  `main.ts` antes do `NestFactory` só quando há `SENTRY_DSN`. O filtro global de exceção de
  `auditoria-da-rodada` passa a capturar o que for 5xx ou não tratado, com as tags do contexto do pedido
  (`requestId`, `groupId`) e `user: { id }`. `dataCollection` fechado (no `@sentry/*` 11 o `sendDefaultPii` deu lugar ao `dataCollection`, que por padrão coleta tudo): sem IP, cookies, cabeçalhos, corpo, query nem variáveis locais; um `beforeSend` deixa só `user: { id }` e as tags. No painel, "Prevent Storing of IP Addresses" ligado (R5).
  Sem rastreamento de desempenho (`tracesSampleRate: 0`).
- **Sentry no web:** `@sentry/react` por `import()` em `apps/web/src/app/monitoring.ts`, chamado depois da primeira
  renderização e só com `VITE_SENTRY_DSN`. Um limite de erro (`ErrorBoundary`) no topo da árvore mostra a tela de
  erro geral e repassa o erro. `Sentry.setUser({ id })` quando a sessão carrega.
- **Seed:** o comando recusa `NODE_ENV=production`.
- **Backup:** `scripts/backup-db.sh` (`pg_dump --no-owner --format=plain | gzip | gpg --batch --symmetric
  --cipher-algo AES256`) e `scripts/restore-db.sh` (o inverso, recusando destino com tabelas sem `--force`).
  `.github/workflows/backup.yml`: `schedule` diário de madrugada no horário do Brasil e `workflow_dispatch`;
  instala o cliente do Postgres na mesma versão principal do Neon; roda o script com os segredos; sobe o arquivo
  com `actions/upload-artifact` e `retention-days: 30`. Falha do job chega por e-mail do GitHub ao dono.
  Observação para o `deploy.md`: o GitHub desliga agendamento de repositório sem atividade por 60 dias; um commit
  ou um clique em "Enable workflow" religa.
- **Despertador:**
  - `apps/api/src/internal` (módulo novo): `InternalController` com `POST /internal/tick`, marcado `@Public()`
    (sem sessão) e protegido por um guard próprio que compara o `Bearer` com `TICK_SECRET` em tempo constante
    (`crypto.timingSafeEqual`). Sem `TICK_SECRET`, o módulo sobe vazio e a rota responde 404 (o mesmo desenho do
    `DevModule`). A rota só chama o `closeDueVotings(now)` de `votacao` para todos os grupos e devolve a contagem:
    o fechamento, o registro da auditoria, o aviso em tempo real e o push do resultado já saem desse método.
  - `.github/workflows/despertador.yml`: `schedule` com `*/30 * * * *` (ver Decisões) e `workflow_dispatch`; um passo com
    `curl --fail --max-time 120 --retry 1 -X POST -H "Authorization: Bearer $TICK_SECRET" "$PROD_TICK_URL"`. Chama
    a API **direto no Render** (não pelo endereço do app), só a de **produção**.
  - `TICK_SECRET` em `src/config/env.ts`, `.env.example` e `render.yaml` (`sync: false`, só no serviço de
    produção).
  - **A conferir antes de fixar os 15 minutos:** com uma chamada a cada 15 minutos a API de produção quase não
    dorme mais (bom para quem abre o app, que deixa de esperar 1 minuto) e o banco acorda a cada chamada. O TPL
    confere os limites atuais dos planos gratuitos (horas de instância do Render, horas de computação do Neon)
    e, se o mês não fechar com folga, sobe o intervalo para 30 minutos. O intervalo fica numa linha do workflow.
  - O agendamento do GitHub pode atrasar alguns minutos: a votação fecha "no prazo, com até uns 30 a 40 minutos
    de folga". Voto depois do prazo já é recusado na hora por `votacao`, com ou sem despertador.
- **Checagem de configuração:** `scripts/check-deploy-config.mjs` lê `render.yaml`, `vercel.json`, `backup.yml` e
  `despertador.yml` como texto/JSON e confere C9, C10, C14 e C26; entra no `pnpm test` da raiz (script no `package.json` da raiz: é o
  dono do arquivo nesta onda, junto com o `pnpm-lock.yaml` por causa do Sentry; combinar com `pwa-e-push`, que
  também mexe no lock, a ordem de merge).
- **Dependências novas (justificar no PR):** `@sentry/node` (ou `@sentry/nestjs`) na API e `@sentry/react` no web:
  captura de erro com contexto, sem escrever um coletor próprio.

**Documentos:**
- `docs/deploy.md`: seção nova "Produção", com R1 a R8 no mesmo nível de detalhe do staging (onde clicar, o que
  colar, como conferir), a tabela de variáveis por ambiente, "Como restaurar um backup" e "Como ler um erro no
  Sentry e achar o pedido pelo `requestId`".
- `docs/lancamento.md` (novo): checklist do lançamento para a pelada: criar a pelada em produção, conferir o
  elenco e as notas iniciais, mensagem pronta para o WhatsApp (link de convite + como instalar no Android e no
  iPhone + ligar os avisos), o que acompanhar nas 2 ou 3 primeiras rodadas e onde anotar o retorno do grupo.
- `docs/02-arquitetura.md`: tabela de ambientes atualizada.
- Roadmap: marcar "Produção (`main`), Sentry, backup do banco".

### Tela
Só a **tela de erro geral** (`apps/web/src/app/error-screen.tsx`): fundo do app, `ErrorState` que já existe com
título em pixel e a tecla "Recarregar" (`window.location.reload()`). Regras de visual do documento de autonomia
valem (responsivo, alvo de 44 px, palavras). Sem outra mudança visual.

**Álbum** (`docs/design/prints/producao/`): `c17-erro-geral.png` a 390 px, `erro-geral-320.png`,
`erro-geral-desktop.png`, e um print do evento de teste no Sentry do staging.

### Decisões
- Dois projetos na Vercel e dois serviços no Render, um `vercel.json` e um `render.yaml` — a `main` e a `develop`
  carregam os mesmos arquivos; a diferença fica na regra por endereço e nas variáveis de cada painel.
- Client do Google separado para produção — segredo de staging vazado não abre a produção.
- Backup cifrado como artefato do GitHub — resposta do dono à P8: custo zero e sem conta nova; a cifra resolve o repositório
  aberto.
- Restaurar faz parte da entrega — backup que nunca foi restaurado não é backup.
- Sentry do web fora do JS inicial — monitorar não pode deixar o app mais lento de abrir.
- Sem rastreamento de desempenho no Sentry — o plano gratuito é para erros; a auditoria já dá `durationMs` nos
  logs.
- O health não consulta o banco — manteria o Neon gratuito sempre acordado.
- Despertador pelo GitHub Actions chamando um webhook com segredo — pedido do dono (14 nov 2026). Custo zero, sem
  conta nova, o mesmo mecanismo do backup; a rota só dispara o que `votacao` já sabe fazer.
- O despertador só em produção — o staging não precisa de hora certa, e duas APIs acordadas o mês inteiro pesam
  no plano gratuito.
- **Despertador de 30 em 30 minutos, não 15** (TPL, 18 nov 2026, conferido nos planos de hoje): o Render dá 750 horas
  gratuitas por **workspace** (staging e produção somadas) e dorme a API depois de 15 min sem pedido; um tick a cada
  15 min deixa a produção acordada o mês todo (~720–744 h) e quase nada sobra para o staging; se as horas acabam,
  **todos** os serviços gratuitos param até o mês seguinte, inclusive a produção. A cada 30 min a produção dorme ~metade
  do tempo (~380 h). O Neon dá 100 CU-hora por **projeto** (dev e prod juntas) e dorme em 5 min; 48 ticks por dia
  custam ~30 CU-hora. A votação fecha "no prazo, com até uns 30 a 40 minutos de folga" (o último voto e quem abre o app
  depois do prazo seguem fechando na hora). O intervalo fica numa linha do workflow.
- **Relógio interno desligado em produção** (`VOTING_CLOSER_INTERVAL_MS=0` no serviço de produção do `render.yaml`):
  com a API acordada, ele consulta o banco a cada minuto e não deixa o Neon dormir (só ele passaria de 90 CU-hora por
  mês). O despertador cumpre o papel dele em produção; o staging segue com o relógio, como hoje.
- **`x-request-id` do cliente só fora de produção** (pendência da `auditoria-da-rodada`): em produção o id é sempre um
  UUID do servidor, porque ele vai para o registro da rodada e para a tag do Sentry; o web não envia o cabeçalho.
  Em dev e teste segue valendo o recebido (QA e Bruno usam).
- **Tela de erro geral também para erro de rota:** o erro de renderização dentro de uma tela cai no `errorElement`
  do roteador (`route-error.tsx`), não no limite do topo. Pedaço que sumiu continua como hoje (recarrega uma vez);
  qualquer outro erro de rota mostra a tela de erro geral (C17) e vai para o Sentry. O limite do topo cobre o que
  quebra fora do roteador.
- **Cache do rewrite:** projeto novo da Vercel honra `Cache-Control` da origem externa; a API não manda `Cache-Control` público em `/api/*` (só ETag). Conferir no R6c que `/api/me` e o `.../stream` não saem com `x-vercel-cache: HIT`.
- **SSE em produção:** o canal ao vivo passa pelo rewrite da Vercel como no staging; o `: ping` de 20 s
  (`STREAM_HEARTBEAT_MS`) fica abaixo do tempo de espera do proxy da Vercel para origem externa (120 s) e o Render não
  documenta limite para conexão longa. Conferido no staging pelo R6c; se o rewrite segurar o fluxo, o app já cai no
  modo antigo.
- A release (`develop` → `main`) é do orquestrador, não desta fatia — a fatia entrega o ambiente e o roteiro; o
  dia de ir ao ar é do dono.

## Fora do escopo
- Domínio próprio (se o dono ficar com `vercel.app`); e-mail próprio.
- Plano pago do Render para a API não dormir.
- Mapas de código (source maps) no Sentry, alertas por canal, painel de desempenho.
- Limite de pedidos por IP, cabeçalhos de segurança extras, verificação do app no Google.
- Lembretes com hora marcada ("a votação fecha em 2 h", "falta confirmar presença"): o despertador desta fatia só
  fecha votação vencida. Os lembretes ficam para depois do lançamento (precisam gravar "já avisei").
- Usar o despertador para o rodízio (trocas de minutos pedem precisão que o agendamento do GitHub não tem).
- Cartola e pagamentos.

## Perguntas respondidas pelo dono
- Meta de custo zero, Render gratuito inclusive em produção, Sentry gratuito (`docs/02-arquitetura.md`).
- P8 · Login em produção? → Publicar o app do Google: qualquer conta entra (14 nov 2026).
- P8 · Onde guardar o backup? → Arquivo cifrado, 30 dias, no GitHub Actions (14 nov 2026).
- P15 · Despertador e webhook para os avisos? → Sim, a opção 1: só o despertador, para a votação fechar e o
  resultado sair na hora; sem lembretes por enquanto (pedido do dono, 14 nov 2026, depois do lote).
- P8 · Endereço de produção? → `fut-stats-app.vercel.app` (17 nov 2026; `futstats-app` já era de outra pessoa).
- Lançamento (17 nov 2026): `docs/lancamento.md` com a instalação para o grupo, uma parte Android e outra iPhone
  (Safari → Compartilhar → Adicionar à Tela de Início; sem instalar, o iPhone não recebe avisos), ligar os avisos,
  "Testar aviso" como primeiro passo de quem diz "não recebo nada" e um texto curto pronto para o WhatsApp.

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
