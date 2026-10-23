import type { ReactNode, SVGProps } from 'react';

/** Traços dos ícones da folha (viewBox 24, ponta quadrada, canto vivo). A cor vem de `text-*`. */
const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  redo: (
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  share: <path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" />,
  clock: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>
  ),
  // Abas
  feed: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  teams: (
    <>
      <rect x="3" y="4" width="18" height="16" />
      <path d="M12 4v16" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ranking: (
    <path d="M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M8 20h8M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3" />
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Preenche o desenho (aba ativa). */
  filled?: boolean;
};

/** Ícone decorativo: quem dá o nome para leitor de tela é o botão ou o texto ao lado. */
export function Icon({ name, size = 20, strokeWidth = 2, filled, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      className="shrink-0"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Rodinha do botão carregando (fica sobre o amarelo). */
export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0 animate-spin"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="rgb(17 17 17 / 20%)" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
