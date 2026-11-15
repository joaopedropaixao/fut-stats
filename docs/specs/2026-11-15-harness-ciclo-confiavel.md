# Harness Codex: ciclo de execução confiável

Status: desenho aprovado pelo dono; primeiro incremento implementado localmente e validado.
Fonte de requisitos: `prompt-harness.md` e `.harness/aprendizados.md`.
Escopo: primeiro incremento da evolução do harness, em `feature/plugin-harness`.

## Intenção e decisões acordadas

Dar autonomia técnica ao TPL até o PR, com QA independente e evidência verificável.
O dono aprova o contrato antes da implementação. Mudanças de comportamento ou critérios
de aceite voltam ao dono; detalhes técnicos dentro do contrato seguem com o TPL.
Merge continua dependendo da autorização do dono para o PR concreto.

A sequência acordada é: ciclo confiável; QA incremental; roteamento e telemetria.
A matriz de modelos do prompt será a fonte única na etapa de roteamento. Este incremento
não muda o modelo de sessões existentes nem relança equipes.

## Abordagem

Estender `team.mjs`, seus testes e os adaptadores Codex existentes. O helper continua
registrando intenção e evidência; Orca continua executando e supervisionando os agentes.
Não criar outro orquestrador. Corrigir apenas instruções deixaria as mesmas lacunas de
estado; uma substituição ampla acrescentaria migração e risco desnecessários.

## Primeiro incremento

1. **Prontidão por worktree.** Registrar preparação com identidade do checkout, revisão,
   comandos/resultados e referências de evidência, sem conteúdo de `.env`. Antes do DEV,
   exigir dependências e ambiente preparados. Antes do QA, exigir também API/web saudáveis,
   fixtures adequadas e navegador operacional. Evidência declarada pelo coordenador deve
   ser identificada como tal: o helper não pode afirmar que executou verificações externas.
2. **Contrato no binding correto.** TPL aprova e registra o spec; DEV back escreve o primeiro
   commit de shared no próprio worktree. Front só é preparado para implementação após o
   SHA do contrato estar registrado e comprovado como ancestral de sua base. TPL não edita
   o checkout do back. O marco de contrato não encerra prematuramente o DEV back.
3. **Identidades separadas.** Preservar equipe, tentativa, sessão e recibo Orca como conceitos
   distintos. Recibo original permanece imutável. Um novo Task/Dispatch de follow-up gera
   tentativa relacionada à anterior; uma retomada com o mesmo recibo continua a tentativa.
   Reconciliar encerramento da execução anterior antes de ativar a substituta. Uma sessão
   recuperada conserva seu histórico de atribuições, sem dois bindings ativos concorrentes.
4. **Recuperação explícita.** Resultado de launch desconhecido exige inspeção e reconciliação,
   nunca relançamento automático. Recuperar infraestrutura da mesma QA não representa nova
   reprovação funcional. Após correção de produto, nova avaliação independente segue o fluxo
   de QA; o transporte da recuperação não determina sozinho a contagem de rodadas.
5. **Continuidade.** QA aprovado e sem pendência real conduz à integração, checks finais e PR.
   Espera humana só ocorre nos portões aplicáveis. Não eliminar checks nem enfraquecer Stop
   neste incremento; a política de notificações será ajustada com evidência na etapa seguinte.

## Estado e compatibilidade

Manter o armazenamento compartilhado em `git-common-dir/fut-harness`, com trava e escrita
atômica existentes. Acrescentar versão de esquema, timestamps e relações entre tentativas.
Preservar dados legados e não atribuir retrospectivamente tempos ou provas inexistentes.
Equipes em andamento mantêm seu fluxo; a política nova deve ser identificável nas novas
execuções. Nenhum registro autoriza assumir uma equipe de outra sessão ou ferramenta.

Arquivar o histórico necessário antes de liberar uma equipe, para que a telemetria futura
possa sobreviver ao cleanup. Falha em preservar estado operacional bloqueia sua remoção;
falha de telemetria não crítica será tratada separadamente e não bloqueará desenvolvimento.
Manter `working/waiting/delivering`; fases de workflow serão um campo separado.

## Etapas posteriores e fronteiras

- QA: matriz de evidências por cenário e revisão, invalidação por mudanças relevantes,
  fixtures reais e prova do processo MCP com `--isolated`; clipping, scroll e hit-test.
- Roteamento: matriz do prompt centralizada; reclassificação só afeta execuções futuras;
  configuração solicitada separada da observada. Verificação real do runtime permanece
  pendente, sem launches artificiais apenas para afirmar disponibilidade.
- Telemetria: eventos locais, relatório CLI/JSON/Markdown, tempos de execução e espera
  distintos; uso oficial quando disponível, ausência explícita quando não disponível,
  deduplicação e estimativas de custo identificadas com fonte e versão dos preços.
- Duas correções malsucedidas do mesmo problema escalam ao TPL. O limite existente de três
  reprovações funcionais e sua escalada ao dono precisam ser reconciliados na etapa de QA,
  sem contar falhas de infraestrutura como defeitos do produto.

## Aceite do primeiro incremento

Testes devem demonstrar: preparação incompleta não libera implementação; front não avança
sem contrato ancestral; recibos não são sobrescritos; follow-up conserva vínculo e histórico;
recuperação não duplica launch nem binding ativo; estado legado é preservado; histórico
sobrevive à liberação. Executar os testes do harness e checks requeridos pelo projeto.
Separar testes locais de prova ao vivo de Orca, confiança de hooks e configuração do MCP.

Sem mudança de produto, perfis pessoais, equipes Claude, Ranking/Pacote ou Auditoria.
Após entrega integrada, cleanup automático exige integração comprovada, Git limpo,
workers encerrados e recursos liberados. Preservar esta branch e seu worktree.

## Posse

A sessão documental liberou explicitamente este worktree para a sessão
`01a1e158-4704-78a1-8af8-a71f7c3cb246`, comprometendo-se a não escrever nem operar Git aqui.
O PR70 permanece documental e aberto; publicação da implementação deverá considerar esse
estado antes de acrescentar commits à mesma branch. Nenhum merge está autorizado aqui.
