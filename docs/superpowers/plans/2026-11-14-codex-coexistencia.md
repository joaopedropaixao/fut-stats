# Codex e Claude Code: proteções compartilhadas

## Objetivo e desenho

Permitir tarefas independentes no Codex e no Claude Code pessoal, seguindo as mesmas regras do Fut Stats.
O Claude mantém sua configuração. O Codex recebe configuração própria em .codex/hooks.json e um adaptador
que chama os scripts existentes em .claude/hooks. Nenhuma equipe ou tarefa interrompida é iniciada ou transferida.

As instruções de domínio continuam em AGENTS.md e CONTEXT.md. Os workflows TPL/DEV/QA continuam nos arquivos
originais; esta entrega não adapta o lançamento de equipes para outro agente.

## Alternativas

- Copiar e manter dois conjuntos de proteções: duplica as regras e permite divergências.
- Compartilhar os scripts por um adaptador do Codex: escolhido para manter a regra em um lugar só.
- Trocar o harness do Claude pelo do Codex: incompatível com o uso independente das duas ferramentas.

## Restrições

- Trabalhar exclusivamente na branch feature/plugin-harness.
- Não acessar o Claude corporativo nem a conta corporativa do GitHub.
- Não modificar código do aplicativo, dependências, credenciais ou tarefas em andamento.
- Não alterar os scripts e as configurações atuais do Claude.
- Usar apenas Node.js e as ferramentas já exigidas pelos hooks existentes (sh, jq e git).
- Hooks locais precisam de revisão e confiança no Codex; não fabricar registros de confiança.

## Entrega: adaptador e configuração nativa

Arquivos: .codex/hooks/bridge.mjs, .codex/hooks/bridge.test.mjs, .codex/hooks.json e .codex/README.md.
AGENTS.md aponta a ativação; CI executa os testes do adaptador e os testes dos scripts compartilhados.

Interface: receber o JSON do hook em stdin; selecionar o evento por argumento pre/post/start/stop.
Converter apply_patch em eventos de arquivo, incluindo origem e destino de renomeações.
Reutilizar sem-env, sem-merge, front-sem-shared, commit-sem-ia, prettier, atraso-ao-iniciar e sem-push-pendente.

- [x] Escrever e observar testes vermelhos para leitura de segredo, patches, renomeações, contrato do front,
      comandos Git e fim de turno com push pendente.
- [x] Implementar a tradução do payload e encadear os scripts existentes, preservando bloqueios e mensagens.
- [x] Conferir comandos permitidos e formatação real de um arquivo após patch.
- [x] Documentar ativação, limites dos hooks e uso independente das duas ferramentas.
- [x] Rodar testes do adaptador e dos hooks originais; rodar lint, typecheck, test e build da raiz.

## Pontos de revisão

Patches com vários arquivos ou renomeação; caminhos com espaços; cwd de outro worktree;
erros de entrada e falha de script; comandos dentro do code mode.

Os testes exercitam o adaptador pelo comando configurado, usando repositórios Git temporários e os scripts reais.
O teste do payload cobre o contrato documentado do code mode, mas não substitui a ativação dos hooks
em uma nova sessão do Codex.


## Validação da entrega

- Onze testes do adaptador passaram, incluindo a regressão de git -C relativo ao workdir efetivo.
- Os testes originais passaram com configuração Git global vazia e identidade temporária de fixture,
  a mesma usada na nova etapa do CI. Os scripts do Claude não foram alterados.
- Após rebase em origin/develop: pnpm lint, pnpm typecheck, pnpm test e pnpm build passaram.
- Revisão independente: corrigidos o cwd do subprocesso e a identidade temporária dos testes no CI.
- Permanecem os limites documentados dos scripts originais (interpretação parcial do shell,
  caminhos não reconhecidos e liberação quando jq está ausente). Não ampliar a proteção existente
  nesta entrega evita alterar o comportamento do Claude; os hooks não são uma barreira completa.
- Ativação ao vivo ainda exige nova sessão, confiança no projeto e revisão em /hooks pelo dono.
