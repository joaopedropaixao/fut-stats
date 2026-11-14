# Orquestração Claude e Codex: plano de implementação

> **For agentic workers:** Use superpowers:executing-plans para executar na sessão atual, com uma revisão independente final. Autorizado pelo dono: implementar, com modelo menor.

**Goal:** Disponibilizar o fluxo completo no Codex preservando as equipes Claude.
**Architecture:** Skills Codex e papéis compartilhados; workers Orca; estado local por equipe e sessão para reserva e rastreabilidade. Helpers pequenos sem dependências novas.
**Tech Stack:** Markdown, Node.js, shell, Git, Orca.
**Spec:** docs/superpowers/specs/2026-11-14-orquestracao-claude-codex-design.md

## Global Constraints

Somente feature/plugin-harness. GitHub pessoal explícito. Nunca ler .env nem perfil corporativo.
Não iniciar fatias nem assumir sessões. Não fazer merge desta entrega sem autorização própria.
Novos workers Codex: gpt-6-luna, esforço medium (pedido do dono por modelo menor).

## Review Focus

Worktrees de outra equipe; colisão de portas entre Claude e Codex; lançamento ambíguo;
Stop de um DEV no worktree do TPL; QA com permissão de shell não equivale a sandbox somente leitura.

### Task 1: Hooks e identidade

Files: .claude/hooks/dev-termina-verde.sh, .claude/scripts/git-pessoal.sh,
.claude/scripts/checar-atraso.sh, .harness/hooks.test.mjs.

Interfaces: checker usa cwd exato ou branch irmã exata da mesma fatia; git-pessoal.sh encaminha Git com credencial pessoal.

- [x] Escrever testes de dois pares, caminho explícito, papel inválido e contadores por worktree; observar RED.
- [x] Corrigir seleção e identidade; executar testes GREEN e suite original.
- [x] Registrar resultado e commit.

### Task 2: Coordenação e encerramento

Files: .harness/team.mjs, .harness/team.test.mjs, .codex/hooks/bridge.mjs, .gitignore.

Interfaces: reserva atômica de vaga; prepare gera kickoff/argv e registra intenção de lançamento;
record associa receipt sem reexecutar; bind associa sessão ao papel/worktree para hooks; status/release reconciliam metadados.

- [x] Escrever testes de reservas simultâneas, legado, lançamento duplicado, isolamento de sessão e modelos; observar RED.
- [x] Implementar estado em git-common-dir, reserva com lock, briefs e validações sem executar launches automaticamente.
- [x] Integrar papel de sessão ao bridge para DEV simples e proteção do front; executar testes GREEN.
- [x] Registrar resultado e commit.

### Task 3: Workflows, papéis e descoberta

Files: .agents/skills/{lancar-equipe,tpl,lider-v1,mergear}/SKILL.md, .harness/roles,
.harness/*.md, .claude/agents, .claude/skills, AGENTS.md, .codex/README.md, CI.

Interfaces: skills consomem helpers da Task 2 e checker da Task 1; cada papel lê corpo comum e adaptador do runtime.

- [x] Extrair corpos comuns; preservar frontmatter Claude e atualizar validação antiga que procura texto nos agentes.
- [x] Escrever fluxo Codex completo com preparação, ask/reply/send, QA novo, checkpoints, entrega e limpeza.
- [x] Adaptar reserva e identidade no Claude; preservar modelos e subagentes atuais.
- [x] Validar skills e referências, fazer revisão de cenários e corrigir problemas encontrados.
- [x] Executar hooks, testes do harness e pronto da raiz; preparar entrega para develop.

## Registro

- Desenho aprovado pelo dono nesta conversa; modelo econômico explicitamente solicitado.
- Decisão: não automatizar a execução do Orca num wrapper opaco. O helper registra intenção e fornece argv/brief;
  o agente executa a chamada documentada uma vez e registra o recibo. Falha ambígua impede nova preparação.
- Decisão: QA usa instruções e conferência de diff, sem alegar isolamento técnico inexistente.

## Evidência final

- 28 testes Node de harness/bridge passaram; falhas RED foram observadas antes das correções.
- Suíte shell original passou também com Git global vazio e identidade de fixture.
- Quatro skills validadas pelo validador nativo (PyYAML em ambiente uv temporário, sem dependência no projeto).
- pnpm lint, typecheck, test e build passaram; Turbo reutilizou cache compartilhado do aplicativo.
- Revisão independente de implementação e cenários (modelo econômico): sem bug operacional encontrado;
  contradição documental de modelo corrigida. O wrapper Git recebeu teste de remoto bare e bloqueio de push protegido.
- Nenhuma equipe real, tarefa interrompida ou banco foi acionado como teste. Transporte ao vivo e confiança
  dos hooks serão conferidos na primeira sessão autorizada; não se afirma ativação por testes em fixture.
- Estado local usa git-common-dir, dispensando nova entrada no .gitignore.
