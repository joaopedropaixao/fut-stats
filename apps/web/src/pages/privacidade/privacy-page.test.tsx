import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PRIVACY_SECTIONS, PRIVACY_UPDATED_AT } from './privacy-content';
import { PrivacyPage } from './privacy-page';

describe('PrivacyPage', () => {
  it('C31: mostra o título, a data, todas as seções e o e-mail de contato, sem sessão nem consulta', () => {
    const router = createMemoryRouter([{ path: '/privacidade', element: <PrivacyPage /> }], {
      initialEntries: ['/privacidade'],
    });
    const html = renderToString(<RouterProvider router={router} />);
    expect(html).toContain('<h1');
    expect(html).toContain(PRIVACY_UPDATED_AT);
    for (const section of PRIVACY_SECTIONS) {
      expect(html).toContain(section.title);
    }
    expect(html).toContain('[e-mail de contato do dono]');
    expect(html).toContain('href="/"');
  });
});
