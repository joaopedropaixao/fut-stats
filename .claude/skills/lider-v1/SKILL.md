---
name: lider-v1
description: Use quando a sessão recebe "você é o líder da v1" (ou "kickoff do líder"). Escreve os specs de todas as fatias restantes da Trilha, junta as dúvidas num lote só para o dono, monta o plano de ondas e abre um PR com tudo.
---

# Líder da v1

Leia também `.harness/operacao.md` para identidade pessoal, reservas conjuntas e recuperação.
Este é o fluxo Claude; preserve seus modelos e subagentes nativos. Em sessão Codex, use
`.agents/skills/lider-v1/SKILL.md` (mergear compartilha este procedimento com seu adaptador).
Todo fetch/push/pull abaixo usa `sh .claude/scripts/git-pessoal.sh <operação>`, mesmo quando
abreviado no texto. Nunca usar a credencial GitHub padrão.


Você escreve o plano de execução do resto da v1. Não implementa nada: quem implementa são as equipes (skill `tpl`),
lançadas depois pelo orquestrador. Desenho e porquês: `docs/specs/2026-11-14-autonomia-v1.md`. Leia esse arquivo
inteiro antes de tudo, principalmente as regras de visual e as decisões do dono.

Rode com esforço `high`. Lançamento novo usa `.harness/claude-workers.md` e reserva
`--kind leader`; não ocupa vaga de banco/API. Não tomar o worktree de outro líder existente.

## 1. Entender
1. Confira que está na branch `feature/specs-v1`, atualizada com a `origin/develop`.
2. Leia: `AGENTS.md`, `CONTEXT.md`, `docs/03-roadmap.md` (Trilha e fases), `docs/01-visao-e-escopo.md`,
   `docs/04-cartola.md`, `docs/design/DESIGN.md`, os specs já entregues em `docs/specs/` (são o padrão de
   qualidade) e o modelo `docs/specs/_modelo.md`.
3. Veja o código só o bastante para saber o que já existe: `packages/domain/src`, `apps/api/src`,
   `apps/api/prisma/schema.prisma`, `apps/web/src/features`. Use subagentes Explore só para varreduras grandes, e
   lembre que cada subagente custa tokens.

## 2. Escrever os specs
Para cada fatia que falta na Trilha (as linhas sem ✅), em ordem de dependência:
1. Copie o modelo para `docs/specs/<fatia>.md` e preencha tudo: produto, cenários com id e tipo de teste, contrato
   completo (rotas, schemas, erros), banco (models e campos), domínio, tela e decisões.
2. Telas: aplique as regras de visual do documento de autonomia como critério explícito, com cenário de
   responsividade (320/375/390/430 px e desktop) e de sobreposição. Decida o visual você mesmo: o dono ajusta
   depois, pelo álbum.
3. Ponto que precisa do dono (regra de negócio em aberto, escolha de produto): **não pare**. Escreva a sua
   recomendação no spec, marque com `❓P<n>` e anote a pergunta no lote (passo 3).
4. Preencha **Base** (`git rev-parse --short origin/develop` no momento em que leu o código), **Depende de** e
   **Toca em** (prefixos de caminho: models do schema, arquivos do shared, pastas de tela). O detector de atraso
   usa esses campos para avisar quando uma dependência entrar na develop depois da base.
5. Commit por spec: `docs(<fatia>): spec`. Faça push da branch a cada commit e atualize o quadro:
   `sh .claude/scripts/quadro.sh set specs-v1 "Spec <fatia>"`.

## 3. Lote de perguntas
Junte tudo em `docs/specs/perguntas-v1.md`, numa tabela: `P<n>`, fatia, pergunta, opções, sua recomendação e por
quê. Mostre ao dono **numa mensagem só**, em ordem de impacto. Se você é worker do Orca, a mensagem vai ao
coordenador com `orca orchestration ask --question "<lote>"`; termine o turno e o Orca te acorda com as respostas. Ele pode responder só "ok" para aceitar todas as
recomendações, ou indicar exceções.

Com as respostas: aplique em cada spec, tire as marcas `❓`, registre a resposta na seção "Perguntas respondidas
pelo dono" e marque `Status: aprovado em <data>`.

## 4. Plano de ondas
Escreva em `docs/specs/ondas-v1.md`:
- as ondas, cada uma com até 3 fatias em paralelo, sem duas fatias da mesma onda mexendo no mesmo model do
  `schema.prisma`;
- o modo de cada fatia (Front, Back ou Par) e qual fatia da onda é dona do `schema.prisma`;
- para cada tela nova parecida com outra: qual é a tela de referência que precisa estar aprovada antes.

Atualize a Trilha no roadmap se a ordem mudar ou se surgir fatia nova.

## 5. Entregar
1. `git fetch && git rebase origin/develop`. Entrou algo na develop desde que você começou? Confira os
   specs cujo **Depende de** ou **Toca em** cruza o que entrou, ajuste e atualize a **Base**. Depois push, e PR para a `develop` com
   `GH_TOKEN=$(gh auth token --user joaopedropaixao) gh pr create --base develop --body-file <arquivo>`: lista dos
   specs, link do lote de perguntas respondido e as ondas.
2. Avise o dono com o link. O merge é do orquestrador, com o ok do dono.

# Terminar o trabalho
Não pare enquanto houver spec por escrever. Status curto é bem-vindo, mas siga com o que não depende do dono em vez
de oferecer continuar ou esperar. Erro, timeout ou comando que falhou: diagnostique e contorne. Pare só para o lote
de perguntas (passo 3) e para avisar o PR (passo 5).

# Comunicar
Escreva para quem não viu o seu trabalho: o ponto principal nas primeiras frases, frases curtas, sem termos que
você inventou no caminho. Em português.
