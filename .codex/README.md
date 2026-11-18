# Codex no Fut Stats

Claude Code pessoal e Codex usam o mesmo AGENTS.md, CONTEXT.md, specs, quadro e papéis em
.harness/roles. Cada tarefa tem dono, ferramenta e worktree definidos. O Claude mantém seus
subagentes e modelos; Codex usa workers supervisionados pelo Orca.

## Começar

No Codex, as skills de projeto ficam em .agents/skills:

| Pedido | Fluxo |
| --- | --- |
| “Lança a equipe Codex para <fatia>” | lancar-equipe: reserva recursos, prepara e inicia TPL |
| Kickoff de TPL | tpl: spec → DEVs → QA → PR/álbum |
| “Prepara os specs restantes com Codex” | lider-v1: specs, dúvidas em lote e ondas |
| “Pode mergear o PR #N” | mergear: CI, merge autorizado, avisos e limpeza |

Leia .harness/operacao.md para contas, estado, reservas e recuperação; workers Codex seguem
.harness/codex-workers.md. A escolha da ferramenta
é por equipe; sem indicação, uma equipe nova usa a ferramenta do coordenador. Não há troca
automática por limite de uso. Tarefa pausada do Claude exige pedido explícito de retomada.

Modelo econômico solicitado pelo dono: **gpt-6-luna, esforço medium**. .codex/config.toml define
o padrão de novas sessões e subagentes; os kickoffs fixam esse modelo nos workers Orca.
Isso não troca o modelo de uma conversa já aberta e não muda o perfil do Claude.

## Ativar os hooks

1. Usar uma branch que já contenha esta entrega e abrir nova sessão Codex no worktree.
2. Confirmar confiança no projeto e abrir /hooks no Codex CLI.
3. Revisar os quatro eventos de .codex/hooks.json e confiar nas definições.
4. Conferir que não há hooks novos/alterados pendentes. Definições alteradas pedem nova revisão.

Não preencher hashes nem usar bypass. As configurações Claude em .claude/settings.json e
~/.claude-personal continuam independentes. Não importar configurações corporativas.

| Evento | Comportamento |
| --- | --- |
| PreToolUse | Scripts compartilhados para .env, operações Git, trailers; confere patches e destinos |
| PostToolUse | Prettier após apply_patch |
| SessionStart | Identifica sessão para vínculo; quadro/atrasos no checkout do orquestrador |
| Stop | Push pendente para TPL/líder; por sessão, pausa legítima e entrega do DEV recebem tratamento próprio |

O vínculo de papel usa team.mjs bind, não o nome do diretório. DEV simples não recebe obrigação
de push do TPL. Front vinculado não edita shared por ferramenta de arquivo mesmo sem sufixo
-front. Shell e ferramentas não cobertas continuam exigindo respeito às instruções; hooks
não são sandbox. O Stop adicional do DEV tem até 900 segundos e mantém o limite de tentativas
original; checks explícitos e evidências continuam obrigatórios antes de reportar sucesso.

## Operação e convivência

- GitHub pessoal joaopedropaixao com credencial explícita, sem gh auth switch.
- Claude pessoal exclusivamente claude-pessoal/~/.claude-personal. Lançamento supervisionado
  segue .harness/claude-workers.md para não depender da conta padrão do Orca.
- Antes de usar worktree, conferir Git e sessões no Orca. Não editar junto de outro worker.
- Reserve recursos via .harness/team.mjs: Claude/Codex e equipes legadas contam juntos.
- Estado local em git-common-dir/fut-harness, fora do Git; não é configuração de conta.
- A intenção de lançamento é registrada antes da chamada ao Orca; recibos registram identidade
  real. Resultado ambíguo exige inspeção, não relançamento automático.
- QA não edita código. audit-tree compara HEAD e arquivos antes/depois; aceita álbum da fatia.
  É detecção posterior, não isolamento de ferramentas, banco ou efeitos externos.
- Modelos, ferramentas, confiança dos hooks e login são verificados no ambiente real antes
  da primeira implementação. Testes em fixtures não demonstram que a sessão do usuário já os ativou.

Para uma tarefa individual fora da Trilha, usar worktree/branch próprios e AGENTS.md; não é
necessário criar uma equipe apenas para usar o Codex. Fatias da Trilha seguem o fluxo completo.

## Verificar o harness

```sh
node --test .codex/hooks/bridge.test.mjs .harness/*.test.mjs
sh .claude/hooks/test.sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Testes usam repositórios temporários, sem launches reais, push remoto, banco do dono ou leitura
de segredos. Cobrem concorrência/reserva, lançamentos duplicados, identidade de sessão,
worktree correto, auditoria QA e payloads/hooks reais. Ativação e transporte Orca ao vivo devem
ser relatados separadamente. Referência: [hooks do Codex](https://learn.chatgpt.com/docs/hooks).
