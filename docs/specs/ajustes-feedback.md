# `ajustes-feedback`

> Pacote de ajustes do feedback dos admins e do dono (19 nov 2026). Vira a release de melhorias `v1.1`.

| | |
|---|---|
| **Fatia** | `ajustes-feedback` (#17 da Trilha) |
| **Modo** | Front |
| **Parte de** | — |
| **Status** | aprovado em 19 nov 2026 |
| **Base** | develop @23f7acd |
| **Depende de** | — |
| **Toca em** | apps/web/src/features/lineup/generate-block.tsx, apps/web/src/features/lineup/lineup-builder.tsx, apps/web/src/features/pack (pack-cards, share-card só se a carta do Perna de Pau mudar no canvas: não muda), apps/web/src/features/voting (player-card, flop-card), apps/web/src/index.css, apps/web/index.html, docs/lancamento.md, docs/03-roadmap.md |

## Produto

### Objetivo
Quatro ajustes que vieram do feedback:
1. O admin percebe na hora que o **Gerar times** está trabalhando, mesmo quando a API dormiu e a espera chega a ~1 min.
2. A carta do **Perna de Pau** ganha moldura própria (madeira rachada, "pé torto"), e a faixa da nota continua
   visível como selo.
3. Tentativa barata de corrigir as **cores no Samsung Internet com o celular em modo escuro**.
4. **Aviso dos e-mails aceitos no login**, só em documentação e no texto para o grupo.

### Quem usa
- Admin: o Gerar times (só admin vê a montagem de times).
- Todo jogador: o pacote do Craque e a página do resultado (Perna de Pau), o app no Samsung Internet.
- Dono: o texto pronto para o grupo sobre os e-mails.

### Regras de domínio
- Nada muda no domínio. O `balanceTeams` e a calibragem do seletor ficam como estão
  ([CONTEXT.md](../../CONTEXT.md)). A faixa da carta continua vindo de `cardTier(score)` (cortes 6 e 8); só a
  **moldura** do Perna de Pau deixa de seguir a faixa.

### Medição da demora do Gerar times (Research)
| O quê | Medido |
|---|---|
| `balanceTeams` sozinho (elenco do seed, 14 a 18 confirmados) | 6 ms (14), 20 ms (15–16), ~80 ms (17–18, `C(16,8)` = 12.870 divisões) |
| API de produção acordada (`GET /api/health`, ida e volta) | 0,2 a 0,3 s |
| API de produção dormindo (Render free, 15 min sem acesso) | **48 s** no primeiro acesso de 19 nov 2026 |

O vilão é o Render gratuito acordando, não o algoritmo. O dono decidiu: **só front** (loading com movimento e aviso de
servidor acordando), nada de mudar o algoritmo nem de cron externo. O ping de 14 em 14 min vira ideia no roadmap.

### Cenários
| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | admin na montagem de times | toca em **Gerar times** (ou **Regerar**) | o bloco entra no estado **Gerando**: o botão fica desabilitado com `aria-busy`, o texto vira "Gerando" com reticências que andam em degraus ("Gerando." → ".." → "...") e o bloco "?" bate em degraus com moedas saindo em loop enquanto espera (desenho aprovado no Paper) | Playwright (rota da sugestão atrasada) |
| C2 | Gerando há ≥ 5 s | espera | aparece uma linha embaixo do bloco: "Acordando o servidor, pode levar até 1 min" (`aria-live="polite"`) | Playwright (rota atrasada > 5 s) + unitário do temporizador |
| C3 | Gerando há < 5 s | a resposta chega | a linha do servidor não aparece; os times entram como hoje | Playwright |
| C4 | Reduzir movimento ligado | Gerando | sem bater e sem moedas; as reticências também ficam paradas ("Gerando...") e a linha de C2 aparece igual | Playwright (`reducedMotion: 'reduce'`) |
| C5 | a sugestão falha (erro da API) | Gerando termina | o bloco volta ao normal, a linha do servidor some e o erro aparece como hoje | Playwright |
| C6 | rodada com Perna de Pau de nota 6,5 | abre o pacote | a carta do Perna de Pau sai com a **moldura de madeira rachada** e o detalhe "pé torto" pixel no canto; a faixa aparece como **selo "PRATA"** na cor da prata, preso na madeira; a moldura não é prata | Playwright |
| C7 | Perna de Pau de nota 5 / 8,2 | abre o pacote | selo "BRONZE" / "OURO"; a moldura é sempre de madeira | Playwright (faixas) |
| C8 | página do resultado | olhar o card "Perna de pau" | o card usa a mesma moldura de madeira rachada, com o "pé torto" e o selo da faixa | Playwright |
| C9 | Perna de Pau é você | abre o pacote | moldura de madeira + selo da faixa + selo "VOCÊ" como hoje, sem sobreposição | Playwright |
| C10 | leitor de tela | revela o Perna de Pau | o anúncio continua com a faixa por escrito ("Perna de pau: ..., nota 6,5, prata"); a moldura é `aria-hidden` | Playwright (árvore) |
| C11 | qualquer carta do Craque ou a sua | abre o pacote | moldura da faixa (bronze/prata/ouro) igual a hoje: nada muda fora do Perna de Pau | Playwright |
| C12 | build | `pnpm build` | o JS inicial continua dentro do orçamento (`orcamento-de-bundle`); a moldura é CSS/SVG no chunk lazy do pacote e do resultado, sem imagem nova | build (check do orçamento) |
| C13 | `apps/web/index.html` | build | tem `<meta name="color-scheme" content="light dark">` e o CSS declara `color-scheme: dark` também dentro de `@media (prefers-color-scheme: dark)` | unitário (lê o `index.html`) |
| C14 | qualquer tela, modo escuro do sistema, Chrome desktop | olhar | as cores não mudam (fundo `#0d2717`, superfícies `#143521`) | Playwright (`colorScheme: 'dark'`) |

## Técnico

### Contrato
Sem mudança de API, de `packages/shared` e de `packages/domain`.

### Banco (`schema.prisma`)
Sem mudança.

### Domínio
Sem mudança.

### Tela
- **Gerar times:** `features/lineup/generate-block.tsx`. O estado `loading` ganha os quadros em degraus
  (`steps()`, keyframes novos no `index.css`, `motion-reduce` desliga), as reticências e a linha de servidor
  acordando (temporizador de 5 s no próprio bloco, limpo no fim e no desmontar). A linha fica embaixo do bloco, sem
  empurrar o layout de forma brusca (desenho no Paper).
- **Moldura do Perna de Pau:** `features/voting/player-card.tsx` (molde das cartas) ganha a variante de moldura
  "madeira" usada pelo `FlopPackCard` (`features/pack/pack-cards.tsx`); o `features/voting/flop-card.tsx` (página do
  resultado) usa a mesma moldura. Madeira em tokens da família `--color-flop`, rachaduras e "pé torto" em SVG pixel
  (`crispEdges`), selo da faixa com as cores de `TIER_LABELS`/tokens da faixa. O Compartilhar do Perna de Pau não
  existe, então o `share-card.ts` não muda.
- **Samsung Internet:** `apps/web/index.html` + `apps/web/src/index.css`.

### Decisões
- **Loading só no front** (dono, 19 nov 2026): a demora é o Render dormindo; algoritmo e infraestrutura ficam como estão.
- **Moldura de madeira nos dois lugares** (pacote e página do resultado), faixa como selo pequeno na cor da faixa e
  "pé torto" no canto (dono, 19 nov 2026). Atualizar o comentário do `FlopPackCard`, que hoje diz "a madeira fica no
  selo, não na moldura".
- **Samsung Internet: `content="light dark"` na meta**, a forma documentada pela Samsung ("Dark Mode in Samsung
  Internet", dez 2020: o comportamento "Prefer Media Query Over Force Dark" só funciona "when the web developer
  specifies the supported color schemes for the page via the color-scheme meta tag or CSS property"). O CSS segue
  forçando `color-scheme: dark` no `html`, então a página continua sempre escura; a meta só sinaliza ao navegador que
  ela tem tema escuro. Há relatos de desenvolvedores de que algumas versões (v24+) ignoram a meta e não existe um
  jeito garantido de desligar o escurecimento pelo site: **não prometemos a correção**. O PR pede que o jogador do
  Samsung A26 teste o preview da Vercel, e o `docs/lancamento.md` explica como desligar o modo escuro do navegador
  para o site.
- **Desenho aprovado no Paper** (arquivo Fut Stats, página `ajustes-feedback (v1.1)`): quadro "1 · Gerar times — carregando" e quadro "2 · Perna de Pau — moldura de madeira", **variação A** (madeira escura, rachaduras, pé torto pixel no canto de baixo, selo da faixa com prego no canto de cima) e o card da página do resultado com a mesma madeira. A variação B foi descartada.
- **Login:** nada de tela (dono, 19 nov 2026). Só o `docs/lancamento.md`, com o texto pronto para o grupo.

## Fora do escopo
- Mudar o `balanceTeams`, a calibragem ou a rota da sugestão.
- Ping/cron para a API não dormir: vira ideia no roadmap, com o custo (~720 das 750 h/mês gratuitas do Render, somadas
  por conta; o staging ficaria sem ping).
- Aviso de e-mails na tela de entrar ou do convite.
- Login por link no e-mail ou outro provedor: ideia no roadmap.
- Feed e presença ao vivo: a linha da tabela de ideias passa a dizer que entra junto do serviço de notificação.

## Perguntas respondidas pelo dono
- Gerar times: mexer no algoritmo, pingar a API ou só front? → **Só front** (loading com movimento + aviso de servidor
  acordando depois de ~5 s); ping como ideia no roadmap.
- Moldura do Perna de Pau: pacote e página do resultado, ou só pacote? → **Os dois**, faixa como selo, "pé torto" no
  canto, sem imagem nova no JS inicial.
- Aviso de e-mails na tela de entrar? → **Não**, só documentação e texto para o grupo.
- Portão 1 (19 nov 2026): spec e desenho aprovados, madeira **A**, sem ajustes.

## QA
<Preenchido no fim.>
