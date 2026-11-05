// The Stats screens: overview (base, gear, total), measure, and the three editors (HOTM, attributes, power).
import { esc } from '../../../shared/format.js';
import { statsModel, AREA_NAME, ago } from '../stats-model.js';
import { STATS_TABS } from '../model.js';
import { bottomBar } from './parts.js';
import { HOME_TABS } from './home.js';
import { hotmView } from './stats-hotm.js';
import { attrsView } from './stats-attrs.js';
import { powerView } from './stats-power.js';
import { essenceView } from './stats-essence.js';
import { petLabel, petKey } from './stats-pet.js';
import { pic } from './editors.js';

const TAB_NAME = { overview: 'Overview', hotm: 'HOTM', attributes: 'Attributes', power: 'Power', essence: 'Essence' };
const AREAS = Object.keys(AREA_NAME);

// A two-way or four-way switch like the one of the guides: one mark under the links.
function switcher(items, current, label) {
  const at = Math.max(items.findIndex((i) => i.id === current), 0);
  const thumb = `<span class="switch-thumb" aria-hidden="true" style="--n:${items.length};--at:${at}"></span>`;
  return `<nav class="switch" aria-label="${esc(label)}">${thumb}${items.map((i) => `<a href="${esc(i.href)}"${i.id === current ? ' aria-current="page"' : ''}>${esc(i.name)}</a>`).join('')}</nav>`;
}

const tabs = (r) => switcher(STATS_TABS.map((t) => ({ id: t, name: TAB_NAME[t], href: `#/stats/${t}/${r.area}` })), r.tab, 'Stats pages');
const areas = (r) => switcher(AREAS.map((a) => ({ id: a, name: AREA_NAME[a], href: `#/stats/${r.tab}/${a}` })), r.area, 'Area');

const frame = (inner, title, back) => `<div class="screen screen-home" data-theme="stats" data-page="stats"><div class="top"><a class="back" href="${esc(back)}">← ${esc(title.back)}</a><h1 class="stats-title">${esc(title.name)}</h1><span class="top-fill"></span></div>${inner}${bottomBar(HOME_TABS, null)}</div>`;

function overview(world, r) {
  const m = statsModel(world, r.area);
  const buffs = [m.measured?.buffs.godPotion && 'God Potion', m.measured?.buffs.boosterCookie && 'Cookie'].filter(Boolean).join(' + ');
  const when = m.measured ? `Base measured <b>${esc(ago(m.measured.at, world.now))}</b>, no gear${buffs ? `, ${esc(buffs)} on` : ''}.` : 'No base measured yet.';
  const gear = m.guides.length ? `Gear: <b class="c-green">${m.steps} ${m.steps === 1 ? 'step' : 'steps'}</b> ticked in ${esc(m.guides.map((g) => g.title).join(' + '))}.` : 'No guide for this area yet, so no gear.';
  const rows = m.rows.map((x) => `<div class="stat-row"><span class="c-${x.color}">${esc(x.icon)} ${esc(x.label)}</span><span>${esc(x.base)}</span><span class="c-green">${esc(x.gear)}</span><b class="c-${x.color}">${esc(x.total)}</b></div>`).join('');
  const moved = m.changes.length ? `<section class="panel changes"><h2>Changes since measurement</h2>${m.changes.map((c) => `<small><b class="c-${c.color}">${esc(c.text)} ${esc(c.label)}</b> (${esc(c.parts)})</small>`).join('')}</section>` : '';
  const hints = m.hints?.length ? m.hints.map((h) => `<small class="note">${esc(h)}</small>`).join('') : '';
  const listed = m.listed.length ? `<section class="panel"><h2>Only when the condition holds</h2>${m.listed.map((l) => `<small>${esc(l.text)}</small>`).join('')}</section>` : '';
  const stone = world.gamedata?.power.powerStones.find((s) => s.id === world.build.power?.stone);
  const pet = m.pet.step ?? (m.pet.chosen ? petLabel(m.pet.chosen) : null);
  const tag = (label, value, goto = '') => `<a class="tag" href="#/stats/power/${esc(r.area)}"${goto}>${label}: <b>${esc(value ?? 'none')}</b></a>`;
  // the pet next to the figure: the one a ticked step sets wins, like in the total; no pet, no float
  const [stepType, stepTier] = (m.pet.step ?? '').split(' ');
  const shown = (m.pet.step && world.gamedata?.pets?.pets.find((p) => p.id === stepType && p.rarity === stepTier)) || m.pet.chosen;
  const float = shown ? `<a class="pet-float" href="#/stats/power/${esc(r.area)}" data-goto-pet="${esc(petKey(shown))}" aria-label="${esc(petLabel(shown))}, open the pet picker">${pic(`img/hypixel/pets/${shown.id}_${shown.rarity}.png`, 'pet-pic', shown.name[0])}</a>` : '';
  const figure = `<div class="panel figure-panel"><canvas data-figure class="figure" role="img" aria-label="Your player"></canvas>${float}<div class="tags">${tag('Pet', pet, ' data-goto-pet=""')}${tag('Power', stone?.power)}</div></div>`;
  const drafts = ['hotm', 'attrs', 'power', 'essence'].filter((p) => world.draft?.[p]).map((p) => ({ hotm: ['hotm', 'HOTM'], attrs: ['attributes', 'Attributes'], power: ['power', 'Power'], essence: ['essence', 'Essence'] })[p]);
  const draftNote = drafts.map(([tab, name]) => `<a class="note draft-note" href="#/stats/${tab}/${esc(r.area)}">${name} draft not saved</a>`).join('');
  const note = m.missing === 'data' ? '<p class="note">Loading game data…</p>' : m.missing === 'items' ? '<p class="note">Loading item data… gear shows when it is there.</p>' : '';
  return `<div class="scroll">${tabs(r)}${areas(r)}
    ${draftNote}${figure}
    <div class="panel"><small>${when}</small><small>${gear}</small>${hints}${note}<a class="primary-link" href="#/stats/measure/${esc(r.area)}">${m.measured ? 'Measure base again' : `Measure ${esc(m.name)} base`}</a></div>
    <div class="panel stat-table"><div class="stat-row stat-head"><span>All ${esc(m.name.toLowerCase())} stats</span><span>Base</span><span>Gear</span><span>Total</span></div>${rows}</div>${moved}${listed}</div>`;
}

function measure(world, r) {
  const m = statsModel(world, r.area);
  const fields = m.fields.map((f) => `<label class="field"><span class="c-${f.color}">${esc(f.icon)} ${esc(f.label)}</span><input type="number" step="any" inputmode="decimal" data-stats-stat="${esc(f.id)}"></label>`).join('');
  const mp = r.area === 'blaze' ? '<label class="field">Magical Power (not a line of /stats)<input type="number" step="any" min="0" inputmode="decimal" data-stats-mp></label>' : '';
  const gear = m.gearLine.length ? `<small>Gear from your guides adds ${m.gearLine.map((g) => `<span class="c-${g.color}">${esc(g.icon)} ${esc(g.text)}</span>`).join(' · ')}</small>` : '';
  const buff = (key, label) => `<label class="check"><input type="checkbox" data-buff="${key}"${m.buffs[key] ? ' checked' : ''}> ${label}</label>`;
  const body = `<div class="scroll"><div class="panel" data-stats-area="${esc(r.area)}"><h2>Measure ${esc(m.name)} base</h2>
    <small>Take off armor, equipment, tool or weapon and pet${r.area === 'blaze' ? '; keep your accessories on, they are part of the base' : ''}. Then open /stats and type what it shows. A field left empty stays unknown.</small>
    ${buff('godPotion', 'God Potion active')}${buff('boosterCookie', 'Booster Cookie active')}
    ${fields}${mp}${gear}
    <div class="actions"><button type="button" class="primary" data-stats-save>Save as ${esc(m.name)} base</button></div></div></div>`;
  return body;
}

const EDITORS = { hotm: hotmView, attributes: attrsView, power: powerView, essence: essenceView };

export function statsView(world, r) {
  const inner = r.tab === 'measure' ? measure(world, r) : r.tab === 'overview' ? overview(world, r) : EDITORS[r.tab](world, r, tabs(r));
  const title = r.tab === 'measure' ? { name: 'Measure base', back: 'Stats' } : { name: 'Your stats', back: 'Home' };
  return frame(inner, title, r.tab === 'measure' ? `#/stats/overview/${r.area}` : '#/');
}
