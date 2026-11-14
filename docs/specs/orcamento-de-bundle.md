# `orcamento-de-bundle`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `orcamento-de-bundle` (onda 1) |
| **Modo** | Front |
| **Parte de** | — |
| **Status** | aprovado em 2026-11-14 |
| **Base** | develop @1021769 |
| **Depende de** | — |
| **Toca em** | apps/web/src/router.tsx, apps/web/src/pages/rounds/routes.tsx, apps/web/src/pages/times/routes.tsx, apps/web/src/pages/entrar-e-grupo/routes.tsx, apps/web/src/main.tsx, apps/web/scripts, apps/web/vite.config.ts, apps/web/bundle-budget.json |

## Produto

### Objetivo
O app abre rápido no celular e continua rápido quando a v1 crescer: cada tela vira um pedaço carregado só quando
alguém entra nela, e o build **falha** se o JavaScript passar do limite combinado. Hoje sai tudo num arquivo só
(573 kB, 170 kB comprimido, medido na volta 3 de `placar-e-lances`).

### Quem usa
Todo mundo, sem perceber: nenhuma tela muda de aparência. Quem sente é o dev: PR que estoura o limite não passa no CI.

### Regras de domínio
Nenhuma. Não é regra de negócio: são limites técnicos, registrados em `apps/web/bundle-budget.json`.

**Limites (comprimido com gzip):**

| O quê | Limite | Como se mede |
|---|---|---|
| JS inicial | 150 kB | o arquivo de entrada do `index.html` mais tudo que ele importa de forma estática |
| Cada pedaço de rota | 40 kB | cada arquivo `.js` carregado sob demanda |
| CSS | 25 kB | a soma dos `.css` |
| JS total | 400 kB | a soma de todos os `.js` do `dist` |

Se, depois de dividir as rotas, o JS inicial medido ficar abaixo de 120 kB, o limite gravado desce para
"medido + 10%" (arredondado para cima em 5 kB). Limite só sobe em PR que diga o porquê na descrição.

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | um conjunto de arquivos com tamanhos e um orçamento | `checkBudget(files, budget)` (função pura do script) | lista cada medida com valor, limite e se passou; estourou qualquer uma → `ok: false` | unitário |
| C2 | manifesto do build com entrada, imports estáticos e imports dinâmicos | `initialFiles(manifest)` | devolve a entrada e os imports estáticos (recursivo), sem os dinâmicos | unitário |
| C3 | build normal | `pnpm --filter @fut-stats/web build` | imprime a tabela (medida, tamanho, limite, ✓ ou ✕) e sai com 0; a checagem do `jsxDEV` continua valendo | checagem no build |
| C4 | orçamento com o JS inicial forçado para 1 kB | build | sai com 1 e diz qual medida estourou e por quanto | checagem no build |
| C5 | `GITHUB_STEP_SUMMARY` definido (CI) | build | a mesma tabela vai para o resumo do job, em Markdown | unitário (formatação) |
| C6 | app aberto em `/` (logado) | olhar a rede | só o JS inicial e o pedaço do início foram baixados; os pedaços de Times, Rodadas, Jogo, Perfil e Entrar ainda não | Playwright |
| C7 | app aberto e parado por 2 s | olhar a rede | os pedaços das 5 abas foram pré-carregados em segundo plano (`requestIdleCallback`, com `setTimeout` de reserva) | Playwright |
| C8 | internet lenta (rede limitada no Playwright), primeira visita a `/times` | toca na aba | a pílula da aba troca na hora; a tela anterior fica até o pedaço chegar e, se passar de 300 ms, entra o esqueleto (`SkeletonList`); nunca tela em branco | Playwright |
| C9 | abrir direto uma URL interna (`/rodadas/:id/jogo`) | carregar | esqueleto dentro da moldura do app e depois a tela; console sem erros | Playwright |
| C10 | pedaço que não existe mais (deploy novo com a aba aberta: simular com rota de rede que responde 404 no `.js`) | navegar | a página recarrega **uma vez** e abre a tela; se falhar de novo, mostra o erro com "Tentar de novo" (sem laço de recarga) | Playwright |
| C11 | build de produção | conferir o `dist` | `/dev/entrar` e `/dev/componentes` continuam fora do build | checagem no build |
| C12 | todas as telas que já existem | navegar por todas (entrar, começar, convite, início, rodadas, detalhe, formulário, times, montar, jogo, perfil) | funcionam como antes; console sem erros | Playwright |
| C13 | larguras 320, 375, 390, 430 px e desktop | esqueleto de carregamento de rota | sem rolagem horizontal nem sobreposição | Playwright |

## Técnico

### Contrato
Sem mudança de API.

### Banco (`schema.prisma`)
Sem mudança.

### Domínio
Sem mudança.

### Tela
- **Rotas com `lazy`** (`router.tsx` e os arquivos `routes.tsx` de cada pasta): toda página entra com
  `lazy: () => import(...)`, como as de `/dev` já fazem. Ficam no JS inicial só o `AppShell`, a sessão, a barra de
  abas e o que eles usam. Um pedaço por área: início, rodadas (lista, detalhe e formulário), times (aba e montar),
  jogo, perfil e entrar/começar/convite. As páginas exportam `Component` (ou o `lazy` devolve
  `{ Component }`).
- **Espera:** `hydrateFallbackElement` com o esqueleto na carga inicial. Na troca de tela, a anterior fica; um
  indicador global (estado `navigation` do router) mostra o esqueleto depois de 300 ms.
- **Pré-carga:** depois da primeira tela pronta, importar em segundo plano os pedaços das abas
  (`apps/web/src/app/preload.ts`). Não pré-carrega com `navigator.connection.saveData` ligado.
- **Pedaço sumiu:** ouvir `vite:preloadError`; recarregar uma vez (marca em `sessionStorage`, limpa quando a
  navegação dá certo).
- **Checagem** (`apps/web/scripts/`): `vite.config.ts` liga `build.manifest`. `bundle-budget.mjs` exporta as
  funções puras (`initialFiles`, `measure`, `checkBudget`, `formatTable`) e o `check-build.mjs` chama, depois da
  checagem do `jsxDEV`. Tamanho com `node:zlib` (`gzipSync`). Limites em `apps/web/bundle-budget.json`
  (`{ "initialJs": 150, "routeChunk": 40, "css": 25, "totalJs": 400 }`, em kB). Testes das funções em
  `apps/web/scripts/bundle-budget.test.ts` (o Vitest do web já roda no `pnpm test`).
- **CI:** nada muda no `ci.yml`: o `pnpm build` já roda a checagem, e o resumo sai pelo `GITHUB_STEP_SUMMARY`.
- **PWA:** o Workbox continua guardando todos os `.js` (padrão `**/*.{js,css,html,svg}`), então o app instalado
  abre as telas sem rede como hoje.
- Sem dependência nova. Sem mudança visual.

**Álbum** (`docs/design/prints/orcamento-de-bundle/`): `c8-carregando-rota.png` a 390 px, o mesmo a 320 px e no
desktop, e a tabela do build colada no PR.

### Decisões
- Limite no build, não num serviço externo — o CI já roda `pnpm build`; sem conta nem dependência nova.
- Um pedaço por área, não por componente — menos pedidos de rede; os grandes momentos (VS, YOU WIN) ficam no
  pedaço da tela deles.
- Pré-carregar as abas — troca de aba sem espera, sem pôr tudo no JS inicial.
- Recarregar uma vez quando o pedaço sumiu — é o que resolve a aba aberta durante um deploy; a marca evita laço.
- Fontes ficam fora da conta — já são só o recorte latino e mudam pouco.

## Fora do escopo
- Trocar bibliotecas para emagrecer (React, router, Zod).
- Medir tempo de carregamento em aparelho real (Lighthouse no CI).
- Imagens e fontes.

## Perguntas respondidas pelo dono
- Nenhuma: fatia técnica, sem regra de negócio (parecer do Head de Engenharia, 30 out 2026, aprovado pelo dono).

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
