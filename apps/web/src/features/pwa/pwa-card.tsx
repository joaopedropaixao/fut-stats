import type { CSSProperties, ReactNode } from 'react';
import { useId } from 'react';
import { PixelText } from '../../components/ui/pixel-text';

/**
 * Moldura dos cards "Instale o app" e "Avisos" do Perfil: grande momento (contorno de 3 px, sombra dura, entrada
 * em degraus; parado com "reduzir movimento"), com a faixa do título e o corpo. Nenhuma tecla amarela aqui dentro
 * além da de instalar (a ação do card).
 */
export function PwaCard({
  title,
  mark,
  delay = 0,
  children,
}: {
  title: string;
  /** O desenho em pixel da faixa (ícone do app, sino). */
  mark: ReactNode;
  /** Atraso da entrada em ms (o segundo card entra depois do primeiro). */
  delay?: number;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
      style={{ '--moment-delay': `${delay}ms` } as CSSProperties}
    >
      <div className="flex items-center gap-3 bg-surface-3 px-4 py-3 shadow-[inset_0_-3px_0_0_var(--color-border-strong)]">
        {mark}
        <PixelText as="h2" id={titleId} size={24} wrap className="min-w-0 text-text">
          {title}
        </PixelText>
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </section>
  );
}
