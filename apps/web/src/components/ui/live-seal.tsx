import { PixelText } from './pixel-text';

/** Selo "AO VIVO": vermelho chapado, pisca em degraus (parado com "reduzir movimento"). O texto diz o que é. */
export function LiveSeal() {
  return (
    <span className="animate-live-blink inline-flex h-8 shrink-0 items-center bg-danger px-2.5 text-black shadow-[inset_0_0_0_2px_#000] motion-reduce:animate-none">
      <PixelText>Ao vivo</PixelText>
    </span>
  );
}
