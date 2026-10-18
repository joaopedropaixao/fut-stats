# Roadmap

Este arquivo **é** o quadro de tarefas: marque `[x]` no mesmo PR que entrega o item.
Regra de ouro: **cada fase termina com algo no ar**, não só no seu computador.

## Fase 0: Fundação
- [ ] Repositório no GitHub, branches `main` e `develop`, proteção de branch
- [ ] Monorepo (pnpm + Turborepo) com `apps/api`, `apps/web` e `packages/shared`
- [ ] Lint + Prettier + TypeScript strict
- [ ] CI no GitHub Actions (lint, typecheck, testes em todo PR)
- [ ] Banco no Neon + Prisma conectado
- [ ] **Deploy "hello world"** de front e API (staging a partir da `develop`)
- [ ] Login com Google funcionando em staging

## Fase 0.5: Design (Paper + Claude Code)
Roda **em paralelo** com a Fase 0 e o backend da Fase 1. **Bloqueia apenas a implementação das telas no front.**
- [ ] Instalar o Paper Desktop e conectar ao Claude Code (plugin/MCP)
- [ ] Mini design system: cores (Branco x Preto), tipografia, espaçamentos, componentes base
- [ ] Wireframes das telas do caderno (mobile-first): feed, seletor de times, notas, ranking, histórico
- [ ] Alta fidelidade das telas do MVP
- [ ] Tokens do Paper → tema do Tailwind no `apps/web`

## Fase 1: Núcleo do grupo
- [ ] Grupo + link de convite
- [ ] Perfil do jogador (apelido, foto, posição, nota inicial definida pelo admin)
- [ ] Cadastro dos goleiros fixos (tipo `GOLEIRO`)
- [ ] Admin: criar rodada; jogadores: confirmar presença
- [ ] Admin: montar Branco x Preto manualmente e lançar o placar
- [ ] Scouts: jogador lança os próprios gols/assistências; admin lança/corrige de todos
- [ ] Histórico de rodadas e partidas

## Fase 2: Seletor de times
- [ ] Algoritmo `balanceTeams` (Branco x Preto, 1-2-3-1, um goleiro por time) com testes
- [ ] Tela do admin: gerar, arrastar entre times, regerar, publicar
- [ ] Anti-vício: penalizar duplas repetidas nas últimas N rodadas

## Fase 3: Notas e ranking
- [ ] Abertura/fechamento da votação (todos votaram ou prazo expirou)
- [ ] Tela "Dê sua nota" (um jogador por vez, swipe)
- [ ] MVP / Bola Murcha
- [ ] Ranking geral e por posição + perfil com stats

## Fase 4: Feed e lançamento do MVP 🚀
- [ ] Feed de notícias/resenhas (admin cria), reações e comentários
- [ ] Cards de alerta (times publicados, votação aberta)
- [ ] PWA instalável + Web Push
- [ ] Produção (`main`), Sentry, backup do banco
- [ ] **Lançar para a pelada**, coletar feedback em 2–3 rodadas

## Fase 5: Cartola (v1.1)
- [ ] Preços iniciais a partir das notas acumuladas
- [ ] Mercado abre/fecha por rodada
- [ ] Montar escalação + capitão, com orçamento
- [ ] Pontuação e valorização após a votação
- [ ] Ranking do Cartola (rodada e geral)

## Fase 6: Pagamentos
- [ ] Mensalidades: quem pagou / quem não pagou (substitui a planilha)
- [ ] Pix copia-e-cola / QR estático gerado pelo app (sem precisar de API de banco)
- [ ] Admin marca como pago; depois, avaliar confirmação automática via PSP

## Futuro
- Notificações via WhatsApp
- Segundo grupo (sua outra pelada)
- App nativo (Expo), se o PWA não bastar
