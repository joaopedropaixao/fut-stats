# Autonomia para fechar a v1 (líder Fable + equipes)

Desenho aprovado pelo dono em 14 nov 2026. Junta o que o dono precisou corrigir nas fatias 0 a 3 e muda o fluxo
para as equipes rodarem sozinhas até o fim da v1. Complementa `2026-10-24-equipe-design.md` (equipe) e
`2026-10-30-equipe-paralela.md` (modo paralelo).

## O problema
O código saiu bom. O que travou foi **parar para perguntar ao dono no meio do caminho**:
- o Portão 1 de cada fatia;
- as voltas 2 e 3 de visual depois do teste do dono;
- decisões em aberto, como as três do rodízio.

Com três equipes em paralelo, isso vira uma fila de perguntas e o dono passa o dia respondendo.

## A ideia
1. **Um líder, uma vez:** uma sessão com o Claude Fable 5.2 escreve os specs de **todas** as fatias restantes da
   Trilha e junta **todas** as dúvidas num lote só. O dono responde de uma vez e aprova os specs de uma vez.
2. **Equipes executam:** com o spec aprovado, o TPL (Opus) pula o research e vai direto para a implementação. Os DEVs
   (Sonnet) e o QA (Opus) seguem como hoje.
3. **O dono valida por álbum:** cada PR traz um álbum de prints. O dono só abre o navegador se algo parecer errado.

## Modelos por papel
| Papel | Modelo | Esforço | Por quê |
|---|---|---|---|
| Líder da v1 (skill `lider-v1`) | Fable 5.2 | `high` | Julgamento: specs, contratos, ordem das ondas, perguntas. Uma sessão só |
| Orquestrador | Opus | padrão | Lança equipes e faz os merges com o ok do dono |
| TPL | Opus | padrão | Executa um spec já aprovado e coordena |
| dev-back, dev-front | Sonnet | padrão | Volume de tokens. Spec bom basta |
| QA | Opus | padrão | Verificação, um novo por volta |

Preço por milhão de tokens (entrada/saída): Fable 5.2 US$ 8/40, Opus 5.5 US$ 4/20, Sonnet 5.5 US$ 2/10. O Fable
fica onde o julgamento vale mais que o volume.

O líder não fica no meio do fluxo de cada equipe. Se um TPL achar um furo no spec que não é regra de negócio nova,
ele decide e registra no spec. Regra de negócio nova vai para o dono.

## Decisões do dono para os specs
- **Avatar pixel no perfil (fatia `perfil-jogador`):** ao escolher o apelido, o jogador também monta o seu
  bonequinho pixel, com cor da pele e cabelo. É básico, mas é o "rosto do jogador" em todo lugar, **inclusive no
  campo** (tela de times e seletor). Ele substitui o bonequinho genérico do time.
- **Design direto:** o autor do spec já decide o visual seguindo as regras abaixo, sem perguntar ao dono. O dono
  ajusta depois, pelo álbum, e esses ajustes são frequentes. A equipe precisa absorvê-los rápido (volta de design,
  abaixo).
- **Álbum de prints** no lugar do teste do dono no navegador.

## Regras de visual (o que o dono já cobrou)
Todo spec de tela as coloca como critério, e o QA confere:
1. **Todo card é um grande momento:** contorno grosso, sombra dura, animação de entrada. Card chapado foi reprovado
   três vezes (aba Times, YOU WIN, bloco do seletor).
2. **Gavetas rápidas:** abrem em 180 ms e fecham em ~100 ms.
3. **Referência de jogo real é copiada fiel**, não "inspirada" (bloco "?" do Mario, VS de luta). Use as peças da
   folha `docs/design/folha/design-system-v1.3.html` (Momento/VS, Pacote, Times, Selos).
4. **O usuário aparece em destaque:** etiqueta "VOCÊ", faixa "VOCÊ JOGA NO PRETO".
5. **Toque, não arrasto:** toca no jogador, depois na vaga.
6. **Palavras:** "dia da pelada", nunca um dia da semana fixo; "grandes momentos", nunca "festa"; concordância
   certa (a assistência é "lançada", no feminino).
7. **Responsivo e sem sobreposição:** a tela funciona em 320, 375, 390 e 430 px de largura e não quebra no desktop
   (coluna centralizada). Sem rolagem horizontal, sem texto ou botão por cima de outro, sem texto cortado. Alvo de
   toque com no mínimo 44 px.

## Álbum de prints
O QA monta o álbum em toda volta que aprova. O TPL cola no PR.
- **Pasta:** `docs/design/prints/<fatia>/`, com um print por cenário de tela em 390 px (`c<n>-<nome>.png`).
- **Largura estreita:** para cada tela nova, um print em 320 px e um no desktop (`<tela>-320.png`,
  `<tela>-desktop.png`).
- **No PR:** uma tabela com os prints, na ordem do fluxo, com uma linha por print dizendo o que mostrar.
- **Checagem automática de sobreposição:** em cada largura, o QA roda no Playwright um script que falha se
  `document.documentElement.scrollWidth > innerWidth`, se dois elementos de texto ou botão visíveis se cruzam, ou
  se um texto está cortado (`scrollWidth > clientWidth` com `overflow: hidden`). Saída no relatório.

## Volta de design
Quando o dono comenta o álbum com ajustes visuais:
- o TPL repassa ao `dev-front` os pedidos, um por linha, exatamente como o dono escreveu;
- o QA da volta confere só os pedidos, a sobreposição e as telas mexidas, e refaz os prints delas;
- volta de design não conta no limite de 3 voltas de QA.

## O que não precisa de aprovação
Os agentes seguem cautelas ao pé da letra. Por isso a lista do que **não** precisa de ok é explícita:
- tentar de novo um comando que falhou por tempo, porta ocupada ou servidor fora do ar;
- rebase da própria branch e resolução de conflito mecânico (roadmap, imports, linhas vizinhas);
- **push da própria branch depois de todo commit e de todo rebase** (`--force-with-lease` depois de rebase);
- refazer a própria migration e resetar o banco **da própria equipe** (`.env.equipe`);
- rodar seed, subir e derrubar servidores nas portas da equipe;
- criar e remover os worktrees `-back` e `-front` da própria fatia;
- dependência nova com justificativa no PR.

**Precisa do dono:**
- merge na `develop` (o orquestrador faz, com o ok);
- regra de negócio que não está no spec nem no `CONTEXT.md`;
- mexer no banco do dono (o do `.env`) ou no de outra equipe;
- apagar qualquer coisa fora do próprio worktree.

## Coordenação: quadro, checkpoints e detector de atraso
Aprovado pelo dono em 14 nov 2026, antes de lançar o líder. Os atrasos que já aconteceram têm a mesma causa:
**ninguém fica sabendo que a base mudou** (PRs feitos antes de decisões novas, rebase sem push, commits presos,
spec escrito antes do que entrou depois).

- **Quadro** (`.claude/scripts/quadro.sh`, arquivo `.claude/quadro-v1.local.tsv` no checkout principal, fora do
  git): uma linha por fatia com etapa, base, quanto está atrás da develop, estado do push, **Toca em**, aviso e
  hora. TPL e líder atualizam a cada etapa. É a fonte da verdade; mensagem entre sessões é só o empurrão.
- **Checkpoints** (skill `tpl`): ao começar (base do spec x develop), antes de cada volta de QA (rebase e push),
  ao mudar contrato/schema/`CONTEXT.md`, ao receber aviso do orquestrador e antes do PR.
- **Checkpoint de merge** (skill `mergear`): a cada merge, o orquestrador cruza os arquivos do PR com o **Toca em**
  de cada fatia ativa e avisa as afetadas no quadro e por mensagem.
- **Detector de atraso** (`.claude/scripts/checar-atraso.sh`): commits atrás da develop, sem push, local divergente
  do remoto, mudança sem commit, quadro parado há mais de 2 h e spec aprovado cuja dependência entrou depois da
  base. Roda sozinho ao abrir a sessão do orquestrador (hook `atraso-ao-iniciar`) e antes de cada merge.
- **Sem push pendente** (hook `sem-push-pendente`, Stop): sessão de worktree de feature não para com commit sem
  push (as branches `-back`/`-front` ficam de fora: são locais por desenho).
- **Spec com base:** o modelo ganhou **Base**, **Depende de** e **Toca em**.

## Erros de processo que já aconteceram
- Rebase feito e não enviado: o #49 ficou dias em conflito no GitHub.
- Commits que nunca subiram: 5 correções de grupos ficaram só numa branch local (recuperadas no #53).
- Worktree apagado sem conferir os commits: quase se perdeu um spec.
- Cinco telas em paralelo sem validação: muito token e nenhuma tela boa. Por isso uma fatia = uma tela de
  referência validada antes das parecidas.

## Arquivos
| Arquivo | Mudança |
|---|---|
| `.claude/skills/lider-v1/SKILL.md` | Novo: specs em lote, perguntas em lote, plano de ondas |
| `.claude/skills/tpl/SKILL.md` | Spec aprovado pula o research; álbum; volta de design; push sempre; terminar o trabalho |
| `.claude/skills/lancar-equipe/SKILL.md` | Kickoff diz se o spec já está aprovado |
| `.claude/agents/dev-front.md` | Regras de visual e responsivo como critério |
| `.claude/agents/qa.md` | Álbum, checagem de sobreposição, larguras |
| `.claude/agents/dev-back.md` | Push e lista do que não precisa de aprovação |
| `.claude/scripts/quadro.sh`, `.claude/scripts/checar-atraso.sh` | Quadro e detector de atraso |
| `.claude/hooks/atraso-ao-iniciar.sh`, `.claude/hooks/sem-push-pendente.sh` | Alertas ao abrir o orquestrador; nada de parar sem push |
| `docs/specs/_modelo.md` | Base, Depende de e Toca em |
