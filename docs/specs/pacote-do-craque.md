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

## Volta de design 1 (15 nov 2026, dono testou o PR #69 no navegador)
Pedidos do dono e o que a equipe escolheu:

| Id | Pedido (palavras do dono) | Escolha | Por quê |
|---|---|---|---|
| V1 | "tem que falar os gols e as assistências. Uma frase de impacto também seria interessante." | A carta do Craque (página, quadro revelado e imagem do Compartilhar) mostra **gols** e **assistências** do Craque na partida (`goals`, `assists` do `RoundResult`; gol contra não conta) e uma **frase de impacto** de `impactPhrase(player, { won })`, função pura com teste em `features/pack/` (é texto de apresentação, não regra de negócio). Primeira regra que bater: 3+ gols "HAT-TRICK!"; gol e assistência "DONO DO JOGO"; 2 gols "DECIDIU A PARTIDA"; 2+ assistências "GARÇOM DA NOITE"; goleiro "PAREDÃO NO GOL"; 1 gol "BALANÇOU A REDE"; senão "JOGOU DEMAIS". Time vencedor soma "e ainda levou a vitória". Empate de Craques: uma frase para cada um. Perna de Pau: `flopPhrase` roda entre "HOJE NÃO DEU", "O PÉ TAVA TORTO", "NA PRÓXIMA VAI", escolhida de forma estável pela rodada + jogador (a mesma frase em todo aparelho) | Os dados já vêm do `GET .../voting/result`: **sem mudança de contrato nem de API**, sem dev-back. A frase escolhida pelos números segue o ponto de partida do dono, que ajusta pelo álbum |
| V2 | "o fundo do card também está muito preto, dá pra preencher, junto com estatísticas e lances" | O palco atrás da carta (quadro revelado e página) ganha **fundo com vida**: holofote de estádio sobre a carta, gradiente descendo para o verde do app e padrão pixel discreto (só CSS, sem imagem). Ao lado ou abaixo da carta (empilhado em telas estreitas), um **painel de números do Craque**: nota, gols, assistências e colocação. Na página, entram também os **lances dele** na partida (gols e assistências, na ordem), vindos da partida (`useMatch`, já existente, só leitura) | Preencher com informação, sem tirar o foco da carta. **Votos de Craque recebidos não entram**: a API não expõe e a votação é anônima por média |
| V3 | "a animação, quando o jogador que recebeu o Craque ou Perna de Pau [abre], tem que ser mais duradoura"; "o Craque pode ficar mais independente" | O Craque passa a ter **~3 s** (walkout com pistas mais espaçadas). Quando a carta é **sua** (Craque especial "VOCÊ" ou você é o Perna de Pau), o momento segura **~4 s** (mais festa no Craque, mais piada no Perna de Pau). As outras cartas seguem em ~2 s. Toque adianta, "Pular" sempre visível | Liberação do dono. Muda a regra de tempo do C23 (abaixo) |
| V4 | "o você ali ficou bom, mas ele camufla um pouco no branco do card" | Selo "VOCÊ" com **fundo escuro** (tinta), letras claras, **contorno grosso e sombra dura**, legível em bronze, prata, ouro e na especial | Contraste em qualquer faixa |
| V5 | 2+1 cartas no desktop | Fica como está | Decidido pelo dono |
| V6 | Chamada extra `GET voting/result` no início | Fica por ora. **Pendência:** o início deve saber do pacote por um **aviso empurrado** (push/SSE/webhook) em vez de perguntar à API; anotado na fatia `pwa-e-push` do roadmap | Decidido pelo dono |
| V7 | Card ouro empilhado sobre o laranja no início | O card **VOTAÇÃO ABERTA fica neutro** (sem laranja nem ouro; o amarelo só na tecla de ação, se houver), com borda grossa, sombra dura e entrada animada. O ouro fica só no card do pacote ("O RESULTADO SAIU") | Decidido pelo dono depois de ver o `inicio-depois-390.png`: uma recompensa só em ouro na tela |

**C23 revisado:** Craque ~3 s; carta sua (Craque "VOCÊ" ou Perna de Pau você) ~4 s; demais ≤ ~2 s; só `transform`/`opacity`.

Cenários desta volta (QA curto: estes, sobreposição e telas mexidas):

| Id | Dado | Então | Teste |
|---|---|---|---|
| V1a | Craque com 3 gols / gol + assistência / 2 gols / 2 assistências / goleiro / 1 gol / nada | a carta mostra gols e assistências e a frase da primeira regra que bate; time vencedor soma "e ainda levou a vitória" | unitário (`impactPhrase`, cada regra e a ordem) + Playwright (alguns casos) |
| V1b | Perna de Pau | uma das três frases, a mesma ao recarregar | unitário (`flopPhrase`, estável) + Playwright |
| V1c | Compartilhar do Craque | a imagem traz gols, assistências e a frase | Playwright (PNG) |
| V2 | quadro revelado e página do resultado | palco com holofote, gradiente e padrão; painel de números; na página, os lances do Craque; a carta continua o foco; sem sobreposição em 320–430 e desktop | Playwright (antes/depois) |
| V3 | Craque comum / Craque "VOCÊ" / Perna de Pau você | ~3 s / ~4 s / ~4 s; demais ~2 s; toque adianta; Pular visível | Playwright (medido) |
| V4 | selo "VOCÊ" em bronze, prata, ouro e especial | legível, contraste alto | Playwright (prints) |
| V7 | início com a votação aberta e o resultado saiu | votação neutra, ouro só no card do pacote, amarelo só na tecla | Playwright (antes/depois, 320 e 390) |

## QA
**2 voltas, VEREDITO: APROVADO** (15 nov 2026).

- **Volta 1, reprovada com 2 falhas, ambas no "Pular":**
  - C16/C25: com os dois Craques juntos, a 2ª carta e o "Pular" ficavam sob a barra de baixo.
  - Em tela baixa (375×667, 320×568), o "Pular" ficava escondido em todos os quadros.
- **Volta 2, aprovada:** dois Craques lado a lado a partir de 360 px, empilhados só em 320; "Pular" no topo do quadro; a página rola até o pacote. Também entraram:
  - o rótulo "CRAQUE / RODADA N" fica no pacote durante o rasgo;
  - o card do início sem votos diz "Notas fechadas. Veja como foi a rodada.";
  - o leitor de tela anuncia o Craque só quando o rosto aparece.

| Cenário | Resultado | Evidência |
|---|---|---|
| C1 card do início | OK | Tecla amarela "Abrir pacote", pacote em miniatura tremendo (parado com reduzir movimento) |
| C2 fechado | OK | "Pular" de 44 px nas 5 larguras |
| C3 tremendo / C4 rasgo | OK | `c3-suspense-tremendo`, `c4-rasgo` |
| C5 walkout | OK | Time → posição → nota em degraus → rosto com flash, estrelas, confete; `vibrate(40)` |
| C6 Craque / C7 Perna de Pau | OK | `c6-craque-revelado`, `c7-perna-de-pau` (virada, rachada, "HOJE NÃO DEU") |
| C8 sua carta | OK | Bronze 5,5 / prata 6,9 / ouro 8,5 |
| C9 não joguei | OK | Duas cartas |
| C10 Craque sou eu | OK | Selo "VOCÊ", flash e vibração duplos, o dobro de estrelas e confete, sem 3ª carta |
| C11 Pular | OK | De qualquer quadro leva às cartas finais |
| C12 página | OK | Foco no título "Craque da rodada" |
| C13 já abri / outro jogador | OK | Chave rodada + membershipId; "Abrir o pacote de novo"; outro jogador vê o pacote fechado |
| C14 sem armazenamento | OK | Abre duas vezes sem erro |
| C15 reduzir movimento | OK | Fade direto para as cartas finais, sem vibração nem brilho |
| C16 dois Craques | OK | Dois walkouts, lado a lado a partir de 360 px, empilhados em 320, acima da barra |
| C17 sem votos | OK | Sem pacote; card do início com "Ver resultado" |
| C18 brilho holográfico | OK | `steps(14)`, laço de 3,6 s |
| C19 Compartilhar com arquivo | OK | PNG 1080×1350; textos do Craque e da sua carta |
| C20 só texto / wa.me | OK | Sem arquivo manda o texto; sem `share`, abre `wa.me` |
| C21 cancelar | OK | Sem aviso |
| C22 leitor de tela | OK | Botão do pacote, anúncio por carta, foco no título das cartas finais |
| C23 tempos | OK | 2 a 2,5 s por carta (Craque 2,5 s: para de se mexer em ~1,75 s); só `transform`/`opacity` |
| C24 cards do início | OK | Uma cor de destaque por card; prints antes e depois |
| C25 larguras | OK | 320×568, 360, 375×667, 390×844, 430×932 e 1280: sem rolagem horizontal, sem sobreposição, alvos ≥ 44 px |
| D1 `cardTier` | OK | `packages/domain/src/round-score/card-tier.test.ts` |

Pronto na raiz: lint, typecheck e test verdes (domain 417, shared 2, api 427, web 424), build verde. JS inicial com 146,1 de 150 kB; o pacote fica num pedaço lazy (`pack-opening` 12,3 kB, `share-card` 2,9 kB).
