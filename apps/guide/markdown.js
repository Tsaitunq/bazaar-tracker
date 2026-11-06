// Markdown-light for the guide notes: headings, lists, bold, italic, code, simple tables. Everything is escaped first; HTML comments are dropped.
import { esc } from '../../shared/format.js';

const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isRule = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part';

// The headings of level 2 and 3, for the contents: { id, text, level }. Ids are the same as in the html.
export function outline(md) {
  const seen = new Map();
  const out = [];
  for (const line of String(md ?? '').replace(/<!--[^]*?-->/g, '').split('\n')) {
    const m = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const base = `info-${slug(m[2])}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    if (m[1].length === 2 || m[1].length === 3) out.push({ id: n ? `${base}-${n + 1}` : base, text: m[2], level: m[1].length });
  }
  return out;
}

export function markdown(md) {
  const lines = String(md ?? '').replace(/<!--[^]*?-->/g, '').split('\n');
  const seen = new Map();
  const html = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (h) {
      const base = `info-${slug(h[2])}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      html.push(`<h${h[1].length + 2} id="${n ? `${base}-${n + 1}` : base}">${inline(h[2])}</h${h[1].length + 2}>`);
    } else if (/^\s*\|/.test(line) && isRule(lines[i + 1] ?? '')) {
      const head = cells(line);
      const rows = [];
      for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(cells(lines[i]));
      i--;
      html.push(`<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const tag = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
      const items = [];
      for (; i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++) items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      i--;
      html.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
    } else if (line.trim()) {
      const para = [];
      for (; i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*([-*]|\d+\.)\s+|\s*\|)/.test(lines[i]); i++) para.push(lines[i].trim());
      i--;
      html.push(`<p>${inline(para.join(' '))}</p>`);
    }
  }
  return html.join('');
}
