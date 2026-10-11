// Mayor and event radar: the SkyBlock calendar, the events on it and the items that belong to them.
// Dates, items and every source are listed in docs/events-sources.md. An item here is "typically
// affected": it is obtained during the event or through the perk. What its price did in past runs
// is learned from our own snapshots (timing.js); PERK_EXPECT below is the only place with an expectation.

export const SB_EPOCH = 1560275700000; // start of SkyBlock year 1
export const DAY_MS = 20 * 60000;
export const MONTH_DAYS = 31;
export const YEAR_DAYS = 12 * MONTH_DAYS;
export const SOON_MS = 24 * 3600000;   // an event this close already marks its items
export const MONTHS = ['Early Spring', 'Spring', 'Late Spring', 'Early Summer', 'Summer', 'Late Summer',
  'Early Autumn', 'Autumn', 'Late Autumn', 'Early Winter', 'Winter', 'Late Winter'];

// { year, month: 0..11, day: 1..31 }
export function skyDate(ms) {
  const days = Math.floor((ms - SB_EPOCH) / DAY_MS);
  const year = Math.floor(days / YEAR_DAYS);
  const ofYear = days - year * YEAR_DAYS;
  return { year: year + 1, month: Math.floor(ofYear / MONTH_DAYS), day: (ofYear % MONTH_DAYS) + 1 };
}
export const skyTime = (year, month, day) => SB_EPOCH + ((year - 1) * YEAR_DAYS + month * MONTH_DAYS + day - 1) * DAY_MS;

const JERRY = ['WHITE_GIFT', 'GREEN_GIFT', 'RED_GIFT', 'ICE_HUNK', 'BLUE_ICE_HUNK', 'ENCHANTED_ICE', 'ENCHANTED_PACKED_ICE', 'WALNUT', 'GLACIAL_FRAGMENT', 'ICE_BAIT'];

// Harvest Feast: the 13 Rare Crops (named in the wiki's table; the ids are the Bazaar items of the same name)
// and the Feast Flask. Seasoning has no item.
const FEAST = ['CORNUCOPIA', 'CARROT_ZEST', 'DEEPFRIES', 'AGGOURDIAN', 'CANE_KNOT', 'MELON_JUICE', 'CACTUS_FLOWER',
  'DESIGNER_COFFEE_BEANS', 'FEASTFUNGUS', 'BOTROOT', 'SALTED_SUNFLOWER_SEEDS', 'CRYSTALIZED_MOONLIGHT', 'FLORAL_GELATIN', 'FEAST_FLASK'];

// starts: [month, day] of every start within a year. perk: only while that mayor perk is active.
export const EVENTS = [
  { key: 'spooky', name: 'Spooky Festival', starts: [[7, 29]], days: 3,
    items: ['GREEN_CANDY', 'PURPLE_CANDY', 'PUMPKIN_GUTS', 'ECTOPLASM', 'WEREWOLF_SKIN', 'SPOOKY_SHARD', 'SOUL_FRAGMENT'] },
  { key: 'workshop', name: "Jerry's Workshop", starts: [[11, 1]], days: 31, items: JERRY },
  { key: 'jerry', name: 'Season of Jerry', starts: [[11, 24]], days: 3, items: JERRY },
  { key: 'newyear', name: 'New Year Celebration', starts: [[11, 29]], days: 3, items: [] },
  { key: 'zoo', name: 'Traveling Zoo', starts: [[3, 1], [9, 1]], days: 3, items: [] },
  { key: 'hoppity', name: "Hoppity's Hunt", starts: [[0, 1]], days: 3 * MONTH_DAYS, items: [] },
  // Harvest Feast: every year, Early Autumn 1 to Late Autumn 31 (wiki: "3 months spanning Early Autumn, Autumn and
  // Late Autumn"). Finnegan's Grand Feast perk makes it last the whole year.
  { key: 'feast', name: 'Harvest Feast', starts: [[6, 1]], days: 3 * MONTH_DAYS, items: FEAST },
  { key: 'grandfeast', name: 'Grand Feast', perk: 'Grand Feast', starts: [[0, 1]], days: 12 * MONTH_DAYS, items: FEAST },
  { key: 'fishing', name: 'Fishing Festival', perk: 'Fishing Festival', starts: MONTHS.map((_, month) => [month, 1]), days: 3,
    items: ['SHARK_FIN', 'ENCHANTED_SHARK_FIN', 'NURSE_SHARK_TOOTH', 'BLUE_SHARK_TOOTH', 'TIGER_SHARK_TOOTH', 'GREAT_WHITE_SHARK_TOOTH',
      // crafted from them and traded on the Bazaar (wiki, Fishing Festival: "Items Crafted From Festival Items")
      'GREAT_WHITE_TOOTH_MEAL', 'SHARK_BAIT'] },
];

// Perks that run for the whole term and bring their own items.
export const PERK_ITEMS = {
  'Mining Fiesta': ['REFINED_MINERAL', 'GLOSSY_GEMSTONE', 'SHARD_PACKRAT_SKULL'],
  'Blooming Business': ['FINE_FLOUR'],
  'Stock Exchange': ['STOCK_OF_STONKS'],
  'Mythological Ritual': ['GRIFFIN_FEATHER', 'BRAIDED_GRIFFIN_FEATHER', 'ANCIENT_CLAW', 'ENCHANTED_ANCIENT_CLAW', 'DAEDALUS_STICK', 'MYTHOS_FRAGMENT',
    'ENCHANTMENT_ULTIMATE_CHIMERA_1', 'FATEFUL_STINGER', 'BRAIN_FOOD',
    'SHARD_MINOS_HUNTER', 'SHARD_CRETAN_BULL', 'SHARD_HARPY', 'SHARD_MINOTAUR', 'SHARD_SPHINX', 'SHARD_KING_MINOS'],
};

// election: the content of election.json, or null. The minister's perk is active like the mayor's.
export function activePerks(election) {
  const mayor = election?.mayor;
  if (!mayor) return [];
  return [
    ...(mayor.perks ?? []).map((p) => ({ ...p, by: mayor.name })),
    ...(mayor.minister ? [{ ...mayor.minister.perk, by: `${mayor.minister.name}, minister` }] : []),
  ];
}

// Every event's running or next occurrence: running ones first (ending soonest), then by start.
export function upcoming(nowMs, election) {
  const perks = new Set(activePerks(election).map((p) => p.name));
  const { year } = skyDate(nowMs);
  return EVENTS.filter((e) => !e.perk || perks.has(e.perk)).map((e) => {
    const length = e.days * DAY_MS;
    const start = [year - 1, year, year + 1].flatMap((y) => e.starts.map(([month, day]) => skyTime(y, month, day)))
      .sort((a, b) => a - b).find((s) => s + length > nowMs);
    return { ...e, start, end: start + length, active: start <= nowMs };
  }).sort((a, b) => b.active - a.active || (a.active ? a.end - b.end : a.start - b.start));
}

// The election booth opens on Late Summer 27 and closes on Late Spring 27 of the next year.
// Returns whether it is open now and when that changes.
export function electionWindow(nowMs) {
  const { year } = skyDate(nowMs);
  const closes = skyTime(year, 2, 27);
  const opens = skyTime(year, 5, 27);
  if (nowMs < closes) return { open: true, at: closes };
  return nowMs < opens ? { open: false, at: opens } : { open: true, at: skyTime(year + 1, 2, 27) };
}

// { itemId: name of the event or perk } for the badge in the lists: events that run or start within
// SOON_MS, and perks that are active.
export function eventItems(nowMs, election) {
  const out = {};
  for (const e of upcoming(nowMs, election)) {
    if (e.active || e.start - nowMs <= SOON_MS) for (const id of e.items) out[id] ??= e.name;
  }
  for (const p of activePerks(election)) for (const id of PERK_ITEMS[p.name] ?? []) out[id] ??= p.name;
  return out;
}

// What a perk is expected to do to prices while it is active. The sources only describe the perk;
// "cheaper" is our conclusion from it (docs/events-sources.md), so `why` is always shown next to it.
export const PERK_EXPECT = {
  Marauder: { why: 'dungeon reward chests cost 20% less',
    items: ['RECOMBOBULATOR_3000', 'FUMING_POTATO_BOOK', 'WITHER_CATALYST', 'PRECURSOR_GEAR',
      'FIRST_MASTER_STAR', 'SECOND_MASTER_STAR', 'THIRD_MASTER_STAR', 'FOURTH_MASTER_STAR', 'FIFTH_MASTER_STAR',
      'WITHER_BLOOD', 'IMPLOSION_SCROLL', 'SHADOW_WARP_SCROLL', 'WITHER_SHIELD_SCROLL', 'GIANT_TOOTH', 'SADAN_BROOCH',
      'DARK_ORB', 'NECROMANCER_BROOCH', 'SPIRIT_BONE', 'SPIRIT_WING',
      'SUSPICIOUS_VIAL', 'RED_NOSE', 'RED_SCARF'] },
  'Mining Fiesta': { why: 'drops from mining while the perk is active', items: PERK_ITEMS['Mining Fiesta'] },
  'Mythological Ritual': { why: 'found while the perk is active', items: PERK_ITEMS['Mythological Ritual'] },
  'Blooming Business': { why: 'Garden Visitors give out Fine Flour and appear more often', items: PERK_ITEMS['Blooming Business'] },
  'Stock Exchange': { why: 'Stock of Stonks can be won in the Stonks Auction', items: PERK_ITEMS['Stock Exchange'] },
  'Fishing Festival': { why: 'shark loot from the festivals', items: EVENTS.find((e) => e.key === 'fishing').items },
};

// Derpy's QUAD TAXES!!!: "Bazaar and Auction House tax are quadrupled" (wiki, Derpy). The Bazaar tax a player
// has (1.25, 1.125 or 1 percent) becomes four times as much.
export const DERPY_TAX = { 1.25: 5, 1.125: 4.5, 1: 4 };
// What to tell the player about the tax setting: { want, text } or null when the setting is fine.
// With Derpy the setting should be the quadrupled one; without him a quadrupled setting is a left-over.
export function taxAdvice(derpy, set) {
  const want = derpy ? DERPY_TAX[set] : Object.keys(DERPY_TAX).find((k) => DERPY_TAX[k] === set);
  if (!want) return null;
  const mayor = derpy ? 'Derpy is mayor' : 'Derpy is not mayor';
  return { want: Number(want), text: `${mayor} – Bazaar tax is ${want}%. Your setting: ${set}%.` };
}

export const LEAVING_MS = 24 * 3600000; // a term this close to its end is announced on the items it holds down

// { itemId: { kind, text } } for the portfolio: what the election may do to an item's price. Two cases, both from
// PERK_EXPECT and so an expectation, not a measurement:
// - a perk that is coming: all perks of the candidate with the most votes, and the minister perk of the
//   runner-up (candidate.minister; absent in files written before it was stored)
// - a perk that is going: the mayor's and the minister's, when the term ends within LEAVING_MS
// An item with both keeps the first, because the perk stays. kind is 'election' or 'leaving'.
export function flipRisks(election, nowMs) {
  const out = {};
  let kind = 'election';
  const mark = (perk, text) => { for (const id of PERK_EXPECT[perk]?.items ?? []) out[id] ??= { kind, text }; };
  const [lead, second] = [...(election?.vote?.candidates ?? [])].sort((a, b) => b.votes - a.votes);
  if (lead?.votes > 0) {
    for (const perk of lead.perks) mark(perk, `${lead.name} may lower this price`);
    if (second?.votes > 0 && second.minister) mark(second.minister, `${second.name} may lower this price`);
  }
  const start = termStart(nowMs);
  const left = start + YEAR_DAYS * DAY_MS - nowMs;
  const mayor = election?.mayor;
  // the election file lags behind the calendar: only a mayor elected for this term counts
  if (left < LEAVING_MS && mayor?.year === skyDate(start).year - 1) {
    kind = 'leaving';
    const leaves = (name) => `${name} leaves in ${Math.ceil(left / 3600000)}h – price may rise back`;
    for (const perk of mayor.perks ?? []) mark(perk.name, leaves(mayor.name));
    if (mayor.minister) mark(mayor.minister.perk.name, leaves(mayor.minister.name));
  }
  return out;
}
// the same as plain sentences
export const flipWarnings = (election, nowMs) =>
  Object.fromEntries(Object.entries(flipRisks(election, nowMs)).map(([id, risk]) => [id, risk.text]));

// What the Android worker needs to repeat flipRisks for the items of a plan. It has no calendar and no
// list of perks, so both come from here:
// perks: { itemId: [perk names that are expected to lower its price] }, only for the given ids
// term: { end, perks: { perk name: who brings it } } of the mayor in office, or null when the election
// file is behind the calendar. The worker reads the candidates from election.json itself.
export function planElection(ids, election, nowMs) {
  const perks = {};
  for (const [perk, { items }] of Object.entries(PERK_EXPECT)) {
    for (const id of items) if (ids.includes(id)) (perks[id] ??= []).push(perk);
  }
  const start = termStart(nowMs);
  const mayor = election?.mayor;
  const term = mayor?.year === skyDate(start).year - 1 ? {
    end: start + YEAR_DAYS * DAY_MS,
    perks: Object.fromEntries([...(mayor.perks ?? []).map((p) => [p.name, mayor.name]),
      ...(mayor.minister ? [[mayor.minister.perk.name, mayor.minister.name]] : [])]),
  } : null;
  return { perks, term };
}

// A mayor takes office when the election closes on Late Spring 27 and stays for a year.
// Returns the start of the term that runs at nowMs.
export function termStart(nowMs) {
  const { year } = skyDate(nowMs);
  const start = skyTime(year, 2, 27);
  return start <= nowMs ? start : skyTime(year - 1, 2, 27);
}

// Every perk of the regular and special mayors, as the Mayor Election page lists them (read 2026-10-11).
// The wiki gives no price direction for any of them; PERK_EXPECT above is the only place with an expectation.
export const PERKS = [
  ['Aatrox', 'SLASHED Pricing', 'Starting Slayer quests is half price.'],
  ['Aatrox', 'Slayer XP Buff', 'Earn 25% more Slayer XP.'],
  ['Aatrox', 'Pathfinder', 'Gain rare drops 20% more often.'],
  ['Cole', 'Prospection', 'Mining minions work 25% faster.'],
  ['Cole', 'Mining XP Buff', 'Get +60 Mining Wisdom on public islands.'],
  ['Cole', 'Mining Fiesta', 'Refined Mineral and Glossy Gemstone drop from mining; Packrat Shard is sold by Brynmor.'],
  ['Cole', 'Molten Forge', 'Decrease the time it takes to forge items by 25%.'],
  ['Diana', "Huntress' Intuition", 'Gain +10 Tracking.'],
  ['Diana', 'Mythological Ritual', 'Griffin burrows and Mythological creatures with unique drops.'],
  ['Diana', 'Pet XP Buff', 'Gain +35% more pet XP.'],
  ['Diana', 'Sharing is Caring', 'Up to 3 EXP Shared Pets active at once.'],
  ['Diaz', 'Long Term Investment', 'The elected Minister will appear in the next Election with all of their available perks.'],
  ['Diaz', 'Volume Trading', "Double the item quantity from Shen's Auction, Shen's Special and Rift Shen's."],
  ['Diaz', 'Stock Exchange', 'Participate in the Stonks Auction for a chance to win Stock of Stonks.'],
  ['Diaz', 'Shopping Spree', 'Increase daily NPC buy limits by 10x.'],
  ['Finnegan', 'Pest Eradicator', "Pesthunter Phillip's Farming Fortune bonus lasts 60m; Pests spawn 20% less often."],
  ['Finnegan', 'GOATed', "Jacob's Farming Contest brackets include up to 10% more players each."],
  ['Finnegan', 'Blooming Business', 'Garden Visitors give out Fine Flour, appear more often and give 10% more Copper.'],
  ['Finnegan', 'Grand Feast', 'Upgrades the Harvest Feast into the Grand Feast, which lasts a full SkyBlock year.'],
  ['Foxy', 'Sweet Benevolence', 'Earn +30% more Candy, Gifts and Chocolate from duplicate Rabbits.'],
  ['Foxy', 'Extra Event', 'Schedules an extra event during the year.'],
  ['Foxy', 'A Time for Giving', 'Party Chests and Party Gifts can be obtained while this event is active.'],
  ['Foxy', 'Chivalrous Carnival', 'Schedules a Carnival in the Hub that is active throughout the entire year.'],
  ['Marina', 'Fishing XP Buff', 'Gain 50 Fishing Wisdom on public islands.'],
  ['Marina', 'Luck of the Sea 2.0', 'Gain 15 Sea Creature Chance.'],
  ['Marina', 'Fishing Festival', 'Fight dangerous Sharks and earn unique Shark loot during the festivals.'],
  ['Marina', 'Double Trouble', 'For every 1 Sea Creature Chance, gain +0.1 Double Hook Chance.'],
  ['Paul', 'Marauder', 'Dungeon reward chests are 20% cheaper.'],
  ['Paul', 'EZPZ', 'Gain 10 extra bonus score in Dungeons.'],
  ['Paul', 'Benediction', 'Blessings are 25% stronger.'],
  ['Scorpius', 'Bribe', 'Offers 50,000 to 1,000,000 coins for a Bribe.'],
  ['Scorpius', 'Darker Auctions', 'The Dark Auction has 7 rounds and offers special items.'],
  ['Jerry', 'Perkpocalypse', 'Activates all perks of another mayor every 18 SkyBlock days (6 hours).'],
  ['Jerry', 'Statspocalypse', 'Increases all Combat and Miscellaneous stats by 10%.'],
  ['Jerry', 'Jerrypocalypse', 'Reveals hidden Jerries from logging, farming, mining and killing mobs.'],
  ['Derpy', 'QUAD TAXES!!!', 'Pay 4x the normal amount of taxes.'],
  ['Derpy', 'TURBO MINIONS!!!', 'Minions have double the output.'],
  ['Derpy', 'DOUBLE MOBS HP!!!', 'All monsters have double health.'],
  ['Derpy', 'MOAR SKILLZ!!!', 'Gain +50% more skill experience.'],
].map(([who, name, text]) => ({ who, name, text }));

// The "Year of the" events: one SkyBlock year each, "every 12 SkyBlock Years" (wiki). The wiki does not
// say in which years, so no start can be computed and no countdown shown. items: Bazaar items of the event.
export const YEAR_EVENTS = [
  { key: 'seal', name: 'Year of the Seal', text: 'Fish up Bouncy Beach Balls and spend Fishy Treats at Lukas the Aquarist.',
    items: ['BOUNCY_BEACH_BALL', 'GIANT_BOUNCY_BEACH_BALL', 'SMALL_SEAL_PLUSHIE', 'MEDIUM_SEAL_PLUSHIE', 'LARGE_SEAL_PLUSHIE', 'GIANT_SEAL_PLUSHIE'] },
  { key: 'witch', name: 'Year of the Witch', text: 'Mobs drop ingredients; Agnes and Alcina trade them for Witches Stew and shop items.',
    items: ['SMALL_WITCH_CAULDRON', 'MEDIUM_WITCH_CAULDRON', 'LARGE_WITCH_CAULDRON', 'GIANT_WITCH_CAULDRON'] },
  { key: 'pig', name: 'Year of the Pig', text: 'Shiny Pigs spawn; Shiny Orbs on them give rewards, Piggy sells items for Shiny Tokens.',
    items: ['SMALL_PIG_EAR', 'MEDIUM_PIG_EAR', 'LARGE_PIG_EAR', 'GIANT_PIG_EAR'] },
];
