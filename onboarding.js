// Welcome, tour, setup assistant and "What's new": the decisions and the texts.
// No DOM access here, so everything is testable in Node; tour.js does the wiring.
import { esc, coins } from './render.js';

// ---- versions

export const compareVersions = (a, b) => {
  const [pa, pb] = [a, b].map((v) => String(v).split('.').map(Number));
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
};

// changelog.json lists the newest version first; that one is the app version
export const currentVersion = (log) => log.versions[0].version;
export const newsSince = (log, version) => log.versions.filter((v) => compareVersions(v.version, version) > 0);

// What to show at start.
// state: the stored { done, version }, or anything else when nothing usable is stored.
// hadData: the app had saved settings, favourites or items before this start.
export function startupAction(state, log, hadData) {
  const current = currentVersion(log);
  if (!state || typeof state.version !== 'string' || !/^\d+(\.\d+){0,2}$/.test(state.version)) {
    // nothing stored at all: a new user (or cleared storage) gets the welcome screen and no news
    if (!hadData) return { type: 'welcome', current };
    // used the app before it had a tour: offer the tour, never start it unasked
    return { type: 'tourOffer', current, news: log.versions.slice(0, 1) };
  }
  const news = newsSince(log, state.version);
  return news.length ? { type: 'whatsNew', current, news } : { type: 'none', current };
}

// ---- setup assistant

export const CAPITALS = [10e6, 50e6, 200e6, 1e9];
export const ACTIVITY = {
  rarely: { share: 5, label: 'Rarely', hint: 'a few times a day', reason: 'You check in rarely, so other players will often outbid you. 5% is a careful guess.' },
  sometimes: { share: 10, label: 'About every 30 minutes', hint: 'now and then while playing', reason: 'You relist now and then, so you get a fair part of the volume.' },
  often: { share: 20, label: 'Every few minutes', hint: 'actively flipping', reason: 'You relist all the time, so your orders are on top much more often.' },
};
export const STYLES = {
  safe: {
    label: 'Play it safe', hint: 'fewer flips, fewer surprises',
    marketMargin: [15, 'A wider margin leaves room if the price moves against you.'],
    marketMinVolume: [500000, 'Only items that trade a lot, so your orders fill quickly.'],
    marketMinProfit: [100000, 'Keeps flips that are worth the effort without chasing the highest numbers.'],
  },
  profit: {
    label: 'More profit', hint: 'more flips, more risk',
    marketMargin: [8, 'Thinner margins are fine for you, which lets more items in.'],
    marketMinVolume: [100000, 'Slower items are allowed too; they can take longer to fill.'],
    marketMinProfit: [250000, 'Only flips that pay well per hour make the list.'],
  },
};
const SETTING_LABELS = {
  portfolioCapital: 'Total capital', maxCapital: 'Max. capital per flip', share: 'Market share',
  marketMargin: 'Min. margin', marketMinVolume: 'Min. volume/week', marketMinProfit: 'Min. profit/h',
};

// Settings for the three answers, each with the value as shown and one sentence why.
// slots: the current "Parallel flips" setting.
export function setupResult({ capital, activity, style }, slots) {
  const act = ACTIVITY[activity] ?? ACTIVITY.rarely;
  const sty = STYLES[style] ?? STYLES.safe;
  const total = capital > 0 ? Math.round(capital) : CAPITALS[1];
  const perFlip = Math.round(total / Math.max(1, Math.floor(slots) || 1));
  const row = (key, value, shown, reason) => ({ key, value, label: SETTING_LABELS[key], shown, reason });
  return [
    row('portfolioCapital', total, coins(total), 'The coins you told us you want to flip with.'),
    row('maxCapital', perFlip, coins(perFlip), `Your capital split evenly over ${Math.max(1, Math.floor(slots) || 1)} flips at the same time.`),
    row('share', act.share, `${act.share}%`, act.reason),
    row('marketMargin', sty.marketMargin[0], `${sty.marketMargin[0]}%`, sty.marketMargin[1]),
    row('marketMinVolume', sty.marketMinVolume[0], coins(sty.marketMinVolume[0]), sty.marketMinVolume[1]),
    row('marketMinProfit', sty.marketMinProfit[0], coins(sty.marketMinProfit[0]), sty.marketMinProfit[1]),
  ];
}

// ---- tour

// native: running inside the Android app. firstId: an item to open for the detail page station.
// target is a CSS selector, or a list of them in order of preference.
export function tourSteps({ native, firstId }) {
  const item = firstId ? `#/item/${encodeURIComponent(firstId)}` : '#/flips';
  const steps = [
    { route: '#/flips', target: '#list .card', title: 'A flip',
      text: 'Each card is one item you can flip. Profit/h is what it could earn per hour, Margin is your profit after tax. Below: the Buy order price you bid, the Sell offer price you ask, and "normal" – what it usually sells for.' },
    { route: '#/flips', target: '#list .card .badges', title: 'Badges',
      text: 'stable, medium and unstable tell you how reliable the flip has been. provisional means under 24 hours of data, so no verdict yet. suspicious means the numbers look manipulated – better stay away.' },
    { route: '#/flips', target: '#tabs', title: 'Four lists',
      text: 'Flips shows everything. Opportunities shows only the safe picks. NPC and Craft are other ways to earn. On a phone you can swipe left and right to switch.' },
    { route: '#/opps', target: '#portfolio .portfolio', title: 'Portfolio',
      text: 'A ready-made plan: your capital split over the best safe flips, with the total profit per hour. It fills up once items have a day of price history.' },
    { route: '#/flips', target: '.filters', title: 'Find and sort',
      text: 'Search by item name, pick how the list is sorted, and use the star to see only your favorites. Tap the star on a card to make it a favorite.' },
    { route: item, target: ['#detail .charts', '#detail .detail-head'], title: 'Item details',
      text: 'Tap a card to see its price and margin over time. Tap or hover a chart to read the exact value at any point.' },
    { route: '#/flips', target: '#toggle-settings', title: 'Settings',
      text: 'Set your tax, capital and filters here. Every option has a small ? that explains it.' },
    { route: '#/flips', target: '#open-help', title: 'Help',
      text: 'The ? up here brings back this tour and the setup, shows what is new and explains how the numbers are calculated.' },
  ];
  if (native) {
    steps.push({ route: '#/flips', target: '#market-alert-settings', open: true, title: 'Alerts on your phone',
      text: 'Switch on Market alerts and allow notifications when Android asks. For reliable alerts set the app\'s battery use to "Unrestricted": Android Settings → Apps → Bazaar Flip Helper → Battery.' });
  }
  return steps;
}

// ---- HTML

const button = (act, label, primary = false) => `<button type="button" data-act="${act}"${primary ? ' class="primary"' : ''}>${label}</button>`;

export const welcomeHtml = () => `<h2>Bazaar Flip Helper</h2>
<p>Finds Hypixel SkyBlock bazaar flips that are worth your coins – and warns you about the risky ones.</p>
<div class="actions">${button('skip', 'Skip')}${button('tour', 'Take the tour', true)}</div>`;

const versionHtml = (v) => `<section><h3>Version ${esc(v.version)} <span class="muted">${esc(v.date)}</span></h3>
<ul class="news">${v.entries.map((e) => `<li><strong>${esc(e.title)}</strong> ${esc(e.text)}</li>`).join('')}</ul></section>`;

// versions: newest first. offerTour: add the tour offer for people who used the app before it had one.
// history: the full list from the help screen, without the "Show me" walk through.
export function newsHtml(versions, { offerTour = false, history = false } = {}) {
  const spotlight = !history && versions.some((v) => v.entries.some((e) => e.target));
  const offer = offerTour ? `<p class="offer"><strong>New: app tour – take it now?</strong></p>` : '';
  const actions = offerTour
    ? button('close', 'Not now') + button('tour', 'Take the tour', true)
    : (spotlight ? button('news-show', 'Show me') : '') + button('close', history ? 'Close' : 'Got it', true);
  return `<h2>${history ? 'Version history' : "What's new"}</h2>
<div class="scroll">${versions.map(versionHtml).join('')}</div>
${offer}<div class="actions">${actions}</div>`;
}

// The help screen behind the ? in the header.
const HOW = [
  ['Margin', 'Your profit on one item after tax, compared with what you paid: (sell offer price − tax − buy order price) ÷ buy order price.'],
  ['Market share', "Your guess at how much of an item's trade ends up with you. Other players flip the same items, so nobody gets all of it. 5% is careful; raise it if you relist often."],
  ['Profit/h', "Profit per item × the items you can expect to trade in an hour. That is your market share of the item's hourly volume (the weekly volume ÷ 168), and never more than your max. capital can buy."],
  ['Stability score', 'A number from 0 to 100 from the last 7 days of prices. It starts with how often the flip made a profit and loses points the more the buy and sell prices jumped around. 70 or more counts as stable; under 24 hours of data there is no score yet.'],
];
export const helpHtml = () => `<h2>Help</h2>
<div class="help-actions">${button('tour', 'Start tour')}${button('setup', 'Start setup')}${button('news', "What's new")}</div>
<h3>How it works</h3>
<dl class="how">${HOW.map(([term, text]) => `<dt>${term}</dt><dd>${esc(text)}</dd>`).join('')}</dl>
<div class="actions">${button('close', 'Close', true)}</div>`;

const radio = (name, value, label, hint, checked) =>
  `<label class="choice"><input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}><span>${label}<small>${hint}</small></span></label>`;

// defaults: { capital, activity, style } to preselect
export function setupFormHtml({ capital = CAPITALS[1], activity = 'rarely', style = 'safe' } = {}) {
  const preset = CAPITALS.includes(capital);
  return `<h2>Quick setup</h2>
<form id="setup-form">
<fieldset><legend>1. How many coins do you want to flip with?</legend>
<div class="grid2">${CAPITALS.map((c) => radio('capital', c, coins(c), 'coins', c === capital)).join('')}</div>
<label class="choice"><input type="radio" name="capital" value="custom"${preset ? '' : ' checked'}><span>Other amount<input name="custom" type="number" min="1" step="1" inputmode="numeric" aria-label="Other amount of coins" value="${preset ? '' : esc(capital)}"></span></label>
</fieldset>
<fieldset><legend>2. How often do you check your orders?</legend>
${Object.entries(ACTIVITY).map(([k, a]) => radio('activity', k, a.label, a.hint, k === activity)).join('')}
</fieldset>
<fieldset><legend>3. Safe or more profit?</legend>
${Object.entries(STYLES).map(([k, s]) => radio('style', k, s.label, s.hint, k === style)).join('')}
</fieldset>
</form>
<div class="actions">${button('close', 'Cancel')}${button('setup-next', 'Continue', true)}</div>`;
}

export const setupSummaryHtml = (result) => `<h2>Your settings</h2>
<dl class="summary-list">${result.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.shown)}</dd><p>${esc(r.reason)}</p></div>`).join('')}</dl>
<p class="muted">You can change all of this later in the settings.</p>
<div class="actions">${button('setup-back', 'Back')}${button('setup-apply', 'Apply', true)}</div>`;

export const bubbleHtml = (step, index, count) => `<h2 id="tour-title">${esc(step.title)}</h2>
<p>${esc(step.text)}</p>
<div class="actions"><span class="progress">${index + 1}/${count}</span>${button('tour-skip', 'Skip')}${index > 0 ? button('tour-back', 'Back') : ''}${button('tour-next', index + 1 === count ? 'Done' : 'Next', true)}</div>`;
