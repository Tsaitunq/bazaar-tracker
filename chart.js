import { esc } from './render.js';

const stamp = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const when = (tMin) => stamp.format(new Date(tMin * 60000));

// All series share both axes. x values are unix minutes.
export function lineChart(series, { width = 340, height = 160, format = String } = {}) {
  const all = series.flatMap((s) => s.points);
  if (!all.length) return '';
  const [padL, padR, padT, padB] = [8, 8, 14, 22];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = width - padL - padR;
  const h = height - padT - padB;
  // a zero span (single point, constant values) is drawn in the middle
  const px = (t) => padL + (x1 > x0 ? ((t - x0) / (x1 - x0)) * w : w / 2);
  const py = (v) => padT + (y1 > y0 ? (1 - (v - y0) / (y1 - y0)) * h : h / 2);
  const lines = series.filter((s) => s.points.length).map((s) => {
    const pts = s.points.map(([t, v]) => `${px(t).toFixed(1)},${py(v).toFixed(1)}`);
    const dot = s.points.length === 1 ? `<circle cx="${px(s.points[0][0]).toFixed(1)}" cy="${py(s.points[0][1]).toFixed(1)}" r="3" style="fill: ${esc(s.color)}"/>` : '';
    return `<polyline fill="none" stroke-width="2" stroke-linejoin="round" points="${pts.join(' ')}" style="stroke: ${esc(s.color)}"/>${dot}`;
  }).join('');
  const text = (x, y, anchor, s) => `<text x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;
  return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img">`
    + `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + h}" class="axis"/><line x1="${padL}" y1="${padT + h}" x2="${padL + w}" y2="${padT + h}" class="axis"/>`
    + lines
    + text(padL + 4, 10, 'start', format(y1)) + text(padL + 4, padT + h - 4, 'start', format(y0))
    + text(padL, height - 6, 'start', when(x0)) + text(width - padR, height - 6, 'end', when(x1))
    + '</svg>';
}
