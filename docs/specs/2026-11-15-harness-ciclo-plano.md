# Plano de implementação: ciclo confiável

> Execução nesta sessão com `superpowers:executing-plans`, autorizada pelo dono.

**Objetivo:** aplicar o desenho `2026-11-15-harness-ciclo-confiavel.md` sem migrar equipes ativas.
**Arquitetura:** estender o registro transacional existente; separar validações de prontidão em
`.harness/lifecycle.mjs`. Orca permanece responsável por execução e liveness.
**Tecnologias:** Node.js, Git e node:test; sem dependências novas.

## Restrições

- Somente branch `feature/plugin-harness`, com posse liberada pela sessão documental.
- Não alterar produto, credenciais, modelos ou equipes existentes.
- Não publicar implementação no PR70 documental; entrega local revisável nesta etapa.
- Evidência externa é atestação explícita, nunca prova de liveness produzida pelo helper.

## Foco da revisão

Revisão diferente da preparada; spec alterado após aprovação; SHA fora da ancestralidade;
follow-up enquanto antecessor está ativo; liberação seguida de reutilização do mesmo nome.
Cada condição terá teste com repositório temporário real.

## Tarefa 1 — Prontidão e contrato

- [x] Escrever e observar falhas em `.harness/lifecycle.test.mjs`: DEV sem aprovação/setup,
  mudança de spec/HEAD, QA sem prova de fixtures/browser e front sem contrato ancestral.
- [x] Implementar `approve --mode Front|Back|Par --spec <md> --evidence <referência>`;
  `ready --worktree <path> --stage dev|qa --proof <json>`; `contract --session <id> --sha
  <sha> --evidence <referência>`. Novas equipes Codex recebem `policyVersion: 2`.
- [x] `prepare` verifica gates; `contract` exige back vinculado e commit em shared. Prova
  de setup identifica HEAD, comandos, exitCode e evidência por check; QA requer processo
  MCP isolado e navegação, além de API/web e fixtures. Não executar comandos da prova.
- [x] Preservar equipes sem policyVersion e adaptador Claude; ajustar fixtures atuais.
- [x] Rodar `node --test .harness/lifecycle.test.mjs .harness/team.test.mjs .codex/hooks/bridge.test.mjs`.

## Tarefa 2 — Tentativas e histórico

- [x] Escrever e observar falhas: follow-up concorrente, recibo reusado, recuperação na mesma
  sessão e tentativa encerrada, cancelamento/retry, archive após release e nome reutilizado.
- [x] Estender `prepare --after <key> --reason <texto>`: predecessor settled, chave nova e
  relação explícita. Mesmo recibo continua registrado; novo dispatch exige nova tentativa.
- [x] Preservar histórico de bindings ao recuperar sessão; impedir duas sucessoras ativas.
- [x] Adicionar IDs e timestamps, versão do estado e arquivo lógico de equipes liberadas no
  mesmo state.json atômico; falha de persistência não pode apagar o histórico operacional.
- [x] Rodar testes de lifecycle/team e verificar compatibilidade sem timestamps inventados.

## Tarefa 3 — Fluxo e entrega

- [x] Atualizar operação, workers, README e skills Codex com comandos, limites da evidência,
  back antes do front e recuperação sem contar infraestrutura como reprovação funcional.
- [x] Revisar com contexto independente, corrigir achados materiais com testes.
- [x] Rodar harness, hooks compartilhados e `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`; registrar limitações concretas. Não iniciar banco de outra equipe.
- [x] Entregar diff local e resultados; não mergear PR70 nem publicar mudança de escopo nele.

## Registro da execução

Direção e desenho aprovados. Implementação autorizada em 2026-11-15.
Decisão: execução direta e revisão final independente; sem lançar equipe de produto.
Interfaces comuns: gates usam a mesma identidade de worktree/tentativa que os bindings;
arquivo de histórico usa a transação existente, sem segundo escritor ou serviço.

### Resultado

Tarefas 1–3 concluídas localmente, sem publicação no PR70 e sem merge.
Testes novos observados falhando antes da implementação; execução final do harness: 39/39.
Hooks compartilhados: todos passando. Lint, typecheck, test e build da raiz passaram;
as tarefas de produto foram atendidas pelo cache do Turbo, sem nova execução de integração.
Revisão independente estática com Luna/medium não apontou defeitos materiais.

Decisões de execução: prova identifica caminho canônico além de HEAD; aliases de filesystem
como `/var` e `/private/var` são normalizados. QA exige DEVs encerrados e prontidão dos seus
checkouts; correções posteriores usam tentativas relacionadas. A asserção textual de cleanup
dos hooks foi atualizada à redação já existente no PR70, sem alterar o comportamento do Claude.

Baseline: 27/28 testes passaram antes do setup; formatação dependia de node_modules ausente.
`pnpm install --frozen-lockfile` resolveu essa dependência, sem alteração do lockfile.
O teste textual dos hooks procurava uma frase removida pelo PR70; a regra continua presente.

Limitações: não houve launch real, ativação de hooks, recuperação Orca ao vivo nem prova
de isolamento de um processo MCP real. Os testes usam repositórios temporários e provas
de fixture explicitamente identificadas. O helper valida evidências declaradas pelo
coordenador; não verifica automaticamente liveness nem executa os comandos da prova.
Roteamento por complexidade, relatório de métricas e matriz incremental QA seguem posteriores.
