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

export const ADVANCED_SINCE = '5.0.0'; // the version that brought the advanced tour

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
  // advanced: this user has not seen the advanced tour yet, so the news window offers it
  return news.length ? { type: 'whatsNew', current, news, advanced: compareVersions(state.version, ADVANCED_SINCE) < 0 } : { type: 'none', current };
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
  hotm: 'HotM tier', forgeAh: 'Forge results',
};

// Settings for the five answers, each with the value as shown and one sentence why.
// slots: the current "Parallel flips" setting. hotm: 0 to 10; ah: false leaves auction house results out.
// pro: false leaves the two forge settings out, so they stay as they are.
export function setupResult({ capital, activity, style, hotm, ah }, slots, pro = true) {
  const tier = Number.isInteger(hotm) && hotm >= 0 && hotm <= 10 ? hotm : 10;
  const withAh = ah !== false;
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
    row('hotm', tier, `Tier ${tier}`, tier === 10 ? 'The Forge tab shows every recipe.' : `The Forge tab hides recipes that need more than tier ${tier}.`),
    row('forgeAh', withAh, withAh ? 'Bazaar and Auction House' : 'Bazaar only',
      withAh ? 'Forge results that sell on the Auction House are shown too, marked as estimates.' : 'Only forge results with a Bazaar price are shown.'),
  ].filter((r) => pro || !['hotm', 'forgeAh'].includes(r.key));
}

// ---- tour

// target is a CSS selector, or a list of them in order of preference.
// hint: the context hint a station makes unnecessary (see HINTS).
// The basic tour: what a new user needs for the first flip. Six stations at most.
export function tourSteps() {
  return [
    { route: '#/flips', target: '#list .card', title: 'A flip', hint: 'card',
      text: 'Each card is one item. Place a buy order at the Buy order price, wait until it fills, then put the items up as a sell offer at the Sell offer price. The difference is your profit. Tap a card to see its price history.' },
    { route: '#/flips', target: '#list .card .key', title: 'Two numbers',
      text: 'Profit/h is an estimate of what the flip could earn you per hour. Margin is your profit on one item after tax, compared with what you paid.' },
    { route: '#/flips', target: '#list .card .badges', title: 'Badges',
      text: 'stable, medium and unstable tell you how reliable the flip has been over the last week. suspicious means the numbers look manipulated – better stay away.' },
    { route: '#/opps', target: '#tabs', title: 'Opportunities', hint: 'opps',
      text: 'This tab holds only the flips you can act on without checking them by hand: stable for at least a day, not suspicious and worth the effort. On a phone you can swipe left and right to switch tabs.' },
    { route: '#/flips', target: '.filters', title: 'Find, sort, favorites',
      text: 'The search finds every bazaar item, also the ones your filters hide. Pick how the list is sorted. Tap the star on a card to make it a favorite; the star up here shows only your favorites.' },
    { route: '#/flips', target: '#toggle-settings', title: 'Settings and help',
      text: 'Set your tax and capital here; every option has a small ? that explains it. The ? next to this button brings back the tour and explains the numbers.' },
  ];
}

const BATTERY = 'For reliable alerts set the app\'s battery use to "Unrestricted": Android Settings → Apps → Bazaar Flip Helper → Battery.';

// The advanced tour: everything beyond plain flipping, in the order of the tabs.
// native: running inside the Android app.
export function advancedSteps({ native }) {
  const steps = [
    { route: '#/flips', target: ['#list .badge-trend', '#sort'], title: 'Trends',
      text: 'The arrow on a card shows where the sell price went over the last day: rising, falling or flat. "below normal" and "above normal" compare it with the usual price. You can also sort by Trend.' },
    { route: '#/flips', target: '#radar .radar', title: 'Event radar', hint: 'radar',
      text: 'The mayor, the active perks and the next SkyBlock events with a countdown. Tap it to unfold, then tap a line to see the items that are typically affected. Once a price moved the same way three times, the radar says how much it usually changes.' },
    { route: '#/opps', target: '#portfolio .portfolio', title: 'Portfolio', hint: 'portfolio',
      text: 'A ready-made plan: your capital split over the best safe flips, with the total profit per hour. It fills up once items have a day of price history.' },
    { route: '#/forge', target: ['#list .card', '#tabs a[href="#/forge"]'], title: 'Forge', hint: 'forge',
      text: 'What is worth forging, with the profit per hour of one forge slot. "AH sale – estimate" means the result sells on the Auction House, which is slower and less certain.' },
  ];
  if (native) {
    steps.push({ route: '#/flips', target: '#market-alert-settings', open: true, title: 'Alerts on your phone', hint: 'alerts',
      text: `Switch on Market alerts and allow notifications when Android asks. ${BATTERY}` });
  }
  return steps;
}

// ---- context hints: one short note the first time a feature shows up

// at: where the note goes (CSS selector); where: its place relative to that element, as in insertAdjacentHTML.
// text may be a function of { native, pro }.
export const HINTS = {
  card: { at: '#count', where: 'beforebegin',
    text: 'Tap a card for its price history. To flip, place a buy order at the Buy order price, then sell with a sell offer.' },
  detail: { at: '#detail .ranges', where: 'beforebegin',
    text: 'Tap a chart to read the exact values. The buttons switch between the last 24 hours and 7 days.' },
  suspicious: { at: '#detail .badges', where: 'afterend',
    text: 'Suspicious means the numbers look too good to be true: a margin above 200%, a high margin on an item that hardly trades, fewer than 3 orders on one side, or a price more than 30% above normal. Often someone is pushing the price. Better stay away.' },
  fav: { at: '#count', where: 'beforebegin',
    text: ({ native, pro }) => 'Favorites stay in Flips even when your filters hide them. The star next to the sort box shows only favorites.'
      + (native && pro ? ' You can get alerts for them in the settings.' : '') },
  opps: { at: '#count', where: 'beforebegin',
    text: 'These are the flips you can act on without checking them by hand: stable for at least a day, not suspicious, and above the margin, volume and profit set for Opportunities.' },
  portfolio: { at: '.portfolio h2', where: 'afterend',
    text: 'A plan, not a promise: your total capital split over the best safe flips. No flip gets more than your max. capital per flip; a note says what holds capital back.' },
  npc: { at: '#count', where: 'beforebegin',
    text: 'NPC flips: buy with a buy order, then sell to an NPC shop for a fixed price. There is no bazaar tax. Profit (instant buy) is what is left if you buy at once instead of waiting for your order.' },
  craft: { at: '#count', where: 'beforebegin',
    text: 'Craft flips: buy the ingredients with buy orders, craft, and sell the result with a sell offer. Revenue is already after tax. Crafts/h is limited by the ingredient that trades least.' },
  forge: { at: '.forge-filter', where: 'beforebegin',
    text: 'Set your HotM tier in the settings to hide recipes you cannot forge yet. "Incl. AH" adds results that sell on the Auction House; their prices are estimates.' },
  radar: { at: '.radar > summary', where: 'afterend',
    text: 'Tap an event or perk to see the items it affects. A price pattern appears once a price moved the same way three times; until then it says "not enough data yet".' },
  search: { at: '#count', where: 'afterend',
    text: 'The search covers the whole bazaar. Cards with a grey line in italics are not a flip right now; the line says why.' },
  settings: { at: '#settings', where: 'afterbegin', setup: true,
    text: 'Every option has a ? that explains it. Not sure what to enter? The setup asks a few questions and fills it in.' },
  alerts: { at: '#settings label.check:has(input:checked)', where: 'afterend', text: BATTERY },
};
export const HINT_IDS = Object.keys(HINTS);
export const PRO_OFFER = 'advanced'; // kept in the same list: the advanced tour was offered on the switch to Pro

// What a user starts with: someone who used the app before version 6 knows it, a new user has seen nothing.
export const initialHints = (hadData) => (hadData ? [...HINT_IDS, PRO_OFFER] : []);
// The first candidate that has not been seen and whose place is on screen right now.
export const pickHint = (candidates, seen, onScreen = () => true) =>
  candidates.find((id) => HINTS[id] && !seen.includes(id) && onScreen(HINTS[id].at)) ?? null;

export function hintHtml(id, opts = {}) {
  const h = HINTS[id];
  const text = typeof h.text === 'function' ? h.text(opts) : h.text;
  return `<aside class="tip" role="note"><p>${esc(text)}</p><div class="actions">${
    h.setup ? '<button type="button" data-act="setup">Start setup</button>' : ''}<button type="button" data-hint="${id}">Got it</button></div></aside>`;
}

// ---- HTML

const button = (act, label, primary = false) => `<button type="button" data-act="${act}"${primary ? ' class="primary"' : ''}>${label}</button>`;

export const welcomeHtml = () => `<h2>Bazaar Flip Helper</h2>
<p>Finds Hypixel SkyBlock bazaar flips that are worth your coins – and warns you about the risky ones.</p>
<div class="actions">${button('skip', 'Skip')}${button('tour', 'Take the tour', true)}</div>`;

const versionHtml = (v) => `<section><h3>Version ${esc(v.version)} <span class="muted">${esc(v.date)}</span></h3>
<ul class="news">${v.entries.map((e) => `<li><strong>${esc(e.title)}</strong> ${esc(e.text)}</li>`).join('')}</ul></section>`;

// Shown once, on the first switch to Pro mode. count: the number of stations on this platform.
export const advancedOfferHtml = (count = 4) => `<h2>Take the advanced tour?</h2>
<p>${count} short stops: trends, the event radar, the portfolio${count > 4 ? ', forge flips and alerts' : ' and forge flips'}. You can also start it later from the ? at the top.</p>
<div class="actions">${button('close', 'Not now')}${button('tour-advanced', 'Take the advanced tour', true)}</div>`;

// Shown after "Skip", so nobody misses the setup.
export const setupOfferHtml = () => `<h2>Set up in 30 seconds?</h2>
<p>A few quick questions and the app picks settings that fit your coins and how you play. You can also start it later from the ? at the top.</p>
<div class="actions">${button('close', 'Not now')}${button('setup', 'Start setup', true)}</div>`;

// versions: newest first. offerTour: add the tour offer for people who used the app before it had one.
// history: the full list from the help screen, without the "Show me" walk through.
// offerAdvanced: add a button for the advanced tour.
export function newsHtml(versions, { offerTour = false, history = false, offerAdvanced = false } = {}) {
  const spotlight = !history && versions.some((v) => v.entries.some((e) => e.target));
  const offer = offerTour ? `<p class="offer"><strong>New: app tour – take it now?</strong></p>` : '';
  const actions = offerTour
    ? button('close', 'Not now') + button('tour', 'Take the tour', true)
    : (spotlight ? button('news-show', 'Show me') : '') + (offerAdvanced ? button('tour-advanced', 'Advanced tour') : '')
      + button('close', history ? 'Close' : 'Got it', true);
  return `<h2>${history ? 'Version history' : "What's new"}</h2>
<div class="scroll">${versions.map(versionHtml).join('')}</div>
${offer}<div class="actions">${actions}</div>`;
}

// The help screen behind the ? in the header. Third field: only shown in Pro mode.
const HOW = [
  ['What a flip is', 'You buy an item with a buy order, wait until it fills, and sell it again with a sell offer. You bid a little more than the best buy order and ask a little less than the best sell offer. What is left after tax is your profit.'],
  ['Margin', 'Your profit on one item after tax, compared with what you paid: (sell offer price − tax − buy order price) ÷ buy order price.'],
  ['Profit/h', "An estimate: profit per item × the items you can expect to trade in an hour. That is your market share of the item's hourly volume, and never more than your capital can buy."],
  ['Market share', "Your guess at how much of an item's trade ends up with you. Other players flip the same items, so nobody gets all of it. 5% is careful; raise it if you relist often.", true],
  ['Volume per week', 'How many items were traded in the last 7 days. The smaller of the buy and the sell side counts, because a flip needs both. Divided by 168 it is the volume per hour.', true],
  ['Stability score', 'A number from 0 to 100 from the last 7 days of prices. It starts with how often the flip made a profit and loses points the more the prices jumped around. 70 or more counts as stable. Under 24 hours of data there is no score yet; the item is "provisional".'],
  ['Suspicious', 'A warning that the numbers may be manipulated. An item gets it for any of four reasons: its margin is above 200%; its margin is above 50% while fewer than 100 items trade per hour; there are fewer than 3 buy orders or fewer than 3 sell offers; or its sell price is more than 30% above its normal price. Suspicious items never show up in Opportunities.'],
  ['Favorites', 'Tap the star on a card. Favorites stay in the Flips list even when your filters would hide them, and the star next to the sort box shows only them. The Android app can alert you when a favorite reaches a margin you set.'],
  ['Portfolio', 'A plan at the top of Opportunities. Your total capital is split over the best opportunities, and what one flip cannot use goes to the others. No flip gets more than your max. capital per flip, and none more than its volume can use.'],
  ['NPC flips', 'Buy an item with a buy order and sell it to an NPC shop for a fixed price. There is no bazaar tax on that sale. "Profit (instant buy)" is what is left if you buy at the sell offer price instead of waiting for your order.', true],
  ['Craft flips', 'Buy the ingredients with buy orders, craft, and sell the result with a sell offer. Cost is all ingredients, revenue is the sale after tax. Crafts/h is limited by the ingredient that trades least, your market share and your capital.', true],
  ['Forge', 'The cost is all ingredients bought with buy orders. A Bazaar result sells at its sell offer price minus tax. Any other result is priced at the lowest BIN on the Auction House minus the fees there, which makes it an estimate. Profit/forge hour is what one forge slot can earn, but never more than you can sell; the card says which of the two limits it.', true],
  ['Events', 'The countdowns come from the SkyBlock calendar, the mayor and perks from Hypixel\'s election data. An item with an event badge is typically obtained during that event or through that perk. The rule of three: only when an item\'s price moved the same way in three past events or terms does the radar say how much it usually changes. Before that it says "not enough data yet". It is never a guarantee.', true],
  ['Trends', 'The arrow is the direction of the sell price over the last 24 hours; rising or falling means more than 3% in a day. "below normal" and "above normal" mean the price is more than 10% off its 7 day median. Trends are a hint and never change Opportunities or alerts.', true],
];
// pro: false leaves out what Simple mode does not show.
export const helpHtml = ({ pro = true } = {}) => `<h2>Help</h2>
<div class="help-actions">${button('tour', 'Start tour')}${pro ? button('tour-advanced', 'Advanced tour') : ''}${button('setup', 'Start setup')}${button('news', "What's new")}${button('hints-reset', 'Show hints again')}</div>
<h3>How it works</h3>
<div class="how">${HOW.filter(([, , proOnly]) => pro || !proOnly).map(([term, text]) => `<details><summary>${term}</summary><p>${esc(text)}</p></details>`).join('')}</div>
<div class="actions">${button('close', 'Close', true)}</div>`;

const radio = (name, value, label, hint, checked) =>
  `<label class="choice"><input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}><span>${label}<small>${hint}</small></span></label>`;

// defaults: { capital, activity, style, hotm, ah } to preselect. pro: false leaves the two forge questions out.
export function setupFormHtml({ capital = CAPITALS[1], activity = 'rarely', style = 'safe', hotm = 10, ah = true, pro = true } = {}) {
  const tier = Math.min(10, Math.max(1, Math.floor(hotm) || 10));
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
</fieldset>${pro ? `
<fieldset><legend>4. What is your Heart of the Mountain tier?</legend>
<label class="choice"><span>HotM tier<select name="hotm">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}"${i + 1 === tier ? ' selected' : ''}>${i + 1}</option>`).join('')}</select><small>For the Forge tab. Not sure? Leave it at 10 to see every recipe.</small></span></label>
</fieldset>
<fieldset><legend>5. Include Auction House sales in the Forge tab?</legend>
${radio('ah', 'yes', 'Yes, include them', 'slower to sell, prices are estimates', ah !== false)}
${radio('ah', 'no', 'Bazaar only', 'only results you can sell on the Bazaar', ah === false)}
</fieldset>` : ''}
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
