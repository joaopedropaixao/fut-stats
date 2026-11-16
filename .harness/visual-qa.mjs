// Teste geométrico preliminar: confirmação visual ainda exige scroll, screenshot e hit-test.
function clip(rect, bounds) {
  return {
    left: Math.max(rect.left, bounds.left),
    right: Math.min(rect.right, bounds.right),
    top: Math.max(rect.top, bounds.top),
    bottom: Math.min(rect.bottom, bounds.bottom),
  };
}
export function paintedOverlap(a, b) {
  const visible = ({ rect, clips }) => clips.reduce(clip, rect);
  const x = visible(a),
    y = visible(b);
  const area = clip(x, y);
  return (
    x.left < x.right &&
    x.top < x.bottom &&
    y.left < y.right &&
    y.top < y.bottom &&
    area.left < area.right &&
    area.top < area.bottom
  );
}
