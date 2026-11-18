# Deploy (custo zero): staging e produção

As seções 1 a 7 descrevem o **staging**; a seção **Produção**, no fim, o ambiente da `main`.

Staging = o que está na `develop`, publicado na internet. Três serviços, todos no plano gratuito:

| O quê | Endereço |
|---|---|
| App (Vercel) | <https://fut-stats-three.vercel.app> |
| API pelo app (rewrite) | <https://fut-stats-three.vercel.app/api/health> |
| API direto (Render) | <https://fut-stats-api-staging.onrender.com/api/health> |

```
Navegador ──► Vercel (web, React)  ──/api/*──►  Render (API, NestJS)  ──►  Neon (Postgres, branch dev)
              https://fut-stats-three.vercel.app https://fut-stats-api-staging.onrender.com
```

O navegador só conversa com a Vercel. Quem chama `/api/...` na Vercel é repassado ao Render pelo
**rewrite** de `apps/web/vercel.json`. Para o navegador, front e API ficam no **mesmo endereço**, o que
facilita os cookies do login (que vem depois).

Arquivos envolvidos:

| Arquivo | Para quê |
|---|---|
| `render.yaml` | "Blueprint" do Render: descreve os dois serviços da API (plano free, build, health check): o de staging, na branch `develop`, e o de produção, na `main` |
| `apps/web/vercel.json` | Como a Vercel builda o front + o rewrite `/api/*` → Render |

> **Antes de começar:** este PR precisa estar **mergeado na `develop`**. Render e Vercel leem os
> arquivos acima da `develop`.
>
> As telas desses sites mudam com o tempo. Se algum botão não estiver exatamente com o nome
> descrito aqui, procure algo equivalente ou me mande um print.

Ordem: **1. Neon → 2. Render → 3. Vercel → 4. Validar.** Cada etapa precisa de um dado da anterior.

---

## 1. Neon (banco)

Você já tem conta e projeto. Falta: conferir a região, criar as branches `dev` e `prod` e copiar a
connection string.

> Branch do Neon ≠ branch do Git. No Neon, "branch" é uma **cópia do banco**. Usamos `dev` para
> staging/desenvolvimento e `prod` para produção (ver `docs/02-arquitetura.md`).

### 1.1 Conferir a região

1. Entre em <https://console.neon.tech> e clique no projeto.
2. Na tela inicial do projeto (Dashboard), procure a **região** (aparece algo como
   `AWS US East 1 (N. Virginia)`; também fica em **Settings → General**).
3. O ideal é **AWS US East 1 (N. Virginia)**, porque a API vai rodar na Virgínia (Render).
   - Se for outra região **e o projeto estiver vazio**, vale apagar e recriar o projeto escolhendo
     essa região (Settings → **Delete project**; depois **New Project**). Não dá para mudar a região
     de um projeto existente.
   - Se preferir não recriar, tudo funciona mesmo assim, só um pouco mais lento.

### 1.2 Criar as branches `prod` e `dev`

1. No menu da esquerda, clique em **Branches**.
2. Deve existir uma branch padrão chamada `main` (ou `production`). Ela vira a **`prod`**:
   - Clique no nome dela → no canto superior direito, menu **⋯** (ou **Actions**) → **Rename** →
     digite `prod` → salve.
3. Volte em **Branches** → botão **New branch** (ou **Create branch**):
   - **Name:** `dev`
   - **Auto-delete:** **Never** (o padrão "After 1 day" **apaga** a branch, e o banco de staging, no dia seguinte)
   - **Parent branch:** `prod`
   - Deixe o resto como está (**Branch data and schema**) → **Create**.

### 1.3 Copiar a connection string da `dev`

1. Volte ao **Dashboard** do projeto e clique no botão **Connect** (canto superior direito).
2. Na janela que abre, escolha:
   - **Branch:** `dev`
   - **Database:** `neondb` (o padrão)
   - **Role:** `neondb_owner` (o padrão)
   - **Connection pooling:** **ligado**. A URL vai ter `-pooler` no meio do endereço.
3. Clique em **Copy snippet**/copiar. O formato é:
   ```
   postgresql://neondb_owner:SENHA@ep-xxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
4. Guarde num lugar seguro (gerenciador de senhas). Esta é a **`DATABASE_URL` de staging**.
5. Ainda na janela, **desligue** o pooling e copie também a URL **sem** `-pooler` (conexão direta).
   Esta é a **`DIRECT_URL` de staging** (usada só nas migrations). Guarde junto.

> Essa URL contém a senha do banco. **Nunca** coloque no código nem em commit. Ela só vai no painel
> do Render. No seu computador o `.env` usa o Postgres do Docker, não o Neon.

---

## 2. Render (API)

Você está na tela **"Create a new Service"**. Não escolha "Web Service": vamos usar **Blueprint**,
que lê o `render.yaml` do repositório e preenche tudo sozinho.

### 2.1 Criar pelo Blueprint

1. Nessa tela, clique em **Blueprint** (em "New Blueprint Instance"). Se não aparecer, use o botão
   **+ New** no topo do dashboard → **Blueprint**.
2. Em **Connect a repository**, se o `fut-stats` não estiver listado:
   1. Clique em **GitHub** / **Connect GitHub** (ou **Configure account**).
   2. Abre o GitHub. Confira no topo que é a conta **joaopedropaixao** (a pessoal; se aparecer a
      corporativa, troque de conta no GitHub antes).
   3. Em **Repository access**, escolha **Only select repositories** → selecione **fut-stats** →
      **Install** (ou **Save**).
   4. Você volta ao Render com o repositório listado.
3. Clique em **Connect** ao lado de `joaopedropaixao/fut-stats`.
4. Preencha a tela seguinte:
   - **Blueprint Name:** `fut-stats-staging`
   - **Branch:** `develop`
   - **Blueprint Path:** deixe `render.yaml`
5. Logo abaixo o Render mostra o que vai criar: um web service **`fut-stats-api-staging`**, plano
   **Free**. Ele também pede o valor de duas variáveis (seção 1.3):
   - **`DATABASE_URL`**: a URL **com** `-pooler`
   - **`DIRECT_URL`**: a URL **sem** `-pooler`

   A `JWT_SECRET` (assina a sessão) não pede valor: o Render gera uma aleatória (`generateValue`).
   Em Blueprint já criado, ela aparece no próximo sync; confira em **Environment** do serviço.
6. Clique em **Deploy Blueprint** (ou **Apply**).

> Se o Render pedir cartão de crédito ou mostrar algum plano pago, **pare** e me avise. Este setup é
> 100% free.

### 2.2 Acompanhar o primeiro deploy

1. No menu da esquerda, **Dashboard** (ou **Projects**) → clique em **`fut-stats-api-staging`**.
2. Aba **Events** / **Logs**: o build leva alguns minutos (instala pnpm, dependências, builda
   `domain` → `shared` → `api`). No fim aparece **"Your service is live 🎉"**.
3. No topo da página do serviço aparece a **URL**, algo como
   `https://fut-stats-api-staging.onrender.com`. **Anote.**
4. Teste no navegador: `https://fut-stats-api-staging.onrender.com/api/health`
   → deve mostrar `{"status":"ok"}`.

> **A URL ficou diferente** (ex.: `fut-stats-api-staging-ab12.onrender.com`)? Acontece quando o nome
> já é usado por outra pessoa. Nesse caso, troque o endereço em `apps/web/vercel.json` (campo
> `destination`) num PR. Me avise que eu faço.

O que já fica configurado pelo `render.yaml`:

- **Deploy automático** a cada merge na `develop`, só quando muda algo da API (`buildFilter`).
- **Health check** em `/api/health`: o Render só troca a versão no ar se essa rota responder.
- **Node** pela versão do `.nvmrc`; **pnpm** pela do `package.json` (corepack, instalado numa pasta do
  projeto porque o `/usr/bin` do Render é só leitura).

> **Plano free "dorme":** depois de 15 min sem acesso, a API desliga e o primeiro acesso seguinte
> demora ~1 min para acordar. É normal em staging.

---

## 3. Vercel (web)

### 3.1 Importar o repositório

1. Entre em <https://vercel.com/new> (ou, no dashboard, **Add New… → Project**).
2. Em **Import Git Repository**, se o GitHub não estiver conectado ou o `fut-stats` não aparecer:
   1. Clique em **Continue with GitHub** / **Install** (ou no link **Adjust GitHub App Permissions →**).
   2. No GitHub, confira que é a conta **joaopedropaixao** → **Only select repositories** →
      **fut-stats** → **Install**/**Save**.
3. Na lista, clique em **Import** ao lado de `fut-stats`.

### 3.2 Tela "Configure Project"

> A Vercel mostra o repositório pela branch padrão (`main`), que ainda não tem a pasta `apps/`.
> Por isso a pasta do front e a branch `develop` são configuradas **depois** do import (3.3).

Preencha assim:

| Campo | Valor |
|---|---|
| **Project Name** | `fut-stats` (o endereço `fut-stats.vercel.app` já era de outra pessoa; a Vercel deu `fut-stats-three.vercel.app`) |
| **Framework Preset** | `Vite` (se não der para escolher, deixe o que vier) |
| **Root Directory** | deixe como está (`./`) por enquanto |
| **Build and Output Settings** | não mexa (o `vercel.json` define) |
| **Environment Variables** | abra a seção e adicione: **Key** `ENABLE_EXPERIMENTAL_COREPACK`, **Value** `1` → **Add** |

> A variável `ENABLE_EXPERIMENTAL_COREPACK=1` faz a Vercel usar a mesma versão do pnpm do projeto
> (campo `packageManager` do `package.json`). Sem ela a instalação falha.

Clique em **Deploy**. **Esse primeiro deploy vai falhar** (sai da `main`, que não tem o app).
Tudo bem: ele só serve para criar o projeto. Clique em **Continue to Dashboard** / volte ao projeto.

### 3.3 Apontar para `apps/web` e para a `develop`

Para a Vercel, o endereço fixo (`fut-stats.vercel.app`) é o da "Production Branch". Como este
projeto é o **staging**, a branch dele é a `develop`.

1. Abra o projeto → aba **Settings** → **Build and Deployment** (em telas antigas: **General**).
   - **Root Directory:** digite `apps/web` → **Save**.
   - Logo abaixo, confira que **"Include files outside the root directory in the Build Step"**
     está **Enabled** (o front usa `packages/shared`).
   - **Framework Preset:** `Vite` → **Save**, se não estiver.
2. Ainda em **Settings** → **Environments** → clique em **Production**.
   Em **Branch Tracking**, troque `main` por **`develop`** → **Save**.
   (Em telas antigas: **Settings → Git → Production Branch**.)
3. Aba **Deployments** → botão **⋯** (ou **Create Deployment**) no canto superior direito →
   escolha a branch **`develop`** → **Create Deployment**.
4. Espere ficar **Ready** (1–2 min). A partir daqui, todo merge na `develop` publica sozinho.

> **Previews por PR:** a Vercel também publica cada PR num endereço próprio (aparece um comentário
> no PR). Esses previews ficam protegidos por login da Vercel por padrão; o endereço fixo do passo
> acima não.

### 3.4 Pegar a URL

Na aba **Overview** do projeto, em **Domains**, está o endereço (ex.: `https://fut-stats.vercel.app`).
**Anote.**

---

## 4. Validar

1. **API direto no Render** (acorda a API se ela estiver dormindo):
   `https://fut-stats-api-staging.onrender.com/api/health` → `{"status":"ok"}`
2. **Front:** `https://<projeto>.vercel.app` → abre a página do app.
3. **API pela Vercel (o rewrite):** `https://<projeto>.vercel.app/api/health` → `{"status":"ok"}`

Pelo terminal:

```sh
curl -i https://<projeto>.vercel.app/api/health
# HTTP/2 200 ... {"status":"ok"}
```

| Sintoma | Causa provável |
|---|---|
| Build do Render falha com `EROFS: read-only file system` | `render.yaml` antigo, com `corepack enable` sem pasta própria. Atualize a `develop` e faça **Manual Deploy** |
| Passo 1 demora ~1 min e depois funciona | API estava dormindo (plano free). Normal |
| Passo 3 dá erro/timeout, mas o 1 funciona | Abra o passo 1 primeiro para acordar a API e tente de novo |
| Passo 3 devolve a página do app (HTML) em vez de JSON | Deploy da Vercel antigo ou da branch errada (refaça o 3.3) |
| Passo 3 dá 404 do Render | URL do Render diferente da do `vercel.json` (ver nota em 2.2) |
| Build da Vercel falha no `pnpm install` | Faltou `ENABLE_EXPERIMENTAL_COREPACK=1` (Settings → Environment Variables → adicione e faça redeploy) |

---

## 5. Banco e migrations

- **A API** conecta no Neon pela `DATABASE_URL` (com pooling).
- **As migrations** rodam sozinhas a cada deploy do Render: o `buildCommand` do `render.yaml` termina com
  `pnpm --filter @fut-stats/api db:deploy` (`prisma migrate deploy`), que usa a `DIRECT_URL`.
  Ele só aplica migrations já commitadas: nunca apaga dados nem cria migration nova.
  Se uma migration falhar, o build falha e a API antiga continua no ar.
- **Conferir:** no log do deploy no Render, procure `All migrations have been successfully applied`
  (ou `No pending migrations to apply`). No Neon, **Tables** da branch `dev` mostra as tabelas.
- **Local:** o `.env` usa o Postgres do Docker (`docker compose up -d`). Migration nova se cria na sua
  máquina com `pnpm --filter @fut-stats/api db:migrate --name <nome>`, nunca no Render.
- **Produção** (`main` + branch `prod` do Neon): outro serviço no Render e outro projeto na Vercel. Ver a seção
  "Produção" abaixo.

---

## 6. Login com Google

O login usa o client OAuth **Web application** do projeto `fut-stats` no Google Cloud. A API precisa de três
variáveis:

| Variável | De onde vem |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud → **APIs & Services → Credentials** (ou **Google Auth Platform → Clients**) → o client Web → **Client ID** (termina em `.apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | Mesma tela, **Client secret** (começa com `GOCSPX-`) |
| `APP_URL` | Endereço do app no navegador. Staging: já vem do `render.yaml`. Local: `http://localhost:5173` |

A callback é sempre `${APP_URL}/api/auth/google/callback`. Os endereços cadastrados no Google (não mexa):

- **Authorized JavaScript origins:** `https://fut-stats-three.vercel.app` e `http://localhost:5173`
- **Authorized redirect URIs:** `https://fut-stats-three.vercel.app/api/auth/google/callback` e
  `http://localhost:5173/api/auth/google/callback`

> **Sem as duas chaves a API não sobe** (a validação do ambiente recusa). No Render, cole antes do deploy que
> traz o login; se esquecer, o deploy falha e a versão antiga continua no ar.
>
> ID e secret **nunca** vão para o código, commit, PR ou chat. Só no painel do Render e no `.env` da raiz.

### 6.1 Render (staging)

1. <https://dashboard.render.com> → serviço **`fut-stats-api-staging`** → menu da esquerda **Environment**.
2. Em **Environment Variables**, clique em **+ Add** (ou **Edit**) e adicione:
   - **Key** `GOOGLE_CLIENT_ID`, **Value** o Client ID
   - **Key** `GOOGLE_CLIENT_SECRET`, **Value** o Client secret
3. Confira que existe `APP_URL` = `https://fut-stats-three.vercel.app` (vem do `render.yaml`; se não
   aparecer, adicione à mão com esse valor).
4. **Save, rebuild, and deploy** (ou **Save changes** e depois **Manual Deploy → Deploy latest commit**).
5. Espere o deploy ficar **Live** (aba **Events**).

### 6.2 Local (`.env` da raiz)

1. Se ainda não tem: `cp .env.example .env` (na raiz do repositório).
2. Preencha no `.env`:
   ```
   GOOGLE_CLIENT_ID=<Client ID>
   GOOGLE_CLIENT_SECRET=<Client secret>
   APP_URL=http://localhost:5173
   ```
3. `pnpm dev` e abra <http://localhost:5173/api/auth/google> (pelo Vite, porta 5173; pela 3000 o Google
   recusa com `redirect_uri_mismatch`).

### 6.3 Test users (enquanto o app estiver em "Testing")

Com o consent screen em **Testing**, só entra quem estiver na lista de test users (até 100). Os outros veem
"Access blocked: fut-stats has not completed the Google verification process".

1. <https://console.cloud.google.com> → confira no topo que o projeto é **fut-stats**.
2. Menu **Google Auth Platform → Audience** (em telas antigas: **APIs & Services → OAuth consent screen**).
3. Em **Test users**, clique em **+ Add users** → digite os e-mails Gmail (um por linha) → **Save**.

### 6.4 Testar

1. Abra <https://fut-stats-three.vercel.app/api/health> primeiro (acorda a API se ela estiver dormindo).
2. Abra <https://fut-stats-three.vercel.app/api/auth/google> → escolha a conta Google → **Continue**.
3. Você volta para a página inicial do app. Abra <https://fut-stats-three.vercel.app/api/me>: tem que
   mostrar seu nome e e-mail (`{"user":{...},"groups":[]}`).

| Sintoma | Causa provável |
|---|---|
| Voltou para `/?login=erro` | Cancelou no Google, demorou mais de 10 min, ou a conta não tem e-mail verificado. O motivo aparece nos **Logs** do Render (`Login com Google recusado: ...`) |
| `Error 400: redirect_uri_mismatch` | `APP_URL` diferente do cadastrado no Google (sem `https://`, com outro domínio, ou aberto pela porta 3000 em vez da 5173) |
| `Access blocked ... has not completed the Google verification process` | O e-mail não está nos test users (6.3) |
| `Error 401: invalid_client` | `GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_SECRET` errado/com espaço sobrando. Cole de novo e redeploy |
| `/api/me` dá 401 depois do login | Cookie de sessão não ficou: abra tudo pelo endereço da Vercel (não pelo do Render) |

---

## 7. Avisos push (VAPID)

Os avisos (rodada marcada, times, votação, resultado) saem pelo Web Push e a API assina cada envio com um par de
chaves **VAPID**. São três variáveis, **as três juntas ou nenhuma**:

| Variável | O que é |
|---|---|
| `VAPID_PUBLIC_KEY` | Chave pública. O app a pede em `GET /api/push/config`, então o front não ganha variável de build |
| `VAPID_PRIVATE_KEY` | Chave privada: **segredo**, só no painel do Render e no arquivo de ambiente da raiz |
| `VAPID_SUBJECT` | Seu contato para o serviço de push: `mailto:voce@exemplo.com` (ou um `https://`) |

> **Sem as três, o push fica desligado:** `GET /api/push/config` diz `{ "enabled": false }`, o app esconde o card
> de avisos e nenhuma ação tenta enviar. **Só uma ou duas** das três: a API não sobe e o erro diz qual falta.
> Trocar o par invalida todas as assinaturas (cada pessoa liga os avisos de novo): gere uma vez e guarde.

### 7.1 Gerar o par

```
npx web-push generate-vapid-keys
```

Saem duas linhas, **Public Key** e **Private Key**. Copie sem espaço sobrando. Nunca cole a privada em commit, PR
ou chat.

### 7.2 Render (staging)

1. <https://dashboard.render.com> → **`fut-stats-api-staging`** → **Environment**.
2. Adicione `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (o `render.yaml` já declara as três com
   `sync: false`, então o Render pede os valores).
3. **Save, rebuild, and deploy** e espere ficar **Live**.

### 7.3 Local

Preencha as três no arquivo de ambiente da raiz (o `.env.example` mostra os nomes, vazios). Para os avisos
chegarem no celular de verdade o endereço precisa ser `https` (use o staging); em `localhost` o navegador do
computador recebe.

### 7.4 Testar

1. Abra o app instalado, no **Perfil**, card **Avisos**, ligue o interruptor **Avisos neste celular** e toque em **Testar aviso**.
2. Com o app fechado, peça para o admin criar uma rodada: o aviso chega sem abrir o app.

| Sintoma | Causa provável |
|---|---|
| `/api/push/config` dá `enabled: false` | Falta alguma variável (ou as três) no Render, ou o deploy ainda não terminou |
| A API não sobe e o log cita `VAPID_*` | Só uma ou duas das três variáveis estão preenchidas, ou uma chave está com aspas, espaço, cortada ou trocada (a pública decodifica para 65 bytes, a privada para 32; a mensagem diz qual e o quê conferir, sem mostrar o valor) |
| Log `push-failed` ou `push-test-failed` | Traz `name`, `statusCode`, `body` (resposta do serviço de push) ou `code` e `errors[]` (rede: `ECONNREFUSED`, `ETIMEDOUT`...), e só o host do aparelho. `push-subscription-gone` com 403 é par de chaves trocado; `push-sent` (debug) com 201 quer dizer que o serviço aceitou |
| "Testar aviso" diz que enviou e nada chega | iPhone sem o app instalado na tela inicial, permissão bloqueada no navegador, ou o par de chaves foi trocado depois de ligar (desligue e ligue de novo), ou o macOS/Windows com o navegador sem permissão de notificação ou em "Não perturbe" |

---

# Produção

Produção = o que está na `main`. Dois ambientes, **nada compartilhado**: cada um com o seu serviço no Render, o seu
projeto na Vercel, o seu segredo de sessão, o seu client do Google e o seu par de chaves de aviso (VAPID).

| | Staging | Produção |
|---|---|---|
| Branch | `develop` | `main` |
| App (Vercel) | `fut-stats-three.vercel.app` | **`futstats-app.com.br`** (domínio próprio, registro.br) |
| API (Render) | `fut-stats-api-staging.onrender.com` | `fut-stats-api.onrender.com` |
| Banco (Neon) | branch `dev` | branch `prod` |
| Sentry | `SENTRY_ENVIRONMENT=staging` | `SENTRY_ENVIRONMENT=production` |
| Fechar votação vencida | relógio da API (1 min) | despertador do GitHub (30 min); relógio desligado |
| Backup | nenhum | diário, cifrado, 30 dias |

> O endereço do app **não muda depois do lançamento**: a instalação e os avisos ficam presos a ele. Trocar obriga
> o grupo a reinstalar e ligar os avisos de novo.

**O domínio próprio: `futstats-app.com.br`.** O Google não aceita `*.vercel.app` como domínio autorizado, então a
produção usa um domínio próprio, comprado pelo dono no registro.br em 18 nov 2026. Ele já está escrito em todo lugar onde
o nome entra (`render.yaml`, `apps/web/vercel.json`, esta documentação e o `docs/lancamento.md`), e o
`node scripts/check-deploy-config.mjs` (que roda no `pnpm test`) confere que o host de produção do `vercel.json` é o
mesmo do `APP_URL` de produção do `render.yaml`.

O `render.yaml` e o `apps/web/vercel.json` são os mesmos nas duas branches. A API de produção só responde pelos
endereços de produção graças às regras de `/api/*` do `vercel.json`: os hosts `futstats-app.com.br` **e** `fut-stats-app.vercel.app`
(o endereço padrão do projeto na Vercel, que continua existindo) vão para `fut-stats-api.onrender.com`; qualquer outro
host continua indo para o staging. O `www.futstats-app.com.br` só redireciona para o principal na Vercel (não precisa de regra).

**O que o dono já tem** (não precisa refazer): o projeto `fut-stats-app` na Vercel (branch `main`, raiz `apps/web`), os dois
projetos do Sentry (com os DSN), o client OAuth de produção do Google, o par VAPID de produção e o `BACKUP_PASSPHRASE`.
**Falta:** o domínio (R0), o Neon `prod` (R2), o Render (R3) e os segredos do GitHub (R7b e R7c).

## Variáveis por ambiente

Todas no painel do Render (a API) e da Vercel (o web). Nenhum valor vai para o repositório.

| Variável | Onde | Staging | Produção | Como obter |
|---|---|---|---|---|
| `DATABASE_URL` | Render | URL **com** `-pooler` da branch `dev` | URL **com** `-pooler` da branch `prod` | Neon → **Connect** (seção 1.3) |
| `DIRECT_URL` | Render | URL **sem** `-pooler` da `dev` | URL **sem** `-pooler` da `prod` | idem, com o pooling desligado |
| `JWT_SECRET` | Render | gerado pelo Render | gerado pelo Render (outro valor) | automático (`generateValue`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Render | client "fut-stats" | **client novo "Fut Stats produção"** | Google Cloud (R4) |
| `APP_URL` | Render | `https://fut-stats-three.vercel.app` (já no `render.yaml`) | `https://futstats-app.com.br` (já no `render.yaml`; a callback do Google sai dele) | — |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Render | par do staging | **par novo, só de produção** | `npx web-push generate-vapid-keys` |
| `SENTRY_DSN` | Render | DSN do projeto da API | o mesmo (a mesma API no Sentry) | Sentry (R5) |
| `SENTRY_ENVIRONMENT` | Render | `staging` (no `render.yaml`) | `production` (no `render.yaml`) | — |
| `TICK_SECRET` | Render | **não existe** | segredo de 48 bytes | `openssl rand -base64 48` (R7c) |
| `VOTING_CLOSER_INTERVAL_MS` | Render | padrão (60000) | `0` (no `render.yaml`) | — |
| `VITE_SENTRY_DSN` | Vercel (build) | DSN do projeto web | o mesmo | Sentry (R5) |
| `VITE_SENTRY_ENVIRONMENT` | Vercel (build) | `staging` | `production` | — |
| `ENABLE_EXPERIMENTAL_COREPACK` | Vercel | `1` | `1` | seção 3.2 |

Segredos do **GitHub** (Settings → Secrets and variables → Actions → **New repository secret**):

| Segredo | Para quê | Como obter |
|---|---|---|
| `PROD_DIRECT_URL` | o backup conecta no banco de produção | a URL **sem** `-pooler` da branch `prod` (a mesma do `DIRECT_URL` de produção) |
| `BACKUP_PASSPHRASE` | cifra o backup | `openssl rand -base64 48`; **guarde também no gerenciador de senhas**: sem ela o backup não abre |
| `TICK_SECRET` | o despertador autentica | o **mesmo** valor do `TICK_SECRET` do Render de produção |
| `PROD_TICK_URL` | o despertador chama a API | `https://fut-stats-api.onrender.com/api/internal/tick` (o endereço **direto** do Render, não o da Vercel) |

## Ordem do roteiro (R0 a R9)

Só o dono tem acesso aos painéis. Faça na ordem; cada passo diz como conferir. Os passos R7b e R7c (backup e despertador)
só podem ser feitos **depois do R7**, porque o GitHub só mostra "Run workflow" para workflows que já estão na branch
padrão (`main`) e a API de produção só existe depois da release.

### R0. Domínio próprio (registro.br + Vercel)

1. **Comprar o domínio** em <https://registro.br> (`.com.br`, cerca de R$ 40 por ano). Escolha o nome, pague e espere
   ele ficar ativo.
2. **Vercel:** projeto `fut-stats-app` → **Settings → Domains → Add Existing** → digite o domínio (`futstats-app.com.br`). A
   Vercel oferece adicionar também o `www`: aceite (`www.futstats-app.com.br`). No `www`, escolha **Redirect to `futstats-app.com.br`**
   (assim o `www` leva ao nome principal; não precisa de regra no `vercel.json`).
3. **DNS no registro.br (recomendado):** mantenha o DNS no próprio registro.br. Em **registro.br → Meus domínios → o
   domínio → DNS → Editar zona** (ou "Configurar zona DNS"), crie o que a Vercel mostrar na tela do domínio:
   um registro **A** do domínio principal (o "apex", nome em branco ou `@`) com o IP que a Vercel indicar, e um
   **CNAME** para o `www` apontando para o valor que a Vercel indicar. Copie os valores **da tela da Vercel**, não de
   outro projeto.
   Por que assim: é a menor mudança (só dois registros), o dono continua controlando o DNS e o e-mail do domínio fica
   intacto. A alternativa, se o registro.br não aceitar algum registro, é **trocar os servidores DNS** do domínio para
   os da Vercel (a tela da Vercel mostra os dois nomes, tipo `ns1.vercel-dns.com`); antes disso copie para a Vercel
   qualquer registro que você já use (e-mail, verificações), porque a troca leva a zona toda.
4. Espere a Vercel mostrar **Valid Configuration** (e o certificado emitido) nos dois nomes. Pode levar de minutos a
   algumas horas.
5. **O endereço antigo `fut-stats-app.vercel.app`:** a Vercel continua servindo o projeto por ele e a regra do
   `vercel.json` manda o `/api` dele para a API de produção. Se você quiser que ele leve ao domínio novo, em **Settings →
   Domains** o domínio padrão do projeto pode ser configurado com **Redirect** para `futstats-app.com.br` quando a Vercel
   oferecer essa opção para ele (a documentação de hoje não a descreve; confira na tela). Se não der, tudo bem: ele
   continua abrindo o app, mas **o login com Google só funciona no domínio do `APP_URL`** (`futstats-app.com.br`), porque a callback
   é montada a partir dele.
6. **Conferir:** a Vercel mostra o certificado válido nos dois nomes e `https://futstats-app.com.br` abre o app.

### R1. Vercel: projeto de produção (já criado pelo dono)

O projeto `fut-stats-app` já existe (branch `main`, raiz `apps/web`). Confira, em **Settings**:

1. **Build and Deployment:** **Root Directory** `apps/web`; **Include files outside the root directory** ligado.
2. **Environments → Production → Branch Tracking:** `main`.
3. **Environment Variables:** `ENABLE_EXPERIMENTAL_COREPACK` = `1`; `VITE_SENTRY_DSN` (o DSN do projeto web do Sentry) e
   `VITE_SENTRY_ENVIRONMENT` = `production`. A variável do Sentry entra no build: depois de mudar, faça **Redeploy**.
4. **Conferir:** em **Settings → Domains** estão ligados o `futstats-app.com.br` (R0) e o `fut-stats-app.vercel.app`.

### R2. Neon: URLs da branch `prod`

1. <https://console.neon.tech> → **Connect** → **Branch:** `prod`, **Connection pooling** ligado → copie (esta é a
   `DATABASE_URL` de produção). Desligue o pooling e copie de novo (a `DIRECT_URL`).
2. **Conferir:** as duas guardadas no gerenciador de senhas; uma tem `-pooler`, a outra não.

### R3. Render: serviço de produção

1. <https://dashboard.render.com> → **Blueprints** → o `fut-stats-staging` (o do staging, que lê o `render.yaml` da
   `develop`) → **Manual sync** (ou **Sync**). Como a `develop` já tem o `render.yaml` com os dois serviços, aparece o
   **`fut-stats-api`** (novo, plano **Free**, branch `main`). Confirme.
2. Preencha as variáveis do serviço de produção (**nunca** as do staging):
   `DATABASE_URL`, `DIRECT_URL` (R2), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (R4), as três `VAPID_*`, `SENTRY_DSN`
   (R5) e `TICK_SECRET` (R7c). Se algum valor ainda não existe, deixe para depois e preencha em **Environment**.
3. **Par VAPID novo, só de produção:** `npx web-push generate-vapid-keys`. O do staging **não** serve: trocar o par
   invalida as assinaturas dos aparelhos. `VAPID_SUBJECT` = `mailto:` com o seu e-mail.
4. Se o Render pedir cartão ou plano pago, **pare**. O serviço de produção builda a `main`: enquanto a release (R7) não
   acontece, o primeiro deploy dele falha por não achar o app. É esperado; preencha as variáveis agora.
5. **Conferir o endereço:** no topo da página do serviço aparece a URL; tem que ser
   `https://fut-stats-api.onrender.com`. Se for outra (ex.: `fut-stats-api-ab12.onrender.com`), me avise: o
   `vercel.json` e o `PROD_TICK_URL` mudam **antes** da release. Depois do R7 o serviço fica **Live** e
   <https://fut-stats-api.onrender.com/api/health> responde `{"status":"ok"}`.

> **Horas do plano gratuito:** o Render dá 750 horas por mês para **todos** os serviços gratuitos juntos. Se acabarem,
> os dois param (inclusive a produção) até o mês seguinte. Por isso o despertador é de 30 em 30 minutos (a produção
> dorme cerca de metade do tempo) e não de 15.

### R4. Google Cloud: client OAuth de produção

O client **Fut Stats produção** já existe (o dono criou com os endereços de `vercel.app`). Ajuste para o domínio próprio:

1. <https://console.cloud.google.com> → projeto **fut-stats** → **Google Auth Platform → Clients** → **Fut Stats produção**.
2. Acrescente (sem apagar os de `vercel.app`, que não atrapalham):
   **Authorized JavaScript origins:** `https://futstats-app.com.br`.
   **Authorized redirect URIs:** `https://futstats-app.com.br/api/auth/google/callback`.
3. Copie o **Client ID** e o **Client secret** para o Render de produção (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`),
   se ainda não colou.
4. **Google Auth Platform → Branding:** **Authorized domains** → `futstats-app.com.br` (o domínio comprado; o Google **recusa**
   `vercel.app`); **Application home page** `https://futstats-app.com.br`; **Application privacy policy link**
   `https://futstats-app.com.br/privacidade` (a página só existe depois do R7: o Google pode pedir para conferir o link; volte
   aqui depois da release).
5. **Publicar o app:** **Google Auth Platform → Audience → Publish app** (sai de "Testing": qualquer conta Google entra;
   só entra na pelada quem tem o convite).
6. **Conferir:** depois do R7, entre em `https://futstats-app.com.br` com uma conta que **não** estava na lista de test users.

### R5. Sentry: dois projetos

1. <https://sentry.io>: o dono **já criou** a conta e os dois projetos (e tem os DSN); se faltar algo, crie a conta (plano
   gratuito, **Developer**) e uma organização.
2. **Projects → Create Project**: um com a plataforma **Node.js** (nome `fut-stats-api`) e outro **React**
   (`fut-stats-web`). Em "alert settings" deixe os padrões (e-mail para você em erro novo).
3. Em **cada** projeto: **Settings → Security & Privacy** (ou **Project Settings → Security & Privacy**) → ligue
   **Prevent Storing of IP Addresses** (o app já não envia IP; isto garante do lado do Sentry). Não ligue nada que
   guarde dado do pedido.
4. Copie o **DSN** de cada projeto (**Settings → Client Keys (DSN)**).
5. Cole o DSN da API em `SENTRY_DSN` no Render (produção **e** staging; `SENTRY_ENVIRONMENT` já vem do `render.yaml`) e o
   do web em `VITE_SENTRY_DSN` (e `VITE_SENTRY_ENVIRONMENT` = `production`) no projeto da Vercel; faça **Redeploy**
   na Vercel (a variável entra no build).
6. **Conferir:** a cada deploy da API aparece no projeto `fut-stats-api` a mensagem **"API no ar"** (nível info) com o
   ambiente. Sem ela, o DSN está errado.

> O Sentry só recebe erro de verdade (resposta 5xx e falha não tratada) e o `id` do usuário e o `requestId`. Nunca email,
> nome, cookie, cabeçalho nem corpo de pedido.

### R6c. Tempo real no staging (antes da release)

1. No staging, abra duas sessões (admin e jogador) na mesma rodada em andamento (dois navegadores ou um anônimo).
2. O admin lança um gol. **Conferir:** o gol aparece no jogador em até 2 segundos e, na aba **Rede** (Network) do
   navegador, a chamada `.../stream` fica aberta.
3. Pelo domínio próprio (`futstats-app.com.br`) nada muda além do host do rewrite: a mesma regra de `/api/*` do `vercel.json` vale.
4. Se o gol só aparece em até 5 segundos, o rewrite da Vercel segurou o fluxo e o app caiu no modo antigo (continua
   funcionando): abra um item para ligar o stream direto na API.

### R7. Release

O orquestrador abre o PR `develop` → `main` e mergeia com o seu ok, e cria a tag `v1.0.0`. **Conferir:** o Render de
produção builda sozinho (as migrations rodam no build, na branch `prod` do Neon), fica **Live** e a Vercel publica o
app em `https://futstats-app.com.br`. Confira <https://fut-stats-api.onrender.com/api/health> e `https://futstats-app.com.br/api/health`
(os dois com `{"status":"ok"}`) e `https://futstats-app.com.br/privacidade` (para o R4).

### R7b. GitHub: segredos e o primeiro backup (depois do R7)

1. <https://github.com/joaopedropaixao/fut-stats> → **Settings → Secrets and variables → Actions → New repository
   secret**: crie `PROD_DIRECT_URL` (R2, sem `-pooler`) e `BACKUP_PASSPHRASE` (`openssl rand -base64 48`; guarde no
   gerenciador de senhas).
2. **Actions → Backup do banco → Run workflow** (branch `main`). A tecla só aparece depois do R7, porque o GitHub só
   mostra "Run workflow" para workflows que já estão na branch padrão.
3. **Conferir:** o job fica verde e, na página da execução, em **Artifacts**, aparece `backup-banco-producao` (30 dias).
4. **Restaurar uma vez de teste**: veja "Como restaurar um backup" abaixo, comparando as contagens que o backup e a
   restauração imprimem. Backup que nunca foi restaurado não é backup.

### R7c. Despertador (depois do R7)

1. Gere o segredo: `openssl rand -base64 48`. Cole como `TICK_SECRET` no Render de **produção** (Environment → Save)
   **e** como segredo `TICK_SECRET` no GitHub (mesmo valor).
2. Crie o segredo `PROD_TICK_URL` no GitHub: `https://fut-stats-api.onrender.com/api/internal/tick`.
3. **Actions → Despertador → Run workflow** (branch `main`; só aparece depois do R7). O Render de produção precisa já
   estar **Live** com o `TICK_SECRET` salvo.
4. **Conferir:** o job fica verde e o log termina com `{"closedVotings":0}`. Se falhar com `401`, os dois `TICK_SECRET`
   são diferentes (o do Render só vale depois do deploy que o inclui); com `404`, o Render ainda não tem o `TICK_SECRET`.

O workflow roda sozinho de 30 em 30 minutos e chama a API **direto no Render** (acorda a API se ela estiver dormindo;
espera até 2 minutos e tenta mais uma vez). Se o job ficar vermelho, o GitHub avisa por e-mail.

> **Os 60 dias do GitHub:** o GitHub **desliga** os agendamentos (despertador **e** backup) de repositório sem atividade
> por 60 dias. Um commit ou **Actions → o workflow → Enable workflow** religa. Anote no calendário para conferir.
>
> **Folga da votação:** o agendamento do GitHub pode atrasar alguns minutos, então a votação vencida fecha com até uns 30
> a 40 minutos de folga. O último voto e quem abre o app depois do prazo continuam fechando na hora, e voto depois do
> prazo é recusado na hora.

### R8. Fumaça em produção

Em aparelho real, **Android e iPhone** (o passo a passo para o grupo está em `docs/lancamento.md`):

1. Entrar com o Google em `https://futstats-app.com.br`, criar a pelada e pegar o link de convite (**Perfil**, card de convite).
2. Instalar o app, abrir pelo ícone, ligar o interruptor **Avisos neste celular** e tocar em **Testar aviso** com o app
   fechado; tocar na notificação.
3. Com um admin em outro aparelho: marcar a rodada, publicar os times, abrir e encerrar a votação.
4. **Perfil → Sair da conta**: depois disso o aparelho para de receber.
5. **Conferir:** tudo funcionou e **nenhum erro novo** apareceu no Sentry.

### R9. Lançar para a pelada

Siga o `docs/lancamento.md`.

## Como restaurar um backup

Restaure **sempre num banco que não é o de produção**. O `restore-db.sh` só aceita um destino **vazio** (sem nenhuma
tabela) e recusa qualquer outro, a menos que você passe `--force` (que apaga tudo do schema `public` do destino).
Atenção: uma branch do Neon criada a partir da `prod` já vem **com as tabelas e os dados**, então o script a recusa.
Duas opções:

- **A. Postgres local vazio (recomendado, não mexe no Neon).** Precisa do Docker:
  ```sh
  docker run --rm -d --name restaurar-teste -e POSTGRES_PASSWORD=postgres -p 5434:5432 postgres:17-alpine
  export RESTORE_DATABASE_URL='postgresql://postgres:postgres@localhost:5434/postgres'
  ```
  Ele nasce vazio, então não precisa de `--force`. Para terminar: `docker stop restaurar-teste`.
- **B. Branch do Neon só com o schema.** **Branches → New branch → Parent branch:** `prod` → marque **Schema only** →
  **Create** (recurso em beta, disponível no plano gratuito; conta como uma "root branch", e o plano gratuito tem 3).
  Ela copia as tabelas **sem os dados**, então o destino **não está vazio** e você precisa de `--force` (que apaga o
  `public` **dessa branch**). Copie a URL **sem** `-pooler` **da branch nova** e **confira que não é a da `prod`** (o
  nome da branch aparece no painel do Neon). Apague a branch no fim.

Passo a passo:

1. Baixe o arquivo: GitHub → **Actions → Backup do banco** → a execução → **Artifacts → `backup-banco-producao`**
   (vem num `.zip`; dentro está `fut-stats-AAAA-MM-DD.sql.gz.gpg`). Na mesma execução, abra o passo **Gerar o backup
   cifrado** e copie a lista **"Linhas por tabela neste backup"** (só contagens, sem dado).
2. Prepare o destino (opção A ou B acima) e, na sua máquina (precisa de `psql` e `gpg`; no macOS,
   `brew install libpq gnupg`), rode:
   ```sh
   export BACKUP_PASSPHRASE='<a senha do gerenciador de senhas>'
   sh scripts/restore-db.sh fut-stats-AAAA-MM-DD.sql.gz.gpg            # destino vazio (opção A)
   sh scripts/restore-db.sh --force fut-stats-AAAA-MM-DD.sql.gz.gpg    # branch só com o schema (opção B)
   ```
3. O script decifra antes de tocar no banco (senha errada ou arquivo corrompido falham ali, sem mexer no destino). Se a
   restauração falhar **sem** `--force`, ela é desfeita e o destino fica como estava; **com** `--force` o schema
   `public` já foi apagado, então o destino fica vazio ou incompleto (rode de novo).
4. **Conferir:** no fim o script imprime **"Linhas por tabela no destino restaurado"**, no mesmo formato da lista do
   backup. As duas listas têm que ser **iguais, tabela por tabela** (a do backup é contada no próprio arquivo, no
   instante do backup; é a prova de que nada se perdeu). Para comparar, cole cada lista num arquivo e rode `diff`:
   sem saída, está igual. (Comparar com a produção "de agora" não prova nada: ela muda o tempo todo.)

Para gerar um backup manual: `DIRECT_URL='<URL sem -pooler>' BACKUP_PASSPHRASE='...' sh scripts/backup-db.sh`.
Precisa do `pg_dump` na mesma versão principal do Neon (17).

## Como ler um erro no Sentry e achar o pedido pelo `requestId`

1. Abra <https://sentry.io> → o projeto `fut-stats-api` → **Issues**. Cada item é um erro 500 (ou falha não tratada).
2. Abra o item. No evento, em **Tags**, estão `requestId` e (se o pedido era de um grupo) `groupId`; em **User**, só o
   `id` do usuário; em **environment**, `production` ou `staging`. Não há email, nome, cookie nem corpo do pedido.
3. O mesmo `requestId` está no log da API (Render → o serviço → **Logs**, busque o valor): a linha do pedido tem
   método, caminho (sem query), status e duração. O erro de verdade e a pilha ficam no log com esse id.
4. Se o erro aconteceu numa rodada, o `requestId` também está no registro da rodada
   (`docs/operacao/registro.md` traz as consultas prontas).
5. Quando o app (web) mostrar "Deu ruim aqui", o erro vai para o projeto `fut-stats-web` com o id do usuário.

A mensagem **"API no ar"** (nível info) aparece a cada deploy da API: serve para provar que o Sentry está ligado.
