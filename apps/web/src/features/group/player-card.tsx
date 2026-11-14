import { POSITION_LABELS, type Member } from '@fut-stats/shared';
import { Badge } from '../../components/ui/badge';
import { PlayerSprite } from '../../components/ui/pixel-sprite';
import { PixelText } from '../../components/ui/pixel-text';
import { Turf } from '../../components/ui/turf';
import { YouTag } from '../lineup/you-tag';

type PlayerCardProps = {
  nickname: string;
  avatar: Member['avatar'];
  position: Member['primaryPosition'];
  secondaryPositions?: Member['secondaryPositions'];
  isAdmin: boolean;
  /** É a figurinha de quem está vendo: ganha a etiqueta "VOCÊ". */
  mine?: boolean;
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
          <PlayerSprite team={null} avatar={avatar} scale={8} />
        </span>
        {(mine || isAdmin) && (
          <span className="absolute top-3 right-3 left-3 flex flex-wrap items-start justify-between gap-2">
            {mine ? <YouTag /> : <span />}
            {isAdmin && <Badge label="Admin" variant="admin" />}
          </span>
        )}
      </Turf>
      <div className="flex flex-col gap-2 p-4">
        <PixelText as="h2" size={24} wrap className="outline-none">
          {nickname}
        </PixelText>
        <PixelText className="text-text-muted">{POSITION_LABELS[position]}</PixelText>
        {secondaryPositions.length > 0 && (
          <p className="text-sm text-text-muted">{`Também joga de ${listPositions(secondaryPositions)}`}</p>
        )}
      </div>
    </section>
  );
}
