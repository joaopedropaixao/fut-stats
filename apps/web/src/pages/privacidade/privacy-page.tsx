import type { CSSProperties } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { LinkButton } from '../../components/ui/button';
import { PRIVACY_SECTIONS, PRIVACY_UPDATED_AT } from './privacy-content';

/**
 * Política de Privacidade. Pública (sem login, fora do AppShell): o Google pede a URL dela para publicar o app.
 * O texto está em `privacy-content.ts`.
 */
export function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col gap-6 px-4 pt-10 pb-10">
      <title>Privacidade · Fut Stats</title>
      <div className="flex flex-col gap-2">
        <PixelText as="h1" size={24} wrap>
          Privacidade
        </PixelText>
        <p className="text-sm text-text-muted">Atualizada em {PRIVACY_UPDATED_AT}</p>
      </div>
      {PRIVACY_SECTIONS.map((section, index) => (
        <section
          key={section.id}
          aria-labelledby={`privacidade-${section.id}`}
          style={{ '--moment-delay': `${index * 60}ms` } as CSSProperties}
          className="moment-frame animate-moment-in flex flex-col gap-3 bg-surface-raised p-4"
        >
          <PixelText as="h2" id={`privacidade-${section.id}`} size={16} wrap>
            {section.title}
          </PixelText>
          {section.paragraphs.map((text) => (
            <p key={text} className="text-base text-text-muted">
              {text}
            </p>
          ))}
          {section.contact && (
            <p className="font-semibold break-words text-text">{section.contact}</p>
          )}
          {section.items && (
            <ul className="flex list-disc flex-col gap-2 pl-5 text-base text-text-muted marker:text-accent">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <LinkButton
        to="/"
        label="Voltar ao app"
        icon="chevronLeft"
        variant="outline"
        size={44}
        block
      />
    </main>
  );
}
