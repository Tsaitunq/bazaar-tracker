// A guide: its path. Also the stats of all guides, reached through the profile button.
import { esc, number } from '../../format.js';
import { statsView as allStats } from '../../stats.js';
import { guideModel, worldFor } from '../model.js';
import { ring, legend, statGrid, pathRow, stepCard, chips, bottomBar, backLink, profileLink, icon } from './parts.js';
import { HOME_TABS } from './home.js';

const FARMING = { id: 'farming', title: 'Farming', area: 'farming', sections: [] };

const head = (m) => `<div class="ring-head">${ring({ chapters: m.chapters, total: m.total, size: 116 })}<div class="ring-text"><div class="ring-title">${icon(m.theme)}<h1>${esc(m.name)}</h1></div>${legend(m.chapters)}</div></div>`;

function missingNote(m) {
  if (m.missing === 'stats') return '<p class="note">Type in your /stats under <a href="#/stats">Stats</a> to rank the steps by what they bring.</p>';
  return m.missing === 'items' ? '<p class="note">Loading item data…</p>' : '';
}

const notes = (m) => `${m.daggerMissing ? '<p class="warn" role="alert">Dagger pair incomplete: the Hellion Shield needs one dagger of each line.</p>' : ''}${m.leftOut ? `<p class="note">${esc(m.leftOut)}</p>` : ''}${m.notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}`;

const pathTab = (m) => `${statGrid(m.stats, m.stats.length > 4 ? 3 : 2)}${missingNote(m)}${m.chips ? chips(m.chips) : ''}${notes(m)}<div class="path">${m.rows.map((row) => (row.card ? stepCard(row.card) : pathRow(row))).join('')}</div>`;

const screenClass = (theme) => `screen${theme === 'blaze' ? ' screen-blaze' : ''}`;

export function guideView(world, id) {
  const guide = world.guides.find((g) => g.id === id) ?? (id === FARMING.id ? FARMING : null);
  if (!guide) return null;
  const m = guideModel(guide, worldFor(world, guide));
  const empty = !guide.sections.length;
  const body = empty ? '<div class="empty"><strong>Guide coming soon</strong></div>' : pathTab(m);
  const credit = m.usedCofl ? '<p class="note">Prices: <a href="https://sky.coflnet.com" rel="noopener">SkyCofl</a></p>' : '';
  return `<div class="${screenClass(m.theme)}" data-theme="${esc(m.theme)}"><div class="top">${backLink()}${m.source ? `<a class="source" href="${esc(m.source)}" rel="noopener">Source</a>` : ''}${profileLink()}</div>${head(m)}${body}${credit}${bottomBar(m.tabs, 'path')}</div>`;
}

export const statsView = (world) => `<div class="screen screen-home" data-theme="home" data-page="stats"><div class="home-title"><h1>Stats</h1></div><div class="scroll">${allStats(world.state, world.prices.items, esc, world.boosts, world.preset)}</div>${bottomBar(HOME_TABS, null)}</div>`;
