// Local, once: node scripts/fetch-private-fixture.mjs <name> <profile name>
// Saves the worker's answer to personal/fixtures/api-profile.json (personal/ is not in git). Tests and self-check read it when it exists.
import { writeFileSync, mkdirSync } from 'node:fs';
import { listProfiles, fetchProfile } from '../apps/guide/import/api.js';

const [name, wanted] = process.argv.slice(2);
if (!name || !wanted) { console.error('usage: node scripts/fetch-private-fixture.mjs <name> <profile name>'); process.exit(2); }
const profile = (await listProfiles(name)).find((p) => p.cute_name.toLowerCase() === wanted.toLowerCase());
if (!profile) { console.error('Profile not found.'); process.exit(1); }
const answer = await fetchProfile(name, profile.id);
mkdirSync('personal/fixtures', { recursive: true });
writeFileSync('personal/fixtures/api-profile.json', JSON.stringify(answer));
console.log(`saved: ${Object.keys(answer).length} top-level keys`);
