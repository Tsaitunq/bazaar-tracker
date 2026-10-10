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
export function setupResult({ capital, activity, style, hotm, ah }, slots) {
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
  ];
}

// ---- tour

// target is a CSS selector, or a list of them in order of preference.
// The basic tour: what a new user needs for the first flip. Six stations at most.
export function tourSteps() {
  return [
    { route: '#/flips', target: '#list .card', title: 'A flip',
      text: 'Each card is one item you can flip. Profit/h is what it could earn per hour, Margin is your profit after tax. Below: the Buy order price you bid, the Sell offer price you ask, and "normal" – what it usually sells for.' },
    { route: '#/flips', target: '#list .card .badges', title: 'Badges',
      text: 'stable, medium and unstable tell you how reliable the flip has been. provisional means under 24 hours of data, so no verdict yet. suspicious means the numbers look manipulated – better stay away.' },
    { route: '#/flips', target: '#tabs', title: 'Five lists',
      text: 'Flips shows everything, Opportunities only the safe picks. NPC, Craft and Forge are other ways to earn. On a phone you can swipe left and right to switch.' },
    { route: '#/opps', target: ['#list .card', '#tabs a[href="#/opps"]'], title: 'Opportunities',
      text: 'The flips you can act on without checking them by hand: stable for at least a day, not suspicious, and above the margin, volume and profit you set.' },
    { route: '#/flips', target: '.filters', title: 'Find and sort',
      text: 'The search finds every bazaar item, also the ones your filters hide. Pick how the list is sorted, and tap the star on a card to make it a favorite.' },
    { route: '#/flips', target: '#toggle-settings', title: 'Settings',
      text: 'Set your tax, capital and filters here. Every option has a small ? that explains it. The ? next to this button brings back the tours and explains the numbers.' },
  ];
}

// The advanced tour: everything beyond plain flipping. native: running inside the Android app.
export function advancedSteps({ native }) {
  const steps = [
    { route: '#/opps', target: '#portfolio .portfolio', title: 'Portfolio',
      text: 'A ready-made plan: your capital split over the best safe flips, with the total profit per hour. It fills up once items have a day of price history.' },
    { route: '#/forge', target: ['#list .card', '#tabs a[href="#/forge"]'], title: 'Forge',
      text: 'What is worth forging: the ingredients cost, the profit per item and per hour of one forge slot, the forge time and the HotM tier you need. "AH sale – estimate" means the result sells on the Auction House, which is slower and less certain.' },
    { route: '#/flips', target: '#radar .radar', title: 'Event radar',
      text: 'The mayor, the active perks and the next SkyBlock events with a countdown. Tap it to unfold, then tap a line to see the items that are typically affected. Those items carry a small event badge in the lists.' },
    { route: '#/flips', target: ['#list .badge-trend', '#sort'], title: 'Trends',
      text: 'The arrow on a card shows where the sell price went over the last day: rising, falling or flat. "below normal" and "above normal" compare it with the usual price. You can also sort by Trend.' },
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

// Shown after the basic tour.
export const advancedOfferHtml = () => `<h2>Take the advanced tour?</h2>
<p>Four more stops: the portfolio, forge flips, the event radar and trend badges. You can also start it later from the ? at the top.</p>
<div class="actions">${button('offer-skip', 'Not now')}${button('tour-advanced', 'Take the advanced tour', true)}</div>`;

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

// The help screen behind the ? in the header.
const HOW = [
  ['Margin', 'Your profit on one item after tax, compared with what you paid: (sell offer price − tax − buy order price) ÷ buy order price.'],
  ['Market share', "Your guess at how much of an item's trade ends up with you. Other players flip the same items, so nobody gets all of it. 5% is careful; raise it if you relist often."],
  ['Profit/h', "Profit per item × the items you can expect to trade in an hour. That is your market share of the item's hourly volume (the weekly volume ÷ 168), and never more than your max. capital can buy."],
  ['Stability score', 'A number from 0 to 100 from the last 7 days of prices. It starts with how often the flip made a profit and loses points the more the buy and sell prices jumped around. 70 or more counts as stable; under 24 hours of data there is no score yet.'],
  ['Forge', 'The cost is all ingredients bought with buy orders. A result that is a Bazaar item sells at its sell offer price minus tax. Any other result is priced at the lowest BIN on the Auction House minus the fees there (1 to 2.5% for listing, 1% on collecting above 1M coins). That is one seller\'s asking price, so it is an estimate. Profit/forge hour is the profit of one run divided by its forge time.'],
  ['Events', 'The countdowns come from the SkyBlock calendar, the mayor and perks from Hypixel\'s election data. An item with an event badge is typically obtained during that event or through that perk. The badge does not tell you where its price is going.'],
  ['Trends', 'The arrow is the direction of the sell price over the last 24 hours; rising or falling means more than 3% in a day. "below normal" and "above normal" mean the price is more than 10% off its 7 day median. Trends are a hint and never change Opportunities or alerts.'],
];
export const helpHtml = () => `<h2>Help</h2>
<div class="help-actions">${button('tour', 'Start tour')}${button('tour-advanced', 'Advanced tour')}${button('setup', 'Start setup')}${button('news', "What's new")}</div>
<h3>How it works</h3>
<dl class="how">${HOW.map(([term, text]) => `<dt>${term}</dt><dd>${esc(text)}</dd>`).join('')}</dl>
<div class="actions">${button('close', 'Close', true)}</div>`;

const radio = (name, value, label, hint, checked) =>
  `<label class="choice"><input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}><span>${label}<small>${hint}</small></span></label>`;

// defaults: { capital, activity, style, hotm, ah } to preselect
export function setupFormHtml({ capital = CAPITALS[1], activity = 'rarely', style = 'safe', hotm = 10, ah = true } = {}) {
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
</fieldset>
<fieldset><legend>4. What is your Heart of the Mountain tier?</legend>
<label class="choice"><span>HotM tier<select name="hotm">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}"${i + 1 === tier ? ' selected' : ''}>${i + 1}</option>`).join('')}</select><small>For the Forge tab. Not sure? Leave it at 10 to see every recipe.</small></span></label>
</fieldset>
<fieldset><legend>5. Include Auction House sales in the Forge tab?</legend>
${radio('ah', 'yes', 'Yes, include them', 'slower to sell, prices are estimates', ah !== false)}
${radio('ah', 'no', 'Bazaar only', 'only results you can sell on the Bazaar', ah === false)}
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
