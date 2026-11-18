import type { Tab } from '../components/ui/tab-bar';

/** As 5 abas do app (DS v1.3). O ícone do Histórico é o calendário. */
export const TABS = [
  { to: '/', label: 'Feed', icon: 'feed' },
  { to: '/times', label: 'Times', icon: 'teams' },
  { to: '/ranking', label: 'Ranking', icon: 'ranking' },
  { to: '/historico', label: 'Histórico', icon: 'calendar' },
  { to: '/perfil', label: 'Perfil', icon: 'profile' },
] as const satisfies readonly Tab[];
