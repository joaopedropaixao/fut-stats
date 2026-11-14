# Perguntas da v1 (lote único)

Todas as dúvidas que apareceram ao escrever os specs das fatias que faltam, em **ordem de impacto**, cada uma com
as opções e a recomendação do líder. As respostas do dono estão no fim e já foram aplicadas nos specs.

**Status:** respondido pelo dono em 14 nov 2026. Fica **uma pendência**: o endereço de produção (P8, item 1), que o
dono decide antes da onda 6.

| P | Fatia | Pergunta | Opções | Recomendação | Por quê |
|---|---|---|---|---|---|
| **P1** | `perfil-jogador` | O bonequinho tem "cor da pele e cabelo". Cabelo é o **estilo**, a **cor** ou os dois? E quantas opções? | **A)** 5 tons de pele + 6 cabelos (careca, curto, cacheado, black power, comprido, moicano) + 5 cores de cabelo (preto, castanho, loiro, ruivo, grisalho). **B)** só pele + cor do cabelo (um corte só). **C)** só pele + estilo (cabelo sempre escuro). | **A** | Com 3 escolhas dá 150 combinações: num grupo de 25 quase ninguém fica igual, e ainda é "básico" (3 fileiras de toque). Vira 3 listas fechadas no banco; opção nova depois é uma mudança pequena. |
| **P3** | `ranking` | Depois que houver votação, **qual nota o seletor de times e a lista de presença usam**? Hoje é a nota inicial do admin. | **A)** média de todas as rodadas do jogador. **B)** média das **5 últimas** rodadas, com a nota inicial completando enquanto houver menos de 5. **C)** continua a nota inicial; o admin ajusta na mão. | **B** | O seletor quer saber como o jogador está **agora**. Com a inicial completando a janela, um jogo bom não transforma ninguém em craque, e depois de 5 rodadas a nota é 100% medida. O ranking da aba continua sendo a média de tudo. |
| **P5** | `rodizio-reservas` | As três decisões em aberto do rodízio, mais a ordem de saída. | **1) Conta:** por time / geral. **2) Goleiro:** fora / dentro do rodízio. **3) Relógio:** compartilhado (todo mundo vê no próprio celular) / só no celular de quem ligou. **4) Quem sai primeiro:** sorteio fixo por rodada / por posição (ataque → defesa) / o admin escolhe. | **Por time; goleiro fora; relógio compartilhado; sorteio fixo por rodada.** Cada jogador de linha fica fora um turno (1 reserva: 7 turnos de 8:34; 2 reservas: 4 turnos de 15:00, saindo de dois em dois). Duração ajustável ao ligar (padrão 60 min). | O reserva já pertence a um time; jogador de linha não vai para o gol; compartilhado é o que faz o reserva saber, no celular dele, quando entra. Custa só 2 campos na rodada. Sorteio evita "sempre o mesmo sai primeiro". |
| **P2** | `votacao` | **Prazo da votação** (o `CONTEXT.md` diz "valor ainda não definido"; o banco está com 48 h). | **A)** 24 h depois de o admin abrir. **B)** 48 h. **C)** até uma hora fixa do dia seguinte. | **A** (e o admin pode encerrar antes) | O resultado sai com o jogo ainda fresco. Fecha antes se todo mundo votar. Hora fixa pediria uma configuração a mais por grupo. |
| **P4** | `ranking` | **O que o ranking conta** e a partir de quantos jogos alguém entra? | **Recorte:** A) tudo desde o início / B) por temporada (semestre). **Mínimo:** A) 3 rodadas com nota (ou todas, enquanto o grupo tiver menos de 3) / B) 1 rodada / C) 5 rodadas. | **Tudo desde o início; mínimo de 3 rodadas com nota** (quem tem menos aparece em "Poucos jogos", sem posição) | Temporada só faz falta com o Cartola (v1.1). O mínimo evita que um jogo bom ponha alguém na ponta, e o "ou todas" faz o ranking existir desde a primeira rodada. |
| **P6** | `feed` | A resenha do admin tem **imagem** na v1? | **A)** só texto (título opcional + até 1000 caracteres). **B)** texto + uma imagem. | **A** | Imagem pede um serviço de arquivos novo (conta, chaves, limite de tamanho, moderação). Texto + reações + comentários já dá vida ao feed; imagem entra na v1.1. |
| **P7** | `pwa-e-push` | **Quais avisos viram notificação** no celular? | **A)** 4 avisos por evento: rodada marcada, times publicados, votação aberta, resultado saiu. **B)** os 4 + resenha nova. **C)** os 4 + lembretes com hora marcada ("a votação fecha em 2 h"). | **A** | São os 4 momentos em que hoje alguém avisa no WhatsApp. Resenha nova pode virar barulho; lembrete com hora pede um agendador, e a API gratuita dorme. |
| **P8** | `producao` | Três escolhas de produção. | **1) Endereço:** A) `*.vercel.app` com nome bom / B) domínio próprio (~R$ 40/ano). **2) Login:** A) publicar o app do Google (qualquer conta entra) / B) manter em teste e cadastrar cada e-mail (até 100). **3) Backup diário:** A) arquivo cifrado guardado 30 dias no GitHub Actions / B) armazenamento privado à parte (conta nova) / C) só o histórico do próprio Neon. | **1A, 2A, 3A** | Custo zero e sem conta nova. Atenção no endereço: instalação do app e avisos ficam presos ao endereço; se um dia trocar por domínio próprio, o grupo reinstala (para 25 pessoas, é uma mensagem no WhatsApp). O backup é cifrado porque o repositório é de portfólio. |
| **P11** | `perfil-jogador` | O grupo pode ter **mais de um admin**? | **A)** sim: o admin torna outro membro admin (e tira), e um admin **não muda o próprio papel nem se desativa**. **B)** só um admin (quem criou). | **A** | A folha já tem "Tornar admin" no menu do elenco, e pelada costuma ter dois organizadores. A trava "não mexe em si mesmo" garante que sempre sobra um admin. |
| **P9** | `perfil-jogador` | **Apelido único** dentro do grupo? | **A)** sim, entre os ativos, ignorando maiúscula e acento ("Zé" = "ze"). **B)** não: podem repetir. | **A** | O apelido é o nome do jogador em toda tela e a folha já prevê o erro "Esse apelido já está em uso no grupo". Muda o convite: apelido repetido passa a ser recusado. |
| **P10** | `perfil-jogador` | **Quem define as posições** do jogador? | **A)** o próprio jogador edita a principal e até 2 secundárias; o admin pode ajustar as de qualquer um. **B)** o jogador só a principal; secundárias só o admin. **C)** só o admin. | **A** | Grupo de confiança, e menos trabalho para o admin. Regras fixas: secundária nunca é goleiro, e goleiro não tem secundária (é como o seletor já funciona). |
| **P12** | `votacao` | Durante a votação, **quem vê quem ainda não votou**? | **A)** todos veem só a contagem ("9 de 16"); o **admin** vê os nomes de quem falta. **B)** todos veem os nomes. **C)** ninguém vê nomes. | **A** | O admin consegue cobrar no grupo sem expor ninguém no app. O voto em si nunca aparece para ninguém, nem para o admin. |
| **P13** | `perfil-jogador` | **Foto** do jogador fica de fora da v1? | **A)** sim: o bonequinho é o rosto. **B)** foto + bonequinho. | **A** | A decisão do bonequinho já resolve o "rosto em todo lugar"; foto pede o mesmo serviço de arquivos da P6. |
| **P14** | plano | Duas mudanças na Trilha feitas pelo líder (detalhe em `ondas-v1.md`). | **A)** aceitar: **fatia nova `pacote-do-craque`** (só front, saiu de dentro de `votacao`) e **`auditoria-da-rodada` e `jogo-ao-vivo` depois de `votacao`** (ondas 4 e 5). **B)** manter a ordem antiga (auditoria e tempo real antes do histórico). | **A** | O pacote é o grande momento que mais pede volta de design: separado, não segura a votação. Auditoria e tempo real depois ligam tudo de uma vez (inclusive a votação e o rodízio), em vez de cada fatia ligar o seu pedaço. |

## O que o líder decidiu sem perguntar
Visual e detalhes de tela, pelas regras do documento de autonomia (o dono ajusta pelo álbum). Os principais:
- **Bonequinho:** dois desenhos das mesmas escolhas: o **rosto** (12 × 12, dentro do círculo com o anel do time) e
  o **corpo** (8 × 12, nos grandes momentos); botão "Sortear" ao montar.
- **Votar:** a nota começa vazia e o primeiro toque parte de 6,0; régua que aceita toque; rascunho guardado no
  aparelho; frases curtas por faixa de nota.
- **Histórico:** entra a partida com jogo finalizado (da Resenha em diante); o detalhe mostra o campo.
- **Feed:** ordem completa dos avisos (jogo ao vivo > Resenha > resultado > votação > times > presença); 5 reações
  em ícone pixel, uma por pessoa; comentários abrem no card; a lista "Quem vai" sai do início e fica no detalhe da
  rodada.
- **Push:** o aviso do resultado não diz quem foi o Craque (o suspense é do pacote).
- **Bug achado:** o histórico do seletor de times ignora rodada na Resenha (`POST_MATCH`); a correção entra em
  `historico`.

## Respostas do dono
Recebidas em 14 nov 2026, pelo orquestrador.

| P | Resposta | Onde foi aplicada |
|---|---|---|
| P1 | Recomendação aceita: 5 tons de pele, 6 cabelos e 5 cores de cabelo | `perfil-jogador` |
| P2 | Recomendação aceita: 24 h, e o admin pode encerrar antes | `votacao` |
| P3 | Recomendação aceita: média das 5 últimas rodadas, com a nota inicial completando | `ranking` |
| P4 | Recomendação aceita: tudo desde o início; mínimo de 3 rodadas com nota | `ranking` |
| P5 | Recomendação aceita: por time, goleiro fora, relógio compartilhado, sorteio fixo por rodada | `rodizio-reservas` |
| P6 | Recomendação aceita: resenha só com texto na v1 | `feed` |
| P7 | Recomendação aceita: os 4 avisos por evento | `pwa-e-push` |
| P8 | **Login:** publicar o app do Google (aceita). **Backup:** arquivo cifrado por 30 dias no GitHub Actions (aceita). **Endereço: pendente.** O dono decide antes do lançamento, antes da onda 6; a recomendação (`*.vercel.app`) e o alerta de reinstalação ficam anotados | `producao` (aprovado com a pendência anotada) |
| P9 | **Confirmado pelo dono:** apelido igual não pode, entre os ativos, ignorando maiúscula e acento | `perfil-jogador` |
| P10 | Recomendação aceita: o jogador edita a principal e até 2 secundárias; o admin ajusta | `perfil-jogador` |
| P11 | Recomendação aceita: mais de um admin; o admin não mexe no próprio papel nem se desativa | `perfil-jogador` |
| P12 | Recomendação aceita: todos veem a contagem; o admin vê os nomes de quem falta | `votacao` |
| P13 | Recomendação aceita: sem foto na v1 | `perfil-jogador` |
| P15 | **Pedido do dono depois do lote:** um despertador e um webhook para os avisos. Das três opções (só o despertador; despertador + lembretes; depois do lançamento), o dono escolheu **só o despertador**: um workflow agendado chama `POST /api/internal/tick` de 15 em 15 minutos, para a votação fechar e o aviso do resultado sair na hora, mesmo com a API parada. Lembretes ficam para depois | `producao` (rota, workflow, cenários C19 a C26 e passo R6b), com nota em `votacao` e `pwa-e-push` |
| P14 | Aceito: fatia nova `pacote-do-craque`; `auditoria-da-rodada` e `jogo-ao-vivo` depois de `votacao`; plano de 6 ondas | `ondas-v1.md`, Trilha do roadmap |
