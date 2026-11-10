import test from 'node:test';
import assert from 'node:assert/strict';
import {
  statId, parseRewardTable, parseSlayerLevels, parseSlayerOverview, parseCookie, parseGodPotionEffects, parseEnrichments, expandNeu, series, cumulative,
} from '../../scripts/lib/stat-sources.mjs';

const REWARDS = `{|class="wikitable ct"
! rowspan="2" | Level
! colspan="2" | XP
! colspan="2" | Defense
! colspan="2" | Bonus Damage
! rowspan="2" style="min-width: 150px" | Unlocks
|-
! Level
! Total
! Level
! Total
! Level
! Total
|-
| 1
| {{Green|50}}
| {{Green|50}}
| {{Stat|defense|icononly=yes|+1}}
| {{Stat|defense|icononly=yes|+1}}
| {{Red|+4%}}
| {{Red|+4%}}
| style="text-align: left" | Access to the {{Zone|Gold Mine}} <br> Unlock {{Green|1}} item
|-
| 2
| {{Green|125}}
| {{Green|1,175}}
| {{Stat|defense|icononly=yes|+1}}
| {{Stat|defense|icononly=yes|+2}}
| {{Red|+4%}}
| {{Red|+8%}}
| nothing
|}
trailing text`;

test('reward table: levels, per-level and total columns, the stat id, percent columns, the text cell left out', () => {
  const t = parseRewardTable(REWARDS);
  assert.equal(t.levels, 2);
  assert.deepEqual(Object.keys(t.columns), ['XP', 'Defense', 'Bonus Damage']);
  assert.deepEqual(t.columns.XP.perLevel, [50, 125]);
  assert.deepEqual(t.columns.Defense.perLevel, [1, 1]);
  assert.equal(t.columns.Defense.stat, 'defense');
  assert.equal(t.columns['Bonus Damage'].percent, true);
  assert.equal(t.columns['Bonus Damage'].stat, null);
});

test('reward table: a total that is not the running sum is reported, not hidden', () => {
  const t = parseRewardTable(REWARDS);
  assert.deepEqual(t.problems, ['XP: total at level 2 is 1175, the sum is 175']);
});

test('slayer levels: level, XP, stats and SkyBlock XP of a row, also with row spans in front', () => {
  const page = `== Leveling Rewards ==
{| class="wikitable ct"
! rowspan="2" |LVL
|-
| rowspan="2" |{{Text anchor|I|1}}
| rowspan="2" |{{Pink|5}}
| rowspan="2" |Noob
| rowspan="2" |{{stat|hp|+2}}<br>{{SBXP|15}}
| rowspan="2" |{{Slot|Wand of Healing}}
|{{Slot|Revenant Flesh, 1-3}}
|-
|{{Text anchor|II|2}}
|{{Pink|1,500}}
|Novice
|{{stat|cd|+1}}{{stat|rt|+3}}<br>{{SBXP|25}}
|{{Slot|Zombie Ring}}
|}
== Next ==`;
  const levels = parseSlayerLevels(page);
  assert.deepEqual(levels.map((l) => [l.level, l.xp, l.stats, l.sbXp]), [[1, 5, { HEALTH: 2 }, 15], [2, 1500, { CRITICAL_DAMAGE: 1 }, 25]]);
  assert.deepEqual(levels[1].unknown, ['rt']);
});

test('slayer overview: cells that span rows are repeated, k and m are read', () => {
  const page = `== Leveling Slayer ==
{| class="wikitable centertext"
!Slayer
!LVL 1
!LVL 2
!LVL 3
|-
!Zombie
| rowspan="2" | {{LightPurple|5 XP}}
|{{LightPurple|15 XP}}
| rowspan="2" |{{LightPurple|20k XP}}
|-
!Spider
|{{LightPurple|25 XP}}
|-
!Vampire
|{{LightPurple|1.5m XP}}
| colspan="2" | {{bc}}
|}`;
  const o = parseSlayerOverview(page);
  assert.deepEqual(o.zombie, [5, 15, 20000]);
  assert.deepEqual(o.spider, [5, 25, 20000]);
  assert.deepEqual(o.vampire, [1500000]);
});

test('NEU rewards hold from their level to the next entry', () => {
  assert.deepEqual(expandNeu({ 1: { health: 2 }, 3: { health: 3 } }, 5), { health: [2, 2, 3, 3, 3] });
  // an entry replaces the one before it: a stat it leaves out has no value from there on
  const two = expandNeu({ 1: { a: 1 }, 2: { b: 1 } }, 3);
  assert.deepEqual(Object.keys(two), ['a', 'b']);
  assert.equal(two.a[0], 1);
  assert.equal(two.a[1], undefined);
  assert.deepEqual([two.b[1], two.b[2]], [1, 1]);
  assert.deepEqual(expandNeu({}, 3), {});
});

test('series: safe when two sources agree, unsafe with the levels that differ, unsafe with one source', () => {
  const a = { name: 'wiki', values: [1, 2, 3] };
  assert.deepEqual(series([a, { name: 'NEU', values: [1, 2, 3] }]), { values: [1, 2, 3], src: ['wiki', 'NEU'], confidence: 'safe' });
  const diff = series([a, { name: 'NEU', values: [1, 5, 3] }]);
  assert.equal(diff.confidence, 'unsafe');
  assert.deepEqual(diff.diff, [2]);
  const one = series([a]);
  assert.equal(one.confidence, 'unsafe');
  assert.equal(one.note, 'one source');
  // a longer second source only counts where both have levels, and says so
  const long = series([a, { name: 'NEU', values: [1, 2, 3, 4, 5] }]);
  assert.equal(long.confidence, 'safe');
  assert.match(long.note, /NEU has 5 levels/);
  assert.deepEqual(series([{ name: 'wiki', values: [1, null] }]).values, [1, 0]);
});

test('cumulative sums without float noise', () => {
  assert.deepEqual(cumulative([0.1, 0.2, 0.3]), [0.1, 0.3, 0.6]);
});

test('stat ids: templates and abbreviations of the wiki', () => {
  assert.equal(statId('hp'), 'HEALTH');
  assert.equal(statId(' Crit Damage '), 'CRITICAL_DAMAGE');
  assert.equal(statId('MnF'), 'MINING_FORTUNE');
  assert.equal(statId('rt'), null);
});

test('cookie, god potion and enrichment texts', () => {
  assert.deepEqual(parseCookie('lasts for {{Green|4}} days\n*{{stat|wisdom|+25|icononly=yes}} on all [[Wisdom]] stats\n*{{stat|mf|+15}}'), { wisdom: 25, magicFind: 15, days: 4 });
  const potion = `{| class="wikitable"
|-
|{{Potion|Critical IV}}
|Grants stuff
|{{stat|cc|25}}<br>{{stat|cd|40}}
|-
|{{Potion|Jump Boost IV}}
|Jumps
|Higher jump
|-
|{{Potion|Strength VIII}}
|x
|{{stat|str|78.75}}
|}`;
  assert.deepEqual(parseGodPotionEffects(potion), { 'Critical IV': { CRITICAL_CHANCE: 25, CRITICAL_DAMAGE: 40 }, 'Strength VIII': { STRENGTH: 78.75 } });
  assert.deepEqual(parseEnrichments("|Enrich an accessory with the power of +1 {{Stat|Speed}}.\n|Enrich an accessory with the power of 0.3 '''{{Stat|Ferocity}}'''.\n|Enrich an accessory with the power of +3 {{Stat|Health}}."), { SPEED: 1, FEROCITY: 0.3, HEALTH: 3 });
});
