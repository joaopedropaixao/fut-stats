# `<fatia>`

> Modelo do spec de fatia da Trilha. O TPL copia para `docs/specs/<fatia>.md`, preenche e pede o ok do dono.
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `<fatia>` (#<n> da Trilha) |
| **Modo** | Par / Front / Back |
| **Parte de** | <PR ou branch antiga, ou "—"> |
| **Status** | rascunho / aprovado em <data> |

## Produto

### Objetivo
<Uma ou duas frases: o que o usuário consegue fazer no fim.>

### Quem usa
<Jogador, admin, convidado... e o que cada um pode.>

### Regras de domínio
- <Regra> ([CONTEXT.md › <seção>](../../CONTEXT.md#<âncora>))

### Cenários
Cada cenário tem um id (`C1`, `C2`...). Os testes levam o id no nome.

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | <contexto> | <ação> | <resultado> | unitário / integração / Playwright |
| C2 | um usuário de outro grupo | chama a rota | 403 `<CODIGO>` | integração |

Cubra o caminho feliz, as bordas e as permissões (jogador, admin e usuário de outro grupo).

## Técnico

### Contrato
Schemas em `packages/shared/src/<feature>.ts`, derivados dos tipos do `packages/domain`. No Par, é o primeiro
commit da branch `-back`.

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/groups/:groupId/<...>` | membro | — | `<NomeOutput>` | `<CODIGO>` (4xx) |

### Banco (`schema.prisma`)
<Modelos e campos novos ou alterados, ou "sem mudança".>

### Domínio
<Funções novas em `packages/domain` com assinatura, ou "sem mudança".>

### Tela
<Rota da tela, telas de referência a copiar, componentes a reusar.>

### Decisões
- <Decisão> — <por quê>

## Fora do escopo
- <...>

## Perguntas respondidas pelo dono
- <Pergunta> → <resposta>

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
