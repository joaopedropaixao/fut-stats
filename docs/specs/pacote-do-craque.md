# `pacote-do-craque`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.
> **Fatia nova**, criada pelo líder: saiu de dentro de `votacao` para o grande momento ter a própria volta de design.

| | |
|---|---|
| **Fatia** | `pacote-do-craque` (onda 4) |
| **Modo** | Front |
| **Parte de** | `votacao` (a tela `/rodadas/:roundId/resultado` e a carta do Craque) |
| **Status** | aprovado em 2026-11-14; escopo ampliado pelo reforço do dono de 2026-11-15 |
| **Base** | develop @4b264a9 (entraram perfil-jogador #62, ajustes-tela-do-jogo #63, historico #64, votacao #66) |
| **Depende de** | votacao |
| **Toca em** | packages/domain/src/round-score/card-tier.ts, packages/domain/src/round-score/index.ts, packages/shared/src/voting.ts (só reexporta `cardTier`), CONTEXT.md, apps/web/src/features/pack, apps/web/src/features/voting (craque-card, result-alert, result-opened, voting-card, flop-card, my-score-card), apps/web/src/pages/voting/result-page.tsx, apps/web/src/pages/rounds/home.tsx (só o que monta os cards do início), apps/web/src/index.css, apps/web/src/components/ui/pixel-sprite-maps.ts |

## Produto

### Objetivo
O resultado da rodada chega como um **pacote fechado** com **três cartas**: o **Craque**, o **Perna de Pau** e **a
sua carta** (sua nota e sua posição na rodada), em **bronze, prata ou ouro** pela nota. Na primeira vez que a pessoa
abre o resultado, toca no pacote, ele treme, rasga, a luz vaza e a carta do Craque faz o **walkout**: revela pistas
em degraus (cor do time, posição, nota subindo) antes do rosto, com flash, estrelas e confete pixel. Depois cai o
Perna de Pau (cômico, virado e "rachado") e por fim a sua carta. Da carta revelada (do Craque e da sua) sai um
**Compartilhar** que manda a imagem para o grupo do WhatsApp. "Bem dopamina mesmo" (dono, 15/11).

### Quem usa
Qualquer membro ativo do grupo, tenha jogado ou não. Cada **jogador** abre o pacote **uma vez por rodada** (a chave
do "já abri" é rodada + `membershipId`, como `result-seen.ts`); depois o resultado abre direto, com "Abrir o pacote
de novo". Quem não jogou vê o pacote com duas cartas (sem a sua).

### Regras de domínio
- **Faixa da carta pela nota (nova, reforço 15/11):** `cardTier(rating, cuts?)` em `packages/domain`, função pura.
  **bronze** abaixo de 6, **prata** de 6 a 7,9, **ouro** de 8 para cima. Cortes como config com default
  (`{ silver: 6, gold: 8 }`). Vale para as três cartas (todas mostram a nota). Nota `null` não tem faixa (não chega
  ao pacote: Craque e Perna de Pau sempre têm nota; a sua carta só existe se você jogou e tem nota). Entrada no
  `CONTEXT.md`.
- Quem é o Craque e o Perna de Pau vem pronto de `GET .../voting/result` (`mvps`, `flops`); a sua carta sai de
  `players` pelo `me.membershipId` (`score`, `rank`, `position`, `team`, `avatar`).
- **Se o Craque é você**, a sua carta não repete: a carta do Craque vira a sua **carta especial** (selo "VOCÊ", o
  grande momento dobrado: o dobro de estrelas e confete, flash duplo). O pacote então tem Craque (especial) e Perna
  de Pau. Se o Perna de Pau é você, a carta dele ganha o "VOCÊ" e a terceira carta não repete.

Regras do momento ([DESIGN.md › Movimento](../design/DESIGN.md#movimento), folha, Grandes momentos):
- **até ~2 s por carta** (sai a regra de 2 s no total); um toque adianta para a próxima carta; "Pular" sempre
  visível leva ao fim (as cartas finais);
- a pixel art anda em degraus (`steps()`), sem suavizar; só `transform` e `opacity`;
- com "reduzir movimento": fade direto para as cartas finais, sem tremer, rasgar, walkout, vibração nem brilho;
- `navigator.vibrate` curto na revelação do Craque, quando existir (nunca com reduzir movimento);
- som desligado (esta fatia não tem som).

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | resultado saiu e ainda não abri nesta rodada | olhar o card "O RESULTADO SAIU" do início | a tecla amarela diz **"Abrir pacote"**, e o card mostra o pacote pixel fechado em miniatura, **tremendo de leve** em degraus (parado com reduzir movimento) | Playwright |
| C2 | primeira vez em `/rodadas/:roundId/resultado` (há Craque) | abrir | **Fechado**: o pacote pixel no centro, em ouro, com "CRAQUE", "RODADA 12" e "TOQUE PARA ABRIR". Fica parado até o toque. "Pular" visível (≥ 44 px) | Playwright |
| C3 | pacote fechado | toca no pacote (ou Enter/Espaço) | **suspense**: o pacote treme em degraus | Playwright |
| C4 | depois do suspense | — | **Rasgo**: a fenda abre no topo e a luz vaza em faixas pixel | Playwright |
| C5 | depois do rasgo | — | **Walkout do Craque**, pistas em degraus na carta virada/apagada: (1) a **cor do time** (Branco/Preto) acende na carta, (2) a **posição** ("MEIA") aparece, (3) a **nota sobe em degraus** até o valor; só então (4) o **bonequinho grande** (`pixel-body-large`) aparece com **flash**, estrelas e **confete pixel**, e a moldura toma a cor da faixa (ouro/prata/bronze). `navigator.vibrate` curto nesse instante, se existir | Playwright (cada pista visível) + unitário (degraus da nota) |
| C6 | Craque revelado | olhar | a carta: bonequinho, apelido inteiro, "CRAQUE · RODADA 12", posição, nota em dígitos pixel, moldura da faixa. É o `craque-card.tsx` (sem duplicar) | Playwright |
| C7 | Craque revelado | toque (ou ~2 s) | **Perna de Pau**: a carta cai **virada**, "rachada" (fenda pixel), com "HOJE NÃO DEU", bonequinho dele, apelido, nota e faixa (normalmente bronze). Tom cômico, sem confete | Playwright |
| C8 | Perna de Pau revelado e eu joguei | toque (ou ~2 s) | **A sua carta**: seu bonequinho, apelido, posição, "#N NA RODADA" (o `rank`), nota e a moldura da faixa: **bronze** (< 6), **prata** (6 a 7,9), **ouro** (≥ 8) | Playwright (três faixas) |
| C9 | eu não joguei | revelar | o pacote mostra só Craque e Perna de Pau; sem terceira carta | Playwright |
| C10 | o Craque sou eu | revelar | a carta do Craque é a **especial**: selo "VOCÊ", flash duplo, o dobro de estrelas e confete; sem terceira carta repetida | Playwright |
| C11 | em qualquer quadro | "Pular" | vai direto para as **cartas finais** (as 2 ou 3 lado a lado; empilhadas em telas estreitas) com Compartilhar e "Ver o resultado" | Playwright |
| C12 | cartas finais | "Ver o resultado" (ou rolar) | a página do resultado (carta do Craque, Perna de Pau, sua nota, tabela), com o foco no título | Playwright |
| C13 | já abri este pacote (esta rodada, este jogador) | abrir o resultado de novo | abre direto no resultado, sem animação; no topo, a tecla de contorno "Abrir o pacote de novo" repete o momento. **Outro jogador** no mesmo aparelho vê o pacote fechado | Playwright + unitário (chave com `membershipId`) |
| C14 | aparelho sem armazenamento (modo privado) | abrir duas vezes | toca as duas vezes e nada quebra | unitário + Playwright |
| C15 | "reduzir movimento" | abrir pela primeira vez | o pacote fechado aparece; ao tocar, as cartas finais entram com um fade, sem tremer, rasgar, walkout nem vibrar; o brilho holográfico fica parado | Playwright (`emulateMedia`) |
| C16 | dois Craques (empate) | revelar | as duas cartas do Craque fazem o walkout uma depois da outra e ficam lado a lado (empilhadas em 320 px); depois Perna de Pau e a sua carta | Playwright |
| C17 | rodada fechada sem votos | abrir o resultado | sem pacote: abre direto no resultado ("Ninguém votou nesta rodada") e o card do início diz "Ver resultado" | Playwright |
| C18 | resultado aberto (página) | olhar a carta do Craque | um **brilho holográfico** passa pela carta em degraus (só `transform`/`opacity`), em laço lento; parado com reduzir movimento | Playwright |
| C19 | celular com `navigator.share` e arquivo | "Compartilhar" na carta do Craque **ou na sua carta** | compartilhamento do sistema com **PNG** da carta (1080 × 1350, mesmo desenho pixel, faixa, "FUT STATS" no rodapé) e o texto: Craque "Craque da rodada 12: Ronaldinho, nota 9,1"; sua carta "Minha nota na rodada 12: 7,4 (prata)" | Playwright (função chamada com o arquivo) + unitário (textos) |
| C20 | sem compartilhar arquivo; sem `navigator.share` | "Compartilhar" | compartilha só o texto; sem `share`, abre `https://wa.me/?text=...` com o mesmo texto | Playwright |
| C21 | a pessoa cancela o compartilhamento | — | nada acontece (sem aviso de erro) | Playwright |
| C22 | leitor de tela | abrir e revelar | a animação é `aria-hidden`; o pacote é um botão "Abrir o pacote da rodada 12"; a cada carta revelada anuncia ("Craque da rodada 12: Ronaldinho, nota 9,1, ouro"; "Perna de pau: ..."; "Sua carta: nota 7,4, prata, 3º na rodada") e o foco vai para o título das cartas finais | Playwright (árvore de acessibilidade) |
| C23 | tempos | medir | cada carta ≤ ~2 s do toque até parar; toque adianta; nenhuma animação usa outra coisa que `transform` e `opacity` | Playwright |
| C24 | cards do início (votação aberta, "O resultado saiu", resultado anterior) | olhar | **uma cor de destaque por card** (ouro só no do resultado, que é recompensa; o amarelo fica só na tecla de ação; ouro e amarelo nunca disputando lado a lado), cara de grande momento: borda grossa, sombra dura, entrada animada, tipografia com hierarquia (título pixel grande, linha de apoio menor) | Playwright (prints antes/depois) |
| C25 | larguras 320, 375, 390, 430 px e desktop | cada quadro, as cartas finais (2 e 3, uma e duas Craque) e os cards do início | tudo cabe inteiro, sem rolagem horizontal nem sobreposição com "Pular" e as teclas; apelido de 10 letras inteiro; alvos ≥ 44 px. Checagem automática passa. Console sem erros no fluxo real | Playwright |
| D1 | `cardTier` | notas 5,9 / 6,0 / 7,9 / 8,0 (e 1, 10, cortes trocados por config) | bronze / prata / prata / ouro | unitário (domain) |

## Técnico

### Contrato
Sem mudança de API. Usa `GET /groups/:groupId/rounds/:roundId/voting/result` (`RoundResult`: `mvps`, `flops`,
`players`, `me`) e o `lastResult` da lista de rodadas, os dois de `votacao`. `packages/shared` só reexporta
`cardTier`/`CardTier` do domain (o web não importa o domain direto).

### Banco (`schema.prisma`)
Sem mudança.

### Domínio
- `packages/domain/src/round-score/card-tier.ts`: `type CardTier = 'bronze' | 'silver' | 'gold'`;
  `DEFAULT_CARD_TIER_CUTS = { silver: 6, gold: 8 }`; `cardTier(rating: number, cuts = DEFAULT_CARD_TIER_CUTS)`.
  Testes primeiro, bordas do D1. Exportado no `index.ts` da pasta e reexportado no `shared`.

### Tela
Regras de visual do documento de autonomia valem como critério. Referência: os quadros da folha
(`docs/design/folha/design-system-v1.3.html`, Momento/Pacote e Carta/Craque); mapas pixel do pacote saem do
`build.py` da folha. Código a copiar: `vs-board.tsx`/`vs-seen.ts` (fases, Pular, foco, reduzir movimento),
`result-card.tsx` (estrelas, confete), `craque-card.tsx` (sem duplicar), `pixel-body-large`, `score-fit`,
`field-errors`.

- **`features/pack/pack-opening.tsx`:** máquina de fases `closed → shake → tear → craque(walkout) → flop → mine →
  final`, um quadro por carta, ~2 s cada, toque adianta, "Pular" leva ao `final`. Walkout em sub-degraus `team →
  position → rating (sobe em degraus) → face (flash, estrelas, confete, vibrate)`. Pacote e fenda em SVG pixel
  (`crispEdges`); luz em faixas com `opacity` em degraus; giro/queda com `transform` em `steps()`.
- **Carta com faixa:** a carta (Craque, Perna de Pau, sua) recebe a faixa de `cardTier(score)`: moldura e fundo
  bronze/prata/ouro (tokens novos em `index.css`, família do `--color-gold`). O `craque-card.tsx` ganha a faixa,
  as pistas do walkout como props e o modo "especial" (VOCÊ); a carta do Perna de Pau e a sua carta são
  componentes irmãos no mesmo molde, sem duplicar a moldura (uma base comum).
- **"Já abri":** continua `features/voting/result-opened.ts` (já é por rodada + `membershipId`), mas passa a ser
  marcado **quando o pacote termina ou é pulado**, não ao carregar a página. Sem Craque (sem votos) marca ao
  carregar, como hoje.
- **`pages/voting/result-page.tsx`:** se há Craque e o pacote não foi aberto, mostra o `PackOpening` (lazy) no
  lugar do topo; no fim, segue a página normal. Na página, a carta do Craque tem o **brilho holográfico**
  (faixa diagonal que atravessa em degraus, `transform`/`opacity`, pausa com reduzir movimento) e as teclas
  "Compartilhar" (Craque) e, em "Minha nota", "Compartilhar minha carta".
- **Cards do início** (`result-alert.tsx`, `voting-card.tsx`, `ResultLine`): uma cor de destaque por card,
  borda grossa, sombra dura, entrada animada, hierarquia tipográfica; o do resultado com o pacote em miniatura
  tremendo de leve e "Abrir pacote". O resto do Feed é da fatia `feed`: não redesenhar a tela inicial.
- **Compartilhar** (`features/pack/share-card.ts`): `canvas` com fundo, moldura da faixa, bonequinho dos mapas
  pixel, textos em Silkscreen depois de `document.fonts.ready`, `imageSmoothingEnabled = false`, `toBlob` PNG.
  `navigator.share({ files, text })` se `canShare` aceitar; senão `share({ text })`; senão `wa.me`. Textos de
  função pura com teste. Serve à carta do Craque e à sua. Sem dependência nova.
- **Orçamento:** JS inicial está em 146,0 de 150 kB. Tudo do pacote (`PackOpening`, `share-card`, sprites novos)
  no pedaço da rota, com `lazy`; a miniatura do início é leve (SVG pequeno). `pnpm build` confere o orçamento.
- Cor: ouro é recompensa; o amarelo de ação só na tecla da vez. Cor nunca é o único sinal: as cartas dizem
  "CRAQUE", "PERNA DE PAU", "SUA CARTA" e a faixa por escrito ("OURO", "PRATA", "BRONZE").
- Palavras: "grande momento", nunca "festa".

**Álbum** (`docs/design/prints/pacote-do-craque/`, 390 px por quadro; 320, 375, 430 px e desktop nos principais):
fechado, tremendo, rasgo, walkout em cada pista (time, posição, nota, rosto), Craque revelado, Perna de Pau, sua
carta em bronze, prata e ouro, sua carta especial de Craque, cartas finais (2 e 3), dois Craques, reduzir
movimento, já aberto com "Abrir o pacote de novo", página com brilho holográfico, imagem gerada pelo Compartilhar
(Craque e sua), e os cards do início **antes e depois**.

### Decisões
- Fatia própria, só front; a função `cardTier` é a única peça de domínio (dev-back curto, só ela).
- O pacote espera o toque; o tempo conta a partir dele, **até ~2 s por carta** (reforço 15/11: sai o limite de
  2 s no total), toque adianta, "Pular" leva ao fim.
- **Três cartas, nesta ordem:** Craque, Perna de Pau, a sua (reforço 15/11). Quem não jogou: duas. Empate de
  Craque: as duas no mesmo pacote. Sem votos: sem pacote.
- **Faixa pela nota, cortes 6 e 8** (reforço 15/11), regra no domain com cortes configuráveis.
- **Craque sou eu:** carta especial com o grande momento dobrado, sem repetir a sua carta.
- **Uma vez por jogador, não por aparelho:** a chave inclui o `membershipId` (lição do YOU LOSE, #63). Reusa o
  `result-opened.ts` da votação (já com essa chave) em vez de um `pack-opened.ts` novo; marca no fim do pacote.
- **Vibração** curta na revelação do Craque (reforço 15/11), fora com reduzir movimento.
- Imagem em `canvas`, sem biblioteca de captura.
- Cards do início com uma cor de destaque por card (reforço 15/11); o resto do início fica para `feed`.

## Fora do escopo
- Som.
- Carta holográfica com giroscópio; álbum de figurinhas ("já tenho / não tenho").
- Compartilhar o resultado inteiro da rodada; Compartilhar a carta do Perna de Pau.
- Redesenho da tela inicial inteira (fatia `feed`).
- Mudança de API ou de `schema.prisma`.

## Perguntas respondidas pelo dono
- Grande momento do Craque? → Pacote com suspense e revelação da carta, aprovado (22 out 2026).
- P14 · Fatia própria para o pacote? → Sim (14 nov 2026). O visual segue a folha e o dono ajusta pelo álbum.
- Reforço 15 nov 2026 (dono testou a votação: "faltou animação e alguma festinha" no Craque; "bem dopamina mesmo!") → três cartas (Craque, Perna de Pau, a sua), faixa bronze/prata/ouro pela nota (cortes 6 e 8), walkout com pistas, ~2 s por carta, uma vez por jogador, brilho holográfico e Compartilhar na sua carta, cards do início com uma cor de destaque cada.

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
