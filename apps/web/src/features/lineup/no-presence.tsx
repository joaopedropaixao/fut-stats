import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';

/** Marca de escalado que não confirmou presença: texto e ícone, nunca só cor. */
export function NoPresence({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-start gap-1 text-warning ${className ?? ''}`}>
      <Icon name="alert" size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" />
      <PixelText wrap>Sem presença</PixelText>
    </span>
  );
}
