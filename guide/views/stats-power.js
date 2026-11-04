// The power editor: Magical Power, the power stone, tuning points and the two buffs.
import { esc } from '../../format.js';
import { EMPTY_PART } from '../build.js';
import { draftBar, round2 } from './editors.js';
import { petPanel } from './stats-pet.js';

// The five stones in use first, the rest by name.
const MAIN = ['FURBALL', 'BEATING_HEART', 'MAGMA_URCHIN', 'MANDRAA', 'SCORCHED_BOOKS'];

export const multiplierAt = (m, mp) => m.a * Math.log(m.b * mp + 1) ** m.exp;

export function powerView(world, r, head) {
  const data = world.gamedata;
  if (!data) return `<div class="scroll">${head}<p class="note">Loading game data…</p></div>`;
  const d = data.power;
  const power = world.draft?.power ?? world.build.power ?? EMPTY_PART.power();
  const name = (id) => data.stats.stats.find((s) => s.id === id)?.name ?? id;
  const stones = [...d.powerStones].sort((a, b) => (MAIN.indexOf(a.id) + 1 || 99) - (MAIN.indexOf(b.id) + 1 || 99) || a.power.localeCompare(b.power));
  const chip = (s) => `<button type="button" class="chip-btn${power.stone === s.id ? ' on' : ''}" data-power-stone="${esc(s.id)}" aria-pressed="${power.stone === s.id}">${esc(s.power)}</button>`;
  const stone = d.powerStones.find((s) => s.id === power.stone);
  let gives = '';
  if (stone) {
    const scale = power.mp === null ? null : multiplierAt(d.multiplier, power.mp);
    const parts = [...new Set([...Object.keys(stone.base), ...Object.keys(stone.uniqueBonus)])].map((id) => {
      const v = (scale === null ? 0 : (stone.base[id] ?? 0) * scale) + (stone.uniqueBonus[id] ?? 0);
      return `<span>${esc(name(id))} ${v >= 0 ? '+' : ''}${round2(v)}</span>`;
    }).join('');
    gives = `<div class="panel gives"><small>${esc(stone.power)} gives${scale === null ? ' (only the fixed bonus until you enter Magical Power)' : ''}</small><div class="chips">${parts}</div></div>`;
  }
  const points = d.tuning.stats.map((t) => {
    const n = power.tuning?.[t.stat] ?? 0;
    return `<div class="tune"><span>${esc(name(t.stat))}</span><small>${t.perPoint === null ? 'unknown' : `${t.perPoint} per point → ${round2(t.perPoint * n)}`}</small><button type="button" data-tune="${esc(t.stat)}" data-tune-step="-1" aria-label="Less ${esc(name(t.stat))}">−</button><b>${n}</b><button type="button" data-tune="${esc(t.stat)}" data-tune-step="1" aria-label="More ${esc(name(t.stat))}">+</button></div>`;
  }).join('');
  const total = power.mp === null ? null : Math.floor(power.mp * d.tuning.pointsPerAccessoryPower);
  const used = Object.values(power.tuning ?? {}).reduce((a, b) => a + b, 0);
  const left = total === null ? `${used} used` : `${used} of ${total} used${used > total ? ' — more than you have' : ''}`;
  const buff = (key, label) => `<label class="check"><input type="checkbox" data-buff="${key}"${world.build.buffs?.[key] ? ' checked' : ''}> ${label}</label>`;
  return `<div class="scroll">${head}${draftBar(world, 'power', 'power')}
    <div class="panel"><label class="field">✦ Magical Power (Accessory Bag)<input type="number" min="0" step="1" inputmode="numeric" data-power-mp value="${power.mp ?? ''}"></label><small>Tuning points: ${esc(left)}</small></div>
    <div class="panel"><h2>Power stone</h2><div class="chips"><button type="button" class="chip-btn${power.stone ? '' : ' on'}" data-power-stone="" aria-pressed="${!power.stone}">None</button>${stones.map(chip).join('')}</div></div>${gives}
    <div class="panel"><h2>Tuning</h2>${points}</div>
    ${petPanel(world, r)}
    <div class="panel"><h2>Buffs</h2><small>Counted as always on.</small>${buff('godPotion', 'God Potion')}${buff('boosterCookie', 'Booster Cookie')}</div></div>`;
}
