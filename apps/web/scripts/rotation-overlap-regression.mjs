/* eslint-disable @typescript-eslint/no-unused-vars */
async function rotationOverlapRegression(page) {
  const widths = [320, 375, 390, 430, 1280];
  const failures = [];
  const results = [];
  const nickname = 'Marcelinho';

  if (!/\/rodadas\/[^/]+\/jogo$/.test(page.url())) {
    throw new Error(`Abra um jogo servido pela API real antes de rodar C29/C43: ${page.url()}`);
  }

  const section = page.locator('section[aria-label="Rodízio"]');
  await section.waitFor();

  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    for (const team of ['BRANCO', 'PRETO']) {
      await page.getByRole('radio', { name: team }).click();
      const main = page.locator('main');
      await main.evaluate((element) => {
        element.scrollTop = 0;
      });
      const navigationTop = await page
        .locator('nav[aria-label="Principal"]')
        .evaluate((element) => element.getBoundingClientRect().top);
      const content = await main.evaluate((element) => ({
        top: element.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom,
        overflowY: getComputedStyle(element).overflowY,
      }));
      const blocks = [];

      for (const label of ['▲ ENTRA', '▼ SAI']) {
        const block = section.getByText(label, { exact: true }).locator('..');
        await block.scrollIntoViewIfNeeded();
        const item = await block.evaluate((element, text) => {
          const heading = element.querySelector('span');
          const name = [...element.querySelectorAll('span')].find((candidate) => {
            const value = candidate.textContent?.trim() ?? '';
            return (
              value &&
              value !== heading?.textContent?.trim() &&
              value !== 'NINGUÉM' &&
              value !== 'VOCÊ'
            );
          });
          let nicknameRect = null;
          if (name) {
            // Mede o caso-limite no span real renderizado pela API e restaura o apelido recebido.
            const original = name.textContent;
            name.textContent = text;
            nicknameRect = name.getBoundingClientRect().toJSON();
            name.textContent = original;
          }
          return { rect: element.getBoundingClientRect().toJSON(), nicknameRect };
        }, nickname);
        blocks.push({ label, ...item });
      }

      const footer = section.getByText('JOGO', { exact: true }).locator('..');
      await footer.scrollIntoViewIfNeeded();
      const footerRect = await footer.evaluate((element) =>
        element.getBoundingClientRect().toJSON(),
      );
      const current = {
        width,
        team,
        scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
        navigationTop,
        contentTop: content.top,
        contentBottom: await main.evaluate((element) => element.getBoundingClientRect().bottom),
        contentOverflowY: content.overflowY,
        enter: blocks.find(({ label }) => label === '▲ ENTRA').rect,
        leave: blocks.find(({ label }) => label === '▼ SAI').rect,
        nicknames: blocks.map(({ nicknameRect }) => ({ value: nickname, rect: nicknameRect })),
        footer: footerRect,
      };

      results.push(current);
      if (current.scrollWidth > width)
        failures.push(`${width}px ${team}: rolagem horizontal ${current.scrollWidth}px`);
      if (blocks.some(({ nicknameRect }) => !nicknameRect)) {
        failures.push(`${width}px ${team}: falta um nome de jogador em ENTRA ou SAI`);
      }
      const layoutFailures = await page.evaluate(async (measurement) => {
        const { rotationLayoutFailures } = await import('/src/features/match/rotation-layout.ts');
        return rotationLayoutFailures(measurement);
      }, current);
      failures.push(...layoutFailures);
    }
  }

  if (failures.length) throw new Error(`Regressão C29/C43:\n${failures.join('\n')}`);
  return results;
}
