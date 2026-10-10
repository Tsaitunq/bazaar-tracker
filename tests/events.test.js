import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { skyDate, skyTime, upcoming, activePerks, electionWindow, eventItems, flipWarnings, flipRisks, planElection, termStart, LEAVING_MS, PERK_EXPECT, EVENTS, PERK_ITEMS, DAY_MS, YEAR_DAYS, SOON_MS, MONTHS } from '../events.js';
import { compactElection } from '../scripts/election.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/election.json', import.meta.url), 'utf8'));
const election = compactElection(raw, raw.lastUpdated); // mayor Paul, minister Cole with Mining Fiesta
const YEAR_MS = YEAR_DAYS * DAY_MS;
const at = (month, day, year = 519) => skyTime(year, month, day);
const marina = { mayor: { name: 'Marina', perks: [{ name: 'Fishing Festival', text: '' }], minister: null } };

test('a SkyBlock year lasts 124 hours and starts on Early Spring 1', () => {
  assert.equal(YEAR_MS, 124 * 3600000);
  assert.deepEqual(skyDate(1560275700000), { year: 1, month: 0, day: 1 });
  assert.deepEqual(skyDate(1560275700000 + DAY_MS - 1), { year: 1, month: 0, day: 1 });
  assert.deepEqual(skyDate(1560275700000 + YEAR_MS - 1), { year: 1, month: 11, day: 31 });
  assert.deepEqual(skyDate(at(7, 29)), { year: 519, month: 7, day: 29 });
  assert.equal(MONTHS[7], 'Autumn');
});

test('the clock agrees with the election data: the mayor of year 518 is in office in year 519', () => {
  assert.equal(raw.mayor.election.year, 518);
  assert.deepEqual(skyDate(raw.lastUpdated), { year: 519, month: 3, day: 2 });
});

test('upcoming: running events first, then the next ones in order', () => {
  const now = at(3, 2); // Early Summer 2: Traveling Zoo is on
  const list = upcoming(now, election);
  assert.deepEqual(list.map((e) => e.key), ['zoo', 'spooky', 'workshop', 'jerry', 'newyear', 'hoppity']);
  assert.equal(list[0].active, true);
  assert.equal(list[0].end, at(3, 4));
  assert.equal(list[1].start, at(7, 29));
  assert.equal(list[1].end - list[1].start, 3 * DAY_MS);
  // next year's Hoppity's Hunt
  assert.equal(list[5].start, at(0, 1, 520));
});

test('upcoming: an event that is over moves to its next start, also across the year end', () => {
  const zoo = (now) => upcoming(now, null).find((e) => e.key === 'zoo');
  assert.equal(zoo(at(3, 4)).start, at(9, 1));
  assert.equal(zoo(at(9, 4)).start, at(3, 1, 520));
  const newYear = upcoming(at(11, 31) + DAY_MS - 1, null).find((e) => e.key === 'newyear');
  assert.equal(newYear.active, true);
  assert.equal(upcoming(at(0, 1, 520), null).find((e) => e.key === 'newyear').start, at(11, 29, 520));
});

test('perk events appear only while the perk is active', () => {
  assert.ok(!upcoming(at(3, 2), election).some((e) => e.key === 'fishing'));
  const fishing = upcoming(at(3, 2), marina).find((e) => e.key === 'fishing');
  assert.equal(fishing.active, true);
  assert.equal(upcoming(at(3, 4), marina).find((e) => e.key === 'fishing').start, at(4, 1));
});

test('activePerks lists the mayor\'s perks and the minister\'s', () => {
  assert.deepEqual(activePerks(election).map((p) => [p.name, p.by]), [['Marauder', 'Paul'], ['Benediction', 'Paul'], ['Mining Fiesta', 'Cole, minister']]);
  assert.deepEqual(activePerks(null), []);
  assert.deepEqual(activePerks({}), []);
});

test('the election booth is open from Late Summer 27 to Late Spring 27', () => {
  assert.deepEqual(electionWindow(at(0, 1)), { open: true, at: at(2, 27) });
  assert.deepEqual(electionWindow(at(2, 27)), { open: false, at: at(5, 27) });
  assert.deepEqual(electionWindow(at(5, 27)), { open: true, at: at(2, 27, 520) });
});

test('eventItems marks items of running or near events and of active perks', () => {
  const during = eventItems(at(7, 30), election);
  assert.equal(during.GREEN_CANDY, 'Spooky Festival');
  assert.equal(during.REFINED_MINERAL, 'Mining Fiesta');
  assert.equal(during.WHITE_GIFT, undefined);
  assert.equal(during.SHARK_FIN, undefined);
  // one hour less than the limit before the start: marked; a little earlier: not yet
  assert.equal(eventItems(at(7, 29) - SOON_MS + 3600000, null).GREEN_CANDY, 'Spooky Festival');
  assert.equal(eventItems(at(7, 29) - SOON_MS - 1, null).GREEN_CANDY, undefined);
  assert.deepEqual(eventItems(at(4, 10), null), {});
  assert.equal(eventItems(at(3, 2), marina).SHARK_FIN, 'Fishing Festival');
  // an item of two events keeps the one that comes first
  assert.equal(eventItems(at(11, 25), null).WHITE_GIFT, 'Season of Jerry');
});

test('every curated item and event is documented with its source', () => {
  const doc = fs.readFileSync(new URL('../docs/events-sources.md', import.meta.url), 'utf8');
  for (const e of EVENTS) {
    assert.ok(doc.includes(e.name), e.name);
    for (const id of e.items) assert.ok(doc.includes(`\`${id}\``), `${e.name}: ${id}`);
  }
  for (const [perk, ids] of Object.entries(PERK_ITEMS)) {
    assert.ok(doc.includes(perk), perk);
    for (const id of ids) assert.ok(doc.includes(`\`${id}\``), `${perk}: ${id}`);
  }
});

test('flipWarnings: the leader of the election and the runner-up as minister may lower a price', () => {
  const calm = at(8, 1); // months before the term ends
  const vote = (dianaVotes, perks = ['Mythological Ritual', 'Pet XP Buff']) => ({ vote: { year: 520, candidates: [
    { name: 'Marina', votes: 500, perks: ['Fishing Festival'], minister: 'Fishing Festival' },
    { name: 'Diana', votes: dianaVotes, perks, minister: perks.at(-1) },
    { name: 'Cole', votes: 10, perks: ['Mining Fiesta'], minister: 'Mining Fiesta' },
  ] } });
  const leading = flipWarnings(vote(900), calm);
  assert.equal(leading.GRIFFIN_FEATHER, 'Diana may lower this price');
  // the drops added from the wiki page are covered too
  for (const id of ['BRAIDED_GRIFFIN_FEATHER', 'ENCHANTMENT_ULTIMATE_CHIMERA_1', 'FATEFUL_STINGER', 'SHARD_MINOTAUR']) assert.equal(leading[id], 'Diana may lower this price', id);
  // Marina is second: her minister perk comes along; Cole in third place brings nothing
  assert.equal(leading.SHARK_FIN, 'Marina may lower this price');
  assert.equal(leading.REFINED_MINERAL, undefined);
  assert.equal(Object.keys(leading).length, PERK_EXPECT['Mythological Ritual'].items.length + PERK_EXPECT['Fishing Festival'].items.length);

  // Diana second: only her minister perk counts, and here that is not the ritual
  const behind = flipWarnings(vote(100), calm);
  assert.equal(behind.GRIFFIN_FEATHER, undefined);
  assert.equal(behind.SHARK_FIN, 'Marina may lower this price');
  assert.equal(flipWarnings(vote(100, ['Pet XP Buff', 'Mythological Ritual']), calm).GRIFFIN_FEATHER, 'Diana may lower this price');
  // a file from before the minister perk was stored: the leader still counts
  const old = vote(900);
  for (const c of old.vote.candidates) delete c.minister;
  assert.deepEqual(Object.keys(flipWarnings(old, calm)).sort(), [...PERK_EXPECT['Mythological Ritual'].items].sort());

  // no election, or no vote cast yet: nothing
  assert.deepEqual(flipWarnings({ mayor: { name: 'Paul' }, vote: null }, calm), {});
  assert.deepEqual(flipWarnings(null, calm), {});
  assert.deepEqual(flipWarnings({ vote: { candidates: [{ name: 'Diana', votes: 0, perks: ['Mythological Ritual'] }] } }, calm), {});
});

test('flipWarnings: in the last 24 hours of a term the mayor and the minister are about to leave', () => {
  const end = termStart(at(8, 1)) + YEAR_MS; // Paul, elected in 518, is in office in 519
  assert.deepEqual(flipWarnings(election, end - LEAVING_MS), {});
  const soon = flipWarnings(election, end - LEAVING_MS + 1);
  assert.equal(soon.RECOMBOBULATOR_3000, 'Paul leaves in 24h – price may rise back');
  // chest loot added from the wiki's tables per floor, and the minister's perk
  assert.equal(soon.WITHER_BLOOD, 'Paul leaves in 24h – price may rise back');
  assert.equal(soon.REFINED_MINERAL, 'Cole leaves in 24h – price may rise back');
  assert.equal(flipWarnings(election, end - 5.5 * 3600000).GIANT_TOOTH, 'Paul leaves in 6h – price may rise back');
  assert.equal(flipWarnings(election, end - 60000).GIANT_TOOTH, 'Paul leaves in 1h – price may rise back');
  // the election file still names last term's mayor after the change: no warning for the new term
  assert.deepEqual(flipWarnings(election, end + YEAR_MS - 3600000), {});
  // a perk that stays keeps the election's sentence: Cole is about to be minister again
  const again = { ...election, vote: { year: 519, candidates: [
    { name: 'Diana', votes: 9, perks: ['Pet XP Buff'], minister: 'Pet XP Buff' },
    { name: 'Cole', votes: 5, perks: ['Mining Fiesta'], minister: 'Mining Fiesta' },
  ] } };
  const both = flipWarnings(again, end - 3600000);
  assert.equal(both.REFINED_MINERAL, 'Cole may lower this price');
  assert.equal(both.DARK_ORB, 'Paul leaves in 1h – price may rise back');
});

test('flipRisks says which kind of warning it is; flipWarnings is the same as sentences', () => {
  const end = termStart(at(8, 1)) + YEAR_MS;
  const leaving = flipRisks(election, end - 3600000);
  assert.deepEqual(leaving.RECOMBOBULATOR_3000, { kind: 'leaving', text: 'Paul leaves in 1h – price may rise back' });
  const vote = { vote: { candidates: [{ name: 'Diana', votes: 9, perks: ['Mythological Ritual'], minister: null }] } };
  assert.deepEqual(flipRisks(vote, at(8, 1)).GRIFFIN_FEATHER, { kind: 'election', text: 'Diana may lower this price' });
  assert.equal(flipWarnings(vote, at(8, 1)).GRIFFIN_FEATHER, 'Diana may lower this price');
});

test('planElection: what the Android worker needs to repeat the election warnings for a plan', () => {
  const now = at(8, 1);
  const { perks, term } = planElection(['GRIFFIN_FEATHER', 'REFINED_MINERAL', 'ENCHANTED_IRON'], election, now);
  // only the plan's items, and only those a perk is expected to move
  assert.deepEqual(perks, { GRIFFIN_FEATHER: ['Mythological Ritual'], REFINED_MINERAL: ['Mining Fiesta'] });
  assert.equal(term.end, termStart(now) + YEAR_MS);
  // the mayor's perks first, then the minister's
  assert.deepEqual(Object.entries(term.perks), [['Marauder', 'Paul'], ['Benediction', 'Paul'], ['Mining Fiesta', 'Cole']]);
  // an election file that is behind the calendar names nobody
  assert.equal(planElection([], { mayor: { ...election.mayor, year: 500 } }, now).term, null);
  assert.deepEqual(planElection(['SHARK_FIN'], null, now), { perks: { SHARK_FIN: ['Fishing Festival'] }, term: null });
});
