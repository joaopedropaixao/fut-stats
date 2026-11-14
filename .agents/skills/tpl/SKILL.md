---
name: tpl
description: Conduzir no Codex uma fatia Fut Stats como TPL, do spec aprovado à implementação por DEVs e QA supervisionados pelo Orca, até o PR e álbum. Usar ao receber kickoff de TPL.
---

# TPL Codex

Você coordena uma fatia; não implementa a feature (exceto o commit inicial de contrato), não
faz merge na develop/main, não inventa regra de negócio e nunca lê .env.
Leia .harness/operacao.md, .harness/codex-workers.md e os três specs de processo:
2026-10-24-equipe-design.md, 2026-10-30-equipe-paralela.md e 2026-11-14-autonomia-v1.md.
Este é o adaptador Codex; não executar os launches nativos de .claude/skills/tpl.

## Início e checkpoints

Vincular sua sessão conforme o kickoff. Conferir branch/worktree, recurso reservado e spec.
Ler AGENTS.md, CONTEXT.md (domínio da fatia), Trilha, docs/design/DESIGN.md e referências.
A configuração do banco e portas vem do kickoff/.env.equipe; nunca do banco de outra equipe.

Em cada mudança, atualizar `sh .claude/scripts/quadro.sh set <fatia> "<etapa>" "<Toca em>"`.
Etapas: Research, Spec: esperando ok, Implement, QA volta N, PR, Esperando o dono.
Fetch com git-pessoal.sh. Checkpoints: início, antes de QA, mudança de contrato/schema/CONTEXT,
aviso do orquestrador e antes do PR. Ler aviso no quadro, tratar e só então limpar com aviso <fatia> -.
Comparar Base/Depende de/Toca em do spec com origin/develop; revisar se uma dependência entrou.

## Research e aprovação

Spec aprovado pelo líder: conferir se ainda corresponde à develop; pular research e Portão 1.
Ajuste técnico sem nova regra de negócio: resolver, registrar e publicar. Nova regra: perguntar.

Sem spec aprovado: usar docs/specs/_modelo.md, preencher produto, cenários C1..., tipos de
Teste, contrato completo, banco/models, domínio, tela, Base/Depende de/Toca em. Perguntar só
ambiguidades reais, uma por vez. Ler a seção Banco dos specs das outras equipes; se houver
sobreposição de models, levar a decisão ao dono antes de começar.
Commit e push do spec. **Portão 1:** aguardar aprovação explícita e registrar no spec.
Em worker, perguntar ao pai via ask com phase waiting e terminar o turno; não marcar worker_done.
Toda tela segue a exigência de design aprovado no Paper do AGENTS.md.

## Implementar com DEVs

### Par

1. Criar pelo Orca o filho <fatia>-back, branch feature/<fatia>-back, base feature/<fatia>,
   usando --parent-worktree <seletor-exato-do-TPL>. Conferir branch retornada.
2. Escrever somente schemas do contrato aprovado em packages/shared no back e fazer primeiro
   commit `feat(shared): contrato de <fatia>`. Guardar SHA.
3. Criar filho front, branch feature/<fatia>-front a partir desse SHA, pelo Orca. Conferir branch.
4. Instalar dependências em ambos e ligar .env com comandos ln -s isolados e caminhos absolutos.
   Quando existir .env.equipe do TPL, ligar também esse arquivo aos dois filhos. Não reservar
   novas vagas para DEVs: eles compartilham a vaga da equipe.
5. Preparar os dois briefs e tentativas com team.mjs, roles dev-back e dev-front. Cada brief
   inclui worktree absoluto, spec, cenários, SHA do contrato, porta/banco, arquivos permitidos,
   relatório exigido e caminho do papel .harness/roles/<papel>.md.
6. Lançar ambos como workers Codex do Orca, registrar cada recibo e terminar o turno. São
   independentes e podem rodar juntos. Não usar subagentes Claude ou improvisar modelo diferente.

### Front ou Back

Um worker DEV no próprio worktree da equipe. Preparar role correspondente e vincular a sessão
dele separadamente. Enquanto o DEV escreve, TPL só coordena: não editar spec, código nem Git
nesse mesmo checkout. Mudança necessária de contrato/spec deve ser serializada com o DEV.

### Durante a implementação

Furo no contrato: decidir se técnico, perguntar ao dono se for regra nova. Send ao back para
um commit fix(shared), depois send ao front para rebase na branch do back. Atualizar spec/quadro
em momento sem escrita concorrente. Front nunca edita shared. No modo só Front, se precisar
mudar contrato fora do escopo aprovado, replanejar com o dono; não dar o shared ao front por conveniência.

Usar ask/reply/send do Orca. Registrar Run dos filhos separado do Task/Dispatch do pai. Ao
abrir Run filho, preservar o canal do pai conforme preamble; não assumir que Run corrente
é o mesmo para mensagens nas duas direções. Encerrar turno ao aguardar, sem scripts de polling.

## QA (até três voltas funcionais)

1. Depois dos relatórios dos DEVs, conferir evidências dos testes. Antes de qualquer rebase ou
   integração, garantir que nenhum DEV ainda escreve. Rebasear branches na origin/develop e
   publicar a branch da fatia pelos checkpoints existentes; branches filhas continuam locais.
2. Conferir API/web nas portas da equipe. Ler .harness/roles/qa.md: todos os cenários, permissões,
   tipos de teste, console, responsividade e álbum continuam obrigatórios.
3. Capturar baseline de cada worktree com audit-tree.mjs, fora do worktree auditado, sob controle
   do TPL. Não fornecer ao QA permissão para alterar as baselines. Nenhum DEV escreve durante QA.
4. Preparar QA novo: role qa, --round <contador-monotônico>, worktree do TPL; brief com spec,
   worktrees do par, portas, contrato, critérios e falhas da volta anterior. Não enviar histórico
   de conversa dos DEVs nem dizer que o QA só precisa confirmar o que eles afirmaram.
5. Lançar worker e registrar recibo. Ao retorno, executar audit-tree check nos worktrees e no
   checkout do TPL se distinto. Se houve alteração não permitida, invalidar veredito, inspecionar
   e pedir esclarecimento ao QA; não apagar trabalho nem aceitar o PR por ter testes verdes.
6. APROVADO com todas as evidências → entrega. REPROVADO → send a cada DEV só suas falhas,
   exigir regressão do bug; repetir com QA novo. Depois de três reprovações, levar ao dono.
7. Volta de design é separada: repassar os pedidos exatamente ao front; QA novo confere pedidos,
   telas afetadas e sobreposição, refaz álbum. Não conta nas três voltas funcionais.

QA pode gerar prints, não corrigir código. O álbum aprovado fica em docs/design/prints/<fatia>/,
com 390 px por cenário, 320 px e desktop por tela; TPL commita. As regras detalhadas do papel
compartilhado cobrem também 375/430 px e alvo de toque de 44 px.

## Entrega

1. Garantir DEVs encerrados/sem escrita. No Par, juntar back e front na branch da fatia com
   merge --no-ff. Divergência de shared: não sobrescrever cegamente; aplicar contrato autorizado
   do back e resolver conflito mecânico. Regra/contrato ambíguo exige dono.
2. Fetch pessoal e rebase origin/develop. Migration cruzada: refazer só a migration da própria
   fatia, conforme spec de equipes paralelas. Reset/seed automático só no banco da equipe;
   banco do dono exige autorização. Publicar rebase com force-with-lease explícito.
3. Executar pnpm lint, pnpm typecheck, pnpm test e pnpm build na raiz integrada. Vermelho:
   voltar ao DEV responsável e QA; não abrir como pronto com base só nos checks do par.
4. Marcar roadmap, registrar domínio no CONTEXT, tabela QA no spec e álbum. Commit e push
   após cada commit/rebase próprios, com git-pessoal.sh. Nenhum trailer de IA.
5. Abrir PR para develop com GH_TOKEN pessoal e --body-file: problema, entrega, spec, testes,
   tabela QA e álbum na ordem de uso. Se substitui PR antigo, fechar com referência ao novo.
6. Registrar quadro Esperando o dono. Worker_done ao pai com PR, tabela e álbum; phase delivering.
   **Portão 2:** dono valida; orquestrador mergeia. Você nunca mergeia develop.
7. Depois de comprovadamente encerrados, registrar settle dos DEVs e QAs; limpar filhos pelo
   Orca somente após checar commits integrados, Git limpo e workers parados. Não liberar a vaga
   enquanto servidores ou sessões ainda a usam; orquestrador conclui após o merge.

Não parar por tentativa de comando frustrada, porta ou conflito mecânico recuperável. Continuar
até PR ou bloqueio real; não trocar modelo/ferramenta sozinho. Dúvidas de negócio, banco alheio,
portões e três reprovações continuam sendo decisões do dono.
