// Small parts the three editors share.
import { esc, number } from '../../../shared/format.js';
import { needsDraft } from '../build.js';

// The first entry of a part the measurement did not know is a draft: it changes nothing until it is saved.
export function draftBar(world, part, label) {
  if (!needsDraft(world.build, world.base ?? {}, part)) return '';
  const drop = world.draft?.[part] ? `<button type="button" class="ghost" data-draft-discard="${part}">Discard</button>` : '';
  return `<div class="panel draft"><small>Your base was measured without ${esc(label)}. Enter everything you have now, then save: it counts as already inside your base. Until then nothing changes your totals.</small><div class="actions"><button type="button" class="primary" data-draft-save="${part}">Save ${esc(label)}</button>${drop}</div></div>`;
}

// prefix: perk or attr. Level down, a number, level up, Max.
export function stepper(prefix, value, max, off = false) {
  const dis = off ? ' disabled' : '';
  return `<div class="stepper"><button type="button" data-${prefix}-step="-1" aria-label="Level down"${dis}>−</button><input type="number" inputmode="numeric" min="0" max="${max}" value="${value}" data-${prefix}-level aria-label="Level, 0 to ${max}"${dis}><button type="button" data-${prefix}-step="1" aria-label="Level up"${dis}>+</button><button type="button" class="max" data-${prefix}-max${dis}>Max</button></div>`;
}

// A picture with the placeholder behind it: a missing file (the app listens for the error) leaves the placeholder, the letters or nothing.
export const pic = (src, cls = '', fallback = '') => `<span class="pic ${cls}" data-fb="${esc(fallback)}"><img src="${esc(src)}" alt="" draggable="false"></span>`;
export const mcPic = (name, cls) => pic(`img/mc/${name}.png`, cls);

export const round2 = (v) => number(Math.round(v * 100) / 100);
