import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { skyDate, skyTime, upcoming, activePerks, electionWindow, eventItems, EVENTS, PERK_ITEMS, DAY_MS, YEAR_DAYS, SOON_MS, MONTHS } from '../events.js';
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
