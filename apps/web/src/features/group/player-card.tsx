import { POSITION_LABELS, type Member } from '@fut-stats/shared';
import { Badge } from '../../components/ui/badge';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { PixelText } from '../../components/ui/pixel-text';
import { Turf } from '../../components/ui/turf';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { Ordinal } from '../ranking/ordinal';
import { formatAverage } from '../ranking/ranking-text';
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
            {isAdmin && <Badge label="Admin" variant="admin" />}
          </span>
        )}
      </Turf>
      <div className="flex flex-col gap-2 p-4">
        <PixelText as={heading} size={24} wrap className="outline-none">
          {nickname}
        </PixelText>
        <PixelText className="text-text-muted">{POSITION_LABELS[position]}</PixelText>
        {secondaryPositions.length > 0 && (
          <p className="text-sm text-text-muted">{`Também joga de ${listPositions(secondaryPositions)}`}</p>
        )}
      </div>
      {ranking && <RankingStrip rank={ranking.rank} average={ranking.average} />}
    </section>
  );
}

/**
 * A faixa de baixo da figurinha: a posição no ranking e a média, em dígitos pixel. Ouro só para o líder; sem posição
 * (poucos jogos), o texto diz por quê.
 */
function RankingStrip({ rank, average }: { rank: number | null; average: number | null }) {
  const leader = rank === 1;
  const tone = leader ? 'text-gold' : 'text-text';
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
              <PixelDigits value={rank} scale={4} label={`${rank}º no ranking`} className={tone} />
              <Ordinal scale={2} className={`mt-0.5 ${tone}`} />
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
