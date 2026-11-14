# Orquestração pessoal no Claude e no Codex

Status: proposta para revisão do dono.

## Objetivo

Executar no Codex o ciclo já usado no Claude pessoal: líder prepara specs e ondas;
orquestrador lança equipes; TPL coordena DEVs e QA; dono aprova decisões e merges.
As duas ferramentas continuam disponíveis para distribuir a carga de uso, com tarefas
independentes. Esta entrega adapta o harness; não lança fatias nem retoma lider-v1.

## Abordagem

Decisão técnica proposta: entradas próprias por ferramenta e conteúdo de papéis compartilhado.
Claude mantém seus subagentes nativos; Codex usa workers supervisionados do Orca para TPL,
DEVs e QA. O protocolo de supervisão é o do Orca instalado, consultado no momento do lançamento.

Alternativas consideradas:

- Copiar todo o harness: simples inicialmente, mas permite divergência de regras e critérios.
- Converter também o Claude para workers em todos os papéis: uniformiza o transporte, mas
  altera desnecessariamente o funcionamento que o dono já usa.
- Entradas próprias, regras compartilhadas e transporte específico: preserva o Claude e
  permite validar o Codex sem fingir que frontmatter e ferramentas são intercambiáveis.

## Invariantes

- Somente Claude pessoal em ~/.claude-personal, invocado por claude-pessoal, e GitHub
  joaopedropaixao com credencial explícita; nunca trocar a conta global do gh.
- Nenhuma alteração de credenciais, configuração corporativa ou sessões existentes.
- A ferramenta é escolhida por equipe/tarefa e registrada no kickoff. Por padrão, a equipe
  usa a ferramenta do coordenador. Pedido explícito pode escolher a outra ferramenta.
- Sem troca automática após limite de uso, timeout ou falha; sem duas sessões donas da mesma tarefa.
- Preservar os comandos atuais do Claude, as regras de domínio, o Paper, o álbum, as portas,
  os bancos por equipe e os dois portões. Merge continua exclusivo do orquestrador no checkout principal.
- Ferramental apenas em feature/plugin-harness; não alterar código de produto, schema ou dependências.
- Máximo de três equipes conforme as regras existentes; a contagem inclui Claude e Codex juntos.

## Conteúdo e descoberta

Criar skills de projeto em .agents/skills para lancar-equipe, tpl, lider-v1 e mergear,
com entradas que direcionam o Codex para os procedimentos completos e seus adaptadores.
AGENTS.md documenta a seleção por ferramenta para evitar carregar simultaneamente dois fluxos.

Extrair os corpos comuns de dev-back, dev-front e qa para arquivos de papéis neutros no
repositório. As definições .claude/agents preservam nome, modelo, hooks e restrições de
ferramentas, referenciando esses corpos. Os kickoffs Codex leem os mesmos corpos, com
instruções próprias de transporte e encerramento. Não duplicar regras de produto.

Workflows existentes do Claude preservam sua semântica. Corrigir apenas pontos necessários
à convivência: escolha explícita de ferramenta, credencial de rede, identificação inequívoca
de worktree e contagem conjunta de equipes. O quadro continua compartilhado e no formato atual;
metadados adicionais de agente e dispatch ficam em estado local separado e ignorado pelo Git.
Chamadas de fetch disparadas por hooks e scripts também selecionam a credencial pessoal;
não basta corrigir os comandos escritos nos skills e deixar o início da sessão usar o default.

## Fluxo completo no Codex

1. Orquestrador confere identidade, sessões, Git, Trilha, dependências e recursos já ocupados.
   Usa comandos Orca documentados para criar o worktree e confirma a branch devolvida: o
   Orca pode acrescentar sufixo quando há colisão. Nome divergente não autoriza outro lançamento.
2. Prepara dependências, links de .env sem ler seu conteúdo e, quando aplicável, vaga e
   .env.equipe. Reserva da vaga deve ser serializada entre coordenadores; considera equipes
   antigas sem metadados novos e não reutiliza reserva de sessão apenas por estar silenciosa.
3. Gera kickoff com ferramenta, papel, worktree absoluto, branch, spec, cenários, contrato,
   escopo de escrita, portas/banco e evidência de conclusão. Usa --spec-file para conteúdo.
4. Lança TPL por worker-start --agent codex --keep-open no worktree preparado. Não fixa modelo
   por suposição; herda a configuração de lançamento do Orca, salvo escolha explícita do dono.
   Herança do Orca não significa necessariamente o mesmo modelo da conversa coordenadora.
5. TPL realiza research e Portão 1, ou valida a atualidade do spec já aprovado e pula esse portão.
   No Par, prepara o contrato antes de criar o front a partir do SHA correto. Usa worktrees
   Orca separados para back/front; nos modos simples, só o DEV escreve enquanto o TPL aguarda.
6. DEVs são workers Codex separados, com brief que referencia o papel comum. Perguntas vão
   ao TPL via ask; respostas via reply; correções via send para o dispatch conhecido. Sem polling.
   O TPL termina o turno depois dos lançamentos e é acordado pelo Orca.
7. Cada DEV apresenta verificação do seu worktree e relatório. Verificação de encerramento
   usa o caminho atribuído, nunca o primeiro worktree que termina em -back ou -front.
8. QA é um worker novo a cada volta, recebe spec e evidências, sem histórico de conversa dos DEVs.
   Não edita código; pode produzir álbum e artefatos de teste. Restrições do frontmatter Claude
   não são declaradas como impostas automaticamente no Codex. O TPL confere diff/estado antes
   e depois da rodada e rejeita alterações fora dos artefatos permitidos.
9. Mantém três voltas máximas, correção por DEV responsável, e volta de design separada.
   TPL integra os commits, rebaseia, valida na raiz, atualiza CONTEXT/roadmap e abre o PR.
10. Orquestrador mergeia somente os PRs autorizados, atualiza develop, avisa equipes afetadas
    no quadro e no Orca e limpa apenas recursos encerrados e sem trabalho pendente.

O líder Codex segue o mesmo lote de specs, perguntas e ondas do líder Claude. Um novo líder
não recebe automaticamente a tarefa feature/specs-v1 existente; retomada depende do dono.

## Identidade e recuperação

Antes de lançar Claude pelo Orca, verificar que a configuração de lançamento corresponde ao
perfil pessoal. O --agent claude sozinho não comprova isso. Se o lançamento nativo não permitir
comprovar a configuração, usar o caminho documentado de terminal pessoal supervisionado pelo
Orca, com CLAUDE_CONFIG_DIR explícito, sem modificar a configuração global.

Armazenar identificadores retornados de task/dispatch/worktree, ferramenta e dono por papel.
Não construir IDs nem reenviar um lançamento após resposta ambígua. Usar inspeção e recuperação
documentadas pelo Orca; nenhuma limpeza baseada somente em timeout. Depois de interrupção,
reconciliar estado local, Git, quadro e workers antes de agir. A conversa não assume outro Run.

## Hooks e verificações

Preservar a revisão de confiança em /hooks. Sem hash fabricado, bypass ou desativação de proteções.
O início da equipe exige confirmar hooks confiáveis no worktree; a ausência dessa revisão não
pode ser descrita como equipe integralmente protegida.

Corrigir dev-termina-verde para selecionar explicitamente o worktree correto e isolar contadores
por sessão/papel/worktree. Preservar o comportamento Claude e a política de três bloqueios.
No Codex, a verificação por papel é uma etapa obrigatória do worker e do coordenador; só
conectar a um evento automático se o runtime fornecer identidade de papel confiável e testada.
Não instalar um Stop de DEV global que rode no TPL ou no QA.

Separar pausas legítimas (ask/espera de workers) de conclusão. O hook de push não deve forçar
DEVs dos modos simples a publicar, nem bloquear uma pergunta ao TPL por commits locais.
Definir escopo por papel/sessão, sem conceder isenção para todo o worktree compartilhado.

Notificações e status usam o Orca e o quadro; não copiar statusLine do Claude para uma chave
inexistente do Codex. O conteúdo útil do estado permanece acessível por comandos compartilhados.

## Validação e aceite

- Testes em repositórios temporários para dois pares simultâneos, worktrees com espaços,
  papéis inválidos, contadores separados e DEV simples sem publicação indevida.
- Testes do planejamento de lançamentos e da reserva conjunta de vagas, sem lançar equipes reais
  ou tocar banco do dono. Reexecução e resposta ambígua não podem duplicar atribuições.
- Validação dos skills, referências e compatibilidade dos comandos com a CLI instalada.
- Revisão independente com cenários de Front, Back, Par, líder, limite de uso, QA reprovado,
  troca de ferramenta solicitada e colisão com equipe Claude existente.
- Testes dos hooks originais e adaptador; pnpm lint, pnpm typecheck, pnpm test e pnpm build.
- Uma sessão descartável de validação do transporte, se necessária, só escreve em fixture;
  nenhuma fatia da Trilha é lançada como teste. Relatar separadamente testes simulados e ao vivo.
- Entrega em PR próprio para develop; ativação e limitações remanescentes documentadas.

## Escolhas ainda abertas ao dono

- Modelos Codex por papel: proposta inicial é herdar os defaults do Orca. Uma preferência
  explícita pode definir modelo/esforço por papel, sem mudar os modelos atuais do Claude.

## Referências verificadas

- orca skills get orchestration e referências placement-and-remote, low-level-topology.
- orca orchestration worker-start --help e orca worktree create --help (CLI instalada).
- docs/specs/2026-10-24-equipe-design.md, 2026-10-30-equipe-paralela.md e 2026-11-14-autonomia-v1.md.
- .claude/skills, .claude/agents, hooks atuais e .codex/README.md.

## Revisão do desenho

Revisão independente concluída em 14/11/2026: nenhuma pergunta pendente que impeça planejar
a implementação. O padrão de modelos permanece a herança dos defaults do Orca, sujeito à
preferência do dono. A revisão não representa teste de execução nem aprovação do dono.
