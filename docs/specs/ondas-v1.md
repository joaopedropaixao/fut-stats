# Ondas da v1

Plano de execução das 12 fatias que faltam na Trilha (`docs/03-roadmap.md`), escrito pelo líder da v1
(`2026-11-14-autonomia-v1.md`). São **6 ondas**. Cada onda tem até 3 fatias rodando ao mesmo tempo e **uma só dona
do `schema.prisma`**. Uma onda começa quando a anterior inteira está na `develop`.

**Status:** rascunho, esperando as respostas do lote (`perguntas-v1.md`).

## Resumo

| Onda | Fatia | Modo | Dona do `schema.prisma` | Models que muda | Depende de |
|---|---|---|---|---|---|
| **1** | `perfil-jogador` | Par | **sim** | `Membership` (+ 3 enums do bonequinho) | — |
| 1 | `orcamento-de-bundle` | Front | — | — | — |
| **2** | `rodizio-reservas` | Par | **sim** | `Round` | perfil-jogador |
| 2 | `historico` | Par | — | — | perfil-jogador |
| **3** | `votacao` | Par | **sim** | `Vote` e `Rating` (novos), `Round`, `TeamPlayer`, `Group` | perfil-jogador, historico |
| **4** | `auditoria-da-rodada` | Back | **sim** | `RoundLog` (novo) | votacao, rodizio-reservas |
| 4 | `ranking` | Par | — | — | votacao, perfil-jogador |
| 4 | `pacote-do-craque` | Front | — | — | votacao |
| **5** | `feed` | Par | **sim** | `Post`, `PostReaction`, `PostComment` (novos) | votacao, pacote-do-craque, perfil-jogador |
| 5 | `jogo-ao-vivo` | Par | — | — | auditoria-da-rodada, votacao, rodizio-reservas |
| **6** | `pwa-e-push` | Par | **sim** | `PushSubscription` (novo) | feed, votacao, perfil-jogador |
| 6 | `producao` | Back | — | — | auditoria-da-rodada, orcamento-de-bundle |

Depois da onda 6: a **release** (`develop` → `main`, tag `v1.0.0`) e o lançamento para a pelada, pelo roteiro de
`producao` (`docs/deploy.md` e `docs/lancamento.md`). É do orquestrador, com o ok do dono.

## Por que essa ordem
- **Seis fatias mexem no banco** (perfil, rodízio, votação, auditoria, feed e push). Com uma dona do schema por
  onda, seis ondas é o mínimo. As outras seis fatias se encaixam ao lado, respeitando as dependências.
- **`perfil-jogador` primeiro:** o bonequinho entra em quase todo contrato (`avatar` em presença, times, jogo). Toda
  tela nova depois dela já nasce com o rosto do jogador.
- **`orcamento-de-bundle` na onda 1:** dividir as rotas é mais barato antes de existirem mais telas. Toda rota nova
  das ondas seguintes já entra com `lazy`.
- **`rodizio-reservas` na onda 2:** era o próximo pedido do dono depois do placar, é pequena, e não cruza com
  `historico`.
- **`historico` antes de `votacao`:** a votação acrescenta as notas e o Craque nas telas do histórico.
- **`votacao` sozinha na onda 3:** é a maior fatia (votar, fechar, apurar e resultado) e tudo o que vem depois
  depende dela. Nada que sobra pode rodar ao lado sem depender dela.
- **`auditoria-da-rodada` e `jogo-ao-vivo` depois da votação** (mudança em relação à Trilha antiga): assim um PR só
  liga o registro, e outro só liga o tempo real, em **todos** os pontos de escrita da rodada (placar, lances,
  rodízio e votação), em vez de cada fatia ligar o seu pedaço.
- **`pacote-do-craque` é fatia nova**, tirada de dentro de `votacao`: é só front, é o grande momento que mais pede
  volta de design, e não segura o resultado (que funciona sem ele).
- **`producao` por último:** a release só faz sentido com tudo dentro; e ela usa o `requestId` da auditoria e o
  orçamento de bundle.

## Onda a onda

### Onda 1: `perfil-jogador` + `orcamento-de-bundle`
- **Schema:** `perfil-jogador`.
- **Tela de referência:** os formulários de entrar (`/comecar`, `/convite`) e a lista de presença de `rodadas`, já
  aprovados. A **figurinha do Perfil** desta fatia vira referência para o perfil do jogador em `ranking`, e os
  **rostos** viram referência para todas as telas seguintes: o dono olha o álbum desta fatia com mais atenção.
- **Cruzamento:** as duas mexem no `router.tsx` e em `pages/entrar-e-grupo/routes.tsx`. Mergear
  `orcamento-de-bundle` primeiro (é menor); `perfil-jogador` faz o rebase e põe as rotas novas com `lazy`.

### Onda 2: `rodizio-reservas` + `historico`
- **Schema:** `rodizio-reservas` (`Round`).
- **Telas de referência:** rodízio = o card do jogo no início (`game-card.tsx`) e o placar; histórico = a lista de
  `/rodadas` e a tela do jogo em modo leitura. As duas referências já estão aprovadas.
- **Cruzamento:** nenhum arquivo em comum além do `router.tsx` (só `historico`) e do `app.module.ts`. Ordem de
  merge livre.

### Onda 3: `votacao`
- **Schema:** `votacao` (a maior migration da v1: `Vote`, `Rating`, campos em `Round`, `TeamPlayer` e `Group`).
- **Tela de referência:** a folha, seção "Dar nota e votar" (todas as peças já estão desenhadas), e os cards de
  grande momento do jogo. É uma tela de tipo novo: o álbum desta fatia é a referência para os avisos do `feed`.
- **Tamanho:** é a fatia mais longa. Se o TPL precisar entregar em duas voltas de QA (votar primeiro, resultado
  depois), pode, dentro do mesmo PR.

### Onda 4: `auditoria-da-rodada` + `ranking` + `pacote-do-craque`
- **Schema:** `auditoria-da-rodada` (`RoundLog`).
- **Telas de referência:** ranking = a lista de presença (nota + posição) e a figurinha do Perfil (onda 1);
  pacote = o VS (`vs-board.tsx`) e o YOU WIN (`result-card.tsx`), com os três quadros da folha copiados fiéis.
- **Cruzamento:** `auditoria` e `ranking` mexem no `lineups.service.ts` (uma em publicar/despublicar, a outra em
  de onde vem a nota) e no `app.module.ts`: conflito mecânico; quem entrar por último faz o rebase.
  `pacote-do-craque` é só front e mexe em `features/voting` e na página do resultado: não cruza com as outras
  duas.

### Onda 5: `feed` + `jogo-ao-vivo`
- **Schema:** `feed` (`Post`, `PostReaction`, `PostComment`).
- **Telas de referência:** feed = os cards de votação e resultado (onda 3), o pacote (onda 4) e o card do jogo;
  jogo-ao-vivo não tem tela nova.
- **Cruzamento:** `feed` troca a página inicial (`pages/rounds/home.tsx` → `pages/feed`); `jogo-ao-vivo` mexe no
  `shell.tsx` e nas consultas do jogo e da votação. O acordo que evita dependência entre as duas: a consulta dos
  avisos do feed fica **sob a chave da lista de rodadas**, e o tempo real invalida por prefixo (está nos dois
  specs).
- **Depois do merge:** conferir o tempo real no staging (passa pelo proxy da Vercel); o roteiro vem no PR.

### Onda 6: `pwa-e-push` + `producao`
- **Schema:** `pwa-e-push` (`PushSubscription`).
- **Tela de referência:** os cards do Perfil (onda 1) e a linha de aviso do feed (onda 5).
- **Cruzamento:** as duas mexem no `render.yaml`, no `.env.example`, no `env.ts` e no `pnpm-lock.yaml` (cada uma
  com uma dependência nova: `web-push` e Sentry). Mergear `pwa-e-push` primeiro; `producao` faz o rebase,
  reinstala e inclui as variáveis `VAPID_*` no serviço de produção.
- **Trabalho do dono:** esta onda tem os passos que só ele faz (painéis da Vercel, Render, Neon, Google, Sentry e
  segredos do GitHub) e o teste de push em aparelho real. O roteiro está no spec de `producao` (R1 a R9).

## Regras para rodar em paralelo
- Modo paralelo com `.env.equipe` (`2026-10-30-equipe-paralela.md`): portas e banco por equipe, no máximo 3
  equipes. A onda 4 usa as três vagas.
- **Só a dona do schema cria migration na onda.** As outras duas não tocam no `schema.prisma`. Se uma fatia sem
  schema descobrir que precisa de coluna, o TPL para e avisa o orquestrador (vira assunto da onda seguinte ou troca
  de dona).
- Quem entra por segundo na `develop` faz `git fetch && git rebase origin/develop`, resolve o conflito mecânico e
  roda o "pronto" de novo antes do merge.
- O campo **Base** de cada spec é a `develop` que o líder leu. No kickoff de cada onda, o TPL confere a Base contra
  a `develop` do dia (checkpoint "ao começar" da skill `tpl`) e ajusta o spec se uma dependência mudou o que ele
  cita.
- Uma fatia só começa com o spec `Status: aprovado` e com as fatias do **Depende de** já na `develop`.

## O que o dono valida em cada onda
Pelo álbum de prints do PR (`docs/design/prints/<fatia>/`), sem abrir o navegador se nada parecer errado:

| Onda | Olhar com mais atenção |
|---|---|
| 1 | os bonequinhos (6 cabelos e 5 tons distinguíveis), a figurinha do Perfil e os rostos no campo |
| 2 | o card do rodízio (contagem, PREPARA, TROCA!) e o card de partida do histórico |
| 3 | a tela de dar nota, "Votos enviados" e a carta do Craque no resultado |
| 4 | os três quadros do pacote e a imagem do Compartilhar; a lista do ranking |
| 5 | o Feed com um aviso grande e as linhas; o card da resenha com reações |
| 6 | os cards de instalar e de avisos; o roteiro de produção |
