# `producao`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`. Marcas `❓P<n>` = recomendação do líder esperando o
> dono (`docs/specs/perguntas-v1.md`).

| | |
|---|---|
| **Fatia** | `producao` (onda 6) |
| **Modo** | Back |
| **Parte de** | — (staging já está no ar: `docs/deploy.md`) |
| **Status** | rascunho |
| **Base** | develop @4a1540e |
| **Depende de** | auditoria-da-rodada, orcamento-de-bundle |
| **Toca em** | render.yaml, apps/web/vercel.json, .github/workflows, scripts, docs/deploy.md, docs/lancamento.md, docs/02-arquitetura.md, .env.example, apps/api/src/config/env.ts, apps/api/src/main.ts, apps/api/src/setup-app.ts, apps/api/src/common, apps/api/src/seed, apps/api/package.json, apps/web/src/main.tsx, apps/web/src/app, apps/web/package.json, pnpm-lock.yaml |

## Produto

### Objetivo
A `main` fica no ar como **produção**, separada do staging: endereço próprio, banco próprio, login próprio. Erro em
produção chega ao dono pelo **Sentry** antes de o grupo reclamar, e o banco tem **backup diário** que já foi
restaurado uma vez de teste. No fim, um roteiro de lançamento para chamar a pelada.

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
- **Endereço de produção** ❓P8: `*.vercel.app` com um nome bom, sem domínio próprio por enquanto. O endereço é
  do dono criar (passo 1 do roteiro) e vem no kickoff desta fatia.
- **Login em produção** ❓P8: o app do Google sai de "Testing" (qualquer conta Google entra; só entra na pelada
  quem tem o convite).
- **Backup** ❓P8: todo dia, cópia do banco de produção, **cifrada**, guardada por 30 dias como artefato do GitHub
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
| C9 | `render.yaml` | checagem de configuração (`scripts/check-deploy-config.mjs`, roda no `pnpm test` da raiz) | dois serviços: staging na `develop` e produção na `main`; os dois com `healthCheckPath`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, as do Google, `APP_URL`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT` e as três `VAPID_*`; nenhum valor de segredo escrito no arquivo | checagem |
| C10 | `apps/web/vercel.json` | a mesma checagem | o `/api/*` do endereço de produção vai para a API de produção, e o resto para a de staging; a regra do `index.html` continua por último | checagem |
| C11 | banco local com o seed | `scripts/backup-db.sh` com `BACKUP_PASSPHRASE` | gera `fut-stats-<data>.sql.gz.gpg`; o arquivo não tem texto legível (`strings` não acha nomes de tabela) | integração (script, no Postgres de teste) |
| C12 | o arquivo de C11 | `scripts/restore-db.sh` num banco vazio, com a senha certa | o banco restaurado tem as mesmas contagens por tabela do original | integração (script) |
| C13 | senha errada; variável faltando; banco de destino não vazio | `restore-db.sh` / `backup-db.sh` | falha com mensagem clara e código ≠ 0; o destino não vazio é recusado sem `--force` | integração (script) |
| C14 | `.github/workflows/backup.yml` | checagem de configuração | roda todo dia e por `workflow_dispatch`; usa os segredos `PROD_DIRECT_URL` e `BACKUP_PASSPHRASE`; sobe o artefato com retenção de 30 dias; nenhum passo imprime segredo | checagem |

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
| R1 | Criar o projeto de produção na Vercel (branch `main`, raiz `apps/web`) e informar o endereço | o endereço vai para o `vercel.json` e para o `APP_URL` de produção |
| R2 | Neon: copiar as duas URLs da branch `prod` (com e sem `-pooler`) | guardadas no gerenciador de senhas |
| R3 | Render: sincronizar o Blueprint (aparece o serviço `fut-stats-api`, plano gratuito) e colar as variáveis | deploy "Live" e `GET /api/health` 200 pelo endereço de produção |
| R4 | Google Cloud: client OAuth novo "Fut Stats produção" com a origem e a callback de produção; publicar o app (sair de "Testing") | login com uma conta que não está na lista de teste |
| R5 | Sentry: criar a conta e dois projetos (API e web); colar os DSN no Render e na Vercel | a mensagem "API no ar" aparece no Sentry |
| R6 | GitHub: criar os segredos `PROD_DIRECT_URL` e `BACKUP_PASSPHRASE` e rodar o backup à mão uma vez | artefato gerado; restaurar numa branch descartável do Neon com `restore-db.sh` e conferir |
| R7 | Release: PR `develop` → `main` (o orquestrador abre e mergeia com o ok do dono), tag `v1.0.0` | produção no ar com as migrations aplicadas |
| R8 | Fumaça em produção: entrar, criar a pelada, gerar o convite, instalar no celular, ligar os avisos e "Testar aviso" | tudo funciona; nenhum erro novo no Sentry |
| R9 | Lançar para a pelada com o `docs/lancamento.md` | — |

## Técnico

### Contrato
Sem mudança de rota. Variáveis de ambiente novas (todas opcionais; sem elas o comportamento é o de hoje):

| Variável | Onde | Para quê |
|---|---|---|
| `SENTRY_DSN` | API (Render) | liga o Sentry da API |
| `SENTRY_ENVIRONMENT` | API | `staging` ou `production` (padrão: `NODE_ENV`) |
| `VITE_SENTRY_DSN` | web (Vercel, no build) | liga o Sentry do web |
| `VITE_SENTRY_ENVIRONMENT` | web | idem |

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
  (`requestId`, `groupId`) e `user: { id }`. `sendDefaultPii: false`; um `beforeSend` remove cookies e cabeçalhos.
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
- **Checagem de configuração:** `scripts/check-deploy-config.mjs` lê `render.yaml`, `vercel.json` e `backup.yml`
  como texto/JSON e confere C9, C10 e C14; entra no `pnpm test` da raiz (script no `package.json` da raiz: é o
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
- Backup cifrado como artefato do GitHub — ❓P8: custo zero e sem conta nova; a cifra resolve o repositório
  aberto.
- Restaurar faz parte da entrega — backup que nunca foi restaurado não é backup.
- Sentry do web fora do JS inicial — monitorar não pode deixar o app mais lento de abrir.
- Sem rastreamento de desempenho no Sentry — o plano gratuito é para erros; a auditoria já dá `durationMs` nos
  logs.
- O health não consulta o banco — manteria o Neon gratuito sempre acordado.
- A release (`develop` → `main`) é do orquestrador, não desta fatia — a fatia entrega o ambiente e o roteiro; o
  dia de ir ao ar é do dono.

## Fora do escopo
- Domínio próprio (se a resposta da ❓P8 for manter `vercel.app`); e-mail próprio.
- Plano pago do Render para a API não dormir; "ping" para mantê-la acordada.
- Mapas de código (source maps) no Sentry, alertas por canal, painel de desempenho.
- Limite de pedidos por IP, cabeçalhos de segurança extras, verificação do app no Google.
- Agendador externo para fechar votação e mandar lembrete com a API dormindo.
- Cartola e pagamentos.

## Perguntas respondidas pelo dono
- Meta de custo zero, Render gratuito inclusive em produção, Sentry gratuito (`docs/02-arquitetura.md`).
- ❓P8 (endereço, login do Google e onde guardar o backup): aguardando (`perguntas-v1.md`).

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
