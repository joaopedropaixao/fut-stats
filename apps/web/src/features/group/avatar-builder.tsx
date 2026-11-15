import {
  AVATAR_HAIR_COLOR_LABELS,
  AVATAR_HAIR_LABELS,
  AVATAR_SKIN_LABELS,
  type PlayerAvatar,
} from '@fut-stats/shared';
import { useId, useState, type ReactNode } from 'react';
import { FaceDisc } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { HAIR_SHADE_VAR, HAIR_VAR, SKIN_VAR } from '../../components/ui/pixel-sprite-maps';
import { PixelText } from '../../components/ui/pixel-text';
import { Turf } from '../../components/ui/turf';
import { AVATAR_HAIR_COLORS, AVATAR_HAIRS, AVATAR_SKINS, randomAvatar } from '../../lib/avatar';
import { cn } from '../../lib/cn';

/** O dado pixel do "Sortear" (9 x 9, cinco pontos). */
const DICE = [
  '#########',
  '#.......#',
  '#.#...#.#',
  '#.......#',
  '#...#...#',
  '#.......#',
  '#.#...#.#',
  '#.......#',
  '#########',
];
const DICE_PATH = DICE.flatMap((row, y) =>
  [...row].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : '')),
).join('');

function PixelDice() {
  return (
    <svg
      aria-hidden
      width={18}
      height={18}
      viewBox="0 0 9 9"
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      <path d={DICE_PATH} fill="currentColor" />
    </svg>
  );
}

/**
 * A amostra da cor do cabelo (32 x 32 dentro dos 48 x 48): os dois tons, base em cima e sombra embaixo, com o
 * contorno de 2 px: do jeito que o cabelo fica no boneco.
 */
function HairSwatch({ color }: { color: PlayerAvatar['hairColor'] }) {
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(to bottom, ${HAIR_VAR[color]} 0 20px, ${HAIR_SHADE_VAR[color]} 20px 100%)`,
      }}
      className="size-8 shadow-[inset_0_0_0_2px_var(--color-outline)]"
    />
  );
}

type AvatarBuilderProps = {
  value: PlayerAvatar;
  onChange: (avatar: PlayerAvatar) => void;
  /** O que está digitado no apelido: aparece embaixo do boneco (vazio = "SEU APELIDO"). */
  nickname: string;
};

/**
 * "Monte seu boneco": o bonequinho de corpo inteiro numa nesga de gramado e três fileiras de opções (pele, cabelo,
 * cor do cabelo). Card de grande momento (contorno grosso, sombra dura, entrada em degraus). A opção escolhida
 * ganha contorno grosso e ✓; as fileiras são rádios nativos (as setas trocam). Ao trocar, o boneco dá um
 * pulinho em degraus (sem ele, com "reduzir movimento"). "Careca" não tem cor.
 */
export function AvatarBuilder({ value, onChange, nickname }: AvatarBuilderProps) {
  const id = useId();
  // A cada troca o boneco remonta e dá o pulinho; a primeira exibição fica parada
  const [hops, setHops] = useState(0);
  const bald = value.hair === 'BALD';
  const shown = nickname.trim();

  function change(next: PlayerAvatar) {
    setHops((n) => n + 1);
    onChange(next);
  }

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="moment-frame animate-moment-in flex flex-col gap-4 bg-surface-raised p-3"
    >
      <h3 id={`${id}-titulo`} className="px-1 pt-1">
        <PixelText>Monte seu boneco</PixelText>
      </h3>

      <Turf aria-hidden className="flex flex-col items-center gap-3 px-3 pt-6 pb-4">
        <span key={hops} className={cn('relative inline-flex', hops > 0 && 'animate-block-hop')}>
          <PixelBodyLarge team={null} avatar={value} scale={4} />
        </span>
        <PixelText size={24} className={cn('relative', shown ? 'text-text' : 'text-text-muted')}>
          {shown || 'Seu apelido'}
        </PixelText>
      </Turf>
      <p aria-live="polite" className="sr-only">
        {`Seu boneco: ${AVATAR_SKIN_LABELS[value.skin]}, cabelo ${AVATAR_HAIR_LABELS[value.hair].toLowerCase()}${
          bald ? '' : `, ${AVATAR_HAIR_COLOR_LABELS[value.hairColor].toLowerCase()}`
        }`}
      </p>

      <OptionRow
        legend="Pele"
        options={AVATAR_SKINS}
        value={value.skin}
        labelOf={(skin) => AVATAR_SKIN_LABELS[skin]}
        onChange={(skin) => change({ ...value, skin })}
        render={(skin) => (
          <span
            style={{ backgroundColor: SKIN_VAR[skin] }}
            className="size-8 shadow-[inset_0_0_0_2px_var(--color-outline)]"
          />
        )}
      />
      <OptionRow
        legend="Cabelo"
        options={AVATAR_HAIRS}
        value={value.hair}
        labelOf={(hair) => AVATAR_HAIR_LABELS[hair]}
        onChange={(hair) => change({ ...value, hair })}
        render={(hair) => <FaceDisc avatar={{ ...value, hair }} team={null} size={40} />}
      />
      <OptionRow
        legend="Cor do cabelo"
        options={AVATAR_HAIR_COLORS}
        value={value.hairColor}
        labelOf={(color) => AVATAR_HAIR_COLOR_LABELS[color]}
        onChange={(hairColor) => change({ ...value, hairColor })}
        disabled={bald}
        note={bald ? 'Careca não tem cor' : undefined}
        render={(color) => <HairSwatch color={color} />}
      />

      <Button
        variant="outline"
        size={48}
        label="Sortear"
        mark={<PixelDice />}
        block
        onClick={() => change(randomAvatar(value))}
      />
    </section>
  );
}

type OptionRowProps<T extends string> = {
  legend: string;
  options: readonly T[];
  value: T;
  labelOf: (option: T) => string;
  onChange: (option: T) => void;
  render: (option: T) => ReactNode;
  disabled?: boolean;
  /** Por que a fileira está travada (texto, não só o apagado). */
  note?: string;
};

/** Uma fileira de opções 48 x 48 (quebra em duas linhas quando não cabe, nunca rola). Rádio nativo: as setas trocam. */
function OptionRow<T extends string>({
  legend,
  options,
  value,
  labelOf,
  onChange,
  render,
  disabled,
  note,
}: OptionRowProps<T>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 px-1">
      <div className="flex items-center justify-between gap-2">
        <PixelText id={`${id}-legenda`} className="text-text-muted">
          {legend}
        </PixelText>
        {note && (
          <span className="flex items-center gap-1 text-caption text-text-muted">
            <Icon name="lock" size={14} />
            {note}
          </span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-legenda`}
        aria-disabled={disabled || undefined}
        className="flex flex-wrap gap-1.5"
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <label
              key={option}
              className={cn(
                'relative flex size-12 items-center justify-center',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-text',
                disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer active:bg-highlight',
                selected
                  ? 'bg-highlight shadow-[inset_0_0_0_3px_var(--color-border-strong)]'
                  : 'shadow-[inset_0_0_0_2px_var(--color-border)]',
              )}
            >
              <input
                type="radio"
                name={id}
                value={option}
                checked={selected}
                disabled={disabled}
                aria-label={labelOf(option)}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              {render(option)}
              {selected && (
                <span
                  aria-hidden
                  className="absolute top-0 right-0 inline-flex size-4 items-center justify-center bg-text text-bg"
                >
                  <Icon name="check" size={12} strokeWidth={3.4} />
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
