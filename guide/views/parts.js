// The building blocks of the guide app. Every text, value and unit comes in from the model.
import { esc, number } from '../../format.js';

const svgIcon = (d, size) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${d}</svg>`;
const ICONS = {
  mining: '<path d="M4 20l9-9M14 4c3 0 6 3 6 6l-3-1-4-4z M13 11l-2-2"/>',
  blaze: '<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  farming: '<path d="M12 21V10M12 10C12 6 9 4 5 4c0 4 3 6 7 6zM12 13c0-4 3-6 7-6 0 4-3 6-7 6z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
};
export const icon = (name, size = 18) => (ICONS[name] ? svgIcon(ICONS[name], size) : '');

const percent = (share) => `${Math.round(share * 100)}%`;
// r, stroke, gap, text position and size of the two rings of the mockups
const RINGS = { 88: { r: 36, stroke: 9, gap: 12, textY: 50, font: 18 }, 70: { r: 28, stroke: 7, gap: 10, textY: 40, font: 14 } };

export function ring({ chapters, total, size, label = 'Chapter progress', showTotal = true, marks = [] }) {
  const { r, stroke, gap, textY, font } = RINGS[size];
  const mid = size / 2;
  const C = 2 * Math.PI * r;
  const part = C / chapters.length;
  const L = part - gap;
  const circle = (cls, dash, off) => `<circle class="${cls}" cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${dash}" stroke-dashoffset="${off}" transform="rotate(-90 ${mid} ${mid})"></circle>`;
  const arcs = chapters.map((c, i) => {
    const off = (-(i * part) - gap / 2).toFixed(1);
    return circle('arc-track', `${L.toFixed(1)} ${(C - L).toFixed(1)}`, off)
      + circle(`arc-${(i % 3) + 1}`, `${Math.max(0.1, L * c.share).toFixed(1)} ${(C - L * c.share).toFixed(1)}`, off);
  }).join('');
  // a milestone: a small dot on the one arc, light on the track, dark on the filled part
  const dots = marks.map((m) => {
    const angle = ((gap / 2 + m.at * L) / C) * 2 * Math.PI - Math.PI / 2;
    return `<circle class="ring-mark${m.done ? ' ring-mark-done' : ''}" cx="${(mid + r * Math.cos(angle)).toFixed(1)}" cy="${(mid + r * Math.sin(angle)).toFixed(1)}" r="${(stroke * 0.28).toFixed(1)}"></circle>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">${arcs}${dots}${showTotal ? `<text class="ring-pct" x="${mid}" y="${textY}" text-anchor="middle" font-size="${font}">${percent(total)}</text>` : ''}</svg>`;
}

// The line of a ranked guide under its ring.
export const nextMilestone = (ms) => (ms.next ? `Next milestone: ${ms.next.name} · ${number(ms.next.steps)} ${ms.next.steps === 1 ? 'step' : 'steps'} · ${ms.next.left}` : 'All milestones reached');

export const legend = (chapters) => chapters.map((c, i) => `<div class="legend"><i class="dot-${(i % 3) + 1}"></i><span${c.current ? ' class="legend-now"' : ''}>${esc(c.name)}</span><b>${percent(c.share)}</b></div>${c.leftText ? `<div class="legend-left">${esc(c.leftText)} to chapter end</div>` : ''}`).join('');

export const statGrid = (stats, columns) => `<div class="stats${columns === 3 ? ' stats-3' : ''}">${stats.map((s) => `<div class="stat"><div class="stat-label"><span class="c-${s.color}">${esc(s.icon)}</span> ${esc(s.label)}</div><div class="stat-row"><span class="stat-value c-${s.color}">${esc(s.value)}</span><span class="stat-delta">${esc(s.delta)}</span></div></div>`).join('')}</div>`;

const rail = (status, top, bottom) => `<div class="step-rail"><div class="rail-top${top ? ' rail-on' : ''}"></div><div class="step-dot dot-${status}">${status === 'done' ? '✓' : ''}</div><div class="rail-bottom${bottom ? ' rail-on' : ''}"></div></div>`;
const shown = (cls, text) => (text ? `<span class="${cls}">${esc(text)}</span>` : '');

export function pathRow(row) {
  const key = esc(row.key);
  const state = row.status === 'done' || row.status === 'locked' ? ` row-${row.status}` : '';
  const sub = shown(`row-sub${row.subColor ? ` c-${row.subColor}` : ''}`, row.sub);
  const side = [row.side && esc(row.side), row.progress && esc(row.progress)].filter(Boolean).map((part) => `<span>${part}</span>`).join('');
  return `<div class="step${row.member ? ' step-member' : ''}">${rail(row.status, row.railTop, row.railBottom)}<button type="button" class="row${state}" data-step="${key}" aria-pressed="${row.status === 'done'}"><span class="row-text"><span class="row-name">${esc(row.name)}</span>${sub}${shown('row-sub', row.group)}</span><span class="row-side">${side}</span></button>${row.api ? `<button type="button" class="undo" data-evidence="${key}" aria-label="What the sync found for this step" aria-haspopup="dialog">API</button>` : ''}${row.undo ? `<button type="button" class="undo" data-step="${key}" aria-label="Undo the API check">Undo</button>` : ''}</div>`;
}

export function stepCard(card) {
  const box = card.stats.length || card.gain
    ? `<div class="card-box">${card.stats.map((s) => `<span class="card-stat c-${s.color}">${esc(s.text)}</span>`).join('')}${shown('card-gain', card.gain)}</div>`
    : '';
  return `<div class="step">${rail('current', card.railTop, card.railBottom)}<div class="card"><div class="card-head"><span class="card-name">${esc(card.name)}</span>${card.badge ? '<span class="card-badge">★ BEST VALUE</span>' : ''}${shown('card-where', card.where)}</div>${box}${(card.items ?? []).map((i) => shown('card-item', i.text)).join('')}<div class="card-foot"><span class="card-cost">${esc(card.cost)}</span>${shown('card-rate', card.rate)}</div>${shown('card-where', card.group)}${(card.notes ?? []).map((n) => shown('card-where', n)).join('')}${shown('card-where', card.hint)}${card.left ? `<span class="card-where">${esc(card.left)} to section end</span>` : ''}<button type="button" class="primary" data-step="${esc(card.key)}">Mark done</button></div></div>`;
}

const limitValue = (v) => (v === null ? 'unknown' : number(v));

// A missed limit stays in its chip: the value turns red and gets a mark, so colour is not the only sign.
const missed = (v) => `<span class="c-red">${number(v)} ✗</span>`;

export function chips(limits) {
  const { trueDefense: td, mp } = limits;
  const defense = limits.lowTrueDefense ? missed(td) : td === null ? limitValue(td) : `<span class="c-gain">${number(td)} ✓</span>`;
  const power = limits.lowMp ? `${missed(mp)} / ${number(limits.minMp)}` : `${limitValue(mp)} / ${number(limits.targetMp)}`;
  return `<div class="chips"><div class="chip${limits.lowTrueDefense ? ' chip-low' : ''}"><span class="c-white">❂ True Def ≥ ${number(limits.minTrueDefense)}</span><span class="chip-value">${defense}</span></div><div class="chip${limits.lowMp ? ' chip-low' : ''}"><span class="c-cyan">✦ Power</span><span class="chip-value">${power}</span></div></div>`;
}

export const bottomBar = (tabs, active) => `<nav class="bar">${tabs.map((t) => `<button type="button" data-tab="${esc(t.id)}"${t.id === active ? ' aria-current="page"' : ''}>${esc(t.label)}</button>`).join('')}</nav>`;

export const profileLink = () => `<a class="profile" href="#/stats" aria-label="Your stats">${icon('profile', 22)}</a>`;

export const backLink = () => `<a class="back" href="#/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Guides</a>`;

// The detection report: one step, what each rule asked for and what the profile showed for it.
const RULES = {
  owned: () => 'Owns the item', enchant: (d) => `Enchant ${d.enchant} ${d.level}`, reforge: (d) => `Reforge ${d.value.join(' or ')}`, recomb: () => 'Recombobulated',
  coating: () => 'Coating', polarvoid: () => 'Polarvoid book', scroll: (d) => `Scroll ${d.value}`, part: (d) => `Drill part ${d.ids.join(' or ')}`,
  gem: (d) => `${d.type ?? 'Any'} gem, ${d.quality} or better`, pet: (d) => `Pet ${d.types.join(' or ')}, ${d.tier ?? 'COMMON'} or better`, held: (d) => `Pet item ${d.item}`,
  petItem: (d) => `${d.item} on ${d.types.join(' or ')}`, essence: (d) => `Perk ${d.perk} ${d.level}`, perk: (d) => `Perk ${d.perk} ${d.level}`, power: (d) => `Power ${d.value}`,
  attr: (d) => `Attribute ${d.attr} ${d.need}`, coll: (d) => `Collection ${d.id} ${d.tier}`, skill: (d) => `${d.skill} ${number(d.xp)} XP`,
};
const PLACES = { inventory: 'Inventory', ender: 'Ender chest', vault: 'Personal vault', armor: 'Worn armor', equipment: 'Equipment', accessory: 'Accessory bag', tick: 'Ticked by hand' };

function placeOf(item) {
  const sets = (item.sets ?? []).map((s) => { const [kind, n] = s.split(':'); return kind === 'armor' ? `wardrobe slot ${n}` : `equipment set ${n}`; });
  const where = item.where === 'backpack' ? `Backpack ${item.bag ?? '(number after the next sync)'}`
    : item.where === 'wardrobe' ? sets.shift() ?? 'Wardrobe' : PLACES[item.where] ?? item.where;
  return [where[0].toUpperCase() + where.slice(1), ...sets].join(', ');
}

function itemText(item, tierOf) {
  const tier = tierOf(item.id);
  const parts = [
    item.id,
    tier && `${tier}${item.recomb ? ' +1 (recombobulated)' : ''}`,
    item.reforge && `reforge ${item.reforge}`,
    Object.keys(item.enchants ?? {}).length && `enchants ${Object.entries(item.enchants).map(([e, l]) => `${e} ${l}`).join(', ')}`,
    item.gems?.length && `gems ${item.gems.map((g) => `${g.slot} ${g.type} ${g.quality}`).join(', ')}`,
    item.coating && 'coating',
    item.polarvoid > 0 && `polarvoid ${item.polarvoid}`,
    Object.keys(item.parts ?? {}).length && `modules ${Object.entries(item.parts).map(([k, v]) => `${k} ${v}`).join(', ')}`,
  ].filter(Boolean);
  return `${esc(parts.join(' · '))}<br><small>${esc(placeOf(item))}</small>`;
}

const verdict = (have, need) => (have >= need ? ['yes', 'fulfilled'] : have > 0 ? ['partly', 'partly'] : ['no', 'no']);

function partView(p, tierOf) {
  const [cls, word] = verdict(p.have, p.need);
  let found;
  if (p.slots) {
    found = p.slots.map((s) => (s.item ? `<li>${itemText(s.item, tierOf)}${s.value ? '' : '<br><small>found, but without this</small>'}</li>` : `<li class="ev-miss">missing: none of ${esc(s.ids.join(', '))}</li>`)).join('');
    if (p.loose) found += `<li>${itemText(p.loose, tierOf)}<br><small>the part on its own</small></li>`;
  } else if (p.pets) found = p.pets.length ? p.pets.map((pet) => `<li>${esc([pet.type, pet.tier, pet.heldItem && `holding ${pet.heldItem}`].filter(Boolean).join(' · '))}<br><small>Pets</small></li>`).join('') : '<li class="ev-miss">missing: no such pet</li>';
  else found = `<li>Profile: ${esc(typeof p.value === 'boolean' ? (p.value ? 'unlocked' : 'not unlocked') : number(p.value))}</li>`;
  return `<div class="ev-rule"><div><span>${esc(RULES[p.rule.kind](p.rule))}</span><b class="ev-${cls}">${number(p.have)} / ${number(p.need)} · ${word}</b></div><ul>${found}</ul></div>`;
}

export function evidence(entry, tierOf) {
  const [cls, word] = verdict(entry.have, entry.need);
  const result = entry.have >= entry.need ? word : `${word}: ${number(entry.have)} / ${number(entry.need)}, missing ${number(entry.need - entry.have)}`;
  const by = entry.by ? `<p class="note">Counted as done: a later step of the same slot was found (${esc(entry.by)}).</p>` : '';
  const how = entry.ticked ? '<p class="note">From an item ticked by hand, here or in another guide.</p>' : '';
  return `<div class="evidence"><h3>${esc(entry.name)}</h3><small>${esc(entry.section)}</small><p class="ev-${cls}">Result: ${esc(result)}</p>${how}${by}${entry.parts.map((p) => partView(p, tierOf)).join('')}</div>`;
}
