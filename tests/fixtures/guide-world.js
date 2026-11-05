// The stores of the guide app in test form: game data from gamedata/, a measured base, an empty build.
import fs from 'node:fs';
import { loadGameData } from '../../apps/guide/gamedata.js';
import { emptyBuild, measure } from '../../apps/guide/build.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../../gamedata/${f}.json`, import.meta.url), 'utf8'));
export const gamedata = await loadGameData(read);
export { emptyBuild };

// base: { mining: { values, mp }, blaze: ... } measured at time 1 with an empty build
export const baseOf = (areas) => Object.entries(areas).reduce((all, [area, entry]) => measure(all, area, entry, emptyBuild(), 1), {});
