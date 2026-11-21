---
name: lider-v1
description: Preparar no Codex os specs restantes da v1 do Fut Stats, lote de perguntas e ondas, ao receber kickoff de líder. Não retomar automaticamente o líder Claude existente.
---

# Líder da v1 no Codex

O objetivo, conteúdo dos specs, perguntas em lote e ondas são os mesmos do líder Claude.
Leia docs/specs/2026-11-14-autonomia-v1.md, AGENTS.md, CONTEXT.md, a Trilha, visão/escopo,
Cartola, docs/design/DESIGN.md, specs entregues e docs/specs/_modelo.md.
Use .harness/codex-workers.md e .harness/operacao.md. O líder usa a linha TPL da matriz Codex,
na complexidade registrada; não adotar modelo Claude do spec histórico. Registrar classificação
antes de prepare e conservar a configuração das sessões já abertas.

## Preparação do coordenador

Somente com pedido de uma tarefa nova ou retomada explicitamente autorizada. Se feature/specs-v1
já existir, inspecionar e perguntar antes de ocupar; a presença de um Claude pausado não autoriza
substituição. Para tarefa nova autorizada, criar worktree pelo Orca e reservar com
`team.mjs reserve --team <nome> --agent codex --kind leader --worktree <raiz>`.
Líder não ocupa vaga de API/banco. Preparar role lider-v1 e lançar/registrar pelo fluxo comum.

## Executar

1. Conferir branch e base indicadas no kickoff. Fetch pessoal; identificar as fatias não entregues
   e suas dependências. Ler código apenas para verificar existência real de rotas/models/telas.
2. Por fatia, copiar o modelo de spec: produto, cenários Cn e tipos de teste, contratos completos,
   banco, domínio, tela, Base/Depende de/Toca em e decisões. Preservar design aprovado no Paper.
3. Registrar dúvidas de negócio como ❓P<n> com recomendação; seguir os demais specs sem inventar
   uma decisão aprovada. Não chamar DEV nem implementar produto.
4. Commit por spec e push pessoal. Atualizar quadro com `Spec <fatia>`.
5. Juntar perguntas em docs/specs/perguntas-v1.md (fatia, pergunta, opções, recomendação e motivo).
   Mandar lote ao coordenador via ask, phase waiting, e terminar o turno. Aprovação explícita
   do lote pode aceitar recomendações; silêncio ou timeout não aprovam.
6. Aplicar respostas, retirar marcas, registrar decisões e status aprovado de cada spec.
7. Criar docs/specs/ondas-v1.md: até três fatias por onda, sem sobreposição de dono de model do
   schema, modo Front/Back/Par e referência visual que precisa estar aprovada antes de telas similares.
8. Atualizar Trilha se ordem ou escopo mudou com autorização. Rebase origin/develop, revalidar
   specs cujas dependências entraram depois da base, executar verificações apropriadas e publicar.
9. PR para develop com specs, perguntas respondidas e ondas; worker_done com link ao coordenador.
   Merge depende do dono. Não lançar as equipes como efeito colateral de terminar o planejamento.
