# Ideias de inspiração: front com cara de jogo

Banco de ideias para o Fut Stats não parecer "mais um app de estatística".
Nada aqui está decidido: é um cardápio para escolher depois de validar a v0.2 com o grupo.

## A grande ideia: dois modos

| Modo | Quando | Visual |
|------|--------|--------|
| **Dia a dia** | Navegar, ler o feed, ver ranking, dar nota | O design system v0.2 (noite de jogo): limpo, legível, rápido |
| **Festa** | Momentos especiais: times publicados, craque revelado, subiu no ranking, fim da votação | Explosão de game 2D: pixel art, sons, animações exageradas |

Se tudo for festa, nada é festa. O app fica calmo e "vira videogame" só nos
momentos que merecem comemoração. Isso também resolve a legibilidade: fonte pixel
é linda num "VS", mas péssima num texto longo.

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
- Encerra com "QUINTA, 20H. QUEM GANHA?"

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
4. **Curto.** Micro-interações de 150 a 300 ms. Momentos de festa até uns 2 s, sempre com
   botão "pular".
5. **Acessibilidade.** Respeitar a configuração "reduzir movimento" do celular
   (`prefers-reduced-motion`): nesse caso a festa vira um fade simples.
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
| **Fontes pixel** (Press Start 2P, Pixelify Sans, Silkscreen) | Títulos de festa: "VS", "1-UP", "GAME OVER" | Só em textos curtos, nunca em texto corrido |

Pixel art (moedas, bloco "?", bonequinhos) pode vir de pacotes gratuitos (ex.: itch.io,
Kenney.nl). Atenção à licença: preferir CC0 ou desenhar o nosso próprio, sem usar
personagens da Nintendo (direitos autorais).

## Limitação do Paper

O Paper desenha telas **paradas**. Para os momentos de festa, o caminho é:
1. Desenhar no Paper os quadros-chave (começo, meio e fim da animação).
2. Prototipar o movimento de verdade no código (Motion) ou no Rive.

## Próximos passos sugeridos

- [ ] Validar a v0.2 com o grupo e perguntar também: "e se o app tivesse uma pegada de videogame nos momentos especiais?"
- [ ] Escolher 2 ou 3 momentos de festa para o MVP (sugestão: **VS dos times**, **pacotinho do craque**, **game over/tela vazia**)
- [ ] Definir o estilo visual da festa: pixel 8/16-bit, cartoon (Inazuma) ou mistura
- [ ] Desenhar os quadros-chave no Paper
