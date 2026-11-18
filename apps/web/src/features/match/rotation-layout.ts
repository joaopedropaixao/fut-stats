export type RotationLayoutRect = { top: number; bottom: number };

export type RotationLayoutMeasurement = {
  width: number;
  navigationTop: number;
  contentTop: number;
  contentBottom: number;
  contentOverflowY: string;
  enter: RotationLayoutRect;
  leave: RotationLayoutRect;
  footer: RotationLayoutRect;
  nicknames: { value: string; rect: RotationLayoutRect }[];
};

export function rotationLayoutFailures(measurement: RotationLayoutMeasurement): string[] {
  const failures: string[] = [];
  if (!['auto', 'scroll'].includes(measurement.contentOverflowY)) {
    failures.push(`${measurement.width}px: conteúdo não rola em área reservada`);
  }
  if (measurement.contentBottom > measurement.navigationTop - 8) {
    failures.push(`${measurement.width}px: conteúdo cruza a navegação`);
  }

  for (const [label, rect] of [
    ['▲ ENTRA', measurement.enter],
    ['▼ SAI', measurement.leave],
    ['JOGO / DE', measurement.footer],
  ] as const) {
    if (
      rect.top < measurement.contentTop ||
      rect.bottom > measurement.contentBottom ||
      rect.bottom > measurement.navigationTop - 8
    ) {
      failures.push(
        `${measurement.width}px ${label}: ${rect.top.toFixed(1)}–${rect.bottom.toFixed(1)} fora da área visível ou cruza a navegação em ${measurement.navigationTop.toFixed(1)}px`,
      );
    }
  }
  for (const nickname of measurement.nicknames) {
    if (
      nickname.rect.top < measurement.contentTop ||
      nickname.rect.bottom > measurement.contentBottom ||
      nickname.rect.bottom > measurement.navigationTop - 8
    ) {
      failures.push(
        `${measurement.width}px ${nickname.value}: ${nickname.rect.top.toFixed(1)}–${nickname.rect.bottom.toFixed(1)} fora da área visível ou cruza a navegação em ${measurement.navigationTop.toFixed(1)}px`,
      );
    }
  }
  return failures;
}
