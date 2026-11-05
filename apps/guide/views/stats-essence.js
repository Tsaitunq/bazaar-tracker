// The Essence tab: the five perks of the essence shop with a stepper each. Texts and numbers come from essenceModel.
import { esc, number } from '../../../shared/format.js';
import { draftBar, stepper, mcPic } from './editors.js';
import { essenceModel } from '../stats-model.js';

const ICON = { GOLD: 'gold_ingot', DIAMOND: 'diamond', FOSSIL: 'bone', ICE: 'packed_ice' };
const cost = (c) => (c.coins === null ? `${number(c.essence)} essence · no price` : `${number(c.essence)} essence · ${esc(c.coins)} coins`);

function card(p) {
  const next = p.next ? `<small>Next level: ${esc(p.after)}</small><small>To next level: ${cost(p.next)}</small>` : '<small>Maxed.</small>';
  const rest = p.maxed ? '' : `<small>To max: ${cost(p.toMax)}</small>`;
  const rate = p.conditional ? '<small>Condition applies: shown, not counted in your stats.</small>' : p.rate ? `<small>Next level: <b>${esc(p.rate)}</b></small>` : '';
  return `<section class="panel essence" data-essence-perk="${esc(p.id)}"><div class="bs-head">${mcPic(ICON[p.essence] ?? 'coal', 'essence-pic')}<div class="bs-title"><h2>${esc(p.name)}</h2><small>${esc(p.essence[0] + p.essence.slice(1).toLowerCase())} essence · ${esc(p.where ?? '')} · max level ${p.max}</small></div></div>
    ${stepper('essence', p.level, p.max)}<small>Level ${p.level}: ${esc(p.now)}</small>${next}${rest}${rate}</section>`;
}

export function essenceView(world, r, head) {
  const m = essenceModel(world, r.area);
  if (!m) return `<div class="scroll">${head}<p class="note">Loading game data…</p></div>`;
  return `<div class="scroll">${head}${draftBar(world, 'essence', 'Essence')}${m.perks.map(card).join('')}</div>`;
}
