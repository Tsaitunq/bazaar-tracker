// The first-start tour and the "What's new" sheet: the decisions and the texts. No DOM access, so Node can test it.
// app.js does the wiring. (onboarding.js of the Bazaar app is not used: it pulls the market views in.)
import { esc } from '../../shared/format.js';

export const TOUR_KEY = 'pg.tour'; // true once the tour was finished or skipped
export const SEEN_KEY = 'pg.seenVersion'; // the newest version whose news were shown

export const compareVersions = (a, b) => {
  const [pa, pb] = [a, b].map((v) => String(v).split('.').map(Number));
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
};

const VERSION = /^\d+\.\d+\.\d+$/;
// the changelog lists the newest version first
export const currentVersion = (log) => log?.versions?.[0]?.version;
// the versions after `seen`, newest first, up to and including `upTo`
export const newsBetween = (log, seen, upTo = currentVersion(log)) => log.versions.filter((v) => compareVersions(v.version, seen) > 0 && compareVersions(v.version, upTo) <= 0);

// What to show at start. store: { get(key), set(key, value) }; log: the changelog, or null when it did not load.
// The tour comes first and covers a new install as well as everybody who updates to the first version with a tour.
// The sheet shows only to someone who has seen a version before and has not seen the newest one.
export function decide(store, log) {
  const current = currentVersion(log);
  const seen = store.get(SEEN_KEY);
  const known = typeof seen === 'string' && VERSION.test(seen);
  if (current) store.set(SEEN_KEY, current);
  if (store.get(TOUR_KEY) !== true) return { type: 'tour' };
  const news = current && known ? newsBetween(log, seen, current) : [];
  return news.length ? { type: 'news', news } : { type: 'none' };
}

// finished or skipped: the tour does not start again by itself
export const finishTour = (store) => store.set(TOUR_KEY, true);

// hash: where a step lives; the first guide's id is needed for the guide step. target: what the spotlight points at; all matches of
// the selector are lit together (the list of guide cards).
export const STEPS = [
  { id: 'home', hash: () => '#/', target: '.guide-card', title: 'Your guides', text: 'Every guide shows its progress here, and the next best step of each one.' },
  { id: 'guide', hash: (guide) => (guide ? `#/guide/${guide}/path` : '#/'), target: '.card .primary', title: 'Tick = you own it', text: 'Mark a step done and the app counts the item as yours, in every guide that uses it.' },
  { id: 'measure', hash: () => '#/stats/measure/mining', target: '[data-stats-area]', title: 'Measure your base', text: 'Take off pet, armor, weapon or tool and equipment first. Keep your talismans on. Then type what /stats shows.' },
  { id: 'tabs', hash: () => '#/stats/hotm/mining', target: '.switch[aria-label="Stats pages"]', title: 'HOTM, Attributes, Power', text: 'Enter each once and tap Save. From then on, changes you make count on top of your base.' },
  { id: 'overview', hash: () => '#/stats/overview/mining', target: '.stat-table', title: 'The total', text: 'Base + gear + changes = total. Bonuses that need a condition are only listed below.' },
  { id: 'settings', hash: () => '#/settings', target: '[data-act="tour"]', title: 'See it again', text: 'You can start this tour again here whenever you like.' },
];

export function tourHtml(i) {
  const step = STEPS[i];
  const dots = STEPS.map((_, n) => `<i${n === i ? ' class="on"' : ''}></i>`).join('');
  const last = i === STEPS.length - 1;
  return `<div class="tour-hole" hidden></div><section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    <div class="tour-dots" role="img" aria-label="Step ${i + 1} of ${STEPS.length}">${dots}</div>
    <h2 id="tour-title">${esc(step.title)}</h2><p>${esc(step.text)}</p>
    <div class="tour-actions">${last ? '<span></span>' : '<button type="button" class="ghost" data-tour="skip">Skip</button>'}<button type="button" class="primary" data-tour="next">${last ? 'Done' : 'Next'}</button></div></section>`;
}

export function newsHtml(versions) {
  const body = versions.map((v) => `<h3>${esc(v.version)} <small>${esc(v.date ?? '')}</small></h3>${v.entries.map((e) => `<p><b>${esc(e.title)}</b> ${esc(e.text)}</p>`).join('')}`).join('');
  return `<button type="button" class="sheet-back news-back" data-news-close aria-label="Close"></button>
    <section class="bsheet news" role="dialog" aria-modal="true" aria-label="What's new"><div class="bs-head"><div class="bs-title"><h2>What's new</h2></div><button type="button" class="bs-close" data-news-close aria-label="Close">✕</button></div><div class="news-list">${body}</div></section>`;
}
