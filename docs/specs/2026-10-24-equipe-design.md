# Equipe de desenvolvimento (TPL, DEVs e QA)

Spec do harness simples que organiza a entrega das fatias da Trilha (`docs/03-roadmap.md`).
Ainda não é o harness "completo" do workshop. É o mínimo que faz a entrega fluir com qualidade.

## Objetivo
Com um "ok" do dono, uma fatia sai do roadmap e vira um PR pronto para validação, passando por três etapas:
**Research/Plan → Implement ↔ Verify**. O dono só entra em dois portões: aprova o spec e valida no navegador.

**Sucesso:**
- O dono não precisa montar briefs nem coordenar agentes à mão.
- Nenhum DEV começa sem um spec aprovado.
- Nenhum PR abre sem que o QA tenha verificado todos os cenários do spec.
- O custo fica controlado: modelo definido por papel e no máximo 3 voltas de QA.

## Papéis
| Papel | Forma | Modelo | Onde | Faz | Não faz |
|---|---|---|---|---|---|
| Orquestrador | Sessão do checkout principal | Opus | `roadmap-orchestrator` | Recebe o ok, cria o worktree da fatia e entrega o kickoff | Implementar |
| TPL | Sessão principal da fatia (aberta pelo dono no Orca) | Opus | worktree `feature/<fatia>` | Research, perguntas ao dono, spec, contrato, coordena DEVs e QA, abre o PR | Implementar feature, fazer merge |
| DEV back | Subagente (`.claude/agents/dev-back.md`) | Sonnet | worktree `feature/<fatia>-back` | Domínio, Prisma, API e testes | Mexer no front |
| DEV front | Subagente (`.claude/agents/dev-front.md`) | Sonnet | worktree `feature/<fatia>-front` | Tela, validação no Playwright | Editar o `packages/shared` |
| QA | Subagente novo a cada volta (`.claude/agents/qa.md`) | Opus | lê os worktrees dos DEVs | Roda tudo e verifica cada cenário do spec | Editar código |

Subagente não conversa com o dono nem com outro subagente. Por isso o TPL é a sessão principal e faz a ponte.

## Fluxo

### 0. Lançamento (Orquestrador, skill `lancar-equipe`)
1. O dono pede "lança a equipe para `<fatia>`".
2. O Orquestrador confere a fatia e o modo (Front, Back ou Par) na Trilha e se a anterior já foi entregue.
3. Cria o worktree `feature/<fatia>` a partir da `origin/develop` em `~/orca/workspaces/fut-stats/<fatia>`.
4. Entrega ao dono o kickoff, que tem a fatia, o modo, a PR ou branch antiga e a instrução de usar a skill `tpl`.

### 1. Research/Plan (TPL, skill `tpl`)
1. Lê o `CONTEXT.md`, a linha da fatia, o `DESIGN.md`, as telas de referência (entrar, rodadas) e a branch ou PR antigo.
   Pode usar subagentes Explore para varrer o código.
2. Pergunta ao dono, uma pergunta por vez, só o que estiver ambíguo ou em aberto. Não inventa regra.
3. Escreve `docs/specs/<fatia>.md` a partir de `docs/specs/_modelo.md` e faz commit.
4. 🚦 **Portão 1:** o dono aprova o spec. Sem isso, nenhum DEV começa.

### 2. Implement (DEVs)
- **Par:**
  1. O TPL cria `feature/<fatia>-back` a partir de `feature/<fatia>` e faz nela o **primeiro commit: só o contrato**
     do spec em `packages/shared` (`feat(shared): contrato de <fatia>`).
  2. O TPL cria `feature/<fatia>-front` a partir desse commit.
  3. Lança os dois DEVs juntos, cada um no seu worktree.
- **Front ou Back:** um DEV só, no worktree `feature/<fatia>`.
- Cada DEV termina com lint, typecheck e testes verdes no seu pacote e um relatório: o que fez, o que ficou de
  fora e as dúvidas.
- **Furo no contrato:** o front reporta ao TPL. O TPL corrige com `fix(shared): ...` na branch do back e retoma o
  front, que puxa a mudança. O front nunca edita o `shared`.
- Arquivos com dono único: só o back mexe em `schema.prisma`, no `package.json` da raiz e no `pnpm-lock.yaml`.

### 3. Verify (QA)
1. Sobe a API (worktree do back) e a web (worktree do front).
2. Roda `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
3. Verifica **cada** Given/When/Then do spec, pela API e no Playwright. Inclui as permissões (jogador, admin e
   usuário de outro grupo) e confere que o console fica sem erros.
4. Devolve uma tabela com cada cenário ✅/❌. Nas falhas, inclui a evidência (comando, resposta, print) e qual DEV
   corrige.

**Loop:**
- O TPL repassa só as falhas ao DEV responsável e lança um QA novo, sem o contexto do anterior.
- **No máximo 3 voltas.** Se ainda houver ❌ depois disso, o TPL para e mostra ao dono o que falta.

### 4. Entrega (TPL)
1. Junta `-back` e `-front` em `feature/<fatia>`, faz `git fetch && git rebase origin/develop` e roda o "pronto"
   do `AGENTS.md` na raiz.
2. Marca `[x]` no roadmap e registra no `CONTEXT.md` o que mudou no domínio.
3. Abre o PR para a `develop` com o link do spec e a tabela final do QA. Se a fatia tinha PR antigo, fecha o antigo.
4. 🚦 **Portão 2:** o dono valida no navegador e faz o merge. O TPL nunca faz merge.

## Spec da fatia (`docs/specs/<fatia>.md`)
Fica no repo e entra no PR da fatia. O modelo está em `docs/specs/_modelo.md` e tem estas seções:
- **Produto:** objetivo, quem usa, regras de domínio (com referência ao `CONTEXT.md`) e os cenários
  Given/When/Then (caminho feliz, bordas, permissões).
- **Técnico:** contrato (rotas sob `/api`, schemas Zod, códigos de erro), mudanças no `schema.prisma`, funções de
  domínio novas e decisões com o porquê.
- **Fora do escopo** e **perguntas respondidas pelo dono**.

## Arquivos do harness
| Arquivo | Conteúdo |
|---|---|
| `.claude/skills/lancar-equipe/SKILL.md` | Passo 0 |
| `.claude/skills/tpl/SKILL.md` | Passos 1 a 4, portões, loop e quando chamar o dono |
| `.claude/agents/dev-back.md` | Regras do back (incluindo o contrato e os arquivos de dono único), `model: sonnet` |
| `.claude/agents/dev-front.md` | Regras do front (parte do contrato, não edita o `shared`, Playwright), `model: sonnet` |
| `.claude/agents/qa.md` | Verificação e formato do relatório, sem editar código, `model: opus` |
| `docs/specs/_modelo.md` | Modelo do spec da fatia |
| `AGENTS.md` | Uma linha apontando para o fluxo da equipe |

O `.claude/briefs/par.md` sai: as regras dele passam para os agentes e para a skill `tpl`, e o contrato passa
para o spec.

## Fora do escopo (por enquanto)
- Hooks, automação de CI e métricas de custo.
- Etapas e papéis separados para Research e Plan (fica para o harness do workshop).
- Mais de uma fatia ao mesmo tempo.
