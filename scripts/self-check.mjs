// Local check, not part of the app: node scripts/self-check.mjs
// Compares the private worker answer (personal/fixtures/api-profile.json, from scripts/fetch-private-fixture.mjs) with the
// tooltips in it and with the game's rules, and writes the differences to personal/sources/self-check.md (private).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { loadGameData } from '../apps/guide/gamedata.js';
import { tooltips, checkItems, checkHotm, checkPlausible, renderTable } from './lib/self-check.mjs';

const FIXTURE = 'personal/fixtures/api-profile.json';
if (!existsSync(FIXTURE)) { console.error(`No ${FIXTURE}. Run scripts/fetch-private-fixture.mjs first.`); process.exit(1); }
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const answer = json(FIXTURE);
const data = await loadGameData(async (f) => json(`gamedata/${f}.json`));
const items = json('personal/items.json').r;

const list = await tooltips(answer.inventories);
const itemRows = checkItems(list, items);
const rows = [...itemRows, ...checkHotm(answer, data), ...checkPlausible(answer, list, data, items)];
const table = renderTable(rows);
console.log(`${list.length} items, ${rows.length} differences, ${itemRows.skipped} item stats not modelled by the app, ${itemRows.tooltipOnly} enchants only in the tooltip`);
console.log(table);
mkdirSync('personal/sources', { recursive: true });
writeFileSync('personal/sources/self-check.md', `# Self-check (${new Date().toISOString().slice(0, 10)})\n\n${list.length} items read, ${itemRows.skipped} item stats not modelled by the app (left out), ${itemRows.tooltipOnly} enchants shown in the tooltip but not in the item data (not readable, left out).\n\n${table}`);
