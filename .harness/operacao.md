# Operação compartilhada: Claude pessoal e Codex

Ler antes de lançar ou recuperar uma equipe. Os papéis estão em .harness/roles, as regras
em AGENTS.md/CONTEXT.md e os specs em docs/specs. As duas ferramentas compartilham o quadro
existente; o transporte e os modelos são específicos de cada ferramenta.

## Identidade e dono

- GitHub: `GH_TOKEN=$(gh auth token --user joaopedropaixao) gh ...`.
- Git de rede: `sh .claude/scripts/git-pessoal.sh fetch origin` (também aceita push/pull).
  Esse wrapper não muda a conta ativa do gh. Push publica somente a própria feature em origin,
  sem --all/--mirror/--force; pull exige --ff-only. Nunca imprimir token.
- Claude: exclusivamente `CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude` (claude-pessoal).
  Para lançar, seguir .harness/claude-workers.md. Não presumir identidade por --agent claude.
- Codex: confirmar login pessoal antes de integrações. Não importar perfis externos.
- Escolha explícita do dono prevalece; sem escolha, uma equipe nova usa a ferramenta da
  sessão coordenadora. Registrar a escolha. Não misturar DEVs de ferramentas diferentes
  dentro de uma equipe automaticamente; equipes Claude e Codex podem coexistir.
- Retomada, troca de ferramenta e migração de sessão existente exigem instrução do dono;
  silêncio, limite de uso ou timeout não são autorização.

## Preparar worktree e recursos

1. Carregar `orca skills get orca-cli` e `orca skills get orchestration`; usar o executável
   resolvido pela skill. Os exemplos usam orca, válido nesta instalação.
2. Inspecionar Git, `orca worktree ps --json`, quadro e `orca orchestration worker-list --json`.
   Não tomar worktree ocupado. Perguntar antes de usar branch/fatia já existente.
3. Criar pelo Orca, sem iniciar agente: `orca worktree create --name <fatia> --no-parent
   --branch feature/<fatia> --base-branch origin/develop --json`. Guardar o ID completo retornado.
   Conferir path e branch: sufixo automático por colisão não corresponde à tarefa pedida.
4. Reservar: `node .harness/team.mjs reserve --team <fatia> --agent codex|claude
   --worktree <raiz-absoluta>`. O registro fica em `git-common-dir/fut-harness`, fora do Git.
   A operação usa trava e conta ambas as ferramentas, o quadro legado e .env.equipe.
   Pedido explícito de paralelo adiciona `--parallel yes`. Sem outra equipe e sem esse pedido usa vaga 0; havendo outra, usa 1 ou 2. Máximo três equipes somadas.
   A reserva exige worktree já criado; se falhar, não iniciar agente, banco nem servidor.
5. Usar apiPort, webPort, database e slot retornados. Na vaga 0 não criar .env.equipe.
   Nas demais, criar na raiz .env.equipe conforme docs/specs/2026-10-30-equipe-paralela.md,
   com PORT, WEB_PORT, APP_URL, API_PROXY_TARGET, DATABASE_URL e DIRECT_URL iguais aos valores
   reservados. Não incluir segredos. Não recalcular a vaga consultando só uma ferramenta.
6. Rodar pnpm install. Ligar o .env do checkout principal com um ln -s isolado, caminhos
   absolutos escritos por extenso; nunca ler ou copiar o conteúdo. Não substituir arquivo existente.
   Quando paralelo, gerar/buildar pacotes e aplicar migrations/seed no banco da equipe conforme
   lancar-equipe. Reset no banco principal ou de outra equipe continua exigindo o dono.
7. Atualizar quadro. A preparação completa vem antes do kickoff, não enquanto o worker implementa.

Reservas não expiram por tempo. Se a preparação falhar, inspecionar Git/Orca antes de liberar
com `release --team <fatia> --evidence <descrição-da-inspeção>`; uma tentativa já preparada
impede release até ser reconciliada. Nunca remover a trava por timeout: conferir processo e
operação proprietária antes de recuperação manual. Não editar JSON para contornar bloqueios.

## Preparar uma tentativa e registrar o recibo

O helper não executa Orca, Git remoto nem modelos. Ele fornece os argumentos e registra a intenção
**antes** do lançamento, para uma resposta perdida não levar a duas sessões da mesma tarefa.

1. Escrever um arquivo de brief com entrega, spec, cenários, arquivos permitidos, contrato,
   dependências, demais equipes, recursos e provas de conclusão. Não incluir segredos.
2. `node .harness/team.mjs prepare --team <fatia> --role <tpl|lider-v1|dev-back|dev-front|qa>
   --worktree <raiz-absoluta> --spec <brief.md>`; QA também exige `--round <n>` único,
   inclusive voltas de design (a contagem de limite funcional continua separada).
3. O resultado tem key, specFile e argv. Para Codex, executar uma única chamada Orca com esses
   argumentos, respeitando espaços e sem eval. Exemplo de forma: `orca orchestration worker-start
   --spec-file <specFile> --task-title "<papel> <fatia>" --worktree path:<raiz>
   --agent codex --model <modelo-do-argv> --effort <esforço-do-argv> --json`. TPL/líder usam também --keep-open.
   Para Claude, argv é null: seguir .harness/claude-workers.md, com terminal pessoal explícito.
4. Guardar a resposta completa fora do Git. Copiar os IDs reais de Task, Dispatch e Run do
   recibo para `node .harness/team.mjs record --team <fatia> --key <key>
   --dispatch <id> --task <id> --run <id>`. Não inventar formatos nem inferir IDs de nomes.
5. Depois de iniciar todos os workers independentes, **terminar o turno**; Orca acorda o
   coordenador. Não bloquear em polling. Se a resposta disser next, seguir next.

Se o worker começar antes de record, seu bind recusa: o worker faz ask e termina o turno;
coordenador registra o recibo e responde para ele prosseguir. Não precisa relançar.

## Perguntas, retomada e falhas

- Pergunta: worker usa ask e termina o turno; coordenador responde via reply se a decisão já
  consta no spec/CONTEXT/conversa. Regra nova, mudança de banco do dono ou portão vai ao dono.
- Correção: send ao **dispatch registrado**, não terminal send nem novo worker da mesma tarefa.
- Worker terminado que precisa corrigir: inspecionar o efeito de send no Orca. Com o mesmo
  Task/Dispatch e tentativa recorded, continuar nela. Novo Task/Dispatch exige tentativa
  relacionada, depois de comprovar encerramento anterior; ver ciclo v2 abaixo.
- Nova avaliação funcional QA usa novo round e brief sem conversa dos DEVs. Recuperação de
  infraestrutura retoma a mesma QA/rodada; não é nova reprovação funcional.
- Falha de start ou recibo ausente: não repetir prepare nem worker-start; carregar a referência
  recovery-and-cleanup do Orca. Inspecionar worker-show/list, recuperar recibo e registrar.
  Se não houve worker e a tentativa precisa ser substituída, guardar evidência da ausência e
  usar o fluxo de recuperação documentado do Orca. Com prova de que nenhum worker foi lançado,
  `cancel-prepared --team <fatia> --key <key> --evidence <prova>` arquiva a intenção e permite
  uma nova preparação; nunca usar esse comando quando há worker ou o resultado continua desconhecido.
- Estado local não transfere propriedade de um Run. Usar --run explícito ao atuar em outro Run
  autorizado; não chamar run-use em Run alheio. Workers que coordenam filhos mantêm os IDs do
  pai para ask/worker_done, mesmo que criem um Run para os próprios filhos.
- Limite de uso: registrar onde parou, commits, worktrees e dispatch; avisar o dono. Não migrar sozinho.

## Concluir e limpar

Somente após worker_done, validações e inspeção de que o worker/helpers encerraram:
`node .harness/team.mjs settle --team <fatia> --key <key> --evidence <provas>`.
Após integrar a entrega na `develop`, descartar os chats/terminais e worktrees da equipe sem pedir
confirmação de preservação. Faça isso somente depois de comprovar que os commits estão integrados
(ou que seus equivalentes estão presentes após rebase), o Git está limpo, workers/helpers estão
encerrados e recursos foram liberados. Se algum critério falhar, não remover ainda; reconciliar ou
registrar o impedimento. Trabalho pausado, inclusive arquitetura em andamento, não está finalizado.

Sequência de cleanup:
1. Conferir `worker_done`, ausência de escrita e validações; então registrar `settle`.
2. Confirmar integração dos commits (ou equivalência após rebase), `git status --short` vazio e
   ausência de commits exclusivos em relação à `origin/develop`.
3. Parar servidores próprios e confirmar que nenhuma sessão usa as portas/banco; liberar com
   `node .harness/team.mjs release --team <fatia> --evidence <provas>`.
4. Remover pelo Orca os chats/terminais da equipe e os worktrees. Remover a linha do quadro.

O helper não para processos, não apaga worktrees e não comprova liveness: essa verificação é do
coordenador. `feature/plugin-harness` e seu worktree são exceções permanentes definidas em AGENTS.md.

Para revisar: `node .harness/team.mjs status`. Um desenho de sessão não muda outra sessão;
estado local é rastreabilidade e coordenação, não uma barreira de segurança.

## Ciclo v2 para novas equipes Codex

Novas reservas Codex recebem `policyVersion: 2`. Reservas existentes sem essa versão e
equipes Claude mantêm seus gates anteriores; não editar JSON para migrar uma equipe ativa.
O estado tem `schemaVersion: 2`; versões futuras desconhecidas são recusadas em escrita.
Novas reservas também recebem `routingVersion: 1`; precisam de `classify` antes de prepare.
Equipes sem routingVersion mantêm Luna/medium, sem migração implícita. Matriz e telemetria em
`.harness/metricas.md`; plano/evidências do QA em `.harness/qa-incremental.md`.

Antes de DEVs, registrar o spec aprovado (o brief de launch pode ser outro arquivo):

```sh
node .harness/team.mjs approve --team <fatia> --mode Par --spec <spec.md> --evidence <referência-do-ok>
node .harness/team.mjs ready --team <fatia> --worktree <raiz> --stage dev --proof <setup.json>
```

`approve` registra uma atestação do coordenador; não concede aprovação pelo dono. Spec
alterado invalida seu digest. Mudança técnica autorizada dentro do contrato registra a
referência da autorização aplicável; comportamento/aceite novos exigem aprovação nova.
Para substituir aprovação, DEVs e QA precisam estar encerrados/reconciliados.

Prova JSON mínima, fora do Git, com SHA real do checkout e sem segredos:

```json
{
  "worktree": "<raiz absoluta canônica do checkout>",
  "head": "<SHA completo>",
  "checks": {
    "install": { "command": "pnpm install --frozen-lockfile", "exitCode": 0, "evidence": "<log>" },
    "environment": { "command": "<verificação sem ler segredos>", "exitCode": 0, "evidence": "<log>" }
  }
}
```

Para `--stage qa`, incluir também checks `api`, `web`, `fixtures`, `browser` no mesmo formato
e `browser: { "pid": <PID real>, "args": [<argv real contendo --isolated>], "navigation":
"<evidência de navegação real>" }`. Preparar o processo pelo transporte suportado do Orca;
não inferir PID/argv de um exemplo de configuração. `isolatedContext` não basta.
Registrar QA readiness no checkout do QA e nos checkouts de cada DEV. O helper valida formato,
HEAD e referências, mas **não executa comandos nem verifica liveness**; o coordenador verifica
o ambiente real. Não colocar credenciais, URLs com tokens ou conteúdo de `.env` na prova.

No Par, back vinculado registra `contract --team <fatia> --session <id> --sha <commit>
--evidence <referência>` a partir do próprio checkout. O commit deve alterar shared e ser
ancestral de HEAD. O front exige esse SHA como ancestral e setup próprio. TPL não grava no back.
O marco de contrato não encerra o DEV. `prepare` e `bind` verificam os gates da política v2;
HEAD alterado requer prontidão renovada antes de iniciar/recuperar o trabalho.

Após encerramento comprovado, `settle` mantém recibo e binding histórico. Para uma nova
execução relacionada, usar `prepare` com os argumentos normais mais `--after <chave-anterior>
--reason <motivo>`. QA também informa o mesmo `--round` em recuperação. Usar a nova chave
retornada para record/bind. A mesma sessão pode vincular-se à sucessora direta da própria
tentativa encerrada; o vínculo anterior vai para history. Outra equipe/papel/worktree não
é transferência permitida. Cada predecessor só tem uma sucessora; para continuar, seguir a cadeia.

Antes de qualquer launch, reconciliar recibos ausentes no Orca. A tentativa sucessora pode
registrar um follow-up já criado pelo Orca: não chamar worker-start de novo nesse caso.
Uma intenção comprovadamente não lançada pode ser cancelada como antes; retry recebe ID novo.

`release` arquiva equipe, tentativas e bindings em `archives` na mesma escrita atômica antes
de remover a reserva ativa. Consultar com `status`. IDs diferenciam reutilização do nome.
Timestamps novos não preenchem retrospectivamente dados legados. O arquivo é operacional,
não um relatório de tokens/custo; preservar `git-common-dir/fut-harness` nos backups locais.
