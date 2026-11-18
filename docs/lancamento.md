# Lançamento para a pelada

Roteiro do dia em que o Fut Stats vai para o grupo. Pré-requisito: o roteiro de produção do `docs/deploy.md` (R0 a
R8) feito e conferido, sem erro novo no Sentry. O app de produção fica em **`https://futstats-app.com.br`**.

> O endereço **não pode mudar depois**: a instalação e os avisos ficam presos a ele. Trocar obriga todo mundo a
> reinstalar e ligar os avisos de novo.

## 1. Antes de chamar o grupo (você, o admin)

- [ ] Entrar em `https://futstats-app.com.br` com **Entrar com Google** e **Criar pelada** (nome, o seu apelido, a sua posição).
- [ ] Abrir **Perfil → Elenco** e **conferir os jogadores** (toque num jogador para editar): apelido, posição e a **nota inicial** de cada um (a nota inicial
      pesa na hora de montar os times equilibrados; ajuste antes da primeira rodada).
- [ ] Pegar o **link de convite** no **Perfil**, no card de convite do admin (teclas **Copiar link**, **Mandar no WhatsApp** e
      **Gerar novo link**), e testar abrindo numa aba anônima: aparece o nome da pelada.
- [ ] Instalar o app **no seu celular** e ligar o interruptor **Avisos neste celular** (passos abaixo), para ver como o grupo vai ver.
- [ ] Marcar a **primeira rodada** (tecla **Criar rodada**: dia, hora e local).
- [ ] Abrir o Sentry e confirmar que não há erro novo.

## 2. Texto pronto para o WhatsApp

> Pessoal, a nossa pelada agora tem app (https://futstats-app.com.br): times equilibrados, notas, ranking e resenhas.
>
> 1. Entre pelo link e confirme seu apelido e posição: LINK-DE-CONVITE
> 2. **Android:** abra o link no Chrome → menu (⋮) → **Instalar app** (ou **Adicionar à tela inicial**); ou, no **Perfil**, a tecla **Instalar**.
> 3. **iPhone:** abra o link no **Safari** → **Compartilhar** → **Adicionar à Tela de Início**. Sem isso o iPhone
>    **não recebe os avisos**.
> 4. Abra o app pelo **ícone** e, no **Perfil**, no card **Avisos**, ligue o interruptor **Avisos neste celular** (tem que mostrar
>    **Ligado**) e aceite. Para conferir, toque em **Testar aviso**.
>
> Qualquer problema, me chama aqui.

(Troque `LINK-DE-CONVITE` pelo link do passo 1 da seção anterior.)

## 3. Instalação, por aparelho

### Android (Chrome)

1. Abra o link de convite no **Chrome**, entre com o Google e preencha o apelido e a posição.
2. Menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**) → **Instalar**. Também dá pelo **Perfil**, card **Instale o app**,
   tecla **Instalar**.
3. Abra o app pelo **ícone** novo na tela inicial.
4. **Perfil**, card **Avisos**: ligue o interruptor **Avisos neste celular** (passa a mostrar **Ligado**) e toque em
   **Permitir** quando o Android perguntar.
5. Toque em **Testar aviso**: a notificação tem que chegar (com o app aberto ou fechado).

### iPhone (Safari)

1. Abra o link de convite no **Safari** (não no navegador do WhatsApp nem no Chrome do iPhone), entre com o Google e
   preencha o apelido e a posição.
2. Toque em **Compartilhar** (o quadrado com a seta) → **Adicionar à Tela de Início** → **Adicionar**. (No **Perfil**, o card
   **Instale o app** tem a tecla **Instalar**, que mostra esses dois passos.)
3. Feche o Safari e abra o app pelo **ícone** na tela inicial. **Sem instalar, o iPhone não recebe avisos.**
4. **Perfil**, card **Avisos**: ligue o interruptor **Avisos neste celular** (passa a mostrar **Ligado**) e toque em
   **Permitir** quando o iPhone perguntar.
5. Toque em **Testar aviso**: a notificação tem que chegar.

## 4. "Não recebo nada" (quem reclamar de aviso)

Siga nesta ordem, com a pessoa:

1. **Testar aviso** (**Perfil**, card **Avisos**; a tecla só aparece com o interruptor **Ligado**). Chegou? Então o aparelho está certo: o aviso real só sai quando o admin faz a
   ação (marcar rodada, publicar times, abrir votação, sair o resultado).
2. Não chegou: o interruptor **Avisos neste celular** mostra **Ligado**? Se mostra **Desligado**, ligue de novo.
3. **iPhone:** o app foi **instalado pela tela inicial** (e aberto pelo ícone)? Se abriu pelo Safari, instale (seção 3).
4. A permissão de notificação está **bloqueada** nos Ajustes do aparelho (ou do navegador)? Libere para o Fut Stats.
5. O celular está em **Não perturbe** / modo foco? Desligue para testar.
6. Ainda nada: **desligue e ligue de novo** o interruptor **Avisos neste celular** e toque em **Testar aviso**.
7. Se persistir, anote o aparelho e o sistema e abra o Sentry/log com o horário; mande para o desenvolvedor.

## 5. Acompanhar as 2 ou 3 primeiras rodadas

| Quando | O que conferir |
|---|---|
| Ao marcar a rodada | Chegou o aviso para o grupo? Quem confirmou aparece na lista? |
| Antes do jogo | Presenças fechadas, **times** montados e publicados (o aviso sai); o admin conferiu o equilíbrio |
| Durante o jogo | Placar e lances lançados; os jogadores veem o gol em poucos segundos |
| Depois do jogo | A **votação** abre e o aviso sai; as pessoas conseguem dar as notas |
| No prazo | A votação fecha sozinha (até uns 30 a 40 minutos depois do prazo) e o **resultado** sai, com o aviso |
| No Sentry | Nenhum erro novo; se houver, anote o `requestId` (ver "Como ler um erro no Sentry" no `docs/deploy.md`) |
| No GitHub | O **Despertador** está verde de 30 em 30 minutos e o **Backup** verde todo dia |

Depois da 3ª rodada, decida com o grupo o que melhorar e abra os itens no roadmap.

## 6. Onde anotar o retorno do grupo

Anote tudo num lugar só: uma lista no próprio WhatsApp do admin ("Fut Stats: retorno") ou uma nota no celular, com data,
quem falou, aparelho e o que aconteceu. Para cada rodada, três linhas: **o que funcionou**, **o que travou ou
confundiu** e **o que pediram**. Bugs vão como item no repositório (com o `requestId` se houver); pedidos entram no
roadmap, depois do lançamento.
