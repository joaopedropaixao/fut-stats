import { useState } from 'react';
import { Spinner } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';

type GenerateBlockProps = {
  /** Já tem alguém no rascunho: o bloco vira "Regerar". */
  regenerate: boolean;
  loading: boolean;
  onGenerate: () => void;
};

/**
 * Bloco "?" estilo Mario: toca, ele pula e solta os times. Tons de madeira (o amarelo é do Publicar),
 * canto reto, contorno duro, 64px de altura. O pulo é em degraus; com Reduzir movimento o CSS global zera.
 */
export function GenerateBlock({ regenerate, loading, onGenerate }: GenerateBlockProps) {
  const [hops, setHops] = useState(0);

  function press() {
    if (loading) return;
    setHops((n) => n + 1);
    onGenerate();
  }

  return (
    <button
      type="button"
      disabled={loading}
      aria-busy={loading}
      onClick={press}
      className={cn(
        'flex h-16 w-full items-center justify-center gap-4 px-4 select-none',
        'transition-[translate,box-shadow] duration-(--duration-fast) ease-out',
        loading
          ? 'bg-surface text-disabled shadow-none'
          : 'bg-flop text-on-accent shadow-key active:translate-x-1 active:translate-y-1 active:shadow-key-pressed',
      )}
    >
      <span
        // A key nova reinicia a animação a cada toque
        key={hops}
        aria-hidden
        className={cn(
          'flex size-12 shrink-0 items-center justify-center bg-[#8a6a3f] text-text shadow-[inset_0_0_0_3px_#000]',
          hops > 0 && 'animate-block-hop',
        )}
      >
        {loading ? <Spinner /> : <PixelText size={32}>?</PixelText>}
      </span>
      <PixelText>{loading ? 'Gerando' : regenerate ? 'Regerar' : 'Gerar times'}</PixelText>
    </button>
  );
}
