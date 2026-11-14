import { SkeletonList } from '../components/ui/states';
import { ShellFrame } from './shell';

/** Esqueleto da primeira carga (o pedaço da tela ainda vem da rede): dentro da moldura do app, com as abas. */
export function RouteFallback() {
  return (
    <ShellFrame showTabs>
      <SkeletonList rows={3} />
    </ShellFrame>
  );
}
