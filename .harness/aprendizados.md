# Aprendizados do harness: rodízio de reservas

**Sessão documental:** `aprendizados-harness`
**ID da sessão Codex:** `01a1e0cc-3889-72f3-af10-56e216de42c9`
**Branch:** `feature/plugin-harness`
**Run consultado:** `run_938627b8c1c2` — objetivo `tpl rodizio-reservas`
**Fontes de QA consultadas:** `/tmp/rodizio-reservas-qa-1.md` e os relatórios em `/tmp/rodizio-reservas-qa-2/` a `qa-5/`.

Este registro separa o que foi relatado pelo coordenador do que aparece nos artefatos consultados. Um relatório de QA comprova somente as verificações que descreve; não comprova, por si só, eventos de setup, hooks ou conversas que não registrou. Os arquivos de `/tmp` são fontes temporárias. Os fatos relevantes abaixo foram resumidos para que o aprendizado permaneça útil quando esses arquivos forem removidos.

## Evidências e relatos

| Caso | Classificação | Registro e consequência |
|---|---|---|
| Hooks impediram o TPL de editar o contrato no worktree filho. | **Relato do coordenador**; não localizado nos relatórios QA consultados. | O fluxo deixou o TPL responsável pelo commit inicial de contrato em `-back`, mas a sessão vinculada ao TPL foi impedida ao operar no filho. A propriedade do trabalho e o binding do processo não coincidiram. Direção: o DEV back, vinculado ao próprio worktree, produz o contrato como primeiro marco; o front só começa depois desse marco. |
| Setup dos filhos não terminou antes do lançamento dos DEVs. | **Relato do coordenador**; sem recibo de setup nos relatórios QA. | Instalação e preparação incompletas transferem falhas previsíveis para a implementação e QA. O lançamento deve esperar prova de setup para cada filho. |
| Recibo imutável conflitou com follow-up que cria novos Task/Dispatch. | **Relato do coordenador**; não demonstrado pelo `run-show` consultado. | A identidade da tentativa original não deve ser sobrescrita para acomodar uma nova Task/Dispatch. A proposta abaixo mantém a tentativa original e registra follow-ups como novas tentativas relacionadas. |
| QA repetiu trabalho por fixtures incompletas e infraestrutura. | **Relato do coordenador**, com apoio parcial dos relatórios. | QA2 cobriu C33 com resposta simulada, mas QA3 declarou que a seed real disponível não permitia comprovar o estado visual sem reservas. QA4 ainda pediu fixture apropriada e revalidações visuais. QA3 também descreveu uma queda transitória da API que gerou 502, seguida de reinício e repetição. O QA5 relata fixtures reais para C33/C42 e conclui a matriz. Fontes: `qa-2/report.md`, `qa-3/report.md`, `qa-4/report.md`, `qa-5/report.md`. |
| Playwright exigia `--isolated` no processo MCP; `isolatedContext` de aba não eliminou o lock. | **Relato do coordenador**; os relatórios registram contextos isolados, mas não o argumento de inicialização do processo nem o lock. | O isolamento que conta para evitar conflito precisa ser comprovado no nível em que o lock ocorre: processo do MCP. Uma opção de contexto por aba, isoladamente, não satisfaz esse critério. |
| Recuperação da mesma sessão QA preservou o binding. | **Relato do coordenador**; o relatório QA3 confirma auditoria dos worktrees, não a identidade/binding da sessão recuperada. | Recuperar o processo/sessão de QA existente preservou continuidade sem criar uma identidade de trabalho nova. Ao recuperar, confirmar que a sessão ativa continua vinculada à equipe e ao worktree esperados. |
| C43 foi falso positivo de sobreposição. | **Prova documentada no diagnóstico do TPL e no QA5.** | QA5 reproduz o caso: `main` rolável em `y=24..768`, navegação fixa em `y=776..836`; as caixas brutas dos controles no início estavam fora do recorte rolável. Após scroll real, screenshot mostrou controles visíveis acima da navegação e `elementFromPoint()` atingiu os dois controles nas larguras 320, 375, 390, 430 e 1280. O diagnóstico de `/tmp/rodizio-reservas-qa-5/c43-tpl-reproduction.md` antecipou a hipótese; `/tmp/rodizio-reservas-qa-5/report.md` registra a rechecagem e aprovação. A medição de `getBoundingClientRect()` sem clipping não bastava para concluir que havia conteúdo pintado sob a navegação. |
| Avisos automáticos de turno encerrado geraram ruído. | **Relato do coordenador**; não mensurado nos relatórios QA. | Notificações de fim de turno sem mudança de estado útil interrompem a leitura do andamento. Ajustar apenas após definir uma regra de notificação e testar que eventos importantes continuam visíveis. |
| TPL parou apesar de QA aprovado e da instrução para entregar. | **Relato do coordenador**; os arquivos QA demonstram aprovação final, mas não a causa da parada do TPL. | Uma aprovação completa do QA deve levar à etapa de entrega, sem espera artificial. O TPL segue até abrir o PR e informar o dono; merge continua separado e autorizado pelo dono/orquestrador. |
| Spec do apito foi atualizado antes do código. | **Relato do coordenador**; a ordem temporal não está demonstrada nos relatórios QA consultados. | Registrar e revisar o contrato/spec antes da implementação reduziu ambiguidade para os DEVs. Manter esse comportamento como regra, com evidência do spec aprovado anterior ao primeiro commit de código. |

### O que os relatórios QA comprovam

- QA2 registrou reprovação em C29/C43 e uma divergência de `packages/shared` no worktree front; registrou também suites e verificações de API/Playwright que passaram naquele ciclo.
- QA3 registrou reprovação por falta de prova visual de C33/C42 e cobertura incompleta de C43. Também registra indisponibilidade transitória da API, reinício e repetição dos fluxos, e baselines sem alterações.
- QA4 continuou sem aprovar: pediu fixture real para o caso sem reservas, revalidações e cobertura de C43 em vários estados e viewports.
- QA5 registrou fixtures para C33/C42, aprovação de C1–C43 e a rechecagem de C43 com clipping, scroll, screenshot e hit-test. O QA5 diz que reutilizou os checks integrados informados pelo TPL, sem repetir as suites completas.
- `orca orchestration run-show --id run_938627b8c1c2 --json --full` confirmou o Run e seu objetivo. O retorno não continha histórico de Task/Dispatch removido; portanto, este Run identifica o contexto, mas não é prova autônoma dos relatos de operação acima.

## Fluxo desejado

O objetivo é oferecer no Codex uma condução previsível e contínua, próxima da experiência Claude, preservando Orca, bindings, recibos e os papéis específicos de cada ferramenta.

1. **Preparação demonstrada antes do lançamento.** Criar os worktrees, instalar dependências, ligar os arquivos de ambiente autorizados e configurar recursos/banco. Cada filho entrega um resumo de setup com comandos e resultados; verificar health da API/web e fixture/seed quando QA depender deles. Só então iniciar os DEVs.
2. **Contrato escrito pelo back em seu próprio binding.** TPL fecha e aprova o contrato no spec. O DEV back, vinculado à sessão e worktree back, grava os schemas compartilhados como seu primeiro marco e reporta o SHA. O front só é lançado após esse SHA existir e estar acessível pela base acordada. O TPL não usa ferramentas de edição no filho.
3. **Tentativas rastreáveis sem recibo mutável.** O recibo original permanece imutável. Um follow-up que realmente abre nova Task/Dispatch recebe nova chave/identidade, com referência explícita à tentativa anterior e ao motivo. O histórico mostra uma cadeia de tentativas para a mesma entrega, sem fingir que os IDs novos pertencem ao recibo antigo.
4. **Fixtures reais completas antes do QA.** Preparar uma matriz que cubra todos os cenários da UI, inclusive time sem reservas, permissões admin/jogador e nomes de borda. Confirmar que seed/fixture pode ser acionada no ambiente isolado e que restaura o estado compartilhado. Se não puder demonstrar um estado visual, marcar como lacuna antes do lançamento do QA, não depois de várias rodadas.
5. **Navegador isolado comprovado pelo QA.** O brief de QA exige evidência de que o processo MCP foi iniciado com `--isolated`, além de contexto de navegador dedicado e login/estado esperados. Isolamento de uma aba não substitui isolamento do processo. Se o processo não estiver isolado, corrigir a inicialização antes de testar.
6. **Cobertura incremental com matriz de evidências.** Manter por cenário: estado (não executado/aprovado/reprovado), fonte da evidência, ambiente/fixture, alterações desde a rodada anterior e revalidações necessárias. QA novo concentra-se nos cenários alterados e nas lacunas abertas; cobertura completa é repetida quando a mudança ou risco exigir. Aprovação exige todos os critérios obrigatórios cobertos, não só os casos incrementais.
7. **Decisões técnicas resolvidas pelo TPL.** O TPL resolve lacunas mecânicas do spec, integração e escolhas técnicas dentro das regras já aprovadas. Escala ao dono somente regra de negócio nova, conflito real de contrato, mudança de banco fora da equipe, portões de aprovação ou outra decisão com consequência de produto/risco que as instruções não resolvem.
8. **Entrega contínua até PR.** QA aprovado e evidências completas conduzem diretamente à integração, checks finais, atualização de documentação/roadmap, commit, push pessoal e abertura do PR. O TPL comunica PR, QA e álbum e encerra sua responsabilidade. Não aguarda um turno futuro sem uma dependência concreta; não faz merge.

### Critério visual para C43

Não inferir colisão visual comparando apenas retângulos crus. Conferir o ancestral de clipping/scroll, a área realmente pintada, screenshot antes/depois do scroll e hit-test (`elementFromPoint`) nos pontos relevantes. Registrar viewport, posição de scroll e alvos. No QA5, esse conjunto distinguiu um falso positivo de uma falha real sem alterar CSS.

## Comparação com as regras Claude pessoais do projeto

Foram consultados os adaptadores de projeto `.claude/skills/tpl/SKILL.md`, `.claude/skills/lancar-equipe/SKILL.md` e `.harness/claude-workers.md`, além de `.claude/settings.json` e da configuração/autenticação no diretório pessoal `~/.claude-personal`. Nenhum arquivo de `~/.claude` ou `~/.claude.json` corporativo foi consultado.

| Tema | Claude pessoal hoje | Aprendizado para a experiência Codex |
|---|---|---|
| Preparação | Lançamento Claude prepara worktree, dependências, env e banco antes de escrever o kickoff e iniciar TPL. | Tornar setup dos filhos uma barreira observável antes de lançar DEVs/QA, com prova curta por worktree. |
| Contrato | Skill Claude Par orienta TPL a escrever e commitar o contrato no worktree back antes do front. | O binding/hook Codex revelou que propriedade do TPL em filho é frágil. Preferir primeiro marco do back DEV no seu próprio binding, preservando a precedência do contrato. |
| Continuidade | A skill Claude diz para não parar até abrir PR e define portões explícitos para aprovação do dono. | Aplicar o mesmo critério de conclusão no TPL Codex: aprovado → entregar PR; perguntas apenas em decisões realmente reservadas ao dono. |
| QA | Claude também exige QA novo, cenários, álbum e até três voltas funcionais. | A estrutura é compatível; acrescentar pré-checagem de fixture/infra e uma matriz incremental de evidências para evitar repetir verificações por falta de preparo. |
| Identidade e transporte | Claude pessoal exige `CLAUDE_CONFIG_DIR=~/.claude-personal`, terminal pessoal e supervisão Orca; mantém subagentes nativos. | Preservar essa configuração e o modelo Claude. Aproximar resultado/ritmo, sem trocar transporte, importar configuração ou fundir bindings com Codex. |
| Notificações | `.claude/settings.json` inclui hooks de notificação em `Notification` e `Stop`; o comportamento observado gerou ruído segundo o coordenador. | Definir política que priorize mudança de estado e entrega, sem remover avisos necessários nem copiar configuração automaticamente para o Codex. |

O conteúdo do `~/.claude-personal/settings.json` confirma preferências e plugins pessoais, mas a regra operacional do projeto está nos adaptadores versionados acima. As duas ferramentas devem continuar independentes em configuração, identidade e ciclo de execução, compartilhando as regras e o resultado esperado.

## Ajustes propostos — ainda não implementados

Não alterar hooks, helper, defaults de modelo, settings pessoais nem lançar equipe nesta entrega. Os itens abaixo são propostas para avaliação e implementação futura na branch dedicada `feature/plugin-harness`.

| Proposta | Critério de validação antes de adotar |
|---|---|
| Acrescentar gate de setup por filho antes dos launches de DEV/QA. | Em uma execução de fixture, tentativa com install/health/fixture incompletos não inicia worker; tentativa pronta registra prova por worktree e permite o launch. |
| Mover o primeiro commit de contrato para o DEV back vinculado ao próprio worktree. | Teste de fluxo mostra que back consegue editar `packages/shared`, front não inicia antes do SHA, front recebe contrato como ancestral/base e nenhuma sessão edita um worktree sem binding. |
| Modelar follow-up como nova tentativa relacionada sem reescrever recibo original. | Simular worker encerrado seguido de follow-up: IDs originais permanecem iguais, IDs novos são registrados sem colisão, vínculo entre tentativas é consultável e recuperação não duplica launch. |
| Criar checklist/fixture de prontidão do QA. | Fixtures reais cobrem todos os estados visuais requeridos; seed/restore é repetível; dependência caída é detectada antes do QA e não consome rodada funcional. |
| Exigir evidência do isolamento no processo Playwright MCP. | QA registra argv/identidade do processo isolado e contexto dedicado; teste negativo com processo não isolado bloqueia o início; `isolatedContext` sozinho não passa. |
| Introduzir matriz incremental de cenários e evidências. | Rodada seguinte recebe lacunas/alterações e revalida o escopo correto; aprovação não é possível com cenários obrigatórios ainda não cobertos; mudanças de risco alto acionam regressão ampliada. |
| Padronizar diagnóstico visual de clipping e interação. | Caso de teste de fixture demonstra detecção verdadeira e falso positivo: considera ancestral rolável, viewport, screenshot pós-scroll e hit-test, e não reprova por bbox fora do clipping. |
| Reduzir avisos de fim de turno sem perder eventos úteis. | Em uma sequência simulada, transições sem mudança não geram notificação repetida; pergunta, bloqueio, aprovação e entrega continuam notificando o destinatário correto. |
| Tornar explícito que TPL prossegue da aprovação QA até PR. | Cenário com QA aprovado e sem dependência pendente termina com PR preparado/aberto e relatório ao dono; cenário que precisa de decisão real para no portão correto. |
| Preservar spec antes do código como regra de execução. | Uma tentativa inválida sem spec aprovado/contrato suficientemente descrito não inicia implementação; a linha do tempo de evidência mostra aprovação do spec antes do primeiro commit de código. |

## Escopo desta entrega

Esta sessão registra aprendizados e propostas. Não altera produto, hooks, helper ou defaults, não assume nem lança equipes e não faz merge. O documento será publicado em PR documental pessoal para `develop`; a sessão `aprendizados-harness` permanece disponível para o dono continuar este registro.
