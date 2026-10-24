# Brief do par: `<fatia>`

> Template do orquestrador para fatias no modo **Par** (ver "Trilha" em `docs/03-roadmap.md`).
> Copie, troque os `<...>` e mande a parte de cada agente para a sessão dele.

## Fatia
- **Nome:** `<fatia>` (#<n> da Trilha)
- **Entrega:** <o que o usuário consegue fazer no fim>
- **Parte de:** <PR/branch antiga a aproveitar, ou "—">
- **Regras de negócio:** <entradas do `CONTEXT.md` que valem aqui; o que estiver em aberto vira pergunta ao dono>

## Contrato (o orquestrador escreve; o back só transcreve)
| Método | Rota (sob `/api`) | Quem pode | Request (schema Zod) | Response (schema Zod) | Erros |
|---|---|---|---|---|---|
| `<GET>` | `/groups/:groupId/<...>` | <membro/admin> | `<NomeInput>` | `<NomeOutput>` | `<CODIGO>` (4xx) |

Schemas novos em `packages/shared/src/<feature>.ts`, derivados dos tipos do `packages/domain`.

## Regra do contrato (vale para os dois)
1. **O primeiro commit do back é só o contrato:** os schemas e tipos acima em `packages/shared`, nada mais
   (sem domínio, Prisma ou API). Mensagem: `feat(shared): contrato de <fatia>`. O back publica a branch e manda
   o SHA desse commit ao front.
2. **O front parte desse commit**, não da `develop`: `git switch -c feature/<fatia>-front <sha-do-contrato>`.
   O front só começa depois que esse commit existir.
3. **O front nunca edita o `packages/shared`.** Furo no contrato: o front pede ao back, o back faz um commit
   `fix(shared): ...` na branch dele, e o front puxa (`git rebase feature/<fatia>-back` ou `cherry-pick`).
4. Só o back mexe em `schema.prisma`, no `package.json` da raiz e no `pnpm-lock.yaml`.

## Agente back: `feature/<fatia>-back` (sai da `develop`)
1. Commit do contrato (regra acima) e aviso ao front.
2. Domínio (se faltar), com testes primeiro.
3. `schema.prisma` + migration (se precisar).
4. Módulo da API + testes de integração (supertest + Postgres de teste).
5. Deixa a API rodando (`pnpm --filter @fut-stats/api dev`) e avisa o front.

## Agente front: `feature/<fatia>-front` (sai do commit do contrato)
1. Tela no padrão das telas de entrar e de rodadas, seguindo o `DESIGN.md`.
2. Consome só os schemas do contrato; sem regra de negócio no front.
3. Valida no Playwright contra a API do back: fluxo principal funciona e console sem erros.

## Conversa entre os dois
Falam direto (SendMessage entre as sessões locais). Mudança de contrato sempre passa pelo back.

## Fim
- As duas branches se juntam em `feature/<fatia>` e sai **um PR** para a `develop`.
- Pronto = `pnpm lint && pnpm typecheck && pnpm test && pnpm build` na raiz.
- Marcar o item no `docs/03-roadmap.md` e registrar no `CONTEXT.md` o que mudou no domínio.
- PR antigo da fatia (se houver) fecha quando este abrir.
