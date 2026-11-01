// Text helpers both apps share, free of any view.
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const UNITS = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
// Hypixel style: 1,234.5 below ten thousand, then 350k, 1.2M, 3.4B
export function coins(v) {
  if (!Number.isFinite(v)) return '–';
  if (Math.abs(v) < 9999.95) return plain.format(v || 0); // || 0: no "-0" for a loss on zero units
  // 0.99995: a value that rounds up to 1000 of a unit moves to the next unit (999,950 is 1M, not 1000k)
  const [div, unit] = UNITS.find(([d]) => Math.abs(v) >= d * 0.99995) ?? UNITS[2];
  return plain.format(v / div) + unit;
}
