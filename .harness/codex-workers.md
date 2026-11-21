# Worker Codex: ciclo de vida

Vale para workers com Task e Dispatch do Orca, lançados pelos skills deste projeto.
Leia o papel do kickoff, AGENTS.md e as seções relevantes do CONTEXT.md. Codex usa
workers Orca; não interpreta o frontmatter dos agentes Claude como configuração sua.

## Antes da primeira edição

1. Confirmar que cwd, branch e spec correspondem ao kickoff, e que não há outra sessão escrevendo.
2. Confirmar ferramentas necessárias (Paper/Playwright no front/QA), projeto confiável e hooks
   revisados em /hooks. Se falta confiança, levar a revisão ao dono; nunca bypass/hashes manuais.
3. Vincular sessão de dentro da raiz atribuída:
   `node .harness/team.mjs bind --team <fatia> --key <key-do-kickoff> --session <session-id>`.
   Usar CODEX_THREAD_ID quando disponível, conferindo com o ID informado pelo hook SessionStart.
   Se o runtime não expuser o ID, pedir ao coordenador/dono que confira a identificação; não
   inventar um ID nem começar a implementação com proteções de papel presumidas.
4. Se o recibo ainda não foi registrado, fazer ask ao coordenador e terminar o turno; continuar
   com bind após a resposta. A chave não é o nome de uma branch nem o ID do dispatch.

O vínculo é por sessão **e** worktree. Um DEV simples não desativa a proteção de push do TPL
que compartilha a mesma branch. Não vincular a sessão do coordenador ao papel do DEV.
Modelos: usar model/effort e complexidade do kickoff, resolvidos por `.harness/model-policy.json`.
Não alterar modelo silenciosamente; reclassificação registrada só afeta próximas execuções.
Não cria subagentes extras
para tarefas pequenas. Briefs curtos, logs em arquivos e leitura só das seções necessárias.

## Perguntar ou aguardar

Antes de ask ou de aguardar workers filhos:
`node .harness/team.mjs phase --session <id> --phase waiting`.
Fazer ask e terminar o turno. Quando acordar, voltar a working antes de agir:
`node .harness/team.mjs phase --session <id> --phase working`.
Isso distingue pausa de entrega. Espera não significa worker_done nem aprovação.
Para mensagens e runs, seguir a preamble do Orca e .harness/operacao.md.

## DEV back/front

- Trabalhar exclusivamente no worktree recebido, com caminhos absolutos. Em modo simples,
  o TPL não edita enquanto o DEV está trabalhando. No Par, cada DEV tem seu próprio worktree.
- Seguir .harness/roles/dev-back.md ou dev-front.md. Não publicar, fazer PR nem merge.
- Ao finalizar, executar lint/typecheck/test dos pacotes do papel e registrar logs e resultado.
  Back: `pnpm --filter @fut-stats/domain --filter @fut-stats/shared --filter @fut-stats/api run <script>`.
  Front: `pnpm --filter @fut-stats/web run <script>`. Substituir script por lint, typecheck e test.
- Não reportar sucesso com teste vermelho. Perguntas e impedimentos vão ao TPL.
- Antes de worker_done com relatório, marcar phase delivering. Stop roda a verificação
  adicional do DEV nesse worktree; não confiar no Stop como substituto da evidência explícita.
- No retorno para corrigir, voltar a working; repetir verificações e relatório ao entregar.
- No Par, back produz o contrato como primeiro marco no próprio binding e registra
  `team.mjs contract --team <fatia> --session <id> --sha <commit> --evidence <referência>`.
  Informar o SHA ao TPL sem worker_done: ainda há implementação. Front aguarda esse marco.
- Se o coordenador encerrou a tentativa, uma nova execução usa a chave de follow-up fornecida
  por ele; nunca sobrescrever recibo ou fabricar binding. Recuperação da mesma sessão preserva
  o histórico; conferir novamente worktree, prontidão e contrato antes de agir.

## QA

Seguir .harness/roles/qa.md. Permissão para executar testes e criar prints não autoriza corrigir
código. O frontmatter disallowedTools do Claude não restringe este worker Codex.
Não editar fonte, configuração, dependências, Git/index/branches ou migrations. Gravar só o
álbum da própria fatia, prints temporários e logs fora do Git. Não instalar pacotes para testar.

O TPL captura antes e confere depois, em cada worktree:
`node .harness/audit-tree.mjs capture <worktree> <baseline-fora-do-worktree.json> <fatia>`
e o mesmo comando com check. A baseline fica sob controle do TPL. O checker confere HEAD e
conteúdo/modo dos arquivos versionados e não ignorados; aceita docs/design/prints/<fatia>/ e
.playwright-mcp/. Não audita banco, arquivos ignorados ou efeitos externos; o QA continua
obrigado a respeitar o escopo. Qualquer alteração não permitida invalida o veredito; não apagar
as alterações automaticamente, pedir diagnóstico ao QA e devolver a correção ao DEV.

Para equipes com plano incremental, seguir `.harness/qa-incremental.md`: `qa-evidence` e
`qa-result` usam a própria sessão vinculada. Esses comandos gravam somente o registro externo
ao Git; são permitidos ao QA. Reuso não elimina independência: julgar provas e lacunas,
invalidar evidência suspeita e ampliar regressão se necessário. Inconclusivo não é aprovado.

## TPL e líder

Seguir o skill Codex indicado, com os mesmos portões e critérios do Claude. São donos dos
commits de coordenação e da publicação da feature; os DEVs não são. Fazer push após commit
ou rebase pela credencial pessoal. Para receber respostas de filhos, manter identificação
separada do Run de coordenação e do Task/Dispatch recebido do pai. Não perder o canal do pai.

## Limites

Hooks ajudam nas ferramentas cobertas; shell, ferramentas externas e permissões herdadas
não constituem isolamento completo. O binding é registro explícito, não autenticação.
Novos/alterados hooks exigem revisão. Sem confirmação ao vivo, relatar que a ativação está
pendente; testes em fixture não comprovam confiança na sessão do usuário.
