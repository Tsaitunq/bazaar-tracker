// The pet picker (under the power editor): one chip per pet and rarity, what it gives, its perks.
import { esc } from '../../format.js';
import { statsModel } from '../stats-model.js';
import { round2 } from './editors.js';

const RARITY = { LEGENDARY: 'Legendary', EPIC: 'Epic', RARE: 'Rare' };
export const petLabel = (p) => `${p.name}${p.rarity === 'LEGENDARY' && p.name !== 'Scatha' ? '' : ` (${RARITY[p.rarity] ?? p.rarity})`}`;
export const petKey = (p) => `${p.id}:${p.rarity}`;

export function petPanel(world, r) {
  const pets = world.gamedata?.pets?.pets;
  if (!pets) return '';
  const { chosen, step } = statsModel(world, r.area).pet;
  const name = (id) => world.gamedata.stats.stats.find((s) => s.id === id)?.name ?? id;
  const chip = (p) => `<button type="button" class="chip-btn${chosen && petKey(chosen) === petKey(p) ? ' on' : ''}" data-pet="${esc(petKey(p))}" aria-pressed="${chosen ? petKey(chosen) === petKey(p) : false}">${esc(petLabel(p))}</button>`;
  const hint = step ? `<small class="note">A ticked step already sets the pet (${esc(step)}), so it wins over this choice. Untick it to use the pet below.</small>` : '';
  let sheet = '';
  if (chosen) {
    const stats = Object.entries(chosen.stats).map(([id, v]) => `<span>${esc(name(id))} +${round2(v)}</span>`).join('');
    const perks = chosen.perks.map((k) => `<small>${k.condition ? `<span class="cond">only: ${esc(k.condition)}</span> ` : ''}<b>${esc(k.name)}</b> ${esc(k.text)}</small>`).join('');
    sheet = `<div class="chips">${stats}</div>${perks}<small>Level ${chosen.level}. Perks are shown, never added to the total.</small>`;
  }
  return `<div class="panel pet-panel"><h2>Pet</h2><div class="chips"><button type="button" class="chip-btn${chosen ? '' : ' on'}" data-pet="" aria-pressed="${!chosen}">None</button>${pets.map(chip).join('')}</div>${hint}${sheet}</div>`;
}
