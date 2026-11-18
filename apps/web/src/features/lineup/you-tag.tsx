import { PixelText } from '../../components/ui/pixel-text';

/** Anel mais forte do próprio avatar nos times publicados (o creme do "na mão", em 4px e com vão). */
export const YOU_RING = 'shadow-[inset_0_0_0_4px_var(--color-text)]';

/** Etiqueta "VOCÊ" sob o nome de quem está vendo: texto e forma cheia, nunca só cor. */
export function YouTag() {
  return (
    <span className="inline-flex h-5 items-center bg-text px-1.5 text-team-black">
      <PixelText>Você</PixelText>
    </span>
  );
}
