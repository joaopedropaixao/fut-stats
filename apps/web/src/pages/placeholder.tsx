import { PixelText } from '../components/ui/pixel-text';

/** Rota reservada: a tela entra quando tiver design aprovado no Paper. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <title>{`${title} · Fut Stats`}</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        {title}
      </PixelText>
    </>
  );
}
