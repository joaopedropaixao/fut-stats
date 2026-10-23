import { PixelText } from '../../components/ui/pixel-text';

/** Bolinha neutra com as iniciais (2 primeiras letras do apelido): quem ainda não tem time não tem anel. */
export function Initials({ nickname, size = 40 }: { nickname: string; size?: 32 | 40 }) {
  return (
    <span
      aria-hidden
      className={`inline-flex ${size === 32 ? 'size-8' : 'size-10'} shrink-0 items-center justify-center rounded-full bg-surface-3 pl-0.5 shadow-card`}
    >
      <PixelText>{[...nickname.trim()].slice(0, 2).join('')}</PixelText>
    </span>
  );
}
