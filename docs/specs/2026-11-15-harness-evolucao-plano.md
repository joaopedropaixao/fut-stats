# Evolução contínua do harness: QA, política e métricas

Execução autorizada pelo dono após o primeiro incremento. Base: `prompt-harness.md`,
aprendizados e fronteira de aprovação já acordada. Implementar nesta sessão, com testes
primeiro e revisão independente; seguir até PR pronto, sem merge automático.

## Desenho técnico

Estender o helper existente com módulos pequenos, sem serviço externo ou orquestrador novo.
Dados operacionais seguem transação única; telemetria derivada usa eventos locais separados,
com falha não bloqueante e retenção explícita. Preservar equipes anteriores e perfis Claude.

- **QA:** plano de cenários com caminhos de dependência; evidências aceitas somente de QA
  vinculado, com fingerprints dos arquivos versionados nas revisões testadas. Reuso depende
  de fingerprints e spec iguais. Casos inconclusivos não contam como defeito funcional.
  Suítes obrigatórias integram a matriz. Mudança estrutural pode invalidar tudo explicitamente.
  Problema tem ID estável; correções e reincidências são registradas separadamente.
- **Política:** matriz única em `.harness/model-policy.json`. Classificação explícita e curta
  antes de preparar TPL, com histórico; reclassificação afeta só tentativas futuras. Orquestrador
  Sol/low; exceção explícita do dono para a sessão atual Astra/medium é preservada. CLI `policy`
  resolve a matriz. Config padrão é derivada e validada contra a matriz, sem escolhas duplicadas.
- **Métricas:** IDs de equipe/tentativa, eventos sanitizados, fases RESEARCH/PLAN/IMPLEMENT/VERIFY
  separadas de estado working/waiting/delivering. Espera do dono tem início/fim explícitos.
  Uso é importado de exportação oficial normalizada, por evento único ou snapshot cumulativo
  da sessão, nunca ambos somados. Valores desconhecidos são null e cobertura fica visível.
  Modelo solicitado separado do observado; sem observar runtime, efetividade é desconhecida.
- **Relatório:** CLI JSON/Markdown, filtro temporal, resumo e agrupamentos por complexidade,
  papel/modelo/fase. Tempo decorrido é separado da soma de intervalos ativos dos agentes.
  Custo real e estimado separados, preços externos configuráveis com fonte/data; sem preços
  nenhuma cifra inventada. Comparações descritivas, sem mudança automática de política.

## Plano e provas

1. [x] QA: `.harness/qa.mjs` e testes de cobertura incompleta, reuso, invalidação, identidade,
   contagem de correções e recuperação. Comandos qa-plan, qa-evidence, qa-status, qa-result,
   qa-correction, qa-invalidate. Atualizar diagnóstico clipping/overlap com teste puro.
2. [x] Política: JSON e resolvedor, classify e prepare; testar todas as combinações, invariância
   de tentativas anteriores, compatibilidade e modelos observados. Atualizar skills/defaults.
3. [x] Métricas: eventos transacionais espelhados após persistência, CLI report e usage;
   testar deduplicação, paralelismo, dados parciais, períodos, intervalos e falhas de escrita.
4. [x] Documentação, testes harness/hooks e checks raiz; revisão independente e correções.
5. Publicação acompanhada no PR70: fetch/rebase pessoal, CI e branch preservada. Como PR70 já usa
   esta branch, atualizar seu título/corpo ao escopo final, preservando os aprendizados.

## Verificação de runtime

Codex CLI 0.169.0: `codex debug models` confirmou em 2026-11-15 `gpt-6.1-sol`,
`gpt-6-luna`, `gpt-6-astra` e os esforços low/medium/high da matriz. Isso comprova catálogo,
não execução de cada combinação. Orca aceita --model/--effort em worker-start; não lançar
equipes artificiais só para declarar ativação. Uso não exposto fica indisponível.

## Registro

Primeiro incremento: commit 463f1af; baseline atual 39 testes do harness passando.
Sem retomada de Ranking/Pacote ou Auditoria. Mudanças técnicas de validação seguem dentro
do contrato; nova regra de produto, ação em banco alheio e merge continuam portões do dono.


## Resultado local após rebase

Base integrada: `5304341` (develop). Commits de implementação após rebase: `1c5491f` e
`531cbec`. Revisão independente com Sol/high encontrou falhas de agregação/arquivamento;
todas ganharam testes de regressão e foram corrigidas. Rechecagem final sem bloqueio material.

- Harness: 62 testes passando, executados localmente após rebase.
- Hooks compartilhados: todos passando.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: todos passando. Turbo reutilizou
  resultados válidos de pacotes inalterados; web foi revalidada (507 testes) na base nova.
- Catálogo real Codex 0.169.0 confirmou IDs/esforços. Nenhum worker de produto foi lançado.
- Matriz final configurada está em `.harness/model-policy.json`; execução efetiva permanece
  desconhecida até observação oficial da tentativa, sem alegação de ativação por fixture.
- Uso/custo reais não disponíveis nesta validação. Import é por tentativa/dispatch e cumulativo;
  dados de sessão agregada são recusados para evitar duplicação. Não há preços comerciais embutidos.

O fluxo continua com aprovação do contrato, implementação, QA independente e PR. Replanejar
não apaga retrabalho; arquivar congela a validade QA e não restaura aprovação obsoleta.
Os papéis e comandos estão em `.harness/operacao.md`, `.harness/qa-incremental.md` e
`.harness/metricas.md`. Consultar `node .harness/team.mjs report --format markdown`.

Limitações operacionais: prontidão/liveness são atestados pelo coordenador; não houve prova
MCP/Orca ao vivo. Uso precisa de export oficial isolado, sem coleta automática de transcrições.
A retenção do journal é explícita; arquivo operacional de equipes é preservado para auditoria.
Não houve mudança de regras de produto, migração de equipe Claude, deploy ou merge.

### Revalidação em 17 de novembro

Após a retomada, novo fetch/rebase pessoal sobre `e97ee8d` (PR72 integrado), sem conflitos.
Harness novamente 62/62; hooks compartilhados verdes. A sequência raiz lint → typecheck →
test → build terminou com código zero, reutilizando o cache compartilhado válido do Turbo.
Publicação e CI remoto são acompanhados no PR70; merge permanece dependente do dono.
