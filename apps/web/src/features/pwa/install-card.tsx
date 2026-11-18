import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { PixelPicture } from '../../components/ui/pixel-picture';
import { APP_ICON_PALETTE, APP_ICON_SPRITE } from '../../components/ui/pixel-sprite-maps';
import { IosInstallSheet } from './ios-install-sheet';
import { PwaCard } from './pwa-card';
import { useInstall } from './use-install';

/** O ícone do app em pixel, no tom do fundo (Gramado) como na tela inicial do celular. */
export function AppIconMark() {
  return (
    <span className="inline-flex size-14 shrink-0 items-center justify-center bg-bg shadow-[inset_0_0_0_2px_var(--color-border-strong)]">
      <PixelPicture map={APP_ICON_SPRITE} palette={APP_ICON_PALETTE} scale={3} />
    </span>
  );
}

/**
 * "Instale o app" (Perfil). Aparece quando dá para instalar daqui (o navegador ofereceu o pedido, ou é iPhone) e
 * some com o app já aberto como instalado. A tecla amarela do Perfil é esta: instalar é a ação do card.
 */
export function InstallCard({ delay = 0 }: { delay?: number }) {
  const { mode, install } = useInstall();
  const [sheetOpen, setSheetOpen] = useState(false);
  if (mode === 'installed' || mode === 'none') return null;

  return (
    <>
      <PwaCard title="Instale o app" mark={<AppIconMark />} delay={delay}>
        <p className="text-base text-text-muted">
          Abre em tela cheia e avisa quando sair time e resultado.
        </p>
        <Button
          label="Instalar"
          icon="phone"
          block
          onClick={() => (mode === 'ios' ? setSheetOpen(true) : void install())}
        />
      </PwaCard>
      {sheetOpen && <IosInstallSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}
