// Mayor and event radar: the SkyBlock calendar, the events on it and the items that belong to them.
// Dates, items and every source are listed in docs/events-sources.md. An item here is "typically
// affected": it is obtained during the event or through the perk. Nothing is said about its price.

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

// starts: [month, day] of every start within a year. perk: only while that mayor perk is active.
export const EVENTS = [
  { key: 'spooky', name: 'Spooky Festival', starts: [[7, 29]], days: 3,
    items: ['GREEN_CANDY', 'PURPLE_CANDY', 'PUMPKIN_GUTS', 'ECTOPLASM', 'WEREWOLF_SKIN', 'SPOOKY_SHARD', 'SOUL_FRAGMENT'] },
  { key: 'workshop', name: "Jerry's Workshop", starts: [[11, 1]], days: 31, items: JERRY },
  { key: 'jerry', name: 'Season of Jerry', starts: [[11, 24]], days: 3, items: JERRY },
  { key: 'newyear', name: 'New Year Celebration', starts: [[11, 29]], days: 3, items: [] },
  { key: 'zoo', name: 'Traveling Zoo', starts: [[3, 1], [9, 1]], days: 3, items: [] },
  { key: 'hoppity', name: "Hoppity's Hunt", starts: [[0, 1]], days: 3 * MONTH_DAYS, items: [] },
  { key: 'fishing', name: 'Fishing Festival', perk: 'Fishing Festival', starts: MONTHS.map((_, month) => [month, 1]), days: 3,
    items: ['SHARK_FIN', 'ENCHANTED_SHARK_FIN', 'NURSE_SHARK_TOOTH', 'BLUE_SHARK_TOOTH', 'TIGER_SHARK_TOOTH', 'GREAT_WHITE_SHARK_TOOTH'] },
];

// Perks that run for the whole term and bring their own items.
export const PERK_ITEMS = {
  'Mining Fiesta': ['REFINED_MINERAL', 'GLOSSY_GEMSTONE'],
  'Mythological Ritual': ['GRIFFIN_FEATHER', 'ANCIENT_CLAW', 'ENCHANTED_ANCIENT_CLAW', 'DAEDALUS_STICK', 'MYTHOS_FRAGMENT'],
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
