# Design system v1.3: regras para construir as telas

Este é o documento que o front segue. As peças aparecem desenhadas na folha
[`folha/design-system-v1.3.html`](folha/design-system-v1.3.html), gerada por `python3 folha/build.py`, e os
valores estão em [`tokens.css`](tokens.css). Na dúvida, vale a folha.

## Ideia

Um app de pelada com cara de jogo de fliperama. O fundo é um gramado à noite com holofote no topo, e Branco x
Preto é a identidade. A nostalgia de jogo 2D aparece em três camadas:
- **formato:** canto reto, contorno duro e botão em tecla;
- **letra:** pixel em toda a interface;
- **grandes momentos:** VS, pacote do Craque e revelação do resultado, com pixel art inteira.

É um DS só, sem "modos".

## Cor

| Papel | Token | Uso |
|---|---|---|
| Fundo padrão "Gramado" | `--color-bg` e superfícies | Verde. O tema **"Noite"** (escuro) é opção nas configurações e troca só os tokens de fundo. |
| Texto | `--color-text` (creme) | Branco puro só no time Branco. |
| Ação | `--color-accent` (amarelo) | Só tecla de ação, **uma por tela**, sem brilho. Exceção aprovada: a palavra **VS** (`--color-game`). |
| Recompensa | `--color-gold` | Craque, líder do ranking, aviso de resultado. |
| Atenção | `--color-warning` | Prazo e aviso de votação. |
| Convite / vitória | `--color-success` | Presença confirmada, aviso de presença, vitória. |
| Perigo / derrota | `--color-danger` | Ausência, remover, derrota. |
| Zoeira | `--color-flop` (madeira) | Perna de Pau. |

**Cor nunca é o único sinal**, porque há pelo menos um jogador daltônico no grupo. Em protanopia e deuteranopia,
ouro e laranja, verde e vermelho, e amarelo e ouro se confundem. Por isso toda cor vem com ícone, forma ou texto:
- ✓ e ×;
- ▲ e ▼;
- selo "ESCOLHIDO";
- interruptor com LIGADO e DESLIGADO;
- aviso com ícone e título que dizem o tipo.

A seção "Daltonismo" da folha tem a simulação.

## Letra

| Fonte | Onde |
|---|---|
| **Silkscreen** (pixel) | Toda a interface: títulos, botões, abas, selos, rótulos curtos, nomes de jogador, capa. Só caixa alta e **só em 16, 24 ou 32px** (a grade dela é de 8px; fora disso borra). |
| **Dígitos pixel próprios** (SVG, grade 6×9, traço de 2px) | Todo número: nota, posição, placar, contagens, datas. Altura = 9 × escala inteira. O 4 é aberto, o 0 tem risco, o 2 tem topo curvo (não é Z) e a vírgula tem rabicho. |
| **Inter** | Texto corrido (mais de uma linha), mensagens de erro, explicações e o texto digitado nos campos. Mínimo 13px, entrelinha ≥ 1,4. |

- **Em pixel não se abrevia:** "RODADA 12", não "R12"; posição por extenso (Goleiro, Zagueiro, Ala, Meia, Atacante).
  Data e hora são exceção ("SÁB, 24 OUT · 9H").
- **Apelido tem até 10 letras** e aparece inteiro em todo lugar, sem corte.
- **Iniciais do avatar:** as 2 primeiras letras do apelido.
- Rótulo de botão se escreve inteiro. Se não couber, o botão ocupa a linha toda.

## Forma

- Canto reto (raio 0) em tudo. Redondos: avatar, ponto, bolinha do slider e o selo "G" de goleiro.
- **Exceção "controle redondo":** a barra de abas tem raio 20 e flutua. Só a aba ativa mostra o nome, numa pílula
  de raio 14 com um quadradinho creme em cima; as outras são só ícone, com nome para leitor de tela. Ao trocar de
  aba, a pílula cresce até caber o nome (250 ms, ease-out).
- Card e lista: contorno de 2px (`--shadow-card`), sem sombra.
- O que flutua (aviso, barra de abas, gaveta, menu): contorno + sombra sólida `4px 4px 0` preta (`--shadow-float`).
- Botão principal é **tecla**: amarelo chapado, borda preta de 3px e sombra dura. Pressionado, desce 4px e perde a
  sombra.

## Componentes (na folha)

| Grupo | Peças |
|---|---|
| Base | Cores, fundo Gramado/Noite com holofote, tipografia, pixel legível, forma e profundidade |
| Ações | Tecla (normal, pressionada, foco, carregando), contorno, desabilitado, perigo, ícone 44×44 |
| Identidade | Selos (times, Craque, Perna de Pau, posição, prazo), avatares com anel do time e goleiro |
| Entrada | Presença (CONFIRMAR / AUSÊNCIA, 64px), campos de texto com foco e erro |
| Partida | Placar com corte diagonal (assinatura 1), campo 1-2-3-1 com banco, seleção e desfazer (assinatura 2), figurinhas |
| Notas e votos | Nota (stepper + slider, sem pular jogador), revisão, voto em 2 passos (Craque, depois Perna de Pau), Fim de jogo, "Seus votos" editável até o prazo e encerrado |
| Estados | Aviso com desfazer, esqueleto, vazio, erro com "Tentar de novo", gavetas de confirmação, "A votação fechou" |
| Feed | Um aviso grande por vez (resultado > votação > presença); os outros em linha. Ranking com média da temporada |
| Grandes momentos | VS (entrada, choque, quadro final) e pacote do Craque (suspense, rasgo, revelação), com tempos |
| Navegação | Barra de abas redonda, 5 abas, pílula ativa |
| Configurações e admin | Interruptor (Fundo Noite), data e hora da rodada, linha de elenco com menu, encerrar votação, remover jogador |

## Movimento

- Microinterações de 150 a 250 ms, ease-out.
- **Grandes momentos:** até 2 s no total, sempre com "Pular". A pixel art anda em degraus, sem suavizar. Som
  desligado por padrão.
- **Reduzir movimento:** os grandes momentos vão direto para o quadro final com um fade, e o resto troca sem animar.

## Pisos de qualidade

- Alvo de toque ≥ 44px.
- Texto ≥ 13px.
- Contraste AA em texto.
- Contornos clicáveis com `--color-border-strong`.
- Nenhum dia da semana fixo nos textos: o dia é o **dia da pelada**, escolhido pelo admin.

## Regras de produto que o design assume

Estas regras foram decididas pelo dono em 22 e 23 out 2026. Ainda precisam entrar no `CONTEXT.md` no PR do
domínio que as implementar:
1. **Nota para todos:** quem vota dá nota a todos que jogaram, menos a si mesmo, sem pular. Votar continua opcional
   como um todo.
2. **Apelido com até 10 letras.**
3. **Notas e votos podem ser alterados até o fim do prazo da votação.** O prazo em si ainda não está definido (a
   folha usa "22h" só como exemplo).
