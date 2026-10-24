import { useState, type ReactNode } from 'react';
import { Avatar, AvatarMore } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button, IconButton } from '../../components/ui/button';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { Surface } from '../../components/ui/surface';
import { Switch } from '../../components/ui/switch';
import { TabBarPreview } from '../../components/ui/tab-bar';
import { TextField } from '../../components/ui/text-field';
import { TABS } from '../../app/tabs';
import { useBackground } from '../../lib/theme';

/**
 * Vitrine dos componentes de base, na mesma ordem e com o mesmo elenco da folha
 * (docs/design/folha/design-system-v1.3.html), para comparar lado a lado em 390px.
 * Não é tela de produto.
 */
export function ComponentsShowcasePage() {
  const [background, setBackground] = useBackground();

  return (
    <main className="mx-auto flex max-w-mobile flex-col gap-18 px-4 pt-18 pb-10">
      <title>Componentes · Fut Stats</title>
      <header className="flex flex-col gap-5">
        <PixelText className="text-gold">Componentes de base</PixelText>
        <h1 className="flex flex-col">
          <PixelText size={32}>Fut</PixelText>
          <PixelText size={32}>Stats</PixelText>
        </h1>
        <p className="text-text-muted">
          Vitrine do design system v1.3 no código. Compare com a folha em largura de celular.
        </p>
        <Surface>
          <Switch
            label="Fundo Noite"
            checked={background === 'noite'}
            onCheckedChange={(on) => setBackground(on ? 'noite' : 'gramado')}
          />
        </Surface>
      </header>

      <Section
        title="Cores"
        lede="Os times são a identidade. Amarelo é ação; ouro é mérito, madeira é zoeira."
      >
        <div className="flex h-30 items-end justify-between bg-[linear-gradient(112deg,#fff_0%,#fff_50%,#000_50%,#000_100%)] p-4 shadow-float">
          <PixelText size={24} className="text-team-black">
            Branco
          </PixelText>
          <PixelText size={24} className="text-team-white">
            Preto
          </PixelText>
        </div>
        <div className="flex gap-2">
          <Swatch label="Gramado" className="bg-bg shadow-card" />
          <Swatch label="Nível 1" className="bg-surface" />
          <Swatch label="Nível 2" className="bg-surface-raised" />
          <Swatch label="Nível 3" className="bg-surface-3" />
        </div>
        <div className="flex gap-2">
          <Swatch label="Vitória" className="bg-success" />
          <Swatch label="Derrota" className="bg-danger" />
          <Swatch label="Prazo" className="bg-warning" />
          <Swatch label="Madeira" className="bg-flop" />
          <Swatch label="Ouro" className="bg-gold" />
        </div>
      </Section>

      <Section
        title="Tipografia"
        lede="Pixel é a voz do app: rótulo, nome e número. Inter só para ler uma frase."
      >
        <Row sample={<PixelDigits value="4×3" scale={8} />} label="Placar · ×8 = 72" />
        <Row sample={<PixelText size={24}>Ranking geral</PixelText>} label="Título 24" />
        <Row sample={<PixelText>Votação aberta</PixelText>} label="Card, botão, aba 16" />
        <Row sample={<PixelText>Zagueirão</PixelText>} label="Nome 16 · 24" />
        <Row
          sample={<PixelDigits value="8,4 9,0" scale={4} className="text-gold" />}
          label="Número ×4 = 36"
        />
        <Row sample={<p>Dê sua nota até as 22h.</p>} label="Texto corrido 16" />
        <Row
          sample={<p className="text-caption font-medium text-text-muted">12 jogos, 7 vitórias</p>}
          label="Legenda 13"
        />
      </Section>

      <Section title="Pixel legível" lede="Texto em Silkscreen, número em dígitos próprios.">
        <Surface className="flex flex-col gap-2.5 px-4 py-3.5" level={1}>
          <PixelDigits value="0123456789" scale={3} />
          <div className="flex items-center gap-3">
            <PixelDigits value="8,4" scale={3} className="text-gold" />
            <PixelDigits value="2" scale={3} />
            <PixelText size={24}>Z</PixelText>
            <PixelDigits value="0" scale={3} />
            <PixelText size={24}>O</PixelText>
          </div>
          <PixelText>Rodada 12</PixelText>
          <p className="text-caption text-text-muted">
            O 4 é aberto, o 0 tem risco, o 2 tem topo curvo (não é Z) e a vírgula tem rabicho.
          </p>
        </Surface>
      </Section>

      <Section
        title="Forma e profundidade"
        lede="Canto reto, contorno duro e sombra sólida, como tecla de fliperama."
      >
        <div className="flex items-end gap-3">
          <Level
            h="h-21"
            className="bg-surface shadow-card"
            title="Nível 1"
            sub="Listas: contorno"
          />
          <Level
            h="h-25"
            className="bg-surface-raised shadow-card"
            title="Nível 2"
            sub="Cards: contorno"
          />
          <Level
            h="h-29"
            className="bg-surface-3 shadow-float"
            title="Nível 3"
            sub="Flutua: sombra"
          />
        </div>
      </Section>

      <Section title="Botões" lede="Um amarelo por tela. Ele afunda como tecla quando você aperta.">
        <Button label="Confirmar presença" block />
        <Button label="Salvando" size={48} block loading />
        <div className="flex gap-3">
          <Button variant="secondary" label="Ver times" className="flex-1" />
          <Button variant="outline" icon="redo" label="Sortear" className="flex-1" />
        </div>
        <div className="flex gap-3">
          <Button label="Fechada" disabled className="flex-1" size={52} />
          <Button variant="danger" icon="trash" label="Remover" className="flex-1" />
        </div>
        <div className="flex items-center gap-3">
          <IconButton icon="chevronLeft" label="Voltar" />
          <IconButton icon="share" label="Compartilhar" />
          <p className="text-caption text-text-muted">
            Botão de ícone: 44 × 44, com nome para leitor de tela.
          </p>
        </div>
      </Section>

      <Section
        title="Selos e avatares"
        lede="O anel do avatar diz o time. Prêmio é ouro, zoeira é madeira."
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="white" label="Branco" />
          <Badge variant="black" label="Preto" />
          <Badge variant="craque" label="Craque" />
          <Badge variant="flop" label="Perna de Pau" />
          <Badge variant="admin" label="Admin" />
          <Badge label="Zagueiro" />
          <Badge variant="deadline" label="Fecha em 2h" />
        </div>
        <div className="flex flex-wrap items-end gap-3 px-1 pt-2">
          <Caption label="56">
            <Avatar nickname="Ronaldinho" team="white" size={56} />
          </Caption>
          <Caption label="40">
            <Avatar nickname="Zagueirão" team="black" />
          </Caption>
          <Caption label="32">
            <Avatar nickname="Marcão" team="white" size={32} />
          </Caption>
          <Caption label="Goleiro">
            <span className="pr-2 pb-2">
              <Avatar nickname="Diogo" team="white" goalkeeper />
            </span>
          </Caption>
          <Caption label="Grupo">
            <span className="flex gap-1">
              <Avatar nickname="Ronaldinho" team="white" size={32} />
              <Avatar nickname="Zagueirão" team="black" size={32} />
              <AvatarMore count={9} />
            </span>
          </Caption>
        </div>
      </Section>

      <Section title="Campos" lede="O que a pessoa digita fica em Inter.">
        <TextField
          label="Apelido"
          defaultValue="Zagueirão"
          hint="É assim que o grupo te vê no ranking. Até 10 letras."
        />
        <TextField
          label="Apelido"
          defaultValue="Ronaldinho"
          error="Esse apelido já está em uso no grupo."
        />
      </Section>

      <Section title="Interruptor" lede="O botão vai para a direita e aparece LIGADO com ✓.">
        <Surface className="flex flex-col">
          <ShowcaseSwitch initial />
          <ShowcaseSwitch initial={false} divider />
        </Surface>
      </Section>

      <Section
        title="Estados"
        lede="Toda tela sabe dizer quando está carregando, quando está vazia e quando falhou."
      >
        <SkeletonList />
        <EmptyState
          title="Nenhuma rodada marcada"
          message="Quando o admin marcar a próxima, ela aparece aqui e você recebe um aviso."
        />
        <ErrorState
          title="Não deu para carregar o ranking"
          message="Parece que a internet caiu. Suas notas estão salvas."
          onRetry={() => undefined}
        />
      </Section>

      <Section
        title="Navegação"
        lede="Redonda, como controle de videogame. A aba ativa vira pílula com o nome."
      >
        <div className="flex flex-col gap-3.5 bg-[linear-gradient(180deg,var(--color-bg)_0%,#07140c_100%)] px-2 pt-6 pb-4.5">
          <TabBarPreview tabs={TABS} />
          <TabBarPreview tabs={TABS} initial={2} />
        </div>
        <p className="text-caption text-text-muted">
          Toque nas abas: a pílula cresce até caber o nome (250 ms). Com “reduzir movimento”, troca
          sem animar.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <PixelText as="h2" size={24} wrap className="pt-1">
          {title}
        </PixelText>
        <p className="max-w-85 text-text-muted">{lede}</p>
      </div>
      {children}
    </section>
  );
}

function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className={`h-10 ${className}`} />
      <p className="text-caption text-text-muted">{label}</p>
    </div>
  );
}

function Row({ sample, label }: { sample: ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      {sample}
      <p className="text-right text-caption whitespace-nowrap text-text-muted">{label}</p>
    </div>
  );
}

function Level({
  h,
  className,
  title,
  sub,
}: {
  h: string;
  className: string;
  title: string;
  sub: string;
}) {
  return (
    <div className={`flex flex-1 flex-col justify-end gap-0.5 p-3 ${h} ${className}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-caption text-text-muted">{sub}</p>
    </div>
  );
}

function Caption({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {children}
      <p className="text-caption text-text-muted">{label}</p>
    </div>
  );
}

function ShowcaseSwitch({ initial, divider }: { initial: boolean; divider?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <Switch
      label="Avisos"
      checked={on}
      onCheckedChange={setOn}
      className={divider ? 'shadow-[inset_0_2px_0_0_var(--color-border)]' : undefined}
    />
  );
}
