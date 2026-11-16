# QA incremental Codex

Complementa o papel compartilhado sem transferir equipes Claude. O TPL registra o plano
após aprovação do spec e antes da primeira QA. Não enviar conversa dos DEVs.

```sh
node .harness/team.mjs qa-plan --team <fatia> --file <plano.json>
node .harness/team.mjs qa-status --team <fatia>
```

Plano JSON: `{ "scenarios": [{ "id": "C1", "paths": ["apps/web/src/feature",
"packages/shared", "packages/domain"], "test": "Playwright 390/320/desktop" }] }`.
Cada combinação de cenário/tipo de teste relevante pode ter ID próprio, como C1-browser
e C1-api. Incluir dependências transitivas, permissões e configurações compartilhadas;
quando incerto, usar `["."]`. O helper acrescenta lint/typecheck/test/build obrigatórios.
O TPL é responsável por mapear integralmente os critérios aprovados, fixtures e viewports.

Fingerprint usa árvores Git de todos os worktrees da equipe; não lê segredos ignorados.
Evidência vale somente com spec e arquivos de dependência iguais, sem alterações locais
nesses caminhos. Álbum da fatia e .playwright-mcp não invalidam checks por si sós.
O QA pode reaproveitar prova anterior verificável no escopo preservado; código/dependência
alterados invalidam automaticamente. Rebase com árvore idêntica preserva evidência.

QA vinculado registra cada verificação, depois de executá-la e salvar sua prova:

```sh
node .harness/team.mjs qa-evidence --team <fatia> --session <id> --scenario C1 --status passed --evidence <relatório/print/log>
node .harness/team.mjs qa-evidence --team <fatia> --session <id> --scenario C2 --status failed --issue bug-1 --evidence <reprodução>
node .harness/team.mjs qa-result --team <fatia> --session <id> --outcome approved
```

`inconclusive` registra infraestrutura/evidência insuficiente; não aprova e não consome
rodada funcional. `rejected` exige falha confirmada. `approved` exige todas as linhas
atuais verdes. O relatório é evidência declarada pelo QA, não execução automática do teste.
`qa-status` retorna `next: deliver` após aprovação completa; TPL segue aos checks integrados
e PR sem espera artificial. Baselines audit-tree continuam obrigatórias.

Para risco amplo ou evidência duvidosa: `qa-invalidate --team <fatia> --reason <motivo>`.
Isso invalida todas as linhas; histórico permanece. Para correção entregue pelo DEV:
`qa-correction --team <fatia> --issue bug-1 --evidence <commit/teste>`.
QA usa o mesmo issue ao revalidar. Após duas correções malsucedidas do mesmo issue,
qa-status sinaliza TPL. Três rodadas funcionais rejeitadas sinalizam dono; infraestrutura
não entra nessa contagem. Não mudar complexidade automaticamente por causa de um bug.

## Diagnóstico visual

Bbox bruto não comprova sobreposição pintada. Recortar cada retângulo pela viewport e pelos
ancestrais com overflow que realmente aplicam clipping. `.harness/visual-qa.mjs` contém
`paintedOverlap({rect, clips}, {rect, clips})`, teste geométrico auxiliar com left/right/top/bottom.
Interseção potencial exige confirmação: scroll real até o controle, screenshot e
`elementFromPoint()`/interação no ponto visível. Ignorar relação pai/filho e sobreposições
intencionais do design. Não confundir elemento fora do scrollport com conteúdo sob navegação.

Conferir 320/375/390/430/1280, rolagem horizontal, texto cortado e alvos de toque. Casos
reprovados devem ter viewport, estado da fixture, posição de scroll, screenshot e hit-test.
Não apresentar esse auxiliar puro como prova de navegação real.
