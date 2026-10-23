# Ideias de inspiração: front com cara de jogo

Banco de ideias para o Fut Stats não parecer "mais um app de estatística".
A seção abaixo traz o que o dono já decidiu. O resto do arquivo continua sendo cardápio.

## Decisões do dono (22 out 2026)

- **Não teremos dois modos.** O design se consolida **agora**, num DS só.
  - A nostalgia de jogo faz parte do DS.
  - Ela não fica isolada num modo especial.
  - O DS v0.4 ("Noite de jogo") é a base a refinar, não a substituir.
- **Por que pixel art:** trazer a nostalgia dos jogos e das animações que a gente jogava antigamente.
  Precisa virar regra de DS:
  - onde entra
  - em que tamanho
  - com qual fonte
  - o que nunca vira pixel
- **Referências aprovadas:**

| Referência | Status | Uso no Fut Stats |
|---|---|---|
| **Street Fighter / Mortal Kombat** | Aprovada, é o diferencial | Tela de **VS** dos times (Branco x Preto) |
| **FIFA Ultimate Team** | Aprovada | Abertura de pacote com suspense e revelação da **carta do Craque** |
| **International Superstar Soccer** | Curtiu; precisa consolidar | Estética pixel/16-bit: placar, bonequinhos e campo de cima |
| **[Ship or Die](https://www.ship-or-die.com/)** | Referência de **DS**, não de intenção | Ver abaixo |

### Ship or Die: o que pegar e o que não pegar

É uma landing page, com outra intenção. Não precisamos chegar no nível de animação dela, mas o DS dela
acerta a vibe pixel art, jogo e nostalgia. O que foi medido no site (22 out 2026):

- **Fundo:** azul-marinho quase preto (`#030914`) com ilustrações em pixel art grandes (navio, mar, raio).
  - As imagens usam `image-rendering: crisp-edges`, sem borrão.
- **Fontes:**
  - Anton, condensada e pesada, para os títulos gigantes
  - Geist Mono para o texto
  - Pirata One, temática, só no logo
- **Texto em creme** (`#F3E6C9`), em vez de branco puro, com acentos em ouro (`#F0C56C`) e vermelho (`#E2695E`).
- **Cantos retos** (raio 0) em quase tudo.
  - Botão principal "chunky", em relevo de jogo: borda dura de 2px, sombra sólida deslocada para baixo
    (`0 7px 0`) e brilho interno em cima.
  - Parece uma tecla física.
- **Molduras** de madeira/prancha em pixel art nos blocos de destaque.

O que conversa com o Fut Stats:
- a combinação de fonte condensada pesada + pixel art (já usamos Barlow Condensed)
- o botão de jogo com sombra sólida
- o creme quente no lugar do branco frio

O que **não** pegar:
- a fonte mono em todo o texto, porque legibilidade em produto vem antes
- o tema pirata
- as animações de rolagem de landing page

## Referências de jogos

| Jogo | O que pegar dele |
|------|------------------|
| **Super Mario (2D)** | Moeda girando, bloco "?" que você bate e revela algo, "1-UP" subindo da cabeça, tela de fase concluída, pulo com "squash & stretch" (achata e estica) |
| **Street Fighter / Mortal Kombat** | Tela de **VS** com os dois lados se chocando: perfeito para Branco x Preto |
| **Super Campeões (Captain Tsubasa)** | Linhas de velocidade, close dramático, "chute especial" com nome gritado na tela |
| **Inazuma Eleven / Mario Strikers** | Futebol exagerado e cartunesco, personagens com personalidade, efeitos de "super chute" |
| **International Superstar Soccer / Sensible Soccer** | Campo visto de cima em pixel art, placar estilo 16-bit, bonequinhos pequenos |
| **FIFA Ultimate Team** | Abertura de pacote: suspense, brilho, revelação da carta |
| **Álbum da Copa (Panini)** | Rasgar o pacotinho, figurinha brilhante, "já tenho / não tenho" |
| **Rocket League / Fall Guys** | Interface vibrante, comemoração de gol com explosão, menus divertidos |

## Momentos do app que viram "fase" de jogo

### 1. Times publicados: tela de VS (estilo Street Fighter)
- Tela dividida na diagonal (já é a nossa assinatura!): Branco de um lado, Preto do outro.
- Os 7 jogadores de cada time entram deslizando, um por um, como seleção de lutador.
- "VS" gigante no meio, com tremida de tela e som de impacto.
- Encerra com "HOJE, 20H. QUEM GANHA?" (o dia da pelada não é fixo).

### 2. Sorteio de times: bloco "?" (estilo Mario)
- O admin toca num bloco "?" pixelado; ele "pula" e solta os jogadores sorteados.
- Clicar de novo = regerar (o bloco dá outro pulinho).

### 3. Craque da rodada: abrir pacotinho (FIFA + Panini)
- Um pacotinho fechado aparece no feed: "O craque da rodada 12 saiu. Abrir?"
- Toque → o pacote rasga, a luz vaza e a figurinha holográfica gira até parar de frente.
- Momento mais compartilhável do app: o print disso vai para o grupo do WhatsApp.

### 4. Perna de Pau (antiga Bola Murcha): o tropeço
- Animação cômica: o bonequinho entra andando de perna de pau, balança e cai sentado.
- Tom de zoeira, nunca humilhação: rápido e engraçado. Cor madeira, sem brilho.

### 5. Resultado das notas: fase concluída
- Estilo "Course Clear" do Mario: sua nota aparece contando de 0 até o valor (7,5).
- Estrelas de 1 a 3 conforme a nota, caindo uma por uma.
- "Subiu 2 posições" com um "1-UP" flutuando.

### 6. Sequência de vitórias: modo estrela
- Ganhou 3 seguidas? O avatar ganha o efeito da estrela do Mario (brilho piscando em cores).
- Perdeu? O efeito some. Simples e viciante.

### 7. Cartola: cartoletas são moedas
- Moedas giratórias de pixel art no saldo.
- Valorizou um jogador? Moedas saltam com o som clássico de moeda.

### 8. Telas vazias e de erro
- Sem rodada marcada: bonequinho pixel sozinho no campo, chutando a bola na parede.
- Erro ou página não encontrada: "GAME OVER. CONTINUE? 10... 9..." com botão "Continuar".
- Carregando: bola pixelada quicando.

### 9. Prancheta do técnico (alternativa ao pixel para a tela de times)
- Campo verde visto de cima com os jogadores na formação 1-2-3-1.
- Arrastar jogador entre times com setas de giz, estilo quadro tático.

## Princípios de movimento

1. **Um grande momento por fluxo.** A animação tem que ter motivo (revelar, comemorar,
   confirmar). Animação em tudo cansa e deixa o app lento.
2. **Movimento responde ao toque.** Botão afunda ao pressionar, card estica ao arrastar.
   Isso dá sensação de "objeto físico", como num jogo.
3. **Squash & stretch.** Princípio clássico de animação: coisas que pulam achatam ao cair
   e esticam ao subir. É o que faz o Mario parecer vivo.
4. **Curto.** Micro-interações de 150 a 300 ms. Grandes momentos até uns 2 s, sempre com
   botão "pular".
5. **Acessibilidade.** Respeitar a configuração "reduzir movimento" do celular
   (`prefers-reduced-motion`): nesse caso o grande momento vira um fade simples.
6. **Som opcional e desligado por padrão.** Ninguém quer o celular apitando no trabalho.
   Vibração curta (Android) pode substituir.

## Ferramentas (para quando chegar no código)

| Ferramenta | Para que serve | Observação |
|------------|----------------|------------|
| **Motion (antigo Framer Motion)** | Animações de interface em React: entrar, sair, arrastar, molas | Padrão de mercado, primeira escolha |
| **Rive** | Animações interativas desenhadas num editor, com "máquina de estados" (ex.: bloco "?" que reage ao toque) | Ótimo para o pacotinho e o bloco "?" |
| **Lottie / dotLottie** | Tocar animações prontas (exportadas do After Effects ou baixadas no LottieFiles) | Bom para comemorações prontas |
| **canvas-confetti** | Confete na tela em 1 linha | Comemoração barata |
| **View Transitions API** | Transição suave entre telas, nativa do navegador | Sem biblioteca |
| **Fontes pixel** (Press Start 2P, Pixelify Sans, Silkscreen) | Interface toda (v1.3: Silkscreen); antes só "VS", "1-UP", "GAME OVER" | Nunca em texto corrido |

Pixel art (moedas, bloco "?", bonequinhos) pode vir de pacotes gratuitos (ex.: itch.io,
Kenney.nl). Atenção à licença: preferir CC0 ou desenhar o nosso próprio, sem usar
personagens da Nintendo (direitos autorais).

## Limitação do Paper

O Paper desenha telas **paradas**. Para os grandes momentos, o caminho é:
1. Desenhar no Paper os quadros-chave (começo, meio e fim da animação).
2. Prototipar o movimento de verdade no código (Motion) ou no Rive.

## Próximos passos

- [x] Escolher os momentos do MVP: **VS dos times** e **pacote do Craque** (aprovados pelo dono)
- [x] Consolidar a estética pixel (ISS) como regra do DS, sem criar um segundo modo (v0.5)
- [x] Definir o estilo do pixel: sprites de 8×12 e fonte Silkscreen para o jogador; a UI pega o formato
  de fliperama (canto reto, tecla), mas não vira pixel (v0.5, regras no [README](README.md))
- [x] Desenhar os quadros-chave do VS e do pacote (v1.3, na folha HTML; falta colar no Paper)
