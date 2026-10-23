# Visão e Escopo

## Problema

A pelada semanal é organizada pelo grupo do WhatsApp e por uma planilha mensal. Não existe
histórico, ninguém sabe quem está jogando bem, a divisão dos times é feita "no olho"
(e se repete) e o engajamento entre um jogo e outro é zero.

## Objetivo

Um app (mobile-first, com versão web) que deixa a pelada **mais interativa**:
times equilibrados automaticamente, notas pós-jogo, ranking, resenhas e um
"Cartola da pelada".

Objetivos secundários: projeto de portfólio no GitHub e laboratório para praticar
arquitetura, deploy e desenvolvimento assistido por IA.

## Formato da pelada

- **Semanal**, com mensalidade.
- **Fut7**, sempre **dois times: Branco x Preto**, ou seja, **uma partida por rodada**.
- Formação **1-2-3-1**: 1 Goleiro, 2 Zagueiros, 2 Alas, 1 Meia, 1 Atacante
  (6 na linha + goleiro).
- **Goleiros** são contratados por fora, mas existe um grupo fixo que sempre vem.
  Eles entram no app como jogadores do grupo (tipo `GOLEIRO`), são sorteados
  um para cada time e aparecem no ranking de goleiros.

## Usuários

| Papel     | O que faz |
|-----------|-----------|
| **Jogador** | Confirma presença, lança os **próprios** gols/assistências, dá notas, vota Craque / Perna de Pau, vê ranking/histórico, reage e comenta, monta o time no Cartola |
| **Admin**   | Tudo do jogador + cadastra jogadores e goleiros, gera/edita/publica os times, lança placar e scouts **de qualquer jogador** (inclusive corrigindo), cria notícias/resenhas, fecha votação |

Um usuário pode participar de **mais de um grupo (pelada)**, com papel diferente em cada.
O MVP roda em um grupo só, mas o modelo de dados já nasce multi-grupo.

## Funcionalidades

### 1. Seletor automático de times (Admin)
- Entrada: jogadores confirmados na rodada.
- Considera: nota (média recente), posição, histórico de vitórias e **com quem jogou nas últimas rodadas**.
- Saída: **Branco x Preto** equilibrados, cada um na formação 1-2-3-1, com um
  goleiro em cada lado, evitando repetir as mesmas duplas/panelinhas.
- Se faltar gente numa posição, o algoritmo usa as posições secundárias do jogador.
- Admin pode arrastar jogadores entre times, regerar e **publicar** (aí os jogadores veem).

### 2. Notas pós-rodada
- Só quem jogou a rodada vota.
- Nota para cada jogador que jogou (do seu time ou não), exceto a si mesmo.
- Voto de **Craque** e **Perna de Pau**.
- Resultados ficam ocultos até todos votarem **ou** o prazo expirar; aí vão para o histórico.

### 3. Ranking
- Média de nota, vitórias, derrotas, gols, assistências, vezes Craque, vezes Perna de Pau, sequência.
- Goleiros: stats próprios (ex.: gols sofridos, jogos sem sofrer gol).
- Ranking geral e por posição.

### 4. Feed (tela inicial)
- Notícias e resenhas criadas pelos admins (texto + imagem/vídeo curto).
- Reações e comentários.
- Cards de alerta: "times publicados", "votação aberta", "mercado do Cartola fecha em 2h".

### 5. Histórico de partidas
- Lista de rodadas → detalhe com times, placar, scouts e notas de cada jogador.

### 6. Cartola da pelada
Ver [04-cartola.md](04-cartola.md).

### 7. Pagamentos (fora do MVP)
Substituir a planilha mensal: status de quem pagou, Pix copia-e-cola e, no futuro,
confirmação automática.

## Escopo do MVP

| Entra no MVP | Logo depois (v1.1) | Futuro |
|--------------|--------------------|--------|
| Login com Google, convite para o grupo | **Cartola** | Pagamentos / Pix |
| Cadastro de jogadores e posições | | Notificações via WhatsApp |
| Rodadas, presença, placar e scouts | | App nativo nas lojas (se fizer falta) |
| Seletor de times | | Abrir para outros grupos |
| Notas + Craque / Perna de Pau | | |
| Ranking | | |
| Histórico | | |
| Feed com notícias, reações e comentários | | |
| Instalável no celular (PWA) + push | | |

**Por que o Cartola fica em v1.1, logo depois:** o preço dos jogadores depende das
notas e dos scouts. Lançando o núcleo primeiro, o grupo joga 2–3 rodadas, gera
dados reais, e o Cartola já estreia com preços que fazem sentido (sem precisar
"chutar" o valor de todo mundo). E o MVP chega antes na mão do pessoal.

## Regras de negócio (rascunho)

- **Rodada = 1 partida** (Branco x Preto). Notas, Craque e Perna de Pau são por rodada.
- **Scouts**: o jogador lança os próprios gols/assistências; o admin lança e
  corrige os de qualquer um. Cada scout guarda quem lançou.
- **Nota**: 0 a 10, de 0,5 em 0,5. A nota da rodada de um jogador é a **média
  aparada** (descarta a maior e a menor), o que reduz voto de sacanagem. Com **3 votos
  ou menos**, usa a média simples (aparar sobraria pouca ou nenhuma nota). Sem notas, o
  jogador fica sem nota na rodada. Arredondada em 1 casa decimal.
- **Quem vota**: só quem jogou a rodada (goleiros inclusos), em qualquer jogador que jogou
  (dos dois times), nunca em si mesmo.
- **Craque / Perna de Pau**: quem vota escolhe um de cada (não dá para votar só em um), e não
  pode ser o mesmo jogador. Leva quem tiver mais votos; no empate, Craque vai para a maior nota
  da rodada e Perna de Pau para a menor (se a nota também empatar, todos levam). Critério configurável.
- **Votos são anônimos** para os jogadores; a média é pública.
- **Nota inicial**: definida pelo admin no cadastro (cold start do seletor de times).
- **Prazo de votação**: configurável por grupo (ex.: 48h após a rodada).
- **Quem não vota** não perde nada no MVP (avaliar penalidade no Cartola depois).
- **Goleiros contratados são membros como os outros**: votam nas notas, Craque e Perna
  de Pau e participam do Cartola (normalmente são os mesmos e já conhecem a rapaziada).
- **Grupo de confiança**: só entra no app quem é convidado; não há moderação nem
  antifraude pesados além da média aparada.
- **Adesão é opcional**: o jogo só depende de ter os 2 goleiros e os confirmados.
  Votar e jogar o Cartola não são obrigatórios. Tudo precisa funcionar com poucos
  participantes (ex.: poucos votos numa rodada, só parte do grupo no Cartola), porque
  nem todos vão aderir de primeira.
- **Confirmados por rodada**: de 14 a 18. Cada time tem 7 em campo (1 goleiro + 6 de
  linha) e de 0 a 2 reservas, que entram no revezamento (ex.: a cada 7–10 min, entram
  e saem todos os reservas juntos). Por isso todos contam como tendo jogado o mesmo tempo.
  - Número ímpar (raro): um time fica com um a mais e reveza de 2 em 2 ou de 1 em 1;
    o outro fica com 1 ou 0 reservas (diferença máxima de 1 reserva entre os times).
  - Menos de 14 ou mais de 18: o seletor não gera times; o admin ajusta a lista.
  - Exatamente 2 goleiros, um para cada time; jogador de linha não vai para o gol.

## Perguntas em aberto

- [x] Goleiros contratados votam nas notas e participam do Cartola? Sim, os dois.
- [x] O que acontece quando sobra ou falta jogador (13, 15...)? Ver "Confirmados por rodada" acima.

## Referências

- **Cartola FC**: mercado, cartoletas, valorização, capitão.
- **Chega+**: organização de pelada, presença, sorteio de times.
- **Appito**: stats e perfil de jogador amador.
