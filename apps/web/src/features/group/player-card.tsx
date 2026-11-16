import { cardTier, POSITION_LABELS, type Member } from '@fut-stats/shared';
import { Badge } from '../../components/ui/badge';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { PixelText } from '../../components/ui/pixel-text';
import { Turf } from '../../components/ui/turf';
import { TIER_LABELS } from '../pack/tier';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { cn } from '../../lib/cn';
import { Medal } from '../ranking/medal';
import { Ordinal } from '../ranking/ordinal';
import { PODIUM_TEXT, podiumLabel, podiumTier } from '../ranking/podium';
import { formatAverage, roundAverage } from '../ranking/ranking-text';
import { YouTag } from '../lineup/you-tag';

type PlayerCardProps = {
  nickname: string;
  avatar: Member['avatar'];
  position: Member['primaryPosition'];
  secondaryPositions?: Member['secondaryPositions'];
  isAdmin: boolean;
  /** É a figurinha de quem está vendo: ganha a etiqueta "VOCÊ". */
  mine?: boolean;
  /** Posição no ranking geral (`null` = poucos jogos) e média: quando vêm, a figurinha mostra o placar do jogador. */
  ranking?: { rank: number | null; average: number | null };
  /** Nível do apelido: a tela do jogador o tem como título (h1); no Perfil o título é "Perfil". */
  heading?: 'h1' | 'h2';
};

/** "Ala", "Ala e Meia", "Ala, Meia e Atacante". */
function listPositions(positions: readonly Member['primaryPosition'][]): string {
  const names = positions.map((position) => POSITION_LABELS[position]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names.at(-1)}` : (names[0] ?? '');
}

/**
 * A figurinha do jogador (folha: Figurinhas › Figurinha/Jogador): o bonequinho de corpo inteiro num pedaço
 * de gramado, o apelido, a posição por extenso e os selos. Card de grande momento: contorno de 3 px, sombra
 * dura e entrada em degraus; o boneco dá um pulinho quando o card assenta.
 */
export function PlayerCard({
  nickname,
  avatar,
  position,
  secondaryPositions = [],
  isAdmin,
  mine,
  ranking,
  heading = 'h2',
}: PlayerCardProps) {
  // A moldura (faixa da nota) é só de quem está no ranking: com "Poucos jogos" a média é de 1 ou 2 notas.
  // A faixa vale para a média como aparece na tela (1 casa): 7,96 mostra "8,0" e é ouro.
  const tier =
    ranking && ranking.rank !== null && ranking.average !== null
      ? cardTier(roundAverage(ranking.average))
      : undefined;
  // Dentro da moldura a tinta vem da faixa (`--card-ink`); sem ela, as cores de sempre
  const ink = tier ? 'text-(--card-ink)' : undefined;
  const ink2 = tier ? 'text-(--card-ink-2)' : 'text-text-muted';
  return (
    <section
      aria-label={`Figurinha de ${nickname}`}
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
    >
      <Turf className="flex h-52 items-end justify-center pb-6">
        <span
          style={{ animationDelay: '320ms' }}
          className="animate-block-hop relative inline-flex"
        >
          <PixelBodyLarge team={null} avatar={avatar} scale={4} />
        </span>
        {(mine || isAdmin) && (
          <span className="absolute top-3 right-3 left-3 flex flex-wrap items-start justify-between gap-2">
            {mine ? <YouTag /> : <span />}
            {isAdmin && <Badge label="Admin" variant="neutral" className="bg-surface-raised" />}
          </span>
        )}
      </Turf>
      <div data-tier={tier} className={cn('flex flex-col gap-2 p-4', tier && 'card-frame')}>
        <PixelText as={heading} size={24} wrap className={cn(ink, 'outline-none')}>
          {nickname}
        </PixelText>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <PixelText className={ink2}>{POSITION_LABELS[position]}</PixelText>
          {tier && <PixelText className={ink2}>{TIER_LABELS[tier]}</PixelText>}
        </div>
        {secondaryPositions.length > 0 && (
          <p
            className={cn('text-sm', ink2)}
          >{`Também joga de ${listPositions(secondaryPositions)}`}</p>
        )}
      </div>
      {ranking && <RankingStrip rank={ranking.rank} average={ranking.average} />}
    </section>
  );
}

/**
 * A faixa de baixo da figurinha: a posição no ranking e a média, em dígitos pixel. Pódio (ouro, prata e bronze) com a medalha ao lado; sem posição
 * (poucos jogos), o texto diz por quê.
 */
function RankingStrip({ rank, average }: { rank: number | null; average: number | null }) {
  const tier = podiumTier(rank);
  const tone = tier ? PODIUM_TEXT[tier] : 'text-text';
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-3 shadow-[inset_0_3px_0_0_var(--color-border-strong)]">
      <div className="flex flex-col gap-1.5">
        <dt>
          <PixelText className="text-text-muted">Ranking</PixelText>
        </dt>
        <dd className="m-0 flex h-9 items-start gap-1">
          {rank === null ? (
            <PixelText wrap>Poucos jogos</PixelText>
          ) : (
            <>
              <PixelDigits
                value={rank}
                scale={4}
                label={podiumLabel(rank) ?? `${rank}º no ranking`}
                className={tone}
              />
              <Ordinal scale={2} className={`mt-0.5 ${tone}`} />
              {tier && <Medal tier={tier} scale={3} className="ml-1.5 mt-0.5" />}
            </>
          )}
        </dd>
      </div>
      <div className="flex flex-col gap-1.5">
        <dt>
          <PixelText className="text-text-muted">Média</PixelText>
        </dt>
        <dd className="m-0 flex h-9 items-end">
          {average === null ? (
            <span aria-label="Sem média" className="mb-2 h-0.5 w-4 bg-text-muted" />
          ) : (
            <PixelDigits
              value={formatAverage(average)}
              scale={4}
              label={`Média ${formatAverage(average)}`}
              className={tone}
            />
          )}
        </dd>
      </div>
    </dl>
  );
}
