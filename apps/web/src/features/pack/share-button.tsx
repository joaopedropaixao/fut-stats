import { useState } from 'react';
import { Button } from '../../components/ui/button';
import type { PackCard } from './deck';
import { shareFileName, shareText } from './pack-text';
import { shareCard } from './share';

type ShareButtonProps = {
  card: PackCard;
  roundNumber: number;
  block?: boolean;
  className?: string;
};

/**
 * "Compartilhar" a carta do Craque ou a sua: a imagem (canvas PNG 1080 x 1350, gerada só na hora, em outro
 * pedaço de JS) e o texto vão para o compartilhamento do sistema; sem ele, o WhatsApp. Cancelar não faz nada.
 */
export function ShareButton({ card, roundNumber, block, className }: ShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = card.kind === 'mine' ? 'Compartilhar minha carta' : 'Compartilhar';

  const share = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await shareCard(
        shareText(card, roundNumber),
        async () => {
          const { renderCardPng } = await import('./share-card');
          const blob = await renderCardPng(card, roundNumber);
          return new File([blob], shareFileName(card, roundNumber), { type: 'image/png' });
        },
        { nav: navigator, open: (url) => void window.open(url, '_blank', 'noopener') },
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <Button
        label={label}
        icon="share"
        variant="outline"
        size={48}
        block={block}
        loading={busy}
        onClick={() => void share()}
      />
      {failed && (
        <p role="alert" className="pt-2 text-sm text-danger">
          Não deu para compartilhar. Tente de novo.
        </p>
      )}
    </div>
  );
}
