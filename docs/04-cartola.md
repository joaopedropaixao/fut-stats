# Cartola da Pelada

## Como o Cartola FC funciona (resumo)

- Cada usuário tem um orçamento em **cartoletas (C$)**; todos começam com o mesmo valor.
- Cada jogador real tem um **preço**. Antes da rodada o **mercado abre**: você
  compra/vende jogadores dentro do orçamento e escolhe um **esquema** (4-3-3, etc.).
- Você escolhe um **capitão**, que pontua em dobro (hoje em dia, 1,5x).
- O mercado **fecha** antes dos jogos. Depois, cada jogador pontua por **scouts**
  (gol, assistência, desarme, defesa difícil, cartão, gol sofrido...).
- **Valorização**: se o jogador pontuou acima do esperado para o preço dele, ele
  fica mais caro; se pontuou abaixo, fica mais barato. Quem tinha o jogador
  "ganha patrimônio" e consegue comprar jogadores melhores nas rodadas seguintes.
- Ranking por rodada, geral e em ligas entre amigos.

## Adaptação para a pelada (proposta)

| Cartola FC | Pelada |
|------------|--------|
| Esquema 4-3-3 etc. | Escalação fixa **1-2-3-1** (goleiro, 2 zagueiros, 2 alas, 1 meio, 1 atacante), com jogadores dos dois times |
| Mercado fecha antes do jogo | Fecha quando o admin **publica os times** (ou X horas antes) |
| Scouts do jogo | Scouts lançados pelo admin + **nota da rodada** |
| Valorização | Pontos da rodada vs. pontos esperados para o preço |

### Pontuação (exemplo, ajustável)

```
pontos = nota_da_rodada
       + 3 × gols  + 2 × assistências
       + 1 × vitórias na rodada
       + 3 se MVP  − 2 se Bola Murcha
       (goleiro: + 2 jogo sem sofrer gol, − 0,5 por gol sofrido)
capitão: × 1,5
```

### Valorização (exemplo)

```
esperado    = preço × k
variação    = (pontos − esperado) × fator   (limitada a ±X% por rodada)
novo preço  = max(preço_mínimo, preço + variação)
```

Os parâmetros (`k`, `fator`, limites) ficam em configuração do grupo e são
calibrados com os dados das primeiras rodadas.

### Defaults decididos (implementados em `packages/domain/src/cartola`)

| Parâmetro | Default |
|-----------|---------|
| Orçamento inicial | C$ 100 |
| `k` | 0,5 (jogador de C$ 14 "deve" fazer 7 pontos) |
| `fator` | 0,3 C$ por ponto acima/abaixo do esperado |
| Limite por rodada | ±10% do preço |
| Preço mínimo | C$ 3 |
| Empate | 0 ponto (vitória = 1) |
| Regras de goleiro | Valem para quem **jogou no gol na partida**, não para a vaga do Cartola |
| Capitão | × 1,5 no total, inclusive se negativo; capitão que faltou faz 0 |
| Arredondamento | Pontos e preços com 2 casas |

A valorização usa os pontos do jogador **sem** o multiplicador de capitão.

## Riscos e cuidados

- **Conflito de interesse**: quem vota nas notas também tem jogadores escalados.
  Mitigações: média aparada, escalações ocultas até o mercado fechar, voto anônimo.
- **Jogador que faltou**: escalado e não jogou = 0 pontos (igual ao Cartola).
- **Temporada**: com pelada semanal, uma temporada por semestre (~25 rodadas)
  parece um bom tamanho.
- **Dinheiro**: cartoletas são fictícias. Nada de dinheiro real no Cartola.

## Pendências de pesquisa
- [ ] Ver as telas do Cartola (mercado, escalação, parciais) e decidir o que copiar
- [ ] Haverá ligas dentro do grupo ou só ranking geral?

## Tabelas previstas
```
CartolaMarket    roundId, status (ABERTO|FECHADO|PONTUADO), fechaEm
PlayerPrice      roundId, membershipId, preco, variacao
CartolaSquad     roundId, membershipId, capitaoId, patrimonio
CartolaPick      squadId, jogadorId, precoPago
CartolaScore     roundId, membershipId, pontos
```
