// Compares calculated stats with /stats values, locally: node scripts/stats-report.mjs [--slots | --scan | --parts]
// Reads personal/fixtures/profile-fixture.json, stats-ingame.json and personal/items.json. Prints stat names and numbers,
// and game ids only where a pet has to be named. No player names, no loadout names, no uuids.
import { existsSync, readFileSync } from 'node:fs';
import { summarize } from '../profile.js';
import { loadoutOf, computeStats, compareStats, AREA_STATS } from '../stats.js';

const LIMIT = 2; // percent; above it a difference is a finding
const FILE = 'personal/fixtures/stats-ingame.json';
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const num = (v) => String(Math.round(v * 100) / 100);
const flag = process.argv[2];

const profile = await summarize(read('personal/fixtures/profile-fixture.json').members.self);
const items = read('personal/items.json').r;

if (flag === '--slots') {
  for (const kind of ['armor', 'equipment']) {
    const { equipped, sets } = profile.wardrobe[kind];
    console.log(`${kind}: ${sets.map((n) => `${n} (${profile.items.filter((i) => i.sets?.includes(`${kind}:${n}`)).length} parts${n === equipped ? ', worn' : ''})`).join(', ')}`);
  }
  process.exit(0);
}

if (!existsSync(FILE)) {
  console.error(`${FILE} is missing. Format: docs/plan-optimizer-p3-4.md, task 7.`);
  process.exit(1);
}
const ingame = read(FILE);
const META = new Set(['boost', 'armor', 'equipment', 'pet', 'held']);
const valuesOf = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => !META.has(k)));

const calc = (area, choice, held) => computeStats(profile, items, loadoutOf(profile, items, area, { ...choice, emptyHand: held === false }), area);

for (const [area, m] of Object.entries(ingame)) {
  if (flag === '--scan') {
    // Which slots fit the numbers best: a hint when the slots of a measurement are not known, no proof.
    const pets = m.pet ? [m.pet] : [...new Set(profile.pets.map((p) => `${p.type}:${p.tier}`))];
    const rows = [];
    for (const armor of profile.wardrobe.armor.sets) for (const equipment of profile.wardrobe.equipment.sets) for (const pet of pets) {
      const r = compareStats(calc(area, { armor, equipment, pet }, m.held).total, valuesOf(m));
      rows.push({ armor, equipment, pet, off: r.reduce((sum, x) => sum + (x.percent ?? 100), 0) / r.length });
    }
    rows.sort((a, b) => a.off - b.off);
    console.log(`\n${area}: best fits of ${rows.length}`);
    for (const r of rows.slice(0, 5)) console.log(`  armor ${r.armor}, equipment ${r.equipment}, ${r.pet}: mean difference ${num(r.off)} %`);
    continue;
  }
  const choice = { armor: m.armor || undefined, equipment: m.equipment || undefined, pet: m.pet || undefined };
  const { total, parts } = calc(area, choice, m.held);
  console.log(`\n${area}${m.boost ? ' (God Potion / Booster Cookie active)' : ''}\n| Stat | calculated | /stats | difference |\n|---|---|---|---|`);
  for (const r of compareStats(total, valuesOf(m))) {
    console.log(`| ${r.stat} | ${num(r.calculated)} | ${num(r.inGame)} | ${r.percent === null ? 'n/a' : `${num(r.calculated >= r.inGame ? r.percent : -r.percent)} %`}${r.percent === null || r.percent > LIMIT ? ' FINDING' : ''} |`);
  }
  if (flag === '--parts') {
    for (const stat of AREA_STATS[area]) {
      const line = Object.entries(parts).filter(([, p]) => p[stat]).map(([name, p]) => `${name} ${num(p[stat])}`).join(', ');
      console.log(`  ${stat}: ${line || '-'}`);
    }
  }
}
