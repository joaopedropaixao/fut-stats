# Design

O design vive no **Paper**, arquivo "Fut Stats":
https://app.paper.design/file/01M583500PVH8Y9M2R4HG9FFWS

A fonte da verdade é a folha **"Design System v0.5 — Noite de jogo"** e os tokens do arquivo. O PNG
`design-system-v0.5.png` é só uma foto para consulta rápida. As folhas v0.1, v0.2 e v0.4 ficam no Paper como
histórico. Elas usam os mesmos tokens, então as cores mudaram junto, mas o formato (cantos, sombras) é o antigo.

## Direção: "Noite de jogo" com cara de fliperama

Gramado à noite com holofote no topo. Branco x Preto é a identidade. A nostalgia de jogo 2D entra em três
lugares: no formato (canto reto e tecla), na fonte pixel do jogador e nos momentos de festa (VS e pacote).

- **Cor tem papel fixo:**
  - texto em creme `--color-text` (`#F3EAD3`); o branco puro fica só para o time Branco
  - amarelo `--color-accent`: só ações, um por tela, sem brilho
    - **exceção aprovada:** a palavra **VS** usa `--color-game`, que é o mesmo amarelo
  - ouro `--color-gold`: mérito (Craque, líder)
  - madeira `--color-flop`: zoeira (Perna de Pau)
  - verde e vermelho: vitória e derrota
  - laranja `--color-warning`: só o ícone de prazo
- **Fundo:**
  - padrão escuro (`--color-bg`), com holofote radial no topo (`--color-floodlight`)
  - opção **"Gramado"** nas configurações: troca só as 4 cores de fundo pelos tokens `*-green`
    (`--color-bg-green`, `--color-surface-green`, `--color-surface-3-green`, `--color-border-strong-green`)
- **Duas assinaturas, e só elas:**
  - o placar com corte diagonal Branco/Preto
  - o campo 1-2-3-1
- **Tipografia: uma fonte para cada papel.**

| Fonte | Papel | Onde |
|---|---|---|
| Barlow Condensed 800 | o jogo | Placar, nome dos times, títulos. Caixa alta. |
| Silkscreen 700 (`--font-pixel`) | o jogador | Nome, nota e posição do jogador; VS, Craque, Game Over; logo. Só caixa alta, mínimo 13px, sem quebra de linha. |
| Inter | o app | Botões, textos, rótulos, datas, mensagens. |

  - Texto corrido nunca vira pixel.
  - A Pixelify Sans foi descartada porque "Z" lê como "B" e 2/3 parecem 8.
- **Forma:**
  - canto reto (raio 0) em tudo; só avatar, ponto e bolinha do slider são redondos
  - card e lista: contorno duro de 2px com `--color-border-strong`, sem sombra
  - o que flutua (aviso, barra de abas, gaveta): contorno + sombra sólida preta `4px 4px 0`
  - botão principal é **tecla**: amarelo chapado, borda preta de 3px e sombra `4px 4px 0 #000`;
    pressionado, desce 4px e perde a sombra
  - O Paper não tem token de sombra. Os valores estão na folha e viram tokens no Tailwind.
- **Pixel art:** bonequinhos (8×12), estrela e bola desenhados em pixel, com cantos nítidos.
  - Aparecem inteiros no VS e no pacote. No resto do app, o pixel fica na fonte do jogador.
- **Figurinha** para jogador. Só a do Craque é colorida (holográfica) e inclinada.
- **Acessibilidade:**
  - alvo de toque mínimo de 44px
  - texto de produto com no mínimo 13px
  - contornos clicáveis usam `--color-border-strong` (3:1)
  - o campo funciona por toque, e arrastar é atalho
  - respeitar "reduzir movimento"

## Componentes na folha

| Grupo | Componentes |
|---|---|
| Base | Cores; fundo escuro e "Gramado" com holofote; tipografia por papel; forma e profundidade |
| Ações | Botões: primário (tecla) com pressionado, foco e carregando; secundário; fantasma; desabilitado; perigo; ícone |
| Identidade | Selos e avatares com anel do time e goleiro |
| Entrada | Presença (Vou / Não vou) com contador; campos de texto com foco e erro |
| Partida e times | Card da partida; campo 1-2-3-1 com banco, seleção e desfazer; figurinhas |
| Festa | VS dos times (quadro final); pacote do Craque fechado e carta revelada |
| Notas e votos | Dar nota (stepper + slider + revisão); voto Craque / Perna de Pau; fim "Votos enviados" |
| Estados | Aviso com desfazer; carregando; vazio; erro com "Tentar de novo"; gaveta de confirmação |
| Navegação e listas | Feed (alerta), abas, ranking e barra de navegação com rótulos |

## Pendências

- [ ] Wireframes e alta fidelidade das telas do MVP (roadmap, Fase 0.5).
- [x] Nome dos prêmios: **Craque** e **Perna de Pau** em domínio, labels e docs (código segue `mvp`/`flop`).
- [ ] Tokens do Paper → tema do Tailwind no `apps/web`, incluindo sombras, movimento, camadas e o fundo "Gramado".

Próxima sessão de design: comece pelo [HANDOFF.md](HANDOFF.md).

Ideias para os momentos de "festa" (animações estilo jogo 2D): [ideias-de-inspiracao.md](ideias-de-inspiracao.md).
