# `rodizio-reservas`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`. Marcas `❓P<n>` = recomendação do líder esperando o
> dono (`docs/specs/perguntas-v1.md`).

| | |
|---|---|
| **Fatia** | `rodizio-reservas` (onda 2) |
| **Modo** | Par |
| **Parte de** | `placar-e-lances` (a tela `/rodadas/:roundId/jogo` e as rotas de `.../match`) |
| **Status** | rascunho |
| **Base** | develop @4a1540e |
| **Depende de** | perfil-jogador |
| **Toca em** | apps/api/prisma/schema.prisma, packages/domain/src/round, packages/shared/src/match.ts, packages/shared/src/domain.ts, apps/api/src/match, apps/api/src/seed, apps/web/src/features/match, apps/web/src/pages/match |

## Produto

### Objetivo
Com o jogo rolando, o admin liga o **rodízio**: um cronômetro (60 minutos por padrão) que divide o tempo de jogo
por igual entre os jogadores de linha de cada time e avisa, na tela do jogo de todo mundo, **quem entra e quem sai**
a cada troca. É opcional: sem ligar, a tela do jogo fica como hoje (pedido do dono, 25 out 2026).

### Quem usa
- **Admin:** liga (escolhendo a duração), reinicia e para o rodízio, com a rodada em jogo.
- **Jogador (e admin):** vê o card do rodízio na tela do jogo: contagem para a próxima troca, quem entra, quem sai e
  a tabela completa. Se a troca é com ele, a tela diz "VOCÊ ENTRA" ou "VOCÊ SAI".
- **Usuário de outro grupo, ou membro inativo:** 404.

### Regras de domínio
As três decisões que estavam em aberto na Trilha, com a recomendação do líder ❓P5:
- **A conta é por time.** Cada time roda os próprios reservas (o reserva já pertence a um time em `TeamPlayer`).
  Time sem reserva não tem troca.
- **O goleiro fica fora do rodízio.** Só os 6 de linha e os reservas entram na conta (jogador de linha não vai
  para o gol: [CONTEXT.md › Seletor de times](../../CONTEXT.md#seletor-de-times-balanceteams-)).
- **O relógio é compartilhado.** O banco guarda só **quando começou** e a **duração**. A tabela de trocas é uma
  conta pura feita com os times da rodada, então todo celular mostra a mesma coisa sem sincronizar nada.

**A conta** (por time, com `R` reservas, `R` = 1 ou 2, e `L = 6 + R` jogadores de linha):
- O tempo é dividido em `L ÷ R` turnos iguais (1 reserva: 7 turnos de 8:34 em 60 min; 2 reservas: 4 turnos de
  15:00).
- Em cada turno, `R` jogadores ficam fora. **Cada jogador de linha fica fora exatamente um turno**, então todos
  jogam o mesmo tempo (51:26 com 1 reserva; 45:00 com 2).
- No primeiro turno ficam fora os reservas, na ordem do banco. Os titulares saem nos turnos seguintes, numa
  **ordem sorteada e fixa para a rodada** ❓P5 (sorteio com semente = id da rodada + time: recalcular dá sempre a
  mesma tabela). Com 2 reservas, saem e entram de dois em dois (o que `docs/01-visao-e-escopo.md` já descreve).
- A cada virada de turno: **entra** quem estava fora, **sai** quem fica fora no turno seguinte.
- Duração: de 20 a 120 minutos, de 5 em 5; padrão 60 (`DEFAULT_ROTATION_MINUTES`).
- Só existe com a rodada `IN_PROGRESS`. Ao finalizar o jogo, o rodízio acaba (o card some); os campos ficam no
  banco como registro.
- Não muda quem jogou, placar, lances nem notas: reserva conta como tendo jogado, como hoje
  ([CONTEXT.md › Presença e escalação](../../CONTEXT.md#presença-e-escalação-attendance--teamplayer)).

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | time com 1 reserva, 60 min | `rotationPlan` | 7 turnos de 514 285 ms (o último fecha em 60:00 exatos); cada um dos 7 de linha fica fora em exatamente 1 turno; o reserva no 1º; o goleiro em nenhum | unitário |
| C2 | time com 2 reservas, 60 min | `rotationPlan` | 4 turnos de 15:00; 2 fora por turno; os 2 reservas no 1º; cada um dos 8 fora uma vez | unitário |
| C3 | time sem reserva | `rotationPlan` | `turns: []` | unitário |
| C4 | Branco com 2 reservas e Preto com 1 | `rotationPlan` | cada time com a própria tabela (4 e 7 turnos) | unitário |
| C5 | a mesma rodada duas vezes; rodadas com ids diferentes | `rotationPlan` | mesma ordem de saída; ordens diferentes (com alta chance: testar com 2 sementes fixas) | unitário |
| C6 | duração 45 | `rotationPlan` com 1 reserva | 7 turnos somando 45:00 | unitário |
| C7 | plano com 1 reserva, 4:00 de jogo | `rotationStatus(plan, 240_000)` | fora = o reserva; próxima troca em 4:34; `enter` = o reserva; `leave` = quem fica fora no 2º turno | unitário |
| C8 | no instante exato da virada | `rotationStatus` | já está no turno seguinte (limite fechado à esquerda) | unitário |
| C9 | no último turno; depois do fim | `rotationStatus` | `next: null` e `remainingMs` do jogo; `finished: true` com ninguém fora marcado como "próximo" | unitário |
| C10 | tempo negativo (relógio do celular atrasado) | `rotationStatus` | trata como 0 | unitário |
| C11 | admin, `IN_PROGRESS`, 60 min, com reserva em algum time | `validateRotationStart` | `[]` | unitário |
| C12 | jogador comum; rodada fora de `IN_PROGRESS`; nenhum time com reserva; duração 17 ou 125 | `validateRotationStart` | `NOT_ADMIN`; `ROUND_NOT_IN_PROGRESS`; `NO_RESERVES`; `INVALID_DURATION` (só o primeiro que valer, nessa prioridade) | unitário |

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C13 | admin, rodada `IN_PROGRESS` com reservas | `POST .../match/rotation` `{ minutes: 60 }` | 200 `MatchView` com `rotation: { startedAt: agora, minutes: 60 }`; gravado no banco | integração |
| C14 | sem corpo | `POST .../match/rotation` | usa 60 | integração |
| C15 | rodízio rodando | `POST` de novo com `{ minutes: 40 }` | 200; recomeça de agora, com 40 (é o "Reiniciar") | integração |
| C16 | rodízio rodando | admin `DELETE .../match/rotation` | 200 com `rotation: null`; os dois campos voltam a nulo | integração |
| C17 | `{ minutes: 17 }`, `{ minutes: 125 }`, `{ minutes: 'x' }` | `POST` | 400 | integração |
| C18 | rodada `TEAMS_PUBLISHED` ou `POST_MATCH` | `POST` e `DELETE` | 409 `ROUND_NOT_IN_PROGRESS` | integração |
| C19 | rodada em jogo com 14 escalados (sem reservas) | `POST` | 409 `NO_RESERVES` | integração |
| C20 | jogador comum | `POST` e `DELETE` | 403 `NOT_ADMIN` | integração |
| C21 | qualquer membro, rodízio rodando | `GET .../match` | `rotation` preenchido e `serverTime`; `permissions.rotate` só para admin em jogo com reservas | integração |
| C22 | rodízio rodando | admin `POST .../match/finish` | 200; a visão em `POST_MATCH` vem com `rotation: null` | integração |
| C23 | rodada de outro grupo, não membro, membro inativo | qualquer rota | 404; nada muda | integração |
| C24 | `start` e `finish` ao mesmo tempo | `Promise.all` | nunca fica rodízio ligado numa rodada fora de jogo (as duas escritas usam `withRoundLock`) | integração |
| C25 | seed `--cenario=em-jogo` | rodar | a rodada em jogo tem pelo menos 1 reserva em cada time e o rodízio desligado | integração (`seed.spec.ts`) |

**Tela** (`/rodadas/:roundId/jogo`, 390 px, como admin e como jogador)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C26 | admin, em jogo, rodízio desligado, com reservas | abrir | abaixo do placar, tecla de contorno **"Ligar rodízio"** com o texto "Divide o tempo entre os jogadores de linha e avisa cada troca". "Finalizar jogo" segue sendo a única tecla amarela | Playwright |
| C27 | admin | "Ligar rodízio" | gaveta "Ligar o rodízio?": duração em dígitos pixel com − / + de 5 em 5 (20 a 120), e o resumo por time ("BRANCO: TROCA A CADA 8:34", "PRETO: SEM RESERVAS") que recalcula ao mexer. Voltar / Ligar | Playwright |
| C28 | admin confirma | — | a gaveta fecha na hora e aparece o card **RODÍZIO** (grande momento: contorno de 3 px, sombra dura, entrada em degraus) | Playwright |
| C29 | qualquer membro, rodízio rodando | olhar o card | seletor Branco / Preto (abre no meu time); "PRÓXIMA TROCA EM" com a contagem em dígitos pixel grandes, andando de segundo em segundo; bloco **▲ ENTRA** e bloco **▼ SAI**, cada um com rosto e apelido inteiro; embaixo, o tempo de jogo ("JOGO 23:10 DE 60:00") | Playwright |
| C30 | a próxima troca me envolve | olhar | faixa **"VOCÊ ENTRA"** ou **"VOCÊ SAI"** no topo do card, com a etiqueta "VOCÊ" na minha linha; estou fora agora: "VOCÊ ESTÁ NO BANCO" | Playwright |
| C31 | faltam 30 s para a troca | olhar | o card entra em **"PREPARA"**: ícone de alerta e a palavra, em `--color-warning` (ícone + texto, não só cor) | Playwright (relógio simulado) |
| C32 | a contagem zera | olhar | **"TROCA!"**: o card pisca em degraus (≤ 400 ms), os dígitos "batem", o celular vibra (`navigator.vibrate`, se existir) e a frase "ENTRA BETO, SAI MARCÃO" fica 10 s; depois volta à contagem do turno seguinte | Playwright (relógio simulado) |
| C33 | time escolhido não tem reserva | olhar | "PRETO: SEM RESERVAS. NINGUÉM SAI." no lugar dos blocos | Playwright |
| C34 | qualquer membro | "Ver tabela" | gaveta com todos os turnos do time escolhido: horário de jogo ("0:00 – 8:34") e quem fica fora; o turno de agora marcado com "AGORA"; a minha linha com "VOCÊ" | Playwright |
| C35 | admin, rodízio rodando | "⋯" do card → "Reiniciar" / "Parar rodízio" | Reiniciar abre a gaveta de ligar; Parar abre a gaveta "Parar o rodízio?" e, confirmado, o card some e volta a tecla "Ligar rodízio" | Playwright |
| C36 | interruptores **Som** e **Tela ligada** no card | ligar | Som: um bipe curto a cada troca (desligado por padrão). Tela ligada: pede o Wake Lock; onde o navegador não tem, o interruptor não aparece. Os dois ficam lembrados no aparelho | Playwright (existência e estado) |
| C37 | acabou o tempo | olhar | "FIM DO TEMPO" com o tempo total; para o admin, o texto "Finalize o jogo com o placar" | Playwright (relógio simulado) |
| C38 | outro membro com a tela aberta | o admin liga ou para o rodízio | aparece ou some em até 15 s (o polling que já existe em jogo) | Playwright |
| C39 | relógio do celular 2 min errado | abrir | a contagem bate com a de outro aparelho (usa `serverTime` para corrigir) | unitário (`clock-offset`) + Playwright |
| C40 | início (`/`) com a rodada em jogo e rodízio ligado | olhar o card "Em jogo" | uma linha "RODÍZIO: PRÓXIMA TROCA EM 3:12" (do meu time) | Playwright |
| C41 | reduzir movimento | troca | sem piscar nem bater: a frase troca com fade | Playwright (`emulateMedia`) |
| C42 | jogador comum; admin sem reservas nos times | abrir | sem a tecla "Ligar rodízio" (vem de `permissions.rotate`) | Playwright |
| C43 | larguras 320, 375, 390, 430 px e desktop | card do rodízio (contagem, PREPARA, TROCA!, sem reservas), gaveta de ligar e tabela | sem rolagem horizontal, sem sobreposição, apelidos de 10 letras inteiros, alvos ≥ 44 px; checagem automática passa. Console sem erros no fluxo real | Playwright |

## Técnico

### Contrato
Acréscimos em `packages/shared/src/match.ts` e `domain.ts`. Primeiro commit da branch `-back`, junto com
`rotation.ts` do domain (o shared importa de lá).

| Método | Rota (sob `/api/groups/:groupId/rounds/:roundId/match`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `POST` | `/rotation` | admin | `StartRotationInput` | `MatchView` | 400; 403 `NOT_ADMIN`; 404; 409 `ROUND_NOT_IN_PROGRESS` / `NO_RESERVES` |
| `DELETE` | `/rotation` | admin | — | `MatchView` | 403 `NOT_ADMIN`; 404; 409 `ROUND_NOT_IN_PROGRESS` |
| `GET` | `/` | membro | — | `MatchView` (com `rotation` e `serverTime`) | 404 |

```ts
// packages/shared/src/domain.ts
export const ROTATION_ERROR_LABELS: Readonly<Record<RotationError, string>> = {
  NOT_ADMIN: 'Só o admin pode fazer isso',
  ROUND_NOT_IN_PROGRESS: 'O rodízio só existe com o jogo rolando',
  NO_RESERVES: 'Nenhum time tem reserva: não há o que revezar',
  INVALID_DURATION: 'A duração vai de 20 a 120 minutos, de 5 em 5',
};

// packages/shared/src/match.ts
export const startRotationSchema = z.object({
  minutes: z.number().int().refine(isValidRotationMinutes, { message: ROTATION_ERROR_LABELS.INVALID_DURATION })
    .default(DEFAULT_ROTATION_MINUTES),
});
export const matchRotationSchema = z.object({ startedAt: z.iso.datetime(), minutes: z.number().int() });

matchPermissionsSchema: + rotate: z.boolean()        // admin, IN_PROGRESS e algum time com reserva
matchViewSchema:        + rotation: matchRotationSchema.nullable()   // só em IN_PROGRESS; senão null
                        + serverTime: z.iso.datetime()               // hora do servidor na resposta

/** A tabela de trocas da visão: monta os times a partir de `players` e chama `rotationPlan` do domain. */
export function matchRotationPlan(view: MatchView): RotationPlan | null;
export { rotationStatus, type RotationPlan, type RotationStatus };   // o front só mostra
// tipos: StartRotationInput, MatchRotation
```

### Banco (`schema.prisma`)
Model **`Round`** ganha dois campos:
- `rotationStartedAt DateTime?`: quando o rodízio começou. Nulo = desligado.
- `rotationMinutes Int?`: a duração escolhida.

Uma migration (`round_rotation`). Nenhum outro model muda.

### Domínio
`packages/domain/src/round/rotation.ts` (exportado no `index.ts` da pasta):
- `DEFAULT_ROTATION_MINUTES = 60`, `ROTATION_MINUTES_MIN = 20`, `ROTATION_MINUTES_MAX = 120`,
  `ROTATION_MINUTES_STEP = 5`; `isValidRotationMinutes(minutes: number): boolean`.
- `RotationTurn = { index: number; startMs: number; endMs: number; out: string[] }` (tempos contados do início).
  `RotationPlan = Record<Team, { turns: RotationTurn[] }>`.
- `rotationPlan(teams: RoundTeams, options: { seed: string; durationMinutes?: number }): RotationPlan`.
  Goleiro = quem está na vaga `GOALKEEPER`. Sorteio com o `seededRandom` que já existe em `balance-teams/random.ts`,
  semente derivada de `seed` + time.
- `RotationStatus = { elapsedMs; remainingMs; finished; teams: Record<Team, { out: string[]; next: { inMs: number; enter: string[]; leave: string[] } | null }> }`.
  `rotationStatus(plan: RotationPlan, durationMinutes: number, elapsedMs: number): RotationStatus`.
- `ROTATION_ERRORS = ['NOT_ADMIN', 'ROUND_NOT_IN_PROGRESS', 'NO_RESERVES', 'INVALID_DURATION']`;
  `validateRotationStart(actor: RoundActor, round: RoundState, minutes: number): RotationError[]` e
  `validateRotationStop(actor, round)` (os dois primeiros códigos).
- Não lê relógio (o tempo decorrido vem de fora), não lança, não guarda nada. Entrada nova no `CONTEXT.md`
  ("Rodízio dos reservas").

Na API (`apps/api/src/match`): as duas escritas usam `withRoundLock`; `finish` não apaga os campos, mas a visão só
devolve `rotation` em `IN_PROGRESS`. `permissions.rotate` calculado com `validateRotationStart` (sem `NO_RESERVES`
= pode).

### Tela
Regras de visual do documento de autonomia valem como critério.
- **Card do rodízio** (`features/match/rotation-card.tsx`), na tela do jogo em `IN_PROGRESS`, logo abaixo do placar.
  Referência: o card de grande momento do início (`game-card.tsx`, `moment-frame` + `animate-moment-in`) e o
  placar (`scoreboard.tsx`) para os dígitos. Estados: contagem, PREPARA (30 s), TROCA! (10 s), sem reservas, fim do
  tempo.
  - Contagem em `PixelDigits` grandes (escala 6 em 390 px; 5 em 320 px para caber com folga), formato `M:SS`.
  - ▲ ENTRA em `--color-success` e ▼ SAI em `--color-danger`, sempre com a seta e a palavra. Dois blocos lado a
    lado; em 320 px continuam lado a lado, com o apelido embaixo do rosto.
  - Seletor de time: o `TeamSegmented` que já existe.
- **Relógio:** `features/match/use-rotation-clock.ts` guarda a diferença entre `serverTime` e o relógio do aparelho
  a cada resposta e atualiza de segundo em segundo (só com a aba visível). A lógica de "qual estado mostrar"
  (contagem, prepara, troca) é uma função pura com teste (`rotation-phase.ts`).
- **Gavetas** (`Sheet`): ligar, parar e a tabela. 180 ms para abrir, ~100 ms para fechar; a de confirmar fecha na
  hora e a chamada segue.
- **Som e tela ligada:** preferência em `localStorage` (com `try/catch`, como `vs-seen.ts`). Bipe por WebAudio (sem
  arquivo). Wake Lock pedido de novo ao voltar para a aba.
- **Início** (`game-card.tsx`): a linha do rodízio quando `rotation` existe.
- Nada de regra no front: tabela e estado vêm de `matchRotationPlan` e `rotationStatus` (domain, via shared); o que
  pode vem de `permissions.rotate`. Sem dependência nova.

**Álbum** (`docs/design/prints/rodizio-reservas/`): um print por cenário de tela (C26–C42) a 390 px;
`jogo-rodizio-320.png` e `jogo-rodizio-desktop.png`.

### Decisões
- Relógio compartilhado guardando só o início e a duração — o reserva vê no próprio celular quando entra, e a conta
  pura dispensa sincronizar estado.
- Cada um fica fora um turno — é a divisão igual mais simples de explicar no banco de reservas.
- Ordem sorteada com semente da rodada — ninguém é "sempre o primeiro a sair", e a tabela não muda ao recarregar.
- Sem pausa: parou o jogo por muito tempo, o admin reinicia — evita estado de pausa no banco e na conta.
- Aviso só com a tela aberta (vibração, bipe opcional, tela ligada) — navegador não acorda celular bloqueado sem
  push agendado, que precisaria de um agendador no servidor.
- Duração ajustável na gaveta — nem toda pelada tem 60 minutos; o padrão continua 60.

## Fora do escopo
- Pausar e retomar; acréscimos.
- Push a cada troca.
- Admin escolher a ordem de saída na mão; trocar jogador de posição no campo durante o jogo.
- Rodízio do goleiro.
- Registrar minutos jogados por jogador.

## Perguntas respondidas pelo dono
- Cronômetro dos reservas? → Fatia própria, botão opcional na tela do jogo (25 out 2026).
- ❓P5 (por time ou geral, goleiro, relógio e ordem de saída): aguardando (`perguntas-v1.md`).

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
