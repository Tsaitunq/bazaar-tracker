// The HOTM editor: the whole tree, a sheet for the perk that is open, the HOTM level and the omelette.
import { esc, number } from '../../../shared/format.js';
import { EMPTY_PART } from '../build.js';
import { CELL, place, lockOf, LOCK_TEXT, levelOf, costBetween, effectsAt, spent, iconOf, isOff } from '../hotm-model.js';
import { draftBar, stepper, round2, mcPic } from './editors.js';

const POWDER = { mithril: 'Mithril', gemstone: 'Gemstone', glacite: 'Glacite' };
const short = (v) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 100) / 10}k` : String(v));

function costText(perk, from) {
  const c = costBetween(perk, from, perk.maxLevel);
  const parts = [...Object.keys(POWDER).filter((p) => c[p] > 0).map((p) => `${number(c[p])} ${POWDER[p]} powder`), c.tokens > 0 && `${c.tokens} Token of the Mountain`].filter(Boolean);
  if (c.unknown) return parts.length ? `${parts.join(' + ')} + unknown` : 'Cost unknown';
  return parts.length ? parts.join(' + ') : 'Nothing left to pay';
}

function sheet(data, hotm, perk) {
  const level = levelOf(hotm, perk.id);
  const lock = lockOf(perk, hotm);
  const statName = (id) => data.stats.stats.find((s) => s.id === id)?.name ?? id;
  const eff = (l) => effectsAt(perk, l, hotm.omelette).map((e) => `${e.value >= 0 ? '+' : ''}${round2(e.value)}${e.percent ? ' %' : ''} ${esc(statName(e.stat))}${e.cond === 'always' ? '' : ` <em>(${esc(e.cond)})</em>`}`).join(', ') || 'no permanent stat';
  const next = level < perk.maxLevel ? `<small>Level ${level + 1}: ${eff(level + 1)}</small>` : '<small>Maxed.</small>';
  const kind = perk.type === 'ability' ? 'Ability' : perk.type === 'core' ? 'Core' : 'Perk';
  const off = isOff(hotm, perk);
  const toggle = perk.type === 'perk' ? `<button type="button" class="chip-btn${off ? '' : ' on'}" data-perk-enabled aria-pressed="${!off}">${off ? 'Disabled' : 'Enabled'}</button>` : perk.type === 'ability' ? `<button type="button" class="chip-btn${hotm.ability === perk.id ? ' on' : ''}" data-ability-pick aria-pressed="${hotm.ability === perk.id}"${lock || level < 1 ? ' disabled' : ''}>${hotm.ability === perk.id ? 'Selected' : 'Select'}</button>` : '';
  const note = off ? '<small class="c-red">Switched off in the game: it keeps its level but is not counted.</small>' : perk.type === 'ability' ? '<small>Only one pickaxe ability can be selected. Only the selected one counts.</small>' : '';
  const warn = lock ? `<small class="c-red">${LOCK_TEXT[lock]}. Its level stays saved but is not counted.</small>` : '';
  return `<section class="panel sheet" data-perk-sheet="${esc(perk.id)}"><h2>${esc(perk.name)}</h2>
    <small>${kind} · Tier ${perk.tier} · max level ${perk.maxLevel}</small>${warn}
    ${stepper('perk', level, perk.maxLevel, !!lock)}${toggle}${note}
    <small>Level ${level}: ${eff(level)}</small>${next}
    <small>To max: ${esc(costText(perk, level))}</small></section>`;
}

export function hotmView(world, r, head) {
  const data = world.gamedata;
  if (!data) return `<div class="scroll">${head}<p class="note">Loading game data…</p></div>`;
  const hotm = world.draft?.hotm ?? world.build.hotm ?? EMPTY_PART.hotm();
  const perks = data.hotm.perks;
  const byId = new Map(perks.map((p) => [p.id, p]));
  const mid = (p) => ({ x: place(p).x + CELL / 2, y: place(p).y + CELL / 2 });
  const lines = perks.flatMap((p) => p.neighbors.filter((n) => n > p.id).map((n) => {
    const o = byId.get(n);
    const lit = levelOf(hotm, p.id) > 0 && levelOf(hotm, o.id) > 0;
    return `<line x1="${mid(p).x}" y1="${mid(p).y}" x2="${mid(o).x}" y2="${mid(o).y}" class="${lit ? 'lit' : ''}"/>`;
  })).join('');
  const nodes = perks.map((p) => {
    const level = levelOf(hotm, p.id);
    const lock = lockOf(p, hotm);
    const cond = p.effects.length > 0 && p.effects.every((e) => e.cond !== 'always');
    const off = isOff(hotm, p);
    const cls = ['perk', p.type === 'ability' ? 'perk-ability' : '', level >= p.maxLevel ? 'perk-max' : level > 0 ? 'perk-on' : '', lock ? 'perk-locked' : '', cond ? 'perk-cond' : '', off ? 'perk-off' : '', world.ui?.perk === p.id ? 'perk-open' : ''].filter(Boolean).join(' ');
    const text = `${mcPic(iconOf(p, hotm), 'perk-pic')}${p.maxLevel > 1 && level ? `<b class="stack">${level}</b>` : ''}${off ? '<i class="perk-aus">AUS</i>' : ''}`;
    const why = (lock ? `, ${LOCK_TEXT[lock].toLowerCase()}` : '') + (off ? ', disabled' : '') + (hotm.ability === p.id ? ', selected' : '');
    return `<button type="button" class="${cls}" style="left:${place(p).x + 6}px;top:${place(p).y + 6}px" data-perk="${esc(p.id)}" aria-label="${esc(p.name)}, level ${level} of ${p.maxLevel}${why}">${text}</button>`;
  }).join('');
  const used = spent(data, hotm);
  const chips = `<div class="chips"><span class="chip">Tier <b>${hotm.tier ?? '?'}</b>/10</span>${Object.keys(POWDER).map((p) => `<span class="chip chip-${p}">${POWDER[p]} ${short(used[p])}</span>`).join('')}</div>`;
  const tiers = ['<option value="">unknown</option>', ...Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}"${hotm.tier === i + 1 ? ' selected' : ''}>${i + 1}</option>`)].join('');
  const open = byId.get(world.ui?.perk);
  return `<div class="scroll">${head}${draftBar(world, 'hotm', 'HOTM')}
    <div class="panel"><label class="field">HOTM level (1 to 10, from your HOTM XP)<select data-hotm-tier>${tiers}</select></label>
      <label class="check"><input type="checkbox" data-hotm-omelette${hotm.omelette ? ' checked' : ''}> Blue Cheese Goblin Omelette</label>${chips}</div>
    <div class="tree" style="width:${7 * CELL}px;height:${10 * CELL}px"><svg width="${7 * CELL}" height="${10 * CELL}" aria-hidden="true">${lines}</svg>${nodes}</div>
    <div class="legend-row"><span>coal: not unlocked</span><span>emerald: unlocked</span><span>diamond: maxed</span><span><i class="k k-cond"></i> conditional</span><span><i class="k k-lock"></i> locked</span></div>
    ${open ? sheet(data, hotm, open) : '<p class="note">Tap a perk to set its level.</p>'}</div>`;
}
