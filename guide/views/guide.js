// A guide: path and best value. Also the stats of all guides, reached through the profile button.
import { esc, number } from '../../format.js';
import { statsView as allStats } from '../../stats.js';
import { guideModel, worldFor, bestGroups } from '../model.js';
import { ring, legend, statGrid, pathRow, stepCard, chips, bottomBar, backLink, profileLink, icon } from './parts.js';
import { HOME_TABS } from './home.js';

const FARMING = { id: 'farming', title: 'Farming', area: 'farming', sections: [] };
const SETTINGS_LINK = '<a href="#/settings">Settings</a>';

const head = (m) => `<div class="ring-head">${ring({ chapters: m.chapters, total: m.total, size: 116 })}<div class="ring-text"><div class="ring-title">${icon(m.theme)}<h1>${esc(m.name)}</h1></div>${legend(m.chapters)}</div></div>`;

function missingNote(m) {
  if (m.missing === 'profile') return `<p class="note">Sync your profile in ${SETTINGS_LINK} to see your stats and rank the steps.</p>`;
  return m.missing === 'items' ? '<p class="note">Loading item data…</p>' : '';
}

const pathTab = (m) => `${statGrid(m.stats, m.stats.length > 4 ? 3 : 2)}${missingNote(m)}${m.chips ? chips(m.chips) : ''}<div class="path">${m.rows.map((row) => (row.card ? stepCard(row.card) : pathRow(row))).join('')}</div>`;

const groupPanel = (group) => `<section class="panel"><h2>${esc(group.title)}</h2>${group.note ? `<small>${esc(group.note)}</small>` : ''}${group.rows.map((r) => `<button type="button" class="row" data-step="${esc(r.key)}"><span class="row-text"><span class="row-name">${esc(r.name)}</span>${r.sub ? `<span class="row-sub">${esc(r.sub)}</span>` : ''}${r.extra.map((x) => `<span class="row-sub">${esc(x)}</span>`).join('')}</span><span class="row-side">${esc(r.side)}</span></button>`).join('')}</section>`;

function bestPanel(r, world, score) {
  const pick = (i) => (i ? esc(world.name(i.id)) : 'nothing');
  const body = r.best.slots.length
    ? `<p>${esc(score.gainText(r.best.gain))} compared with your wardrobe slot</p><ul>${r.best.slots.map((s) => `<li>${esc(s.slot)}: ${pick(s.current)} → ${pick(s.best)}</li>`).join('')}</ul>`
    : '<p>Your wardrobe slot already is the best of what you own.</p>';
  return `<section class="panel"><h2>Best possible from what you own</h2>${body}<small>${esc(r.stays)}</small></section>`;
}

function bestTab(m, world) {
  if (m.missing) return `<div class="scroll">${missingNote(m)}</div>`;
  const r = m.ranked;
  const paths = r.paths ? `<p class="note">Enchants: ×${r.paths.guide.toFixed(2)} · One For All: ×${r.paths.ofa.toFixed(2)} · ${r.paths.leader} leads by ${r.paths.lead.toFixed(1)} % (estimate). In use: ${r.paths.inUse}.</p>` : '';
  const groups = bestGroups(m);
  return `<div class="scroll">${m.chips ? chips(m.chips) : ''}${r.leftOut ? `<p class="note">${esc(r.leftOut)}</p>` : ''}${paths}${r.daggerMissing ? '<p class="warn" role="alert">Dagger pair incomplete: the Hellion Shield needs one dagger of each line.</p>' : ''}${r.notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}${bestPanel(r, world, m.score)}${groups.length ? groups.map(groupPanel).join('') : '<p class="note">All steps are done.</p>'}</div>`;
}

const screenClass = (theme) => `screen${theme === 'blaze' ? ' screen-blaze' : ''}`;

export function guideView(world, id, tab) {
  const guide = world.guides.find((g) => g.id === id) ?? (id === FARMING.id ? FARMING : null);
  if (!guide) return null;
  const m = guideModel(guide, worldFor(world, guide));
  const empty = !guide.sections.length;
  const open = m.tabs.some((t) => t.id === tab) ? tab : 'path';
  const body = empty
    ? '<div class="empty"><strong>Guide coming soon</strong></div>'
    : open === 'best' ? bestTab(m, world) : pathTab(m);
  const credit = m.usedCofl ? '<p class="note">Prices: <a href="https://sky.coflnet.com" rel="noopener">SkyCofl</a></p>' : '';
  return `<div class="${screenClass(m.theme)}" data-theme="${esc(m.theme)}"><div class="top">${backLink()}${m.source ? `<a class="source" href="${esc(m.source)}" rel="noopener">Source</a>` : ''}${profileLink()}</div>${head(m)}${body}${credit}${bottomBar(m.tabs, open)}</div>`;
}

export const statsView = (world) => `<div class="screen screen-home" data-theme="home" data-page="stats"><div class="home-title"><h1>Stats</h1></div><div class="scroll">${allStats(world.state, world.prices.items, esc, world.boosts, world.preset)}</div>${bottomBar(HOME_TABS, null)}</div>`;
