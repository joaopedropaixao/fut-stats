# Codex no Fut Stats

Claude Code pessoal e Codex trabalham em tarefas independentes, seguindo o mesmo AGENTS.md,
CONTEXT.md e os mesmos specs. A escolha da ferramenta é por tarefa, conforme a disponibilidade
do usuário. Cada tarefa mantém seu worktree, sua branch e seu PR.

## Conta e contexto

- Claude pessoal: claude-pessoal, com configuração em ~/.claude-personal.
- Codex: conferir o login pessoal antes de usar conexões externas.
- GitHub pessoal: joaopedropaixao, sempre com a credencial explicitamente selecionada
  pelo comando do AGENTS.md. Não trocar a conta ativa do gh.
- As memórias pessoais do Claude sobre o projeto podem servir de referência, mas decisões
  e status devem ser conferidos nos arquivos e no Git atuais.
- Não importar configurações, histórico ou integrações do perfil corporativo.

Antes de usar um worktree existente, conferir o Git e as sessões no Orca. Uma sessão pausada
pode ter trabalho em andamento. Continuar uma tarefa em outra ferramenta exige uma instrução
do dono e um resumo do ponto de parada; abrir esta sessão não transfere a tarefa do Claude.

## Ativar os hooks do Codex

Os hooks ficam em .codex/hooks.json. Depois de esta entrega estar na branch da tarefa:

1. Abrir uma nova sessão do Codex no worktree e conferir que o projeto é confiável.
2. Abrir /hooks e revisar os quatro eventos deste projeto antes de confiar neles.
3. Confirmar que não há aviso de hooks novos ou alterados aguardando revisão.

Não preencher hashes de confiança manualmente nem usar opções que pulem essa revisão.
A configuração original do Claude em .claude/settings.json continua independente.

## Proteções compartilhadas

O adaptador traduz os eventos do Codex e chama os scripts existentes em .claude/hooks:

| Evento | Comportamento |
| --- | --- |
| Antes de ferramenta | Bloqueia leitura de .env e alterações de arquivos protegidos, merge/push proibidos e trailers de IA |
| Depois de apply_patch | Formata os arquivos alterados com o Prettier do repositório |
| Início da sessão | Mostra quadro e atrasos no checkout do orquestrador |
| Fim do turno | Mantém o aviso de commits sem push em branches de feature |

Patches são conferidos arquivo a arquivo, incluindo o destino de renomeações.
Comandos executados por code mode chegam aos hooks do Codex como chamadas das ferramentas
internas; o contrato de shell é Bash com tool_input.command.

Os hooks são uma proteção adicional, não um isolamento completo: há ferramentas e modos de
acesso que não passam por todos os eventos. Aplicam-se também os limites dos scripts originais
(por exemplo, a ausência de jq faz os scripts existentes liberarem a operação).
As instruções do AGENTS.md continuam obrigatórias independentemente dos hooks.

## Equipes e revisão

Os workflows originais continuam em .claude/skills, e os papéis em .claude/agents.
Esta entrega habilita as proteções do Codex; não converte os launches das equipes,
os nomes de modelos ou os hooks Stop específicos de cada papel.
Não executar o lançamento de uma equipe presumindo que os parâmetros de agente e perfil
do Orca já foram adaptados ao Codex. Essa escolha deve estar explícita no kickoff.

Para revisão de código no Codex, usar o fluxo nativo de revisão e conferir AGENTS.md,
o diff e os testes. O comando de revisão do Claude usa modelos e ferramentas próprios
e não é copiado como se fosse compatível.

## Começar uma tarefa individual

Para uma tarefa independente que não seja o lançamento de uma fatia TPL/DEV/QA:

1. Definir a entrega e conferir as sessões no Orca e o estado do Git antes de escolher o worktree.
2. Usar um worktree e uma branch próprios, criados pelo Orca a partir de origin/develop.
   Se a tarefa for de harness, usar feature/plugin-harness conforme AGENTS.md.
3. Ler AGENTS.md, as seções relevantes de CONTEXT.md e o spec da tarefa. Memórias pessoais
   ajudam na orientação; arquivos e Git atuais determinam decisões e status.
4. Conferir se a branch já contém .codex/hooks.json e seguir a ativação acima. A existência
   do arquivo em outro worktree não ativa hooks nesta tarefa.
5. Implementar e verificar conforme AGENTS.md; antes do PR, atualizar a base e executar
   pnpm lint, pnpm typecheck, pnpm test e pnpm build. Abrir o PR para develop usando a
   credencial pessoal. O merge segue o fluxo do orquestrador com aprovação do dono.

Brief sugerido para uma nova sessão:

```text
Tarefa independente no Codex: <entrega concreta>.
Worktree: <caminho absoluto>. Branch: <branch>.
Spec ou referência: <arquivo e cenários, se houver>.
Leia AGENTS.md, CONTEXT.md e .codex/README.md antes de implementar.
Confira Git e sessões no Orca; preserve as tarefas em andamento no Claude.
Use exclusivamente o perfil pessoal e a credencial GitHub joaopedropaixao.
Entregue o diff verificado e o PR para develop; o merge fica com o orquestrador.
```

Esse roteiro não substitui o processo de equipe exigido para uma fatia da Trilha.

## O que falta para equipes no Codex

| Parte | Situação |
| --- | --- |
| Regras, specs e critérios de qualidade | Compartilhados nos arquivos do projeto |
| Hooks gerais | Adaptador disponível; ativação precisa ser conferida por sessão |
| Lançamento do TPL | lancar-equipe ainda seleciona agente e modelo Claude |
| DEVs e comunicação | tpl usa papéis e mensagens do Claude; precisa de mapeamento explícito |
| Encerramento dos DEVs | Hooks definidos no frontmatter dos agentes Claude; não são ativados pelo adaptador |
| QA | Restrições de ferramentas do frontmatter Claude precisam de equivalente verificado |

Antes de habilitar equipes paralelas, adaptar a seleção do worktree em
.claude/hooks/dev-termina-verde.sh: hoje ela escolhe o primeiro worktree com sufixo
-back ou -front, que pode pertencer a outra fatia. A validação deve usar o worktree
explicitamente atribuído ao DEV. A auditoria não modifica esse hook nem as equipes existentes.

## Verificar

Executar na raiz:

    node --test .codex/hooks/bridge.test.mjs
    sh .claude/hooks/test.sh
    pnpm lint && pnpm typecheck && pnpm test && pnpm build

Os testes do adaptador usam os comandos configurados e scripts reais em repositórios
Git temporários. Não executam push, merge remoto nem leitura de segredos.
Eles verificam o contrato dos payloads; a ativação e a confiança ainda precisam
ser conferidas na sessão do Codex.

Referência: [hooks do Codex](https://learn.chatgpt.com/docs/hooks).
