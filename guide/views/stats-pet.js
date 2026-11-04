// The pet picker (under the power editor): one chip per pet and rarity, what it gives, its perks.
import { esc } from '../../format.js';
import { statsModel } from '../stats-model.js';
import { round2, pic } from './editors.js';

const RARITY = { LEGENDARY: 'Legendary', EPIC: 'Epic', RARE: 'Rare' };
export const petLabel = (p) => `${p.name}${p.rarity === 'LEGENDARY' && p.name !== 'Scatha' ? '' : ` (${RARITY[p.rarity] ?? p.rarity})`}`;
export const petKey = (p) => `${p.id}:${p.rarity}`;

export function petPanel(world, r) {
  const pets = world.gamedata?.pets?.pets;
  if (!pets) return '';
  const { chosen, step } = statsModel(world, r.area).pet;
  const name = (id) => world.gamedata.stats.stats.find((s) => s.id === id)?.name ?? id;
  // every pet is one card: head, name, what it gives and its perks; a perk with a condition says so and is never added up
  const card = (p) => {
    const on = chosen && petKey(chosen) === petKey(p);
    const stats = Object.entries(p.stats).map(([id, v]) => `<span>${esc(name(id))} +${round2(v)}</span>`).join('');
    const perks = p.perks.map((k) => `<small>${k.condition ? `<span class="cond">only: ${esc(k.condition)}</span> ` : ''}<b>${esc(k.name)}</b> ${esc(k.text)}</small>`).join('');
    return `<div class="pet-card${on ? ' on' : ''}"><button type="button" class="pet-pick" data-pet="${esc(petKey(p))}" aria-pressed="${!!on}">${pic(`img/hypixel/pets/${p.id}_${p.rarity}.png`, 'pet-pic', p.name[0])}<span>${esc(petLabel(p))}</span><span>Level ${p.level}</span></button><div class="chips">${stats}</div>${perks}</div>`;
  };
  const hint = step ? `<small class="note">A ticked step already sets the pet (${esc(step)}), so it wins over this choice. Untick it to use the pet below.</small>` : '';
  return `<div class="panel pet-panel" id="pets"><h2>Pet</h2><div class="chips"><button type="button" class="chip-btn${chosen ? '' : ' on'}" data-pet="" aria-pressed="${!chosen}">None</button></div>${hint}<div class="pet-list">${pets.map(card).join('')}</div><small>Perks are shown, never added to the total.</small></div>`;
}
