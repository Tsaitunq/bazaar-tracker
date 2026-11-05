// The pet picker (under the power editor): one chip per pet and rarity, what it gives, its perks.
import { esc } from '../../../shared/format.js';
import { statsModel } from '../stats-model.js';
import { round2, pic } from './editors.js';
import { gearOptions } from '../build.js';
import { CRIMSON_STAR, HPB } from '../optimizer-data.js';

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
    return `<div class="pet-card${on ? ' on' : ''}" data-pet-card="${esc(petKey(p))}"><button type="button" class="pet-pick" data-pet="${esc(petKey(p))}" aria-pressed="${!!on}">${pic(`img/hypixel/pets/${p.id}_${p.rarity}.png`, 'pet-pic', p.name[0])}<span>${esc(petLabel(p))}</span><span>Level ${p.level}</span></button><div class="chips">${stats}</div>${perks}</div>`;
  };
  const hint = step ? `<small class="note">A ticked step already sets the pet (${esc(step)}), so it wins over this choice. Untick it to use the pet below.</small>` : '';
  return `<div class="panel pet-panel" id="pets"><h2>Pet</h2><div class="chips"><button type="button" class="chip-btn${chosen ? '' : ' on'}" data-pet="" aria-pressed="${!chosen}">None</button></div>${hint}<div class="pet-list">${pets.map(card).join('')}</div><small>Perks are shown, never added to the total.</small></div>`;
}

// The pet item under the picker: only the items of the table, and only when a pet is chosen.
export function petItemPanel(world) {
  const items = world.gamedata?.pets?.items;
  if (!items?.length || !world.build.pet) return '';
  const name = (id) => world.gamedata.stats.stats.find((s) => s.id === id)?.name ?? id;
  const on = world.build.pet.item ?? '';
  const chip = (i) => `<button type="button" class="chip-btn${on === i.id ? ' on' : ''}" data-pet-item="${esc(i.id)}" aria-pressed="${on === i.id}">${esc(i.name)} <small>${Object.entries(i.stats).map(([s, v]) => `${esc(name(s))} +${round2(v)}`).join(', ')}</small></button>`;
  return `<div class="panel"><h2>Pet item</h2><div class="chips"><button type="button" class="chip-btn${on ? '' : ' on'}" data-pet-item="" aria-pressed="${!on}">None</button>${items.map(chip).join('')}</div></div>`;
}

// Blaze gear options. Not measured with the base, so they are changes like the pet. Assumptions are marked.
export function gearPanel(world) {
  const g = gearOptions(world.build);
  const num = (key, label, max, value, hint) => `<label class="field">${label}<input type="number" min="0" max="${max}" step="1" inputmode="numeric" data-gear="${key}" value="${value ?? ''}"></label>${hint ? `<small>${hint}</small>` : ''}`;
  return `<div class="panel gear-panel" id="gear"><h2>Gear</h2>
    ${num('catacombs', 'Catacombs level', 60, g.catacombs, g.catacombs === null ? 'Not set: Withered and Ancient are listed, not counted.' : 'Withered gives +1 Strength and Ancient +1 Crit Damage per level (assumed to count outside dungeons).')}
    ${num('stars', 'Crimson stars (whole set)', CRIMSON_STAR.max, g.stars, `+${CRIMSON_STAR.percent} % of the item stats per star (assumed to count everywhere).`)}
    <label class="check"><input type="checkbox" data-gear="hpb"${g.hpb ? ' checked' : ''}> All armor and daggers with ${HPB.max} Hot Potato Books</label>
    ${num('fuming', 'Fuming Potato Books (0–' + HPB.fumingMax + ')', HPB.fumingMax, g.fuming, 'The Blaze pet doubling is assumed to double Fuming books too.')}
    <small>Order of the maths on a piece (assumed): (item stats × stars + books) × Bling Armor, then reforge and enchants.</small></div>`;
}
