# Deploy de staging (custo zero)

Staging = o que está na `develop`, publicado na internet. Três serviços, todos no plano gratuito:

```
Navegador ──► Vercel (web, React)  ──/api/*──►  Render (API, NestJS)  ──►  Neon (Postgres, branch dev)
              https://<projeto>.vercel.app      https://fut-stats-api-staging.onrender.com
```

O navegador só conversa com a Vercel. Quem chama `/api/...` na Vercel é repassado ao Render pelo
**rewrite** de `apps/web/vercel.json`. Para o navegador, front e API ficam no **mesmo endereço**, o que
facilita os cookies do login (que vem depois).

Arquivos envolvidos:

| Arquivo | Para quê |
|---|---|
| `render.yaml` | "Blueprint" do Render: descreve o serviço da API (plano free, branch `develop`, build, health check) |
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
   - **Parent branch:** `prod`
   - Deixe o resto como está → **Create**.

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

   > Criou o Blueprint antes de a `DIRECT_URL` existir no `render.yaml`? Adicione à mão: serviço →
   > **Environment** → **Add Environment Variable** → `DIRECT_URL` → **Save Changes**.
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
- **Node** pela versão do `.nvmrc`; **pnpm** pela do `package.json` (corepack).

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
| **Project Name** | `fut-stats` (vira o endereço `fut-stats.vercel.app`; se já existir, a Vercel sugere outro) |
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
- **Produção** (`main` + branch `prod` do Neon) vem depois, quando houver release: outro serviço no
  Render e outro destino no rewrite. Não faz parte deste setup.
