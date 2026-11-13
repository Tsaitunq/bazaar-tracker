// The Stats screens: overview (base, gear, total), measure, and the three editors (HOTM, attributes, power).
import { esc, number } from '../../../shared/format.js';
import { statsModel, statDetail, AREA_NAME, ago } from '../stats-model.js';
import { STATS_TABS } from '../model.js';
import { bottomBar } from './parts.js';
import { HOME_TABS } from './home.js';
import { hotmView } from './stats-hotm.js';
import { attrsView } from './stats-attrs.js';
import { powerView } from './stats-power.js';
import { essenceView } from './stats-essence.js';
import { petLabel, petKey, petsView } from './stats-pet.js';
import { pic } from './editors.js';
import { AVERAGE_SKILLS } from '../sources.js';
import { auditKey, compare } from '../audit.js';

const TAB_NAME = { overview: 'Overview', hotm: 'HOTM', attributes: 'Attributes', power: 'Power', essence: 'Essence', pets: 'Pets' };
const AREAS = Object.keys(AREA_NAME);
const signedText = (v) => `${v > 0 ? '+' : ''}${number(Math.round(v * 100) / 100)}`;

// A two-way or four-way switch like the one of the guides: one mark under the links.
function switcher(items, current, label) {
  const at = Math.max(items.findIndex((i) => i.id === current), 0);
  const thumb = `<span class="switch-thumb" aria-hidden="true" style="--n:${items.length};--at:${at}"></span>`;
  return `<nav class="switch" aria-label="${esc(label)}">${thumb}${items.map((i) => `<a href="${esc(i.href)}"${i.id === current ? ' aria-current="page"' : ''}>${esc(i.name)}</a>`).join('')}</nav>`;
}

const tabs = (r) => switcher(STATS_TABS.map((t) => ({ id: t, name: TAB_NAME[t], href: `#/stats/${t}/${r.area}` })), r.tab, 'Stats pages');
const areas = (r) => switcher(AREAS.map((a) => ({ id: a, name: AREA_NAME[a], href: `#/stats/${r.tab}/${a}` })), r.area, 'Area');

const frame = (inner, title, back) => `<div class="screen screen-home" data-theme="stats" data-page="stats"><div class="top"><a class="back" href="${esc(back)}">← ${esc(title.back)}</a><h1 class="stats-title">${esc(title.name)}</h1><span class="top-fill"></span></div>${inner}${bottomBar(HOME_TABS, null)}</div>`;

// Skills and slayers of the imported player: per entry its level, the XP to the next level and the stats it gives (≈ where one source only). Nothing without an import.
const PRETTY = (id) => `${id[0].toUpperCase()}${id.slice(1)}`;
function levelLists(levels, data) {
  if (!levels) return '';
  const name = (id) => data?.stats.stats.find((s) => s.id === id)?.name ?? id;
  const entry = ([id, e]) => {
    const stats = Object.entries(e.stats ?? {});
    const head = `<span>${esc(PRETTY(id))}</span><b>${e.level} / ${e.max}</b><small>${e.toNext === null ? 'max level' : `${esc(number(Math.ceil(e.toNext)))} XP to next`}</small>`;
    const rows = stats.map(([stat, v]) => `<div class="stat-row detail-row detail-sub"><span>${v.unsafe ? '≈ ' : ''}${esc(name(stat))}</span><b>${esc(signedText(v.value))}</b></div>`).join('') || '<small>No stats at this level.</small>';
    return `<details class="detail-part level-entry"><summary class="stat-row detail-row">${head}</summary>${rows}</details>`;
  };
  const panel = (title, rows, extra = '') => (rows.length ? `<section class="panel level-panel" data-levels="${title.toLowerCase()}"><h2>${title}${extra}</h2>${rows.map(entry).join('')}</section>` : '');
  const sb = levels.skyblock;
  const avg = AVERAGE_SKILLS.map((id) => levels.skills[id]?.level).filter((l) => l !== undefined);
  const skills = Object.entries(levels.skills);
  const average = avg.length ? ` <small>⌀ ${Math.round((avg.reduce((n, l) => n + l, 0) / avg.length) * 10) / 10}</small>` : '';
  const level = sb ? `<section class="panel"><small>SkyBlock level <b>${sb.level} / ${sb.max}</b> · ${esc(number(Math.round(sb.xp)))} XP</small></section>` : '<section class="panel"><small>The worker does not send your SkyBlock level yet: deploy the updated worker and sync again.</small></section>';
  return `${panel('Slayers', Object.entries(levels.slayers))}${panel('Skills', skills, average)}${level}`;
}

// Which buffs count as active, with what they add: a potion that has run out would otherwise add its stats unnoticed.
const buffsNote = (m, r) => (m.buffsOn.length
  ? `<div class="panel buffs-note"><small><b>Counted as active:</b> ${m.buffsOn.map((b) => `${esc(b.name)}${b.text ? ` (${esc(b.text)})` : ''}`).join(' · ')}. Run out? <a href="#/stats/power/${esc(r.area)}">Switch it off</a>.</small></div>` : '');

function overview(world, r) {
  const m = statsModel(world, r.area);
  const buffs = [m.measured?.buffs.godPotion && 'God Potion', m.measured?.buffs.boosterCookie && 'Cookie'].filter(Boolean).join(' + ');
  const when = m.measured ? `Base measured <b>${esc(ago(m.measured.at, world.now))}</b>, no gear${buffs ? `, ${esc(buffs)} on` : ''}.` : 'No base measured yet.';
  const gear = m.guides.length ? `Gear: <b class="c-green">${m.steps} ${m.steps === 1 ? 'step' : 'steps'}</b> ticked in ${esc(m.guides.map((g) => g.title).join(' + '))}.` : 'No guide for this area yet, so no gear.';
  const rows = m.rows.map((x) => `<div class="stat-row"><span class="c-${x.color}"><a href="#/stats/detail/${esc(r.area)}/${esc(x.id)}" title="Click for details">${esc(x.icon)} ${esc(x.label)}</a></span><span>${esc(x.base)}</span><span class="c-green">${esc(x.gear)}</span><span class="c-orange">${esc(x.delta)}</span><b class="c-${x.color}"${x.unsafe ? ' title="Adds up values from one source only"' : ''}>${x.unsafe ? '≈ ' : ''}${esc(x.total)}</b></div>`).join('');
  const mark = (o) => (o.unsafe ? '≈ ' : '');
  const suspects = (o) => (o.suspects?.length ? `<small class="note">Unsafe sources behind it (one source, not checked in game): ${esc(o.suspects.join('; '))}.</small>` : o.value && m.hasCalc ? '<small class="note">No unsafe source adds to this: it comes from something the app does not count.</small>' : '');
  const otherLine = (o) => `<small><b class="c-${o.color}">${esc(o.text)} ${esc(o.label)}</b></small>${suspects(o)}`;
  const known = m.hasCalc
    ? 'No base measured, so this adds up what the import gives: build, skills, slayers, SkyBlock level, accessories, buffs and the game base. A ≈ marks values from one source only. Not counted: mayor, cake, museum, other potions and conditional perks. Measure to see what is left over.'
    : 'No base measured yet, so this is only what the app knows: HOTM, attributes, essence, power and ticked gear. Everything else (skills, levels, other bonuses) is missing until you reconcile with /stats, or import your profile.';
  const otherText = m.hasCalc
    ? `What your measured base holds beyond what the app adds up (build, skills, slayers, level, accessories, game base): your /stats value minus that figure.${m.assumed ? ' This measurement is older than the import sources, so they are taken as they are today.' : ''}`
    : "What your measured base holds beyond what the app knows (HOTM, attributes, essence, power, buffs): your /stats value minus the app's figure at the time.";
  const sources = m.other.length ? `<section class="panel"><h2>Other sources</h2><small>${esc(otherText)}</small>${m.other.map(otherLine).join('')}</section>` : m.known.length ? `<section class="panel"><h2>From known sources</h2><small>${esc(known)}</small>${m.known.map((o) => `<small><b class="c-${o.color}">${mark(o)}${esc(o.text)} ${esc(o.label)}</b></small>`).join('')}</section>` : '';
  const unknown = m.unknown?.length ? `<section class="panel"><h2>Not counted</h2>${m.unknown.map((t) => `<small>${esc(t)}</small>`).join('')}</section>` : '';
  const moved = m.changes.length ? `<section class="panel changes"><h2>Changes since measurement</h2>${m.changes.map((c) => `<small><b class="c-${c.color}">${esc(c.text)} ${esc(c.label)}</b> (${esc(c.parts)})</small>`).join('')}</section>` : '';
  const hints = m.hints?.length ? m.hints.map((h) => `<small class="note">${esc(h)}</small>`).join('') : '';
  const listed = m.listed.length ? `<section class="panel"><h2>Only when the condition holds</h2>${m.listed.map((l) => `<small>${esc(l.text)}</small>`).join('')}</section>` : '';
  const stone = world.gamedata?.power.powerStones.find((s) => s.id === world.build.power?.stone);
  const pet = m.pet.step ?? (m.pet.chosen ? petLabel(m.pet.chosen) : null);
  const tag = (label, value, goto = '', tab = 'power') => `<a class="tag" href="#/stats/${tab}/${esc(r.area)}"${goto}>${label}: <b>${esc(value ?? 'none')}</b></a>`;
  // the pet next to the figure: the one a ticked step sets wins, like in the total; no pet, no float
  const [stepType, stepTier] = (m.pet.step ?? '').split(' ');
  const shown = (m.pet.step && world.gamedata?.pets?.pets.find((p) => p.id === stepType && p.rarity === stepTier)) || m.pet.chosen;
  const float = shown ? `<a class="pet-float" href="#/stats/pets/${esc(r.area)}" data-goto-pet="${esc(petKey(shown))}" aria-label="${esc(petLabel(shown))}, open the pet picker">${pic(`img/hypixel/pets/${shown.id}_${shown.rarity}.png`, 'pet-pic', shown.name[0])}</a>` : '';
  const figure = `<div class="panel figure-panel"><canvas data-figure class="figure" role="img" aria-label="Your player"></canvas>${float}<div class="tags">${tag('Pet', pet, ' data-goto-pet=""', 'pets')}${tag('Power', stone?.power)}</div></div>`;
  const drafts = ['hotm', 'attrs', 'power', 'essence'].filter((p) => world.draft?.[p]).map((p) => ({ hotm: ['hotm', 'HOTM'], attrs: ['attributes', 'Attributes'], power: ['power', 'Power'], essence: ['essence', 'Essence'] })[p]);
  const draftNote = drafts.map(([tab, name]) => `<a class="note draft-note" href="#/stats/${tab}/${esc(r.area)}">${name} draft not saved</a>`).join('');
  const stale = m.stale ? `<div class="panel"><small class="c-orange">This measurement is older than the import. Remove it or measure again, or the import values count twice.</small><div class="actions"><button type="button" data-stats-remove="${esc(r.area)}">Remove measurement</button><a class="primary-link" href="#/stats/measure/${esc(r.area)}">Measure again</a></div></div>` : '';
  const remove = m.measured ? `<button type="button" data-stats-remove="${esc(r.area)}">Remove measurement</button>` : '';
  const note = m.missing === 'data' ? '<p class="note">Loading game data…</p>' : m.missing === 'items' ? '<p class="note">Loading item data… gear shows when it is there.</p>' : '';
  return `<div class="scroll">${tabs(r)}${areas(r)}
    ${buffsNote(m, r)}${draftNote}${figure}${levelLists(m.levels, world.gamedata)}${stale}
    <div class="panel"><small>${when}</small><small>${gear}</small>${hints}${note}<a class="primary-link" href="#/stats/measure/${esc(r.area)}">${m.measured ? 'Measure base again' : `Measure ${esc(m.name)} base`}</a>${remove}</div>
    <div class="panel stat-table"><div class="stat-row stat-head"><span>All ${esc(m.name.toLowerCase())} stats</span><span>Base</span><span>Gear</span><span title="Changed since the measurement">Δ</span><span>Total</span></div>${rows}</div>${sources}${unknown}${moved}${listed}</div>`;
}

function measure(world, r) {
  const m = statsModel(world, r.area);
  const fields = m.fields.map((f) => `<label class="field"><span class="c-${f.color}">${esc(f.icon)} ${esc(f.label)}</span><input type="number" step="any" inputmode="decimal" data-stats-stat="${esc(f.id)}"></label>`).join('');
  const mp = r.area === 'blaze' ? '<label class="field">Magical Power (not a line of /stats)<input type="number" step="any" min="0" inputmode="decimal" data-stats-mp></label>' : '';
  const gear = m.gearLine.length ? `<small>Gear from your guides adds ${m.gearLine.map((g) => `<span class="c-${g.color}">${esc(g.icon)} ${esc(g.text)}</span>`).join(' · ')}</small>` : '';
  const buff = (key, label) => `<label class="check"><input type="checkbox" data-buff="${key}"${m.buffs[key] ? ' checked' : ''}> ${label}</label>`;
  const body = `<div class="scroll"><div class="panel" data-stats-area="${esc(r.area)}"><h2>Measure ${esc(m.name)} base</h2>
    <small>Optional. Without it the stats show only what the app knows. Typing your /stats here adds everything else as "other sources": your value minus what the app knows from your HOTM, attributes, essence and power.</small>
    <small>Take off armor, equipment, tool or weapon and pet${r.area === 'blaze' ? '; keep your accessories on, they are part of the base' : ''}. Then open /stats and type what it shows. A field left empty stays unknown.</small>
    ${buff('godPotion', 'God Potion active')}${buff('boosterCookie', 'Booster Cookie active')}
    ${fields}${mp}${gear}
    <div class="actions"><button type="button" class="primary" data-stats-save>Save as ${esc(m.name)} base</button></div></div></div>`;
  return body;
}

// The "in game" field of a category and what it shows: app value, game value, difference (green within 0.1, otherwise red). The same for both blocks.
function auditRow(world, r, title, app) {
  const key = auditKey(r.area, r.stat, title);
  const entry = world.audit?.[key];
  const c = entry ? compare(app, entry.value) : null;
  const result = c ? `<small class="audit-result c-${c.ok ? 'green' : 'red'}" data-audit-result>App ${esc(number(c.app))} · Game ${esc(number(c.game))} · Diff ${esc(signedText(c.diff))}</small>` : '';
  return `<div class="audit-row"><label class="audit">In game <input type="number" step="any" inputmode="decimal" data-audit="${esc(key)}"${entry ? ` value="${esc(entry.value)}"` : ''} aria-label="${esc(title)} in game"></label>${result}</div>`;
}

// The breakdown of one stat in two blocks. Base: everything that does not come from ticked guide steps, a category each, opening into its lines.
// Gear from guides: guide → category → item → steps. The total on top is base + gear (+ multipliers).
function detail(world, r) {
  const d = statDetail(world, r.area, r.stat);
  if (!d) return '<div class="scroll"><div class="panel"><small>No such stat for this area.</small></div></div>';
  const mark = (l) => `${l.unsafe ? '≈ ' : ''}${esc(l.label)}${l.differs ? ' ≠' : ''}${l.note ? ` <small>(${esc(l.note)})</small>` : ''}`;
  const value = (l) => `<b class="c-${d.color}">${esc(l.text)}</b>`;
  const row = (l, sub = false) => `<div class="stat-row detail-row${sub ? ' detail-sub' : ''}"><span>${mark(l)}</span>${value(l)}</div>`;
  // a line with parts opens into them; a line without is a plain row
  const line = (l) => (l.parts?.length
    ? `<details class="detail-part"><summary class="stat-row detail-row"><span>${mark(l)}</span>${value(l)}</summary>${l.parts.map((p) => row(p, true)).join('')}</details>`
    : row(l));
  const sum = (v) => `<b class="c-${d.color}">${esc(signedText(v))}</b>`;
  const baseGroups = d.base.groups.map((g) => `<details class="detail-part detail-cat" data-detail-cat="${esc(g.title)}"><summary class="stat-row detail-row"><span>${esc(g.title)}</span>${sum(g.sum)}</summary>${auditRow(world, r, g.title, g.sum)}${g.lines.map(line).join('')}</details>`).join('');
  const guides = d.gear.guides.map((g) => `<details class="detail-part detail-cat"><summary class="stat-row detail-row"><span>${esc(g.title)}</span>${sum(g.sum)}</summary>${g.cats.map((c) => `<details class="detail-part"><summary class="stat-row detail-row detail-sub"><span>${esc(c.title)}</span>${sum(c.sum)}</summary>${c.items.map(line).join('')}</details>`).join('')}</details>`).join('');
  const gearCats = d.gear.cats.length ? `<details class="detail-part"><summary class="stat-row detail-row"><span>Compare by game category</span><small>${d.gear.cats.length}</small></summary>${d.gear.cats.map((g) => `<div class="stat-row detail-row"><span>${esc(g.title)}</span>${sum(g.sum)}</div>${auditRow(world, r, g.title, g.sum)}`).join('')}</details>` : '';
  const mults = d.multipliers.length ? `<details class="detail-part detail-cat"><summary class="stat-row detail-row"><span>Multipliers</span><small>${d.multipliers.length}</small></summary><small>Applied last, on the sum above.</small>${d.multipliers.map((m) => `<div class="stat-row detail-row${m.holds ? '' : ' muted'}"><span>${esc(m.label)} <small>(${esc(m.condition)}${m.holds ? '' : ', not counted'})</small>${m.key ? `<label class="check"><input type="checkbox" data-condition="${esc(m.key)}"${m.holds ? ' checked' : ''}> holds now</label>` : ''}</span><b>${esc(m.text)}</b></div>`).join('')}</details>` : '';
  const cond = d.conditional.length ? `<section class="panel muted"><h2>Only when the condition holds</h2>${d.conditional.map((t) => `<small>${esc(t)}</small>`).join('')}</section>` : '';
  const total = Number(String(d.total).replace(/,/g, ''));
  const rest = Number.isFinite(total) ? Math.round((total - d.base.sum - d.gear.sum) * 100) / 100 : 0;
  const audits = Object.keys(world.audit ?? {}).length;
  const tools = `<section class="panel audit-tools"><small>Type the value of a category from /stats → Click for details in its "In game" field. Green: within 0.1.</small><div class="actions"><button type="button" data-audit-export>Copy deviations</button><button type="button" data-audit-clear${audits ? '' : ' disabled'}>Clear all (${audits})</button></div>${world.auditMessage ? `<small role="status">${esc(world.auditMessage)}</small>` : ''}</section>`;
  return `<div class="scroll"><div class="panel detail-total"><h2 class="c-${d.color}">${esc(d.icon)} ${esc(d.name)}: ${esc(d.total)}</h2><small>Base ${esc(signedText(d.base.sum))} · Gear ${esc(signedText(d.gear.sum))}${Math.abs(rest) > 0.005 ? ` · Multipliers ${esc(signedText(rest))}` : ''}. ${d.measured ? 'With your measured base.' : 'Added up from what the app knows.'} A ≈ marks values from one source only. ≠ means the game tooltip and the own calculation differ.</small></div>
    <section class="panel" data-block="base"><h2>Base <small>${esc(signedText(d.base.sum))}</small></h2><small>Everything that is not from ticked guide steps.</small>${baseGroups || '<small>Nothing adds to this stat yet.</small>'}${mults}</section>
    <section class="panel" data-block="gear"><h2>Gear from guides <small>${esc(signedText(d.gear.sum))}</small></h2><small>Only what the ticked steps give: guide, category, item, step.</small>${guides || '<small>No ticked gear adds to this stat.</small>'}${gearCats}</section>${cond}${tools}</div>`;
}

const EDITORS = { hotm: hotmView, attributes: attrsView, power: powerView, essence: essenceView, pets: petsView };

export function statsView(world, r) {
  const inner = r.tab === 'detail' ? detail(world, r) : r.tab === 'measure' ? measure(world, r) : r.tab === 'overview' ? overview(world, r) : EDITORS[r.tab](world, r, tabs(r));
  const title = r.tab === 'detail' ? { name: 'Stat details', back: 'Stats' } : r.tab === 'measure' ? { name: 'Measure base', back: 'Stats' } : { name: 'Your stats', back: 'Home' };
  return frame(inner, title, r.tab === 'measure' || r.tab === 'detail' ? `#/stats/overview/${r.area}` : '#/');
}
