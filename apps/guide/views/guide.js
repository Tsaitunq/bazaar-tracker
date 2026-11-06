// A guide: its path. Also the stats of all guides, reached through the profile button.
import { esc, number } from '../../../shared/format.js';
import { guideModel, worldFor, familyOf } from '../model.js';
import { ring, legend, nextMilestone, statGrid, pathRow, stepCard, chips, bottomBar, backLink, profileLink, icon, shortSection } from './parts.js';
import { HOME_TABS } from './home.js';
import { markdown, outline } from '../markdown.js';

const FARMING = { id: 'farming', title: 'Farming', area: 'farming', sections: [] };

// Scrolled down, the head folds to its title line with the total beside it.
// A guide by tiers shows its chapters, a ranked one its milestones on one ring.
const ringOf = (m, size) => (m.milestones ? ring({ chapters: [{ share: m.total }], total: m.total, size, label: 'Progress and milestones', marks: m.milestones.marks }) : ring({ chapters: m.chapters, total: m.total, size }));
const ringLegend = (m) => (m.milestones ? `<span class="milestone-count">${number(m.milestones.reached)} of ${number(m.milestones.count)} milestones</span>` : legend(m.chapters));
const ringHead = (m) => `<div class="ring-head">${ringOf(m, 88)}<div class="ring-text"><div class="ring-title">${icon(m.theme)}<h1>${esc(m.name)}</h1><b class="head-pct">${Math.round(m.total * 100)}%</b></div>${ringLegend(m)}</div></div>`;

function missingNote(m) {
  if (m.missing === 'stats') return `<p class="note">Measure your base under <a href="#/stats/measure/${m.area}">Stats</a> to rank the steps by what they bring.</p>`;
  return m.missing === 'items' ? '<p class="note">Loading item data…</p>' : '';
}

const infoOf = (m) => [m.leftOut, ...m.notes].filter(Boolean);
const COFL = '<p class="note">Lowest BIN prices: <a href="https://sky.coflnet.com" rel="noopener">SkyCofl</a></p>';
const hasInfo = (m) => infoOf(m).length > 0 || m.usedCofl;

// The hints about the model and the stats, and where the prices come from, wait behind the ⓘ of the head, so the path keeps its room.
const infoButton = (m, guide) => (guide.info ? '<button type="button" class="info" data-info="card" aria-label="How it works">ⓘ</button>' : hasInfo(m) ? '<button type="button" class="info" data-info aria-label="Notes on this guide" aria-haspopup="dialog">ⓘ</button>' : '');
const infoSheet = (m, guide) => (!guide.info && hasInfo(m) ? `<dialog class="sheet"><h2>Notes</h2>${infoOf(m).map((n) => `<p class="note">${esc(n)}</p>`).join('')}${m.usedCofl ? COFL : ''}<form method="dialog"><button type="submit" class="ghost">Close</button></form></dialog>` : '');

// "So läuft's": the text of the guide (field info) as a card on top, open the first time a guide is opened and closed after that; the notes of the model follow it.
function infoCard(world, guide, m) {
  const toc = outline(guide.info);
  const contents = toc.length ? `<nav class="info-toc" aria-label="Contents">${toc.map((t) => `<button type="button" class="toc-${t.level}" data-info-goto="${esc(t.id)}">${esc(t.text)}</button>`).join('')}</nav>` : '';
  const notes = [...infoOf(m).map((n) => `<p class="note">${esc(n)}</p>`), m.usedCofl ? COFL : ''].join('');
  const seen = (world.infoSeen ?? []).includes(guide.id);
  return `<details class="info-card" data-keep-open="info" data-info-card="${esc(guide.id)}"${seen ? '' : ' open'}><summary>So läuft's</summary><div class="info-body">${contents}${markdown(guide.info)}${notes}</div></details>`;
}

const warning = (m) => (m.daggerMissing ? '<p class="warn" role="alert">Dagger pair incomplete: the Hellion Shield needs one dagger of each line.</p>' : '');

const head = (m, empty) => `<div class="head">${ringHead(m)}${m.milestones ? `<p class="milestone">${esc(nextMilestone(m.milestones))}</p>` : ''}${empty ? '' : `${m.stats.length ? statGrid(m.stats, m.stats.length > 4 ? 3 : 2) : ''}${missingNote(m)}${m.chips ? chips(m.chips) : ''}`}</div>`;

const pathTab = (m) => `${warning(m)}<div class="path">${m.rows.map((row) => (row.card ? stepCard(row.card) : pathRow(row))).join('')}</div>`;

// Between the guides of one area, as a two-way switch at the top.
function switcher(world, guide) {
  const family = familyOf(world.guides, guide);
  if (family.length < 2) return '';
  // one mark under the links: during a swipe or after a tap it slides, the switch itself stays put
  const thumb = `<span class="switch-thumb" aria-hidden="true" style="--n:${family.length};--at:${family.indexOf(guide)}"></span>`;
  return `<nav class="switch" aria-label="Guides of this area">${thumb}${family.map((g) => `<a href="#/guide/${esc(g.id)}/path"${g === guide ? ' aria-current="page"' : ''}>${esc(g.label ?? g.title)}</a>`).join('')}</nav>`;
}

const screenClass = (theme) => `screen${theme === 'blaze' ? ' screen-blaze' : ''}`;

export function guideView(world, id) {
  const guide = world.guides.find((g) => g.id === id) ?? (id === FARMING.id ? FARMING : null);
  if (!guide) return null;
  const model = guideModel(guide, worldFor(world, guide));
  // what a section name says in brackets waits behind the ⓘ, so the card keeps its room
  const told = guide.sections.filter((s) => shortSection(s.name) !== s.name).map((s) => `${shortSection(s.name)}: ${s.name.slice(shortSection(s.name).length).trim().slice(1, -1)}`);
  const m = told.length ? { ...model, notes: [...model.notes, ...told] } : model;
  const empty = !guide.sections.length;
  const body = empty ? '<div class="empty"><strong>Guide coming soon</strong></div>' : pathTab(m);
  return `<div class="${screenClass(m.theme)}" data-theme="${esc(m.theme)}"><div class="top">${backLink()}${m.source ? `<a class="source" href="${esc(m.source)}" rel="noopener">Source</a>` : ''}${infoButton(m, guide)}${profileLink()}</div>${switcher(world, guide)}${head(m, empty)}${guide.info ? infoCard(world, guide, m) : ''}${body}${infoSheet(m, guide)}</div>`;
}
