// What the ticked steps put on the player, over all guides of one area. Ownership is one store, so a piece ticked in guide A counts in guide B.
import { stepKey } from '../progress.js';
import { isItemStep } from '../owned.js';
import { virtualProfile, virtualLoadout, applyStep, baseStats } from '../virtual.js';
import { stepDelta, blazeDelta } from '../optimizer.js';
import { blazeState } from '../blaze.js';
import { gearStats, petStats, petStatsAt } from '../stats.js';
import { rulesOf, pieceExtra, dressDaggers } from '../pieces.js';

// Steps about the build or the pet are not gear: HOTM, shards and power are in the base, the pet is counted once at the end.
const BUILD_KINDS = new Set(['perk', 'attr', 'power', 'essence', 'pet', 'petItem', 'held', 'coll', 'skill']);
const isBuildStep = (step) => { const parts = [step.detect ?? []].flat(); return parts.length > 0 && parts.every((d) => BUILD_KINDS.has(d.kind)); };

const sum = (into, from) => { for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + v; return into; };

// The pet of the build in the game data (id and rarity), null when the build has none or it is not in the data.
export const buildPet = (build, pets) => pets?.find((p) => p.id === build?.pet?.id && p.rarity === build.pet.rarity) ?? null;

// The pets.json entry of the active pet: the one a ticked step sets, otherwise the one saved in the build. null when it is not in the data.
export const activePet = (loadout, build, pets) => (loadout.pet ? pets?.find((p) => p.id === loadout.pet.type && p.rarity === loadout.pet.tier) ?? null : buildPet(build, pets));

// The pet: one a ticked step sets, otherwise the one saved in the build. Never both.
function petGear(loadout, build, pets) {
  if (loadout.pet) return petStats(loadout.pet);
  const known = buildPet(build, pets);
  if (known) return { ...known.stats };
  const pet = build?.pet;
  return pet ? petStatsAt(pet.id, pet.rarity, pet.level) ?? {} : {};
}

// The pet item of the build, from the table in the game data (a pet from a ticked step has none).
const petItemStats = (loadout, build, data) => (loadout.pet ? {} : data?.find((i) => i.id === build?.pet?.item)?.stats ?? {});

// Gear = item stats of the pieces owned + what each ticked step of the guides adds, in guide order.
// values: the typed base, only as the state the Blaze maths of a step starts from.
// Gives the flat gear stats, the profile and loadout the ranking works from.
export function gearOf({ guides, checks, owned, items, area, build, settings, values = {}, mp = null, pets = null, petItems = null }) {
  let profile = virtualProfile({ sections: [] }, new Set(), owned, items, mp);
  let loadout = virtualLoadout(profile, items, area);
  const gear = sum({}, gearStats([...loadout.armor, ...loadout.equipment, ...(loadout.held ? [loadout.held] : [])]));
  let state = baseStats(values, [gear]);
  for (const guide of guides.filter((g) => g.area === area)) {
    const marks = new Set(checks[guide.id] ?? []);
    for (const section of guide.sections) {
      for (const step of section.steps) {
        // an item step is in the owned store already
        if (!marks.has(stepKey(section, step)) || isItemStep(step)) continue;
        loadout = virtualLoadout(profile, items, area);
        const change = isBuildStep(step) ? null : area === 'blaze'
          ? blazeDelta(step, blazeState(state, loadout, loadout.daggers), loadout, profile, items, settings, guide)
          : stepDelta(step, loadout, profile, items, settings, guide);
        const flat = change?.common ?? change ?? {};
        sum(gear, flat);
        state = baseStats(state, [flat]);
        profile = applyStep(profile, step, guide, items);
        if (change?.mp && profile.mp !== null) profile.mp += change.mp;
      }
    }
  }
  loadout = virtualLoadout(profile, items, area);
  sum(gear, petGear(loadout, build, pets));
  sum(gear, petItemStats(loadout, build, petItems));
  // stars, potato books and Bling Armor of the worn pieces, with the pet that is active at the end
  const pet = activePet(loadout, build, pets);
  const rules = area === 'blaze' ? rulesOf(build, pet) : null;
  for (const piece of loadout.armor) sum(gear, pieceExtra(piece.id, items, rules));
  if (rules) loadout.daggers = dressDaggers(loadout.daggers, items, rules);
  return { gear, profile, loadout, stepPet: loadout.pet ?? null, pet, rules };
}
