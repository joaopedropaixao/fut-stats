# Revisão visual de arquitetura

Projeto de portfólio/laboratório. Esta revisão descreve o produto e o código na escala em que existem; não define metas de capacidade aceitas.

## Plano e acompanhamento

| Rodada | Escopo | Estágios | Estado |
|---|---|---|---|
| 1 | Pessoas, permissões e jornadas/estados | Rascunho com evidências → revisão independente → correções → apresentação ao dono | Revisão técnica concluída (QA3 + conferência focada A1); aguardando validação do dono |
| 2 | Estrutura real, entidades e sequências de requisições/dados | Rascunho com evidências → revisão independente → correções → apresentação ao dono | Aguardando revisão da rodada 1 |
| 3 | Carga/capacidade, segurança da aplicação, operação/confiabilidade e decisões de evolução | Rascunho com evidências → revisão independente → correções → apresentação ao dono | Aguardando revisão da rodada 2 |

- **Validadores:** autoria TPL (esta sessão), revisão independente pelo QA lançado pelo coordenador e apresentação/validação do dono. Nenhum estágio posterior está aprovado por este rascunho.
- **Critério por estágio:** afirmações ligadas a caminho e símbolo/seção; diferenças entre documentação e código explicitadas; diagramas nativos importáveis, legíveis e coerentes com as fontes; perguntas só quando alterarem o desenho.
- **Estado desta revisão:** revisão técnica concluída: QA3 aprovou C1–C5 e C7–C9, e conferência independente do coordenador no HEAD `522f0cbf` aceitou a correção de C6/A1. Aguardando validação do dono, que ainda não aprovou. Rodadas 2 e 3 não iniciadas.
- **Data:** 14/11/2026.
- **Base inicial:** `024186f0cc935f3c835bd5e93e98e9a59654b37c`.
- **Base de produto:** código lido no mesmo SHA inicial; documentação antiga é referência de intenção, não prova de implementação.

## Artefatos da rodada 1

- [Atores e permissões](./01-atores-permissoes.md)
- [Jornada e estados](./02-jornada-estados.md)
- [Resultado pessoal: YOU WIN / YOU LOSE / EMPATE](./03-resultado-pessoal.md)
- [Requisitos e rastreabilidade](./04-requisitos-r1.md)
- Evidências visuais e validação resumida: [relatório da rodada 1](./05-validacao-r1.md) e [álbum QA3](../design/prints/revisao-arquitetura/).
- Pranchas editáveis: [contexto e atores](./diagrams/01-contexto-atores.excalidraw), [jornada por raias](./diagrams/02-jornada-raias.excalidraw), [resultado pessoal](./diagrams/03-resultado-pessoal.excalidraw)

## Revisão independente

QA1 apontou A11 classificado como hipótese e colisões de texto em duas pranchas; corrigidos. QA2 encontrou status P indevido para scouts no jogo e não concluiu importação nativa; o status foi corrigido. QA3 aprovou C1–C5 e C7–C9, importou e inspecionou os três arquivos nativos, e identificou somente A1: status composto `V/P` e contrato `InvitePreview` confundido com componente visual. A1 foi corrigido para V e separa UI, contrato e API; a conferência focada independente do coordenador aceitou a correção no HEAD `522f0cbf`. Evidências, hashes e síntese portátil estão em [validação da rodada 1](./05-validacao-r1.md); PNGs no [álbum QA3](../design/prints/revisao-arquitetura/). Relatórios completos QA1–QA3 permanecem fora do Git em `/tmp/fut-stats-arquitetura-qa1-relatorio.md`, `/tmp/fut-stats-arquitetura-qa2-relatorio.md` e `/tmp/fut-stats-arquitetura-qa3-relatorio.md`.

## Achados que condicionam a leitura

1. **Votação incompleta no código:** o enum `RoundStatus` e as funções de domínio para validar votos/fechar votação existem, mas o schema Prisma não tem registros de voto e a API não tem módulo/rota de voto ou fechamento. O fluxo aparece como intenção de produto e regra parcial, não como jornada ponta a ponta implementada. Fontes: [`schema.prisma`](../../apps/api/prisma/schema.prisma), [`packages/domain/src/round/voting.ts`](../../packages/domain/src/round/voting.ts), [`packages/domain/src/round/status.ts`](../../packages/domain/src/round/status.ts), [`apps/api/src/match/match.controller.ts`](../../apps/api/src/match/match.controller.ts).
2. **História não prova tela pronta:** `docs/02-arquitetura.md` chama o modelo de fase 1 de implementado e descreve `VOTING`; o código confirma status/placar/lances, mas não a gravação de votos descrita no spec de produto. Para esta rodada, enum/regra parcial foi tratado como verificado e votos/API como pendentes.
3. **Reabertura limitada:** só existe retorno `TEAMS_PUBLISHED → SCHEDULED` para desfazer publicação antes do jogo; `CLOSED` não tem transição de retorno. O resultado pessoal pode ser visto novamente conforme o armazenamento local do navegador, mas isso não reabre a rodada.
4. **Scouts na partida e assistências:** scouts só são criados/removidos em `POST_MATCH` para qualquer ator; admin não lança scout em `IN_PROGRESS`. A transição para votação compara somente gols lançados com o placar; assistências são soltas e não precisam ser menores ou iguais aos gols. Specs/comentários anteriores divergem; esta revisão registra o código sem alterar regra, contrato, CONTEXT ou docs fora do escopo.

A lista de dúvidas e o catálogo de requisitos ficam nos documentos ligados acima. Metas de usuários simultâneos, latência, disponibilidade, custo e retenção continuam sem confirmação.
