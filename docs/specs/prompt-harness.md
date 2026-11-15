# Tarefa: Evoluir o Harness do Codex com Roteamento por Complexidade e Telemetria

## Objetivo

Evoluir o harness multiagente existente neste repositório, introduzindo:

1. Classificação de tarefas em três níveis de complexidade.
2. Roteamento de modelos e esforço de raciocínio conforme o agente e a complexidade.
3. Preservação do workflow atual e das aprovações do Product Owner.
4. Instrumentação de métricas de desempenho, custo, consumo e qualidade.
5. Relatórios que permitam avaliar e otimizar a eficiência da equipe de agentes.

**Esta é uma evolução incremental do harness existente, NÃO uma reimplementação.**

Priorize simplicidade, compatibilidade, rastreabilidade e baixo overhead operacional.

Toda a documentação, mensagens de interação e relatórios destinados ao Product Owner devem utilizar PT-BR.

Preserve identificadores técnicos, nomes de APIs, modelos, propriedades de configuração e fases existentes quando necessário.

---

## 1. Investigar a arquitetura atual

Antes de modificar qualquer arquivo, investigue como o harness está estruturado.

Identifique:

- Definição e execução do orquestrador.
- Configuração do TPL (Product Leader + Tech Leader).
- Configuração dos agentes Front-end, Back-end e QA.
- Implementação das fases RESEARCH, PLAN, IMPLEMENT e VERIFY.
- Mecanismos de delegação e execução paralela.
- Seleção atual de modelos e reasoning effort.
- Gestão do estado das tarefas.
- Aprovação de contratos pelo Product Owner.
- Loop de correção entre desenvolvedores e QA.
- Persistência de informações das execuções.
- Mecanismos existentes de logging, métricas e observabilidade.
- Arquivos de instruções, configurações, scripts e integrações relevantes.

Reutilize abstrações existentes.

Não crie novos componentes quando os atuais puderem ser estendidos adequadamente.

Preserve as funcionalidades e convenções atuais.

## 2. Classificação das tarefas

Toda tarefa deve receber um nível de complexidade antes da delegação ao TPL.

### ROTINEIRA

Destinada a:

- Correções pequenas de bugs.
- Alterações isoladas.
- Ajustes simples em funcionalidades existentes.
- Refatorações pontuais.
- Mudanças de baixo impacto.
- Bugs independentes que podem ser corrigidos em paralelo.

Características:

- Baixa complexidade.
- Pouca ambiguidade.
- Sem decisões arquiteturais relevantes.
- Validação simples.
- Aprovação manual do PO, sem processos adicionais de revisão.

### MEDIANA

Destinada a:

- Implementação de funcionalidades completas, mas moderadas.
- Novos endpoints e fluxos de interface.
- Regras de negócio de complexidade intermediária.
- Alterações envolvendo componentes relacionados.
- Funcionalidades que exigem testes e validação relevantes.

Características:

- Escopo bem definido.
- Impacto técnico moderado.
- Necessidade de planejamento.
- Sem grandes decisões arquiteturais ou estratégicas de longo prazo.

### COMPLEXA

Destinada a:

- Funcionalidades de alto impacto.
- Diferenciais competitivos do produto.
- Experiências importantes para a identidade e o design do produto.
- Decisões significativas de UX/UI.
- System design.
- Definições arquiteturais.
- Processos técnicos reutilizáveis de longo prazo.
- Mudanças estruturais e decisões difíceis de reverter.

Características:

- Alto impacto, incerteza ou responsabilidade.
- Consequências de longo prazo.
- Necessidade de investigação profunda.
- Exigências elevadas de qualidade e validação.

### Regras de classificação

A classificação deve considerar:

- Impacto no produto.
- Complexidade técnica.
- Incerteza.
- Escopo.
- Risco de regressão.
- Consequências arquiteturais e de longo prazo.

Não classifique tarefas apenas pelo número de arquivos envolvidos.

O orquestrador deve realizar a classificação inicial de maneira objetiva.

Quando existir ambiguidade relevante, poderá consultar o TPL.

Não crie discussões prolongadas apenas para definir a complexidade.

Registre o nível escolhido e uma justificativa curta.

---

## 3. Matriz oficial de modelos

Implemente a seguinte matriz como fonte única de verdade.


| Agente       | ROTINEIRA    | MEDIANA      | COMPLEXA       |
| ------------ | ------------ | ------------ | -------------- |
| TPL          | Sol / medium | Sol / high   | Astra / medium |
| Front-end    | Luna / low   | Sol / low    | Sol / medium   |
| Back-end     | Luna / low   | Sol / low    | Sol / medium   |
| QA           | Luna / low   | Sol / medium | Sol / high     |
| Orquestrador | Sol / low    | Sol / low    | Sol / low      |


### Regras

1. O orquestrador utiliza sempre Sol com reasoning low.
2. O TPL utiliza o modelo correspondente à complexidade.
3. Front-end e Back-end compartilham a mesma política.
4. QA utiliza o modelo correspondente à complexidade.
5. Todos os agentes recebem a classificação da tarefa.
6. Não permitir alterações silenciosas da política.
7. Evitar configurações duplicadas.
8. Reutilizar os mecanismos existentes de criação e delegação de agentes.

### Resolução dos modelos

Verifique os identificadores reais disponíveis no ambiente.

Considere inicialmente:

- Sol: `gpt-6.1-sol`
- Luna: `gpt-6-luna`
- Astra: `gpt-6-astra`

Confirme disponibilidade, compatibilidade e suporte aos níveis de reasoning configurados.

Não confunda nomes exibidos na interface com identificadores de modelos aceitos pela API ou runtime.

Se o mecanismo atual não permitir selecionar modelos diferentes para subagentes, investigue alternativas compatíveis com a arquitetura existente.

Não implemente adaptações arquiteturais desproporcionais.

Se alguma combinação não for suportada, documente a limitação e apresente a menor solução viável.

Nunca declare que uma configuração está ativa sem verificar como o runtime efetivamente executa o agente.

---

## 4. Preservação do workflow

O workflow deve continuar:

RESEARCH → PLAN → APROVAÇÃO DO PO → IMPLEMENT → VERIFY

### RESEARCH

Responsável: TPL.

- Investigar o problema.
- Entender requisitos e contexto.
- Identificar dependências.
- Levantar dúvidas relevantes.
- Analisar riscos e restrições.

### PLAN

Responsável: TPL.

- Consolidar decisões de produto e tecnologia.
- Definir requisitos.
- Especificar contratos.
- Estabelecer critérios de aceite.
- Planejar implementação.
- Identificar fronteiras e dependências.

O Product Owner deve aprovar explicitamente o contrato antes da implementação.

A aprovação é obrigatória para todos os níveis de complexidade.

Para tarefas rotineiras, mantenha a aprovação leve e objetiva.

### IMPLEMENT

Responsáveis: Front-end e/ou Back-end.

- Executar o contrato aprovado.
- Trabalhar em paralelo quando apropriado.
- Respeitar dependências e isolamento.
- Manter consistência com a arquitetura existente.
- Evitar decisões fora do escopo aprovado.

### VERIFY

Responsável: QA.

- Validar critérios de aceite.
- Executar testes relevantes.
- Identificar erros e regressões.
- Produzir feedback reproduzível.
- Devolver correções aos desenvolvedores.
- Validar novamente após cada correção.

### Loop de qualidade

IMPLEMENT ↔ VERIFY

O loop continua até:

- QA aprovar a implementação; ou
- um bloqueio exigir intervenção ou decisão adicional.

Após duas tentativas malsucedidas de corrigir o mesmo problema, escale para o TPL.

Não altere automaticamente a complexidade da tarefa apenas por haver um problema difícil.

Se uma alteração no contrato aprovado for necessária, retorne ao PLAN e solicite nova aprovação do PO.

---

## 5. Reclassificação dinâmica

Permita reclassificar tarefas quando surgirem novas informações relevantes.

Exemplos:

- Um bug simples revela problemas estruturais.
- Uma funcionalidade mediana exige alteração arquitetural importante.
- Uma tarefa complexa torna-se simples após a investigação.

Ao reclassificar:

1. Registrar o nível anterior.
2. Registrar o novo nível.
3. Justificar a mudança.
4. Atualizar o roteamento das próximas execuções.
5. Preservar o histórico e as decisões existentes.
6. Solicitar nova aprovação do PO somente quando o contrato precisar ser alterado.

Evite reiniciar etapas concluídas desnecessariamente.

---

# 6. Telemetria e métricas de eficiência

Instrumente o harness para permitir uma análise objetiva do desempenho dos agentes.

A telemetria deve ser leve e aproveitar eventos e dados já disponíveis.

Não introduza serviços externos, infraestrutura ou dependências pesadas sem necessidade.

## 6.1 Identificação das execuções

Cada tarefa deve possuir um identificador único.

Cada execução de agente deve possuir um identificador próprio, relacionado à tarefa principal.

Registre, quando disponível:

- ID da tarefa.
- ID da execução do agente.
- Papel do agente.
- Complexidade da tarefa.
- Fase do workflow.
- Modelo utilizado.
- Reasoning effort configurado.
- Momento de início.
- Momento de término.
- Status final.
- Motivo de falha ou bloqueio.

Permita relacionar execuções paralelas à mesma tarefa.

## 6.2 Métricas de tempo

Colete:

- Tempo total da tarefa.
- Tempo de RESEARCH.
- Tempo de PLAN.
- Tempo de IMPLEMENT.
- Tempo de VERIFY.
- Tempo de execução por agente.
- Tempo de espera pela aprovação do PO.
- Tempo acumulado em correções solicitadas pelo QA.

Diferencie:

- Tempo decorrido total.
- Tempo efetivo de execução dos agentes.
- Tempo de espera humana.

Em execuções paralelas, não some as durações individuais como se representassem tempo total decorrido.

Registre timestamps suficientes para calcular corretamente a duração real da tarefa.

## 6.3 Consumo de tokens

Quando os dados estiverem disponíveis no runtime, registre:

- Tokens de entrada.
- Tokens de saída.
- Tokens de raciocínio.
- Tokens de entrada em cache.
- Total de tokens.
- Modelo.
- Agente.
- Tarefa.
- Fase.

Permita agregar consumo por:

- Tarefa.
- Complexidade.
- Modelo.
- Agente.
- Fase.
- Período.

Não estime tokens quando existirem dados oficiais disponíveis.

Se alguma métrica não estiver acessível, registre-a como indisponível.

Não substitua ausência de informações por zero.

Evite contagens duplicadas quando o runtime fornecer estatísticas agregadas e individuais.

## 6.4 Estimativa de custo

Quando a execução expuser dados e preços aplicáveis, permita estimar o custo por:

- Execução.
- Agente.
- Tarefa.
- Complexidade.
- Modelo.
- Fase.

Utilize preços configuráveis, e não valores fixos espalhados pelo código.

Mantenha a origem e a versão/data da tabela de preços identificáveis.

Separe custos reais informados pelo provedor de estimativas calculadas localmente.

Se a sessão utilizar franquias de assinatura ou outra modalidade sem custo por requisição diretamente atribuível, apresente consumo e custo estimado apenas quando isso fizer sentido.

Nunca apresente custo estimado como cobrança efetiva.

Não invente dados de preço, uso ou faturamento.

## 6.5 Qualidade e retrabalho

Registre:

- Quantidade de ciclos de QA.
- Quantidade de problemas reportados.
- Quantidade de correções executadas.
- Quantidade de escalonamentos ao TPL.
- Quantidade de reclassificações.
- Resultado final do QA.
- Quantidade de tentativas até aprovação.

Diferencie um novo problema de uma nova tentativa de corrigir o mesmo problema.

Permita identificar quais tarefas demandaram maior retrabalho.

## 6.6 Métricas derivadas

Calcule, quando existirem dados suficientes:

**Tempo até entrega**

Tempo decorrido entre o início da tarefa e a aprovação final do QA.

**Tempo ativo dos agentes**

Soma das durações individuais de execução, identificada separadamente do tempo decorrido.

**Custo por tarefa aprovada**

Custo total estimado das execuções dividido pela quantidade de tarefas aprovadas.

**Consumo por tarefa aprovada**

Tokens totais consumidos divididos pela quantidade de tarefas aprovadas.

**Média de ciclos de QA**

Total de ciclos de QA dividido pela quantidade de tarefas verificadas.

**Taxa de aprovação na primeira verificação**

Percentual de tarefas aprovadas pelo QA sem necessidade de correções.

**Tempo de espera humana**

Tempo em que a tarefa permaneceu aguardando aprovação do PO.

Evite métricas sem definição clara, denominadores inconsistentes ou dados insuficientes.

Não interprete menor consumo isoladamente como maior qualidade.

---

## 7. Persistência das métricas

Investigue se já existe mecanismo de logs, eventos ou telemetria.

Priorize reutilizar o mecanismo existente.

Caso não exista, implemente a alternativa local mais simples e sustentável.

Preferências:

- Eventos estruturados.
- Persistência incremental.
- Baixo custo de escrita.
- Dados fáceis de consultar.
- Esquema documentado.
- Compatibilidade com execuções paralelas.
- Retenção configurável.
- Ausência de segredos ou conteúdo sensível nos logs.

Evite registrar prompts completos, respostas completas, credenciais ou informações pessoais quando não forem necessários às métricas.

Considere formatos como JSONL ou outra persistência já adotada pelo projeto.

Não introduza banco de dados ou serviço externo exclusivamente para essa funcionalidade sem uma justificativa concreta.

Se os dados forem locais, configure o tratamento adequado no Git e documente como preservar os históricos que o usuário queira manter.

A instrumentação não deve interromper tarefas de desenvolvimento caso uma gravação de telemetria não crítica falhe.

Falhas de telemetria devem ser identificáveis, sem comprometer o workflow principal.

---

## 8. Relatórios de desempenho

Implemente uma maneira simples de consultar o desempenho do harness.

Priorize uma interface já existente no repositório, como:

- Comando CLI.
- Script.
- Relatório Markdown.
- Relatório JSON estruturado.

Evite criar dashboard web ou interface gráfica apenas para esta tarefa.

O relatório deve permitir visualizar:

### Resumo geral

- Total de tarefas.
- Distribuição por complexidade.
- Tarefas aprovadas.
- Tarefas bloqueadas ou incompletas.
- Tempo médio e mediano até entrega.
- Tokens totais.
- Custo estimado, quando disponível.
- Média de ciclos de QA.
- Taxa de aprovação na primeira verificação.

### Comparação por complexidade

Comparar ROTINEIRA, MEDIANA e COMPLEXA segundo:

- Tempo de conclusão.
- Consumo de tokens.
- Custo estimado.
- Ciclos de QA.
- Taxa de aprovação.

### Comparação por agente e modelo

Permitir identificar:

- Quais agentes consomem mais tokens.
- Quais fases demandam mais tempo.
- Quais modelos são mais utilizados.
- Onde ocorre maior retrabalho.
- Quais tarefas exigiram reclassificação.

### Análise de eficiência

Gerar observações baseadas nos dados disponíveis.

Exemplos:

- Tarefas rotineiras estão consumindo tempo excessivo em planejamento.
- QA concentra grande parte do tempo total de execução.
- Determinada categoria apresenta muitos ciclos de correção.
- Uma combinação de modelo e esforço apresenta consumo elevado.

Não inferir causalidade ou recomendar alterações de modelos com base em amostras insuficientes.

Não otimizar exclusivamente por custo ou velocidade em detrimento da qualidade.

As recomendações devem ser apresentadas ao PO, não aplicadas automaticamente à matriz.

---

## 9. Otimização operacional

Preserve as seguintes regras:

- Orquestrador deve coordenar, não repetir decisões do TPL.
- Handoffs devem ser objetivos e estruturados.
- Evitar reabrir discussões já aprovadas.
- Não criar agentes desnecessários.
- Paralelizar apenas atividades independentes.
- Evitar conflitos de edição.
- Reutilizar contexto relevante.
- Evitar exploração repetida do repositório.
- Evitar executar testes redundantes sem justificativa.
- Não deixar loops de QA infinitos.
- Não permitir que a telemetria produza overhead relevante.

A observabilidade deve apoiar decisões futuras, e não interferir negativamente na execução atual.

---

## 10. Validação obrigatória

Antes de finalizar, valide:

### Roteamento

- ROTINEIRA seleciona os modelos e esforços corretos.
- MEDIANA seleciona os modelos e esforços corretos.
- COMPLEXA seleciona os modelos e esforços corretos.
- Orquestrador permanece Sol / low.
- Modelos configurados são realmente utilizados, quando suportados.

### Workflow

- PO continua aprovando contratos.
- IMPLEMENT não inicia sem aprovação.
- Desenvolvedores recebem o contrato aprovado.
- QA consegue devolver problemas aos desenvolvedores.
- Aprovação do QA encerra o ciclo.
- Escalonamentos funcionam.
- Reclassificação atualiza execuções futuras.

### Telemetria

- Eventos possuem identificação consistente.
- Tarefas paralelas não corrompem métricas.
- Tokens não são contabilizados duas vezes.
- Dados ausentes são tratados corretamente.
- Duração real e tempo ativo são diferenciados.
- Espera por aprovação humana é contabilizada separadamente.
- Métricas sobrevivem a falhas parciais quando possível.
- Relatórios não apresentam estimativas como valores reais.
- Falhas de telemetria não bloqueiam a execução principal.

Inclua testes automatizados onde forem apropriados.

Execute os testes existentes relevantes.

Documente qualquer verificação que não puder ser realizada.

---

## 11. Entregáveis

Ao concluir, apresente em PT-BR:

1. **Arquitetura encontrada:** como o harness estava organizado.
2. **Alterações realizadas:** arquivos criados ou modificados.
3. **Matriz final:** configuração efetiva dos agentes.
4. **Workflow:** confirmação de que as etapas e aprovações foram preservadas.
5. **Telemetria:** quais métricas são coletadas e de onde vêm.
6. **Relatórios:** como consultar os resultados.
7. **Testes:** verificações executadas e resultados.
8. **Limitações:** restrições técnicas ou dados indisponíveis.
9. **Próximas melhorias:** somente sugestões realmente justificadas.

## 12. Restrições finais

- Não reconstruir o harness.
- Não criar um sistema paralelo de orquestração.
- Não modificar lógica de negócio do produto.
- Não remover aprovações existentes.
- Não criar infraestrutura desnecessária.
- Não inventar consumo, custo ou resultados de testes.
- Não introduzir alterações fora do escopo.
- Não alterar automaticamente a matriz com base nas métricas.
- Não confundir configuração declarada com configuração efetivamente aplicada.
- Não realizar deploy nem modificar infraestrutura externa sem autorização.

**Comece investigando a arquitetura atual. Em seguida, implemente o menor conjunto de mudanças que entregue o roteamento por complexidade, preserve o workflow e disponibilize telemetria confiável e consultável.**