# Handoff: design system → próxima sessão

Para uma sessão nova, com pouco contexto. Leia este arquivo inteiro antes de mexer no design ou no Paper.

Leitura obrigatória:
- [DESIGN.md](DESIGN.md): as regras do DS v1.3.
- [README.md](README.md): onde cada coisa vive.

## Onde estamos (23 out 2026)

- **DS v1.3 fechado e aprovado pelo dono.** Os arquivos estão em `docs/design/`:
  - `DESIGN.md`: as regras;
  - `tokens.css`: os valores;
  - `folha/design-system-v1.3.html`: a folha com todas as peças, gerada por `folha/build.py`.
  - Prévia publicada (artifact privado do dono): https://claude.ai/artifact/5ya7WX9AFE9Rt3xsXexoi3
- **Paper ainda na v0.5.** O limite semanal do MCP acabou em 22 out, então a v1.x foi feita em HTML. A regra do
  AGENTS.md ("nenhuma tela sem design aprovado no Paper") continua valendo: colar a v1.3 no Paper é a próxima
  missão.
- **Roadmap (Fase 0.5):**
  - feitos: Paper conectado, mini design system (agora v1.3) e rename Craque / Perna de Pau;
  - em aberto: wireframes, alta fidelidade, MCP do Playwright no repo e tokens → Tailwind.

## Decisões do dono (não reabrir sem perguntar)

- **Um DS só, sem "modos".** Os três **grandes momentos** (VS, pacote do Craque, revelação do resultado) vivem
  dentro dele. Nunca chamar de "festa".
- **Fundo verde "Gramado" é o padrão.** O escuro "Noite" é opção nas configurações.
- **Pixel em toda a interface**, menos texto corrido e campos (Inter):
  - Silkscreen só em 16, 24 ou 32px;
  - números em dígitos pixel próprios (6×9, traço de 2px);
  - em pixel não se abrevia.
  - A Barlow saiu da UI.
- **Formato fliperama:**
  - canto reto, contorno de 2px, tecla com sombra dura e texto creme;
  - exceção: a barra de abas redonda, em que só a aba ativa mostra o nome, numa pílula que cresce com animação. As 5 abas ficam.
- **Cor por papel:**
  - amarelo = ação (uma por tela); VS amarelo é exceção;
  - ouro = recompensa;
  - laranja = atenção;
  - verde = convite e vitória;
  - vermelho = perigo, ausência e derrota;
  - madeira = Perna de Pau.
  - Cor nunca é o único sinal, porque há um jogador daltônico no grupo.
- **Feed:** um aviso grande por vez, na ordem resultado > votação > presença; os outros aparecem em linha.
- **Presença:** "CONFIRMAR" (verde) e "AUSÊNCIA" (contorno vermelho), empilhados, com 64px.
- **Voto em 2 passos:** primeiro o Craque, depois o Perna de Pau. A seleção aparece por contorno, selo e a palavra
  "ESCOLHIDO". No passo 2, o Craque escolhido fica travado.
- **Campo 1-2-3-1:** os alas ficam abertos para os lados, como meias-alas. No código a posição é `WINGER` ("ala").
- **Ícone do Histórico:** continua o calendário.
- **O dia da pelada não é fixo.** Nenhum texto fixa dia da semana.

## Regras de produto novas (levar ao `CONTEXT.md` no PR do domínio)

1. **Nota para todos:** quem vota dá nota a todos que jogaram, menos a si mesmo, sem pular.
2. **Apelido com até 10 letras**, que aparece inteiro.
3. **Notas e votos editáveis até o fim do prazo da votação.**
   - O prazo ainda não foi definido; "22h" na folha é só exemplo.
   - O domínio hoje não controla prazo nem abertura e fechamento da votação.

## Histórico das críticas (`/impeccable critique`)

| Versão | Nota | Principais achados |
|---|---|---|
| v0.2 | 16/32 | Amarelo com papel duplo, nota imprecisa, contornos invisíveis |
| v0.3 | 24/32 | Campo só por arrasto, faltava o voto |
| v0.5 | 24/32 | Dígitos em Silkscreen ilegíveis; navegação reta; "Votos enviados" sem comemoração |
| v1.0 | 25/32 | Feed com dois amarelos; voto só por cor; texto de 12px; faltavam peças de admin |
| v1.2 | 26/32 | Elenco de exemplo contraditório; faltavam admin e configurações; abreviações em pixel; feed pesado |
| v1.3 | não medida | Todos os achados da v1.2 corrigidos; o dono dispensou nova crítica |

Os relatórios ficam em `.impeccable/critique/`, que é local e não vai para o git.

## Como a v1.x foi feita (e como continuar)

1. **Folha HTML gerada por Python** (`folha/build.py`):
   - helpers como `t()`, `px()`, `pix()`, `pn()`, `key()`, `ghost()`, `section()` e `gaveta()`;
   - estilo inline e tokens em `:root`;
   - só `div`, `span` e `svg`, sem `margin` e sem `calc()`. É o formato que o Paper aceita.
   - Python 3.9: não use barra invertida dentro de expressão de f-string.
2. **Revisão:**
   - servir a pasta com `python3 -m http.server`;
   - Playwright em viewport de 405px, com prints por `[layer-name="..."]`;
   - `impeccable detect --json`.
   - Falsos alarmes conhecidos:
     - corte diagonal do placar;
     - VS amarelo sobre branco (tem contorno preto);
     - barras coladas na borda;
     - molduras da folha ("nested cards");
     - holofote.
3. **Prévia para o dono:** publicar o HTML como artifact e iterar pelo link.
4. **Pixel nítido:**
   - Silkscreen só em múltiplos de 8;
   - dígitos com `pn(texto, escala)` em escala inteira (altura 9 × escala).
   - A seção "Pixel legível" da folha mostra o porquê.

## Próxima missão

1. **Colar a v1.3 no Paper.**
   - **Antes:** só começar com o ok do dono, testando primeiro com `get_basic_info`. O plano grátis dá 100
     chamadas por semana.
   - **Montar a folha:**
     - criar o artboard "Design System v1.3" ao lado da v0.5;
     - atualizar os tokens com `set_tokens` / `create_tokens` a partir de `tokens.css`;
     - colar seção por seção com `write_html`, cada `[layer-name]` de primeiro nível da folha (cerca de 20
       chamadas).
   - **Conferir:**
     - os dígitos e a pixel art são SVG inline, então devem entrar direto;
     - a fonte Silkscreen precisa existir no Paper (`get_font_family_info`);
     - a exportação do Paper limita a altura a 16.000px, e a folha passa disso: exportar em duas partes.
   - **Fechar:** `finish_working_on_nodes`.
2. **Wireframes e alta fidelidade** das telas do MVP, usando a v1.3.
3. **Tokens → tema do Tailwind** no `apps/web`, com Silkscreen, o componente de dígitos pixel e o tema Noite.
   Começa quando o front começar.

## Sobre o dono

- Dev backend aprendendo front e design: **explique cada decisão de forma simples** e ofereça de 2 a 4 opções,
  com uma recomendada.
- Gosta de ver antes de decidir: mostre prévia (artifact) em vez de descrever.

## Pendências fora do design (não fazer nesta missão)

- `.impeccable/` e `.taste-skill/` no `.gitignore`: ferramental de IA, vai pela branch `feature/plugin-harness`.
- MCP do Playwright em `.mcp.json`: roadmap, necessário antes da primeira tarefa de tela.
