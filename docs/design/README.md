# Design

O design system atual é a **v1.4** (a v1.3 com a **Chakra Petch** no lugar da Inter no texto corrido):
- Regras para construir as telas: [DESIGN.md](DESIGN.md).
- Valores (base do tema do Tailwind): [tokens.css](tokens.css).
- Folha com todas as peças desenhadas: [folha/design-system-v1.3.html](folha/design-system-v1.3.html). Abra no
  navegador em largura de celular. Para mudar, edite `folha/build.py` e rode `python3 folha/build.py`.

## Onde a versão vive

- Até a v0.5, a fonte da verdade era o **Paper**, arquivo "Fut Stats":
  https://app.paper.design/file/01M583500PVH8Y9M2R4HG9FFWS
- A v1.x foi montada em HTML porque o limite semanal de chamadas do Paper (plano grátis) acabou.
  - A folha HTML gera código já no formato que o Paper aceita.
  - Quando o limite voltar, ela é colada no Paper como "Design System v1.3".
  - Enquanto isso, **a folha HTML vale**.
- As folhas v0.1 a v0.5 ficam no Paper só como histórico. Os PNGs `design-system-v0.4.png` e `design-system-v0.5.png` são dessa fase.

## Em uma linha

Gramado à noite com holofote, Branco x Preto como identidade e cara de fliperama:
- canto reto e botão em tecla;
- letra pixel em toda a interface;
- números em dígitos pixel próprios;
- três grandes momentos com pixel art: VS, pacote do Craque e revelação do resultado.

## Pendências

- [ ] Colar a v1.3 no Paper (com ok do dono; ver [HANDOFF.md](HANDOFF.md)).
- [ ] Wireframes e alta fidelidade das telas do MVP (roadmap, Fase 0.5).
- [x] `tokens.css` → tema do Tailwind no `apps/web`, com a fonte Silkscreen e o componente de dígitos pixel.
- [x] Levar ao `CONTEXT.md`, no PR do domínio, as três regras de produto da seção final do [DESIGN.md](DESIGN.md).

Próxima sessão de design: comece pelo [HANDOFF.md](HANDOFF.md). Ideias para os grandes momentos (animações estilo
jogo 2D): [ideias-de-inspiracao.md](ideias-de-inspiracao.md).
