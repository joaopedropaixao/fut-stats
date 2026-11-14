# `pacote-do-craque`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.
> **Fatia nova**, criada pelo líder: saiu de dentro de `votacao` para o grande momento ter a própria volta de design.

| | |
|---|---|
| **Fatia** | `pacote-do-craque` (onda 4) |
| **Modo** | Front |
| **Parte de** | `votacao` (a tela `/rodadas/:roundId/resultado` e a carta do Craque) |
| **Status** | rascunho |
| **Base** | develop @1021769 |
| **Depende de** | votacao |
| **Toca em** | apps/web/src/features/pack, apps/web/src/features/voting, apps/web/src/pages/voting/result-page.tsx, apps/web/src/index.css, apps/web/src/components/ui/pixel-sprite-maps.ts |

## Produto

### Objetivo
O resultado da rodada chega como um **pacote fechado**. A pessoa toca, o pacote treme, rasga, a luz vaza e a carta
do Craque gira até parar de frente. É o segundo grande momento aprovado do app (FIFA Ultimate Team + álbum de
figurinhas) e o mais compartilhável: da carta revelada sai um botão **Compartilhar** que manda a imagem para o
grupo do WhatsApp.

### Quem usa
Qualquer membro ativo do grupo, tenha jogado ou não. Cada pessoa abre o pacote **uma vez por rodada** em cada
aparelho; depois o resultado abre direto, com a opção de rever.

### Regras de domínio
Nenhuma nova. Quem é o Craque vem pronto de `GET .../voting/result` (`mvps`). Regras do momento
([DESIGN.md › Movimento](../design/DESIGN.md#movimento) e a folha, Grandes momentos › Momento/Pacote e Regras):
- até 2 s no total, sempre com "Pular";
- a pixel art anda em degraus (`steps()`), sem suavizar;
- com "reduzir movimento", vai direto para o quadro final com um fade;
- som desligado por padrão (esta fatia não tem som).

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | resultado saiu e ainda não abri nesta rodada | olhar o card "O RESULTADO SAIU" do início | a tecla amarela diz **"Abrir pacote"**, e o card mostra um pacote pixel fechado em miniatura | Playwright |
| C2 | primeira vez em `/rodadas/:roundId/resultado` | abrir | **quadro 1, Fechado** (fiel à folha, Pacote/1 Fechado): o pacote pixel no centro, em ouro, com "CRAQUE", "RODADA 12" e "TOQUE PARA ABRIR". Fica parado até o toque. "Pular" visível (≥ 44 px) | Playwright |
| C3 | pacote fechado | toca no pacote (ou Enter/Espaço) | **suspense**: o pacote treme em degraus (0 a 0,6 s) | Playwright |
| C4 | depois do suspense | — | **quadro 2, Rasgo** (0,6 a 1,2 s): a fenda abre no topo e a luz vaza por ela em faixas pixel | Playwright |
| C5 | depois do rasgo | — | **quadro 3, Revelação** (1,2 a 2 s): a carta do Craque sobe do pacote, gira (a largura muda em degraus, como sprite) e para de frente, levemente inclinada (só ela pode). Estrelas pixel piscam em volta | Playwright |
| C6 | revelado | olhar | a carta: bonequinho do Craque (o `avatar` dele), apelido inteiro, "CRAQUE · RODADA 12" e a nota em dígitos pixel. Abaixo, a tecla amarela **"Compartilhar"** e a de contorno "Ver o resultado" | Playwright |
| C7 | em qualquer quadro | "Pular" | vai direto para a carta revelada | Playwright |
| C8 | revelado | "Ver o resultado" (ou rolar) | a página do resultado de `votacao` (carta, Perna de Pau, sua nota, tabela), com o foco no título | Playwright |
| C9 | já abri este pacote neste aparelho | abrir o resultado de novo | abre direto no resultado, sem animação; no topo, a tecla de contorno "Abrir o pacote de novo" repete o momento | Playwright |
| C10 | aparelho sem armazenamento (modo privado) | abrir duas vezes | toca as duas vezes e nada quebra | unitário (`pack-opened`) + Playwright |
| C11 | "reduzir movimento" | abrir pela primeira vez | o pacote fechado aparece; ao tocar, a carta revelada entra com um fade, sem tremer, rasgar nem girar | Playwright (`emulateMedia`) |
| C12 | dois Craques (empate) | revelar | as duas cartas saem do pacote, uma depois da outra, e ficam lado a lado (empilhadas em 320 px); a nota de cada uma aparece | Playwright |
| C13 | rodada fechada sem votos (sem Craque) | abrir o resultado | sem pacote: abre direto no resultado ("Ninguém votou nesta rodada") e o card do início diz "Ver resultado" | Playwright |
| C14 | celular com `navigator.share` e suporte a arquivo | "Compartilhar" | abre o compartilhamento do sistema com uma **imagem PNG** da carta (1080 × 1350, o mesmo desenho pixel, com "FUT STATS" no rodapé) e o texto "Craque da rodada 12: Ronaldinho, nota 9,1" | Playwright (função chamada com o arquivo) + unitário (texto) |
| C15 | navegador sem compartilhar arquivo; sem `navigator.share` | "Compartilhar" | compartilha só o texto; sem `share`, abre `https://wa.me/?text=...` com o mesmo texto | Playwright |
| C16 | a pessoa cancela o compartilhamento | — | nada acontece (sem aviso de erro) | Playwright |
| C17 | leitor de tela | abrir e revelar | a animação é `aria-hidden`; o pacote é um botão "Abrir o pacote do Craque da rodada 12"; ao revelar, anuncia "Craque da rodada 12: Ronaldinho, nota 9,1" e o foco vai para esse título | Playwright (árvore de acessibilidade) |
| C18 | tempos | medir | suspense + rasgo + revelação ≤ 2 s; nenhuma animação usa outra coisa que `transform` e `opacity` | Playwright |
| C19 | larguras 320, 375, 390, 430 px e desktop | os três quadros, a carta revelada (uma e duas) e o card do início | o pacote e a carta cabem inteiros, sem rolagem horizontal nem sobreposição com "Pular" e as teclas; apelido de 10 letras inteiro na carta; alvos ≥ 44 px. Checagem automática passa. Console sem erros no fluxo real | Playwright |

## Técnico

### Contrato
Sem mudança de API. Usa `GET /groups/:groupId/rounds/:roundId/voting/result` (`RoundResult.mvps`) e o
`lastResult` da lista de rodadas, os dois de `votacao`.

### Banco (`schema.prisma`)
Sem mudança.

### Domínio
Sem mudança.

### Tela
Regras de visual do documento de autonomia valem como critério. **Referência copiada fiel:** os três quadros da
folha (`docs/design/folha/design-system-v1.3.html`, Momento/Pacote: Pacote/1 Fechado, Pacote/2 Rasgando,
Pacote/3 Revelação e Carta/Craque); os mapas pixel do pacote saem do `build.py` da folha, como o bonequinho saiu.
Referência de código: `vs-board.tsx` + `vs-seen.ts` (fases, Pular, foco, reduzir movimento) e `result-card.tsx`
(estrelas e confete).

- **`features/pack/pack-opening.tsx`:** máquina de fases `closed → shake → tear → reveal` com tempos fixos
  (600 / 600 / 800 ms), no padrão do VS. O pacote e a fenda são SVG pixel (`crispEdges`); a luz são faixas com
  `opacity` em degraus; o giro da carta é `scaleX` em `steps()`. Sprites novos em `pixel-sprite-maps.ts`.
- **`features/pack/pack-opened.ts`:** "já abri" por rodada, em `localStorage` com `try/catch` (cópia do
  `vs-seen.ts`, com teste). É o mesmo registro que o card do início usa para virar linha (substitui o
  `result-opened.ts` de `votacao`).
- **`pages/voting/result-page.tsx`:** se há Craque e o pacote não foi aberto, mostra o `PackOpening` no lugar do
  topo da página; revelado ou pulado, segue a página normal. A carta revelada é o `craque-card.tsx` de `votacao`,
  sem duplicar.
- **Card do início** (`features/voting/result-alert.tsx`): miniatura do pacote e o rótulo "Abrir pacote".
- **Compartilhar** (`features/pack/share-card.ts`): desenha a carta num `canvas` (fundo, moldura, bonequinho a
  partir dos mapas pixel, textos em Silkscreen depois de `document.fonts.ready`, `imageSmoothingEnabled = false`)
  e gera o PNG com `toBlob`. Tenta `navigator.share({ files, text })` se `navigator.canShare` aceitar; senão
  `navigator.share({ text })`; senão o link `wa.me`. O texto sai de uma função pura com teste. Sem dependência
  nova.
- Cor: ouro (`--color-gold` e família) é recompensa; o amarelo de ação fica só na tecla da vez ("Abrir pacote" no
  início; "Compartilhar" na revelação). Cor nunca é o único sinal: o pacote e a carta dizem "CRAQUE" por escrito.
- Palavras: "grande momento", nunca "festa".

**Álbum** (`docs/design/prints/pacote-do-craque/`): `c2-fechado`, `c4-rasgo`, `c6-revelado`, `c9-ja-aberto`,
`c11-reduzir-movimento`, `c12-dois-craques`, a imagem gerada pelo Compartilhar (`c14-imagem.png`), `c1-inicio`;
`pacote-320`, `revelado-320`, `pacote-desktop`, `revelado-desktop`.

### Decisões
- Fatia própria, só front — o resultado já funciona sem ela; o grande momento ganha a própria volta de design.
- O pacote espera o toque — o suspense é da pessoa; os 2 s contam a partir do toque.
- Uma vez por rodada por aparelho, com "abrir de novo" — igual ao VS e ao YOU WIN; quem quer mostrar para alguém
  repete.
- Imagem desenhada em `canvas`, sem biblioteca de captura — a carta é pixel art de mapas que já temos; evita
  dependência e sai nítida em qualquer tela.
- Empate revela as duas cartas no mesmo pacote — um momento por rodada.

## Fora do escopo
- Som e vibração.
- Pacote para o Perna de Pau ("o tropeço") e para a nota de cada um.
- Carta holográfica com giroscópio; álbum de figurinhas ("já tenho / não tenho").
- Compartilhar o resultado inteiro da rodada.

## Perguntas respondidas pelo dono
- Grande momento do Craque? → Pacote com suspense e revelação da carta, aprovado (22 out 2026).
- Sem pergunta nova: o visual segue a folha e o dono ajusta pelo álbum.

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
