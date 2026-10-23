import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '../../lib/cn';
import { Icon, type IconName } from './icons';
import { PixelText } from './pixel-text';

export type Tab = { to: string; label: string; icon: IconName };

/**
 * Barra de abas: a exceção ao canto reto (raio 20, flutua sob o polegar).
 * Só a aba ativa mostra o nome, numa pílula de raio 14 que cresce até caber o nome (250 ms, ease-out);
 * as outras são só ícone, com o nome para leitor de tela.
 */
export function TabBar({ tabs }: { tabs: readonly Tab[] }) {
  return (
    <Frame>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => tabClasses(isActive)}
        >
          {({ isActive }) => <TabContent tab={tab} active={isActive} />}
        </NavLink>
      ))}
    </Frame>
  );
}

/** A mesma barra, sem navegar: para a vitrine de componentes. */
export function TabBarPreview({ tabs, initial = 0 }: { tabs: readonly Tab[]; initial?: number }) {
  const [active, setActive] = useState(initial);
  return (
    <Frame label="Prévia da navegação">
      {tabs.map((tab, i) => (
        <button
          key={tab.to}
          type="button"
          aria-current={i === active ? 'page' : undefined}
          onClick={() => setActive(i)}
          className={tabClasses(i === active)}
        >
          <TabContent tab={tab} active={i === active} />
        </button>
      ))}
    </Frame>
  );
}

function Frame({ children, label = 'Principal' }: { children: ReactNode; label?: string }) {
  return (
    <nav aria-label={label} className="flex gap-0.5 rounded-nav bg-surface p-1.5 shadow-float">
      {children}
    </nav>
  );
}

function tabClasses(active: boolean) {
  return cn(
    'flex h-12 min-w-11 items-center justify-center rounded-nav-pill',
    'transition-[background-color] duration-(--duration-normal) ease-out',
    active ? 'shrink-0 bg-text/12 px-3.5 text-text' : 'flex-1 text-text-muted',
  );
}

function TabContent({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <>
      <Icon name={tab.icon} size={24} filled={active} strokeLinejoin="round" />
      <span
        className={cn(
          'overflow-hidden transition-[max-width,margin] duration-(--duration-normal) ease-out',
          active ? 'ml-2 max-w-40' : 'sr-only max-w-0',
        )}
      >
        <PixelText>{tab.label}</PixelText>
      </span>
    </>
  );
}
