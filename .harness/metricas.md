# Política e métricas locais do harness

A fonte única da matriz é `model-policy.json`. Orquestrador usa Sol/low. Líder usa linha TPL.
Claude permanece independente. Classificar por impacto, incerteza, escopo, regressão e
efeitos arquiteturais; justificar em uma frase, sem contar arquivos como critério único.

```sh
node .harness/team.mjs classify --team <fatia> --complexity MEDIANA --reason <justificativa>
node .harness/team.mjs policy --role qa --complexity MEDIANA
node .harness/team.mjs workflow --team <fatia> --phase RESEARCH
node .harness/team.mjs workflow --team <fatia> --phase PLAN
node .harness/team.mjs owner-wait --team <fatia> --state start
```

Reclassificar repete classify: guarda anterior/motivo e só altera prepares futuros. Não
retomar workers com outro modelo silenciosamente. Aprovação do spec fecha espera humana;
`owner-wait --state end` também a fecha. IMPLEMENT/VERIFY exigem spec aprovado. Fases possíveis:
RESEARCH, PLAN, IMPLEMENT, VERIFY, DELIVERED, BLOCKED (esta exige --reason). DELIVERED exige
QA aprovado e evidência ainda válida. Fases de sessão working/waiting/delivering continuam
separadas; seus intervalos são uma aproximação explícita da atividade, não CPU/model billing.

## Uso oficial e observação de modelo

O catálogo do Codex instalado confirmou IDs/esforços da matriz; isso não prova execução.
prepare registra solicitado; `usage` importa observação oficial normalizada por tentativa.
Quando o Orca/runtime não fornece uso isolado daquela execução, deixar indisponível.
Não repartir o total de uma sessão entre follow-ups por estimativa.

```sh
node .harness/team.mjs usage --team <fatia> --key <tentativa> --file <uso-oficial.json>
```

Formato de transporte local (não é payload literal da API):

```json
{
  "source": "codex-runtime",
  "scope": "attempt",
  "attemptId": "<ID de prepare>",
  "dispatch": "<Dispatch real>",
  "reference": "<referência do export oficial isolado>",
  "observedAt": "2026-11-15T23:00:00.000Z",
  "model": "gpt-6.1-sol",
  "effort": "medium",
  "tokens": { "input": null, "output": null, "cachedInput": null, "reasoning": null, "total": null }
}
```

Preencher somente valores fornecidos pelo runtime. Converter nomes do export oficial sem
inventar campos ausentes. O import aceita exclusivamente snapshot cumulativo da tentativa;
substitui o anterior, rejeita regressão e nunca soma com eventos individuais ou agregado de
sessão. cachedInput é subconjunto de input; reasoning é subconjunto de output; total não
soma esses subconjuntos de novo. Modelo/esforço divergentes aparecem como não verificados.
Dados de faturamento reais podem incluir `cost: {amount, currency, source}` quando atribuíveis.
Assinatura sem preço por execução não vira cobrança fictícia.
Campo opcional `phase` só é permitido quando todo o snapshot está comprovadamente restrito
a RESEARCH, PLAN, IMPLEMENT ou VERIFY. Sem essa prova, deixar ausente: não atribuir tokens
de uma execução inteira à fase em que o worker começou. `scheduledPhase` é apenas planejamento.

## Persistência e falhas

O estado operacional existente guarda identificação, fases, observações e arquivo de equipes
liberadas. `events.jsonl`, no mesmo git-common-dir/fut-harness fora do Git, recebe eventos
com UUID/timestamp, tipo, IDs, papel, complexidade, fase, status e modelo solicitado. Não inclui
briefs, respostas ou conteúdo de evidências. Uma única trava serializa escritores; snapshot
operacional é atômico. Falha do journal avisa no stderr e não bloqueia operação já persistida.
Relatório marca journal ausente/ilegível/parcial; nunca trata falta de uso como zero.

`telemetry-prune --days 90` aplica retenção explícita ao journal; recusa descarte de journal
corrompido antes de reconciliação. Não apaga arquivos operacionais de equipes, necessários
para rastreabilidade. Preservar o diretório compartilhado nos backups que o dono desejar.

## Relatórios

```sh
node .harness/team.mjs report --format markdown
node .harness/team.mjs report --format json --since 2026-11-01 --until 2026-11-30
```

Período seleciona coorte por criação da tarefa; métricas cobrem toda a vida dessas tarefas.
JSON contém resumo, tarefas, tentativas e grupos por complexidade/papel/modelo/fase. Tempo
até entrega termina no QA aprovado; tempo decorrido não soma agentes paralelos. Intervalos
abertos ou não observados são indisponíveis. Tempos de workflow e espera humana são separados.
Grupos podem conter a mesma tarefa em vários papéis/modelos; não somar denominadores entre grupos.
`byComplexity` usa classificação atual das tarefas; `byExecutionComplexity` mantém a
classificação congelada de cada execução, inclusive após reclassificações.

Totais desconhecidos são null, acompanhados de subtotal conhecido e cobertura. A média de
ciclos e aprovação na primeira verificação usam tarefas com rodada funcional registrada;
infraestrutura inconclusiva não entra no denominador. Não inferir causalidade ou recomendar
mudança de modelo com amostra insuficiente; relatório nunca muda a matriz.

Preços opcionais via `report --prices <precos.json>`: `{source, version, currency, models}`,
com models indexado pelo ID real, e valores `input`, `cachedInput`, `output` por milhão de
tokens. Não há preços comerciais embutidos. A saída distingue `estimatedCost` de `actualCost`
e preserva fonte/versão/moeda. Sem dados suficientes, custo permanece indisponível.
