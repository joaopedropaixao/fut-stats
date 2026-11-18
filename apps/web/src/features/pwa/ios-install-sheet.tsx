import { Button } from '../../components/ui/button';
import { Icon, type IconName } from '../../components/ui/icons';
import { Sheet } from '../../components/ui/sheet';

const STEPS: { icon: IconName; text: string }[] = [
  { icon: 'shareUp', text: '1. Toque em Compartilhar' },
  { icon: 'addSquare', text: '2. Adicionar à Tela de Início' },
];

/**
 * No iPhone não há pedido de instalação: o caminho é pelo Compartilhar do Safari. A gaveta mostra os 2 passos com
 * os ícones pixel dos botões que a pessoa vai procurar.
 */
export function IosInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="Instale no iPhone"
      onClose={onClose}
      actions={(close) => <Button label="Entendi" size={48} block onClick={close} />}
    >
      <p>Abra o Fut Stats no Safari e siga os passos.</p>
      <ol className="mt-3 flex flex-col gap-3">
        {STEPS.map((step) => (
          <li
            key={step.icon}
            className="flex min-h-14 items-center gap-3 bg-surface px-3 py-2 shadow-card"
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center bg-surface-3 text-text">
              <Icon name={step.icon} size={28} />
            </span>
            <span className="min-w-0 text-base text-text">{step.text}</span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
