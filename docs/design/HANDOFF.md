# Handoff: design system → próxima sessão

Para uma sessão nova, com pouco contexto, que vai **explorar inspirações e aperfeiçoar o design system com o
plugin taste-skill** antes de começar o front. Leia este arquivo inteiro antes de mexer no Paper.

Leitura obrigatória antes de começar: [README.md](README.md) (regras do DS) e
[ideias-de-inspiracao.md](ideias-de-inspiracao.md) (ideias de "festa" estilo jogo 2D).

## Onde estamos (22 out 2026)

- **Paper**, arquivo "Fut Stats": https://app.paper.design/file/01M583500PVH8Y9M2R4HG9FFWS
  - **Atual:** a folha **"Design System v0.4 — Noite de jogo"**, que é a de baixo.
  - **Histórico:** as folhas v0.1 ("Design System — Mobile") e v0.2. Elas usam os mesmos tokens, então as cores
    mudaram junto.
  - **Tokens:** os 62 tokens do arquivo, lidos com `get_tokens`, são a fonte da verdade.
    O Paper não tem token de sombra; as sombras estão escritas nos estilos da folha.
- **Repo:** PR #12 mergeado. `docs/design/` tem o README, o PNG da v0.4 e a nota de ideias.
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
- **Fontes:** Barlow Condensed 700/800 em caixa alta para placar e títulos; Inter para o resto, inclusive nomes.
- **Papel fixo das cores:**
  - amarelo `#FACC15`: **só ação**, e é a única cor com brilho
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
- **Dois modos (está na nota de ideias):**
  - **dia a dia:** sóbrio, é o DS atual
  - **festa:** momentos de jogo 2D (VS dos times, pacotinho do Craque, game over)

## Histórico das críticas (`/impeccable critique`)

| Versão | Nota | Principais achados |
|---|---|---|
| v0.2 | 16/32 | Amarelo com papel duplo, nota imprecisa e sem volta, contornos invisíveis, faltavam estados, navegação só com ícone |
| v0.3 | 24/32 | Campo só por arrasto, faltava o voto, cores quentes confusas, ícone da Bola Murcha ilegível |
| v0.4 | não medida | Todos os itens P1/P2 da v0.3 foram corrigidos via `/impeccable polish` |

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

## Próxima missão: inspirações com o taste-skill

Objetivo: **aperfeiçoar o DS antes do front**, sem reabrir as decisões aprovadas.

1. **Abrir a skill** `taste-skill:design-taste-frontend`. Ela tem um caminho próprio para telas de app,
   com regras e exemplos de dashboards e telas de uso. É o modo certo aqui; o Fut Stats não é landing page.
2. **Levantar inspirações** na biblioteca dela e em referências de apps esportivos e de jogos. A nota
   de ideias já lista: Mario, Street Fighter, Super Campeões, Panini, FIFA Ultimate Team.
   - Apresentar de 2 a 4 direções de refinamento com prévias.
   - Cada uma deve dizer **o que muda e o que preserva**.
3. **Candidatos a refinar**, para o dono escolher:
   - **Movimento:** quadros-chave de 1 ou 2 momentos de "festa" (VS dos times, pacotinho do Craque).
   - **Navegação:** rever as 5 abas.
   - **Tipografia:** passo de 24px e papel "número" para o ranking.
   - **Foto:** figurinha com foto de verdade, em vez de iniciais (regras de recorte e moldura).
   - **Modo claro** para uso no sol, só se o dono quiser.
4. **Depois de aprovado:**
   - aplicar no Paper com o fluxo acima
   - rodar `/impeccable critique` para comparar com 24/32
   - atualizar o `README.md` e este handoff
   - abrir PR para `develop`

## Pendências fora do design (não fazer nesta missão)

- **`.impeccable/` no `.gitignore`:** é ferramental de IA, então vai pela branch `feature/plugin-harness`.
- **MCP do Playwright em `.mcp.json`:** roadmap; necessário antes da primeira tarefa de tela.
- **Tokens → tema do Tailwind no `apps/web`:** começa quando o front começar.
