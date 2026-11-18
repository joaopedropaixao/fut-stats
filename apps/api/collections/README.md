# Coleção do Bruno da API

Requisições da API em arquivos `.bru` (texto puro, versionados no git), para abrir no [Bruno](https://www.usebruno.com/)
ou rodar pela CLI. Cobre saúde, sessão e, principalmente, grupos e convites: criar grupo, ver grupo e membros, link de
convite (ver e trocar), prévia pública, entrar pelo código e os casos de erro (400, 401, 403, 404, 409 e isolamento
entre grupos). Cada requisição tem `tests` com status e formato da resposta; ids e códigos passam de uma para a outra
por variáveis.

| Pasta                    | O que cobre                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| `01 Saude e sessao`      | `GET /api/health`, `GET /api/me` com e sem sessão                             |
| `02 Criar grupo`         | `POST /api/groups`, slug repetido, validação do corpo                         |
| `03 Ver grupo e membros` | `GET /api/groups/:groupId` e `/members`                                       |
| `04 Convite (admin)`     | `GET`/`POST /api/groups/:groupId/invite`: o código antigo para de valer       |
| `05 Previa publica`      | `GET /api/invites/:code` sem login; código antigo ou inexistente → 404        |
| `06 Entrar pelo convite` | `POST /api/invites/:code/join`: 201 entrou, 200 já é membro, 409 inativo      |
| `07 Erros e isolamento`  | PLAYER em rota de admin (403), quem não é do grupo (404), inativo, sem sessão |

## Sessões sem Google

O login é só pelo Google, então o `dev-session.ts` usa as classes da própria API (`SessionService`,
`GroupsService`, `PrismaService`), montadas à mão sem subir o Nest (o `tsx` não emite os metadados de decorator
que a injeção do Nest precisa), e cria sessões no banco de **desenvolvimento** (recusa rodar se o `DATABASE_URL` não for local):

- garante 4 usuários de teste: `dono`, `parceiro`, `intruso` e `inativo` (`@dev.local`);
- apaga os grupos sem rodada que só têm esses usuários (sobras de execuções anteriores);
- cria a "Pelada Inativa" pelo fluxo real (`GroupsService`) e desativa o `inativo` nela (caso do 409);
- assina a sessão de cada usuário com o `SessionService` (mesmo segredo e validade da API; o `JwtService` repete
  as opções do `AuthModule`: se elas mudarem, mude aqui também) e grava tudo em
  `environments/local.bru`.

O `environments/local.bru` tem sessões válidas e fica fora do git (`.gitignore` desta pasta). O modelo versionado é o
`environments/local.example.bru`. Se trocar o `JWT_SECRET`, rode o script de novo.

## Rodando

Da raiz do repositório:

```sh
# 1. Postgres de desenvolvimento (porta 5432)
docker compose up -d db

# 2. apps/api/.env a partir do exemplo. Para esta coleção o Google pode ficar com valores falsos
#    (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não podem ficar vazios); gere um JWT_SECRET de verdade.
cp apps/api/.env.example apps/api/.env

# 3. Migrations no banco de dev
pnpm --filter @fut-stats/api db:deploy

# 4. API em http://localhost:3000 (deixe rodando em outro terminal)
pnpm --filter @fut-stats/api dev

# 5. Sessões de dev → apps/api/collections/environments/local.bru
pnpm --filter @fut-stats/api exec tsx collections/dev-session.ts
```

### No app do Bruno

Abra a pasta `apps/api/collections` ("Open Collection"), escolha o ambiente `local` e rode a coleção inteira (Runner)
ou uma requisição por vez. As pastas dependem das anteriores (o `groupId` e o código do convite vêm de lá), então
rode em ordem.

### Pela CLI

Sem instalar nada no projeto, via `npx`:

```sh
cd apps/api/collections
npx -y @usebruno/cli@4.2.1 run --env local
```

Pode rodar quantas vezes quiser: cada rodada cria um grupo novo (nome com sufixo aleatório). Para limpar os grupos
criados, rode o passo 5 de novo.
