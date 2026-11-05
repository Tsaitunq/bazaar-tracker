const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const stamp = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const when = (tMin) => stamp.format(new Date(tMin * 60000));

const PAD = { left: 8, right: 8, top: 14, bottom: 22 };
const GRID_LINES = 4;

// Index of the time closest to t; times are ascending.
export function nearestIndex(times, t) {
  let best = 0;
  for (let i = 1; i < times.length; i++) {
    if (Math.abs(times[i] - t) < Math.abs(times[best] - t)) best = i;
  }
  return best;
}

// What the pointer at `fraction` of the chart's width points at.
// meta is the object stored in the chart's data-chart attribute.
export function chartHit(meta, fraction) {
  const w = meta.width - PAD.left - PAD.right;
  const pos = Math.min(1, Math.max(0, (fraction * meta.width - PAD.left) / w));
  const t = meta.x0 + pos * (meta.x1 - meta.x0);
  const first = meta.series.find((s) => s.points.length);
  const time = first.points[nearestIndex(first.points.map((p) => p[0]), t)][0];
  const x = PAD.left + (meta.x1 > meta.x0 ? ((time - meta.x0) / (meta.x1 - meta.x0)) * w : w / 2);
  return {
    x,
    time,
    values: meta.series.filter((s) => s.points.length)
      .map((s) => ({ label: s.label, value: s.points[nearestIndex(s.points.map((p) => p[0]), time)][1] })),
  };
}

// All series share both axes. x values are unix minutes.
// series: [{ label, cls, points: [t, value][] }]; kind names the value format for the hover readout.
export function lineChart(series, { width = 340, height = 160, format = String, kind = '' } = {}) {
  const all = series.flatMap((s) => s.points);
  if (!all.length) return '';
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  // a zero span (single point, constant values) is drawn in the middle
  const px = (t) => PAD.left + (x1 > x0 ? ((t - x0) / (x1 - x0)) * w : w / 2);
  const py = (v) => PAD.top + (y1 > y0 ? (1 - (v - y0) / (y1 - y0)) * h : h / 2);

  const grid = (y1 > y0 ? Array.from({ length: GRID_LINES }, (_, i) => y0 + ((y1 - y0) * i) / (GRID_LINES - 1)) : [y0])
    .map((v) => `<line class="grid" x1="${PAD.left}" y1="${py(v).toFixed(1)}" x2="${PAD.left + w}" y2="${py(v).toFixed(1)}"/>`
      + `<text x="${PAD.left + 4}" y="${(py(v) - 3).toFixed(1)}">${esc(format(v))}</text>`).join('');
  const lines = series.filter((s) => s.points.length).map((s) => {
    const pts = s.points.map(([t, v]) => `${px(t).toFixed(1)},${py(v).toFixed(1)}`);
    const dot = s.points.length === 1 ? `<circle class="${esc(s.cls)}" cx="${pts[0].split(',')[0]}" cy="${pts[0].split(',')[1]}" r="3"/>` : '';
    return `<polyline class="${esc(s.cls)}" fill="none" points="${pts.join(' ')}"/>${dot}`;
  }).join('');
  const meta = { width, x0, x1, series: series.map((s) => ({ label: s.label, points: s.points })) };

  return `<figure class="chart-box" data-kind="${esc(kind)}" data-chart="${esc(JSON.stringify(meta))}">`
    + '<p class="readout">Tap or hover the chart for values</p>'
    + `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="${esc(series.map((s) => s.label).join(' and '))} over time">`
    + grid + lines
    + `<line class="cursor" x1="0" y1="${PAD.top}" x2="0" y2="${PAD.top + h}" visibility="hidden"/>`
    + `<text x="${PAD.left}" y="${height - 6}">${esc(when(x0))}</text>`
    + `<text x="${width - PAD.right}" y="${height - 6}" text-anchor="end">${esc(when(x1))}</text>`
    + '</svg></figure>';
}
