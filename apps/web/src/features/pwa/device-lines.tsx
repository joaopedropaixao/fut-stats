import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { ALERT_LINE_CLASS, alertLineStyle } from '../feed/alert-line-style';
import { dismiss, isDismissed, type DismissTarget } from './dismissal';
import { IosInstallSheet } from './ios-install-sheet';
import { useInstall } from './use-install';
import { usePush } from './use-push';

/**
 * As linhas do aparelho no fim dos avisos do Feed: "Instale o app" e "Ative os avisos". Não são da pelada nem
 * entram na prioridade dos avisos: dependem só deste celular. Visual da `AlertLine`, sem tecla amarela; o "✕"
 * (44 x 44) dispensa por 14 dias.
 */
export function DeviceLines({ firstIndex }: { firstIndex: number }) {
  const { mode, install } = useInstall();
  const push = usePush();
  const [sheetOpen, setSheetOpen] = useState(false);
  // `isDismissed` lê o aparelho uma vez; depois é estado da tela
  const [dismissed, setDismissed] = useState<Record<DismissTarget, boolean>>(() => ({
    install: isDismissed('install'),
    push: isDismissed('push'),
  }));
  const close = (target: DismissTarget) => {
    dismiss(target);
    setDismissed((current) => ({ ...current, [target]: true }));
  };

  const showInstall = (mode === 'prompt' || mode === 'ios') && !dismissed.install;
  const showPush = push.enableLine && !dismissed.push;
  if (!showInstall && !showPush) return null;

  return (
    <>
      <ul aria-label="Avisos deste celular" className="flex flex-col gap-3">
        {showInstall && (
          <li>
            <DeviceLine
              kind="install"
              icon="phone"
              title="Instale o app"
              situation="Abre em tela cheia e avisa do resultado"
              index={firstIndex}
              onDismiss={() => close('install')}
              main={{ onClick: () => (mode === 'ios' ? setSheetOpen(true) : void install()) }}
            />
          </li>
        )}
        {showPush && (
          <li>
            <DeviceLine
              kind="push"
              icon="bell"
              title="Ative os avisos"
              situation="Sai time, votação e resultado"
              index={firstIndex + (showInstall ? 1 : 0)}
              onDismiss={() => close('push')}
              main={{ to: '/perfil' }}
            />
          </li>
        )}
      </ul>
      {sheetOpen && <IosInstallSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}

type DeviceLineProps = {
  kind: DismissTarget;
  icon: IconName;
  title: string;
  situation: string;
  index: number;
  onDismiss: () => void;
  /** Uma tela (seta para o Perfil) ou uma ação (instalar). */
  main: { to: string } | { onClick: () => void };
};

function DeviceLine({ kind, icon, title, situation, index, onDismiss, main }: DeviceLineProps) {
  const content: ReactNode = (
    <>
      <span aria-hidden className="w-2 shrink-0 bg-border-strong" />
      <span className="flex min-w-0 flex-1 items-center gap-3 py-2">
        <span className="inline-flex size-7 shrink-0 items-center justify-center text-text">
          <Icon name={icon} size={24} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
          <PixelText wrap>{title}</PixelText>
          <span className="text-caption text-text-muted">{situation}</span>
        </span>
        {'to' in main && (
          <Icon name="chevronRight" size={20} className="shrink-0 text-text-muted" />
        )}
      </span>
    </>
  );
  const mainClass = 'flex min-w-0 flex-1 items-stretch gap-3 text-left';

  return (
    <div
      data-device-line={kind}
      className={`${ALERT_LINE_CLASS} pr-0`}
      style={alertLineStyle(index)}
    >
      {'to' in main ? (
        <Link to={main.to} aria-label={`${title}, no Perfil`} className={mainClass}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={main.onClick} className={mainClass}>
          {content}
        </button>
      )}
      <button
        type="button"
        aria-label={`Dispensar: ${title}`}
        onClick={onDismiss}
        className="inline-flex size-11 shrink-0 items-center justify-center self-center text-text-muted active:text-text"
      >
        <Icon name="x" size={20} strokeWidth={2.6} />
      </button>
    </div>
  );
}
