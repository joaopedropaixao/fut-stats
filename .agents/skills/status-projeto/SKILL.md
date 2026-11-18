---
name: status-projeto
description: Produz uma atualização curta do projeto consultando roadmap, worktrees, sessões, branches e PRs. Use quando o usuário pedir status, andamento, atualização rápida ou comparação desde a última consulta.
---

# Status rápido do projeto

Responda em português, de forma breve e baseada em evidências atuais. Esta skill é uma consulta sob demanda, não um monitor contínuo.

## Isolamento obrigatório do perfil pessoal

Toda consulta deve ficar restrita ao projeto pessoal Fut Stats e às identidades pessoais do usuário.

- Claude: consultar exclusivamente `~/.claude-personal`. Nunca consultar, pesquisar, indexar ou usar `~/.claude`, `~/.claude.json` ou resultados originados desses caminhos.
- Orca: usar sempre um `--repo`, `--worktree` ou `--path` exato do Fut Stats. Em `orca search`, passar `--path` para cada worktree pessoal consultado. Nunca executar buscas, listagens ou leituras globais para formar o status.
- Caminhos autorizados do projeto: `/Users/joaopedropaixao/dev/personal/fut-stats` e `/Users/joaopedropaixao/orca/workspaces/fut-stats/`.
- GitHub: usar apenas `joaopedropaixao`, com `GH_TOKEN=$(gh auth token --user joaopedropaixao) gh ...`. Não usar conectores GitHub sem confirmar que pertencem a essa conta.
- Não usar nomes de branch, diretório ou conta ativa como prova de identidade. Confirmar a raiz do projeto e o seletor da conta antes da consulta.

Se uma resposta global incluir qualquer fonte fora desses limites, descarte-a sem explorar seu conteúdo, refaça a consulta com seletores exatos e informe que a primeira consulta foi rejeitada pelo isolamento.

## Fontes, por ordem de evidência

1. `docs/03-roadmap.md`: quadro oficial de tarefas e fases.
2. Estado atual dos worktrees e sessões Orca do Fut Stats: agente ativo, tarefa declarada e atividade recente. Consulte a skill `orca-cli` quando disponível e use seletores exatos.
3. Git: branch, commits e diff de cada worktree relevante. Lembre que worktrees são cópias isoladas.
4. PRs e checks do GitHub, usando somente a conta pessoal `joaopedropaixao` conforme `CLAUDE.md`.
5. `docs/STATUS.md`, se existir: fotografia da consulta anterior, nunca fonte de verdade.

Não inferir conclusão só por mensagem do agente, diff local ou mudança de `[ ]` no roadmap. Chame de entregue quando a evidência de PR/merge ou a convenção do projeto confirmar. Diferencie claramente atividade observada, relato do agente e estado verificado. Registre timestamp e links/identificadores de evidência quando disponíveis. Se uma fonte não puder ser consultada, diga isso e limite a conclusão.

## Formato

```text
Fut Stats · <data/hora e fuso>

Avançou: <mudanças desde a consulta anterior ou “sem mudança confirmada”>
Em andamento: <tarefa · agente/worktree · evidência recente>
Bloqueado: <bloqueio e dependência, ou “nenhum identificado”>
Próximo marco: <marco do roadmap>
Precisa de você: <decisão necessária, ou “nada”>
```

Omitir linhas vazias. Manter a resposta idealmente abaixo de 120 palavras. Se não houver fotografia anterior, informar que esta é a primeira leitura e não alegar mudanças desde a última consulta.

## Fotografia compartilhada

O estado `docs/STATUS.md` pode ser atualizado apenas quando houver armazenamento compartilhado acessível às sessões Orca. Primeiro localizar a raiz/recurso compartilhado por configuração documentada do Orca; não presumir que worktrees compartilham arquivos. Nunca gravar a fotografia na branch de uma tarefa nem criar cópias concorrentes por worktree. Se não houver armazenamento compartilhado configurado, responder sem persistir e informar que não há comparação confiável entre consultas. Manter a fotografia compacta: timestamp, resumo anterior, tarefas ativas/bloqueadas e referências de evidência. Decisões duradouras pertencem aos documentos do projeto, não a esse cache.
