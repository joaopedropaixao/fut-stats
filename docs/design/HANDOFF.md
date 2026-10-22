# Handoff: design system → próxima sessão

Para uma sessão nova, com pouco contexto, que vai **explorar inspirações e aperfeiçoar o design system com o
plugin taste-skill** antes de começar o front. Leia este arquivo inteiro antes de mexer no Paper.

Leitura obrigatória antes de começar: [README.md](README.md) (regras do DS) e
[ideias-de-inspiracao.md](ideias-de-inspiracao.md) (ideias de "festa" estilo jogo 2D).

## Onde estamos (22 out 2026)

- **Paper**, arquivo "Fut Stats": https://app.paper.design/file/01M583500PVH8Y9M2R4HG9FFWS
  - **Atual:** a folha **"Design System v0.5 — Noite de jogo"**, à direita da v0.4.
  - **Histórico:** as folhas v0.1 ("Design System — Mobile"), v0.2 e v0.4. Elas usam os mesmos tokens, então as
    cores mudaram junto; o formato (cantos e sombras) continua o antigo.
  - **Tokens:** os 68 tokens do arquivo, lidos com `get_tokens`, são a fonte da verdade.
    O Paper não tem token de sombra; as sombras estão escritas nos estilos da folha.
    - Cantos e sombras também são valores escritos em cada peça, sem token: mudar o formato exige
      `find_nodes` + `update_styles` em lote (foi assim que a v0.5 saiu da v0.4).
- **Repo:** `docs/design/` tem o README, os PNGs da v0.4 e da v0.5 e a nota de ideias.
- **Roadmap (Fase 0.5):**
  - Paper conectado: feito.
  - Mini design system: feito.
  - Rename Craque / Perna de Pau: feito.
  - Abertos: wireframes, alta fidelidade, MCP do Playwright no repo e tokens → Tailwind.

## Decisões aprovadas pelo dono (não reabrir sem perguntar)

- **Tema escuro "Noite de jogo":**
  - gramado à noite (`#0A0F0C`)
  - holofote radial no topo
  - linhas de campo em giz
- **Fontes por papel (v0.5):** Barlow Condensed = o jogo (placar, times, títulos); Silkscreen = o jogador
  (nome, nota, posição, VS, Craque, logo; só caixa alta, mínimo 13px); Inter = o app.
- **Cor (v0.5):** paleta "Fliperama creme": texto creme `#F3EAD3`; fundo escuro padrão com holofote;
  fundo verde "Gramado" como opção nas configurações.
- **Forma (v0.5):** canto reto, contorno duro de 2px, botão em tecla (borda preta e sombra sólida), sem brilho.
  Só avatar, ponto e bolinha do slider são redondos.
- **Papel fixo das cores:**
  - amarelo `#FACC15`: **só ação**, sem brilho. **Exceção aprovada:** a palavra VS (`--color-game`)
  - ouro `#E8A93A`: mérito
  - madeira `#B08D6A`: Perna de Pau
  - verde e vermelho: vitória e derrota
  - laranja: só o ícone de prazo
- **Duas assinaturas, e só elas:** o placar com corte diagonal Branco/Preto e o campo 1-2-3-1.
- **Figurinha** para jogador; só a do Craque é holográfica e inclinada.
- **Prêmios:** "Craque" (estrela, ouro) e "Perna de Pau" (ícone de pernas de pau, madeira). Nunca "Bola Murcha".
- **"Dar nota":** slider + stepper −/+ 0,5, depois revisão, depois voto Craque / Perna de Pau, depois "Votos enviados".
- **Campo:** tocar no jogador e depois na vaga, com arrastar como atalho; seletor Branco/Preto, banco e desfazer.
- **Pisos de qualidade:**
  - alvo de toque ≥ 44px
  - texto de produto ≥ 13px
  - contornos clicáveis com `--color-border-strong`
  - respeitar "reduzir movimento"
- **Um DS só, sem "dois modos"** (decidido em 22 out 2026; detalhes na nota de ideias):
  - a nostalgia de jogo 2D vira regra do DS consolidado, sobre a base da v0.4
  - **aprovados:**
    - tela de **VS** estilo Street Fighter/Mortal Kombat, que é o diferencial
    - abertura do **pacote do Craque** estilo FIFA, com suspense e revelação da carta
  - **consolidado na v0.5:** estética pixel estilo International Superstar Soccer (fonte do jogador,
    bonequinhos, estrela; pixel inteiro só no VS e no pacote)
  - **referência de DS (não de intenção):** [Ship or Die](https://www.ship-or-die.com/)

## Histórico das críticas (`/impeccable critique`)

| Versão | Nota | Principais achados |
|---|---|---|
| v0.2 | 16/32 | Amarelo com papel duplo, nota imprecisa e sem volta, contornos invisíveis, faltavam estados, navegação só com ícone |
| v0.3 | 24/32 | Campo só por arrasto, faltava o voto, cores quentes confusas, ícone da Bola Murcha ilegível |
| v0.4 | não medida | Todos os itens P1/P2 da v0.3 foram corrigidos via `/impeccable polish` |
| v0.5 | não medida | Formato fliperama, fontes por papel, creme, fundo "Gramado", VS e pacote |

Ficou de fora, como sugestão das críticas:
- não há momento de "revelação" na quinta às 22h
- revisar se 5 abas na navegação é o número certo
- não há passo de 24px na escala de tipo
- o slider precisa anunciar o valor para leitor de tela (detalhe de código)

## Sobre o dono

- Dev backend aprendendo front e design: **explique cada decisão de forma simples** e ofereça opções para ele
  escolher (de 2 a 4, com uma recomendada).
- Gosta de ver antes de decidir: prefira mostrar (PNG, print, prévia) a descrever.

## Como trabalhar sem gastar o Paper (plano grátis: 100 chamadas/semana)

O fluxo que funcionou:

1. **Montar a mudança como HTML local** (scratchpad), com os tokens como CSS vars no `:root`.
   Para partir da folha atual, puxe com `get_jsx` (1 chamada) só a seção que vai mexer.
2. **Revisar no navegador** com o MCP do Playwright, em viewport 390px, tirando print por seção.
   - O Playwright salva arquivos em `.playwright-mcp/` dentro do repo: mova para o scratchpad e apague a pasta.
3. **Rodar o detector:** `impeccable detect --json <arquivo.html>`.
   Falsos alarmes conhecidos (não "corrigir"):
   - brilho amarelo nos botões principais
   - contraste no fundo diagonal
   - barras "coladas na borda"
   - Inter
4. **Só então colar no Paper:** `write_html` com `mode: "replace"` no nó da seção, uma chamada por seção.
   Se não souber o id, use `find_nodes`. Para ajustes pequenos, `update_styles`, `set_text_content` e
   `set_tokens` aceitam vários nós de uma vez.
5. **Conferir:** `export` em PNG 2x (1 chamada) e revisar em fatias localmente. É mais barato que vários
   `get_screenshot`. A exportação limita a altura a 16.000px.

Armadilhas do Paper:
- **Não aceita:** `margin`, `calc()`, tags semânticas (`button`, `section`, `h1`... use `div`), `display: inline`.
- **Gradientes:** radial com tamanho em `%` estica quando a folha vira `fit-content`; use paradas em `px`.
- **Texto que não pode quebrar:** `white-space: nowrap`.
- **Ao terminar:** chamar `finish_working_on_nodes`.
- **Se der "Paper Desktop isn't running":** peça ao dono para abrir o app; não tente abrir sozinho.

## Como a v0.5 foi decidida (22 out 2026)

Com a `taste-skill` (caminho de telas de app), o dono viu prévias em HTML e escolheu, em três rodadas:
1. Direções A "Tempero", B "Cartucho" e C "16-bit": ficou a **C** (formato fliperama), com a **carta colorida
   do B** e o **placar em Barlow**.
2. Fontes: divisão por papel (Barlow / Silkscreen / Inter). A Pixelify foi descartada no teste de leitura.
3. Cores: entre quatro paletas, ficou a **"Fliperama creme"**, com holofote e fundo verde como opção.
   O VS em amarelo ganhou do ouro e virou exceção registrada.

## Próxima missão

1. **Crítica da v0.5:** rodar `/impeccable critique` sobre o PNG da v0.5 e comparar com 24/32.
2. **Quadros-chave** do VS e do pacote do Craque (começo, meio e fim) no Paper.
3. **Wireframes e alta fidelidade** das telas do MVP, usando a v0.5.
4. Candidatos que continuam em aberto: rever as 5 abas; passo de 24px na tipografia; figurinha com foto
   de verdade; modo claro (só se o dono quiser).

## Pendências fora do design (não fazer nesta missão)

- **`.impeccable/` no `.gitignore`:** é ferramental de IA, então vai pela branch `feature/plugin-harness`.
- **MCP do Playwright em `.mcp.json`:** roadmap; necessário antes da primeira tarefa de tela.
- **Tokens → tema do Tailwind no `apps/web`:** começa quando o front começar.
