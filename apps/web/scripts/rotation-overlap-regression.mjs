/* eslint-disable @typescript-eslint/no-unused-vars */
async function rotationOverlapRegression(page) {
  const widths = [320, 375, 390, 430, 1280];
  const failures = [];
  const results = [];

  if (!/\/rodadas\/[^/]+\/jogo$/.test(page.url())) {
    throw new Error(`Abra uma tela de jogo real antes de rodar C29/C43: ${page.url()}`);
  }

  await page.locator('section[aria-label="Rodízio"]').waitFor();

  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));

    for (const team of ['WHITE', 'BLACK']) {
      await page.locator(`[role="radio"][data-team="${team}"]`).click();
      await page.waitForTimeout(50);

      const measurement = await page.evaluate(() => {
        const card = document.querySelector('section[aria-label="Rodízio"]');
        const navigation = document.querySelector('nav[aria-label="Principal"]');
        if (!card || !navigation) throw new Error('Rodízio ou navegação inferior ausente');

        const navigationTop = navigation.getBoundingClientRect().top;
        const blocks = ['▲ ENTRA', '▼ SAI'].map((label) => {
          const heading = [...card.querySelectorAll('span')].find(
            (element) => element.textContent?.trim() === label,
          );
          const block = heading?.parentElement;
          if (!block) throw new Error(`Bloco ${label} ausente`);
          return {
            label,
            top: block.getBoundingClientRect().top,
            bottom: block.getBoundingClientRect().bottom,
          };
        });

        const nicknames = ['LUQUINHA', 'FELIPINHO'].map((nickname) => {
          const element = [...card.querySelectorAll('span')].find(
            (candidate) => candidate.textContent?.trim().toUpperCase() === nickname,
          );
          if (!element) return { nickname, present: false };
          const rect = element.getBoundingClientRect();
          return { nickname, present: true, top: rect.top, bottom: rect.bottom };
        });

        return {
          width: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          navigationTop,
          blocks,
          nicknames,
        };
      });

      results.push({ team, ...measurement });
      for (const block of measurement.blocks) {
        if (block.bottom > measurement.navigationTop - 8) {
          failures.push(
            `${width}px ${block.label}: bloco termina em ${Math.round(block.bottom)}px, barra começa em ${Math.round(measurement.navigationTop)}px`,
          );
        }
      }
      if (measurement.scrollWidth > width) {
        failures.push(`${width}px: rolagem horizontal de ${measurement.scrollWidth}px`);
      }
      for (const nickname of measurement.nicknames) {
        if (!nickname.present) continue;
        if (nickname.bottom > measurement.navigationTop - 8) {
          failures.push(
            `${width}px ${team} ${nickname.nickname}: apelido termina em ${Math.round(nickname.bottom)}px, barra começa em ${Math.round(measurement.navigationTop)}px`,
          );
        }
      }
    }
  }

  if (failures.length) throw new Error(`Regressão C29/C43:\n${failures.join('\n')}`);
  return results;
}
