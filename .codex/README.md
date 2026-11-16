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

Modelos vêm de `.harness/model-policy.json`, conforme classificação e papel. O padrão de novas
sessões coordenadoras em `.codex/config.toml` é derivado da linha Orquestrador (Sol/low); um teste
confere essa derivação. Workers recebem model/effort explícitos via prepare. Não há default
genérico de subagente que substitua o roteamento. A escolha explícita do dono para esta conversa
e sessões já abertas é preservada; o perfil Claude continua independente.

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
- Novas equipes Codex usam ciclo v2: aprovação do spec, prontidão por HEAD/worktree e contrato
  escrito pelo back antes do front. Comandos `approve`, `ready`, `contract` e `prepare --after`
  estão documentados em `.harness/operacao.md`. Atestação de setup não é verificação automática
  do processo MCP nem de liveness. Equipes existentes não são migradas implicitamente.
- Recibos são imutáveis; follow-ups têm IDs próprios e predecessor. Release preserva histórico
  operacional em `archives`, no estado compartilhado fora do Git. QA incremental e métricas
  estão em `.harness/qa-incremental.md` e `.harness/metricas.md`.
- Stop já é silencioso para waiting e QA, e DEV fora de delivering não dispara checks. Manter
  avisos de bloqueio/push pendente: são trabalho útil. Não criar notificações a cada turno;
  eventos de métricas ficam no journal. Avisos genéricos da interface Orca não são hooks deste repo.

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
