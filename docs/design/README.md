# Design

O design vive no **Paper**, arquivo "Fut Stats":
https://app.paper.design/file/01M583500PVH8Y9M2R4HG9FFWS

A fonte da verdade é a folha **"Design System v0.4 — Noite de jogo"** e os tokens do arquivo. O PNG
`design-system-v0.4.png` é só uma foto para consulta rápida. As folhas v0.1 e v0.2 ficam no Paper como histórico.

## Direção: "Noite de jogo"

Gramado à noite com holofote no topo. Branco x Preto é a identidade; o resto da interface fica quieto.

- **Cor tem papel fixo:**
  - amarelo `--color-accent`: só ações; é a única cor com brilho; um por tela
  - ouro `--color-gold`: mérito (Craque, líder)
  - madeira `--color-flop`: zoeira (Perna de Pau)
  - verde e vermelho: vitória e derrota
  - laranja `--color-warning`: só o ícone de prazo
- **Duas assinaturas, e só elas:**
  - o placar com corte diagonal Branco/Preto
  - o campo 1-2-3-1
- **Figurinha** para jogador. Só a do Craque é holográfica e inclinada.
- **Tipografia:**
  - Barlow Condensed em caixa alta para placar e títulos
  - Inter para todo o resto, inclusive nomes de jogador
  - números com largura fixa (tabular)
- **Profundidade:** 3 níveis, com sombra embaixo e fio de luz em cima.
  - O Paper não tem token de sombra. Os valores estão na folha e viram tokens no Tailwind.
- **Acessibilidade:**
  - alvo de toque mínimo de 44px
  - texto de produto com no mínimo 13px
  - contornos clicáveis usam `--color-border-strong` (3:1)
  - o campo funciona por toque, e arrastar é atalho
  - respeitar "reduzir movimento"

## Componentes na folha

| Grupo | Componentes |
|---|---|
| Ações | Botões: primário com pressionado, foco e carregando; secundário; fantasma; desabilitado; perigo; ícone |
| Identidade | Selos e avatares com anel do time e goleiro |
| Entrada | Presença (Vou / Não vou) com contador; campos de texto com foco e erro |
| Partida e times | Card da partida; campo 1-2-3-1 com banco, seleção e desfazer; figurinhas |
| Notas e votos | Dar nota (stepper + slider + revisão); voto Craque / Perna de Pau; fim "Votos enviados" |
| Estados | Aviso com desfazer; carregando; vazio; erro com "Tentar de novo"; gaveta de confirmação |
| Navegação e listas | Feed (alerta), abas, ranking e barra de navegação com rótulos |

## Pendências

- [ ] Wireframes e alta fidelidade das telas do MVP (roadmap, Fase 0.5).
- [ ] Nome do prêmio de zoeira: o design usa **Perna de Pau**, mas domínio e docs ainda dizem
      **Bola Murcha**. Decidir e renomear em uma tarefa só.
- [ ] Tokens do Paper → tema do Tailwind no `apps/web`, incluindo sombras, movimento e camadas.

Ideias para os momentos de "festa" (animações estilo jogo 2D): [ideias-de-inspiracao.md](ideias-de-inspiracao.md).
