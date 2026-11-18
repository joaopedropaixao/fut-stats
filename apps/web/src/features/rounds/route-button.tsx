import type { ComponentProps, MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { ButtonLink } from '../../components/ui/button';

/** Botão do DS que leva a uma rota do app: é um link de verdade (abrir em outra aba funciona) e navega sem recarregar. */
export function RouteButton({
  to,
  onClick,
  ...rest
}: Omit<ComponentProps<typeof ButtonLink>, 'href'> & { to: string }) {
  const navigate = useNavigate();
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    void navigate(to);
  };
  return <ButtonLink {...rest} href={to} onClick={handleClick} />;
}
