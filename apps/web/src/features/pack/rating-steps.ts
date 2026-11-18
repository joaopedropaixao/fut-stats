/**
 * Os degraus da nota no walkout: a nota sobe em degraus até o valor final (uma casa, como o resto do app).
 * Sempre crescente, sem repetir, e o último degrau é a nota. `count` é o número de degraus.
 */
export function ratingSteps(target: number, count = 5): number[] {
  const end = Math.round(target * 10) / 10;
  const steps: number[] = [];
  for (let i = 1; i <= count; i += 1) {
    const value = i === count ? end : Math.round(((end * i) / count) * 10) / 10;
    if (steps.length === 0 || value > steps[steps.length - 1]!) steps.push(value);
  }
  if (steps[steps.length - 1] !== end) steps.push(end);
  return steps;
}
