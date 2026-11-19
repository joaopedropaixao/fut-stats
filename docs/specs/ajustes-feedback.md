# `ajustes-feedback`

> Pacote de ajustes do feedback dos admins e do dono (19 nov 2026). Vira a release de melhorias `v1.1`.

| | |
|---|---|
| **Fatia** | `ajustes-feedback` (#17 da Trilha) |
| **Modo** | Front |
| **Parte de** | — |
| **Status** | aprovado em 19 nov 2026 (itens 1 a 4); item 5 aprovado em 19 nov 2026; item 6 esperando o Portão 1 (novas opções) |
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
| C13 | `apps/web/index.html` | build | tem `<meta name="color-scheme" content="light dark">` e o CSS mantém `color-scheme: dark` no `html` (a meta é uma tentativa para o Samsung Internet; quem confirma é o jogador) | unitário (lê o `index.html`) |
| C14 | qualquer tela, modo escuro do sistema, Chrome desktop | olhar | as cores não mudam (fundo `#0d2717`, superfícies `#143521`) | Playwright (`colorScheme: 'dark'`) |

#### Itens 5 e 6 (pedidos do dono depois da primeira entrega; proposta para o Portão 1)

**Item 5, tela de servidor iniciando.** Research: a primeira chamada à API é o `GET /api/me` do `AppShell` (`useSession`).
Enquanto ela não volta, hoje aparece só um esqueleto; se der erro (depois das 2 retentativas do TanStack para rede e 5xx),
aparece "Não deu para abrir o app". O shell do PWA vem da Vercel na hora, então quem espera é o `/me`. Medido em 19 nov 2026:
com a produção dormindo, o `/api/me` pelo proxy da Vercel levou **32,6 s** e respondeu normal (401, sem 502/504). A tela
de entrar não espera o `/me` (renderiza na hora), e o convite tem a própria espera.

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C15 | o `/me` responde em menos de 3 s | abre o app | o app abre direto, sem a tela de servidor (nada pisca) | Playwright |
| C16 | o `/me` ainda não respondeu aos 3 s | espera | tela cheia "Servidor iniciando..." com a bola pixel quicando em degraus e "Já já a pelada abre.", sem a barra de abas (`role="status"`) | Playwright (`/api/me` atrasado) |
| C17 | ainda esperando aos 10 s | espera | entra o aviso "Pode levar até 1 min na primeira vez" (borda dourada, `aria-live`), o mesmo tom do aviso do Gerar times | Playwright |
| C18 | a tela de servidor está aberta | o `/me` responde | a tela some e o app abre onde a pessoa ia (ou vai para /entrar sem sessão) | Playwright |
| C19 | o `/me` falhou (depois das retentativas) ou passou de 90 s sem resposta | — | estado de erro "O servidor não respondeu" + "Tentar de novo"; tocar refaz o pedido e volta para "Servidor iniciando"; sem repetir sozinho em loop | Playwright + unitário dos limiares |
| C20 | Reduzir movimento ligado | tela de servidor | bola parada no chão; os textos e o aviso aparecem iguais | Playwright |
| C21 | /entrar, /convite/:código e /dev/entrar | abrir com a API lenta | nenhuma delas mostra a tela de servidor (seguem como hoje) | Playwright |
| C22 | build | `pnpm build` | o JS inicial continua dentro do orçamento (a tela vai no pedaço inicial: SVG pixel com a bola que já existe, sem imagem nova) | build |

**Item 6, carta do Craque com moldura própria.** Mesma regra do Perna de Pau: a carta do Craque tem moldura e fundo
próprios para qualquer nota, e a faixa (`cardTier`) vira o selo no canto de cima.

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C23 | Craque com nota 5,8 / 7,2 / 9,1 | abre o pacote | a mesma moldura do Craque nas três; só o selo muda (BRONZE / PRATA / OURO, na cor da faixa) | Playwright (três notas) + unitário |
| C24 | walkout do Craque | revelar | as pistas seguem iguais (time, posição, nota subindo); a carta fica apagada até o rosto e a moldura do Craque acende no flash, junto com o selo | Playwright |
| C25 | página do resultado | olhar o card do Craque | a mesma moldura e o mesmo selo | Playwright |
| C26 | o Craque sou eu | abrir o pacote | moldura do Craque + o contorno creme da carta especial + VOCÊ na tira; o selo desce e não encosta no VOCÊ; "Sua carta" não repete | Playwright |
| C27 | "Sua carta" (não sou o Craque) e a figurinha do ranking | olhar | sem mudança: seguem a faixa pela nota | Playwright |
| C28 | Compartilhar a carta do Craque | tocar | o PNG sai com a moldura do Craque e o selo da faixa (proposta, depende do dono) | unitário (canvas) |
| C29 | leitor de tela | revelar o Craque | o anúncio segue com a faixa por escrito ("..., nota 9,1, ouro"); a decoração fica em `aria-hidden` | Playwright |
| C30 | 320 a 430 px e desktop | pacote e resultado | sem rolagem horizontal, sem decoração sobre texto; o pacote continua lazy | Playwright + build |

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
- Item 5 (19 nov 2026): desenho (quadros 3, 3b e 3c) e limiares 3/10/90 s aprovados.
- Item 6 (19 nov 2026): nem A nem B ("fundo sem graça"; o creme "ficou igual ao do Perna de Pau"); o dono pediu 3 opções novas, com fundo vivo e de impacto. Quando o Craque sou eu: moldura do Craque + contorno creme da carta especial + VOCÊ na tira, com o selo um pouco abaixo (aprovado). O PNG do Compartilhar do Craque sai com a moldura nova (aprovado).

## QA
2 voltas. **VEREDITO: APROVADO** na volta 2 (HEAD db362a3).

Volta 1 reprovou com duas falhas na carta de madeira: F1, a rachadura de cima cruzava "BRANCO" na tira do time; F2, em
320 px a carta saía cortada no palco do pacote. Também apareceu um extra: o bloco "Gerar times" parado estourava o
botão em 320 px. Os três foram corrigidos (`EdgeCrack` recortado na madeira de cima, carta em `scale(0.85)` abaixo de
360 px, texto do bloco quebrando em duas linhas abaixo de 360 px) e há um teste novo (`flop-wood.test.tsx`).

| Id | Resultado | Evidência |
|---|---|---|
| F1 | ✅ | Branco (rodada 6) e Preto (rodada 8), palco e cartas finais, de 320 a 1280: a rachadura não toca o texto |
| F2 | ✅ | 320 px: a carta vai de 26 a 279 px, dentro do palco, com selo e pé torto |
| extra | ✅ | 320 px: "GERAR / TIMES" dentro do botão; de 360 px para cima, numa linha |
| C1 | ✅ | `aria-busy`, botão desabilitado, bloco batendo, moeda e reticências em degraus |
| C2 | ✅ | depois de 5 s, "Acordando o servidor, pode levar até 1 min" (`aria-live="polite"`) em 320, 390 e 1280 |
| C3 | ✅ | resposta em 1,2 s: sem a linha; os times entram |
| C4 | ✅ | Reduzir movimento: tudo parado, sem moeda; a linha aparece igual |
| C5 | ✅ | 500 forçado: o bloco volta, a linha some e o alerta "Não gerou" aparece |
| C6 | ✅ | nota 6,5: madeira e selo PRATA |
| C7 | ✅ | 5,5 BRONZE e 8,2 OURO; a moldura é sempre madeira |
| C8 | ✅ | card do resultado com madeira, pé torto e selo em 320, 390 e 1280 |
| C9 | ✅ | VOCÊ e o selo da faixa não se cruzam |
| C10 | ✅ | anúncio "Perna de pau: Tavinho, nota 5,5, bronze. Hoje não deu"; a decoração fica em `aria-hidden` |
| C11 | ✅ | Craque e "Sua carta" com a moldura da faixa, sem madeira |
| C12 | ✅ | JS inicial 119,8/150 kB, maior pedaço de rota 33,7/40, CSS 13,6/25, JS total 272/400 |
| C13 | ✅ | `color-scheme.test.ts`; a meta `light dark` está no DOM |
| C14 | ✅ | com o sistema em modo escuro: fundo #0d2717 e superfícies #143521, sem mudança |

**Volta 3 (code-review do PR #86): APROVADO** (db5dddf). O pé torto ganhou folga embaixo nas cartas finais (O2), a
região `aria-live` vazia não deixa mais 12 px fixos sob o botão, saiu o `@media (prefers-color-scheme: dark)` (que não
fazia nada), o `useSlowWait` ganhou teste com fake timers e "Gerando..." cabe em 320 px (16 px e `gap-2` abaixo de
360 px, que resolve o O1). A madeira também passou a não depender do `data-tier`. A, B, C, D, E, F e a regressão de
C1–C14 passaram. Fora da fatia, segue registrado: a contagem "BRANCO 0 DE 7 · 0 DE 7 PRETO" (`lineup-status.tsx`) rola
na horizontal em 320 px.

Observações da volta 2 (O1 e O2 resolvidas na volta 3):
- **O1:** em 320 px, o último ponto de "Gerando..." encosta na borda do botão.
- **O2:** de 360 px para cima, nas cartas finais, a ponta do pé torto fica sob o canto da carta seguinte (só
  decoração com decoração).
- **Fora da fatia:** o cabeçalho da escalação ("Preto 0 de 7") rola na horizontal em 320 px.

