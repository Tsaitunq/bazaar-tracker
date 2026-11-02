// The start page: one card per guide, each guide's best step, and two tiles.
import { esc, number } from '../../format.js';
import { guideModel, worldFor, bestPerGuide, coinsForNext, unlockedThisWeek } from '../model.js';
import { ring, icon, bottomBar } from './parts.js';

export const HOME_TABS = [{ id: 'home', label: 'Home' }, { id: 'stats', label: 'Stats' }, { id: 'settings', label: 'Settings' }];
const HOUR = 3600e3;

function syncedText(state, now) {
  if (!state?.syncedAt) return 'Not synced yet';
  const hours = Math.floor((now - state.syncedAt) / HOUR);
  if (hours < 1) return 'Synced just now';
  return hours < 48 ? `Synced ${number(hours)} h ago` : `Synced ${number(Math.floor(hours / 24))} d ago`;
}

function guideCard(m) {
  const at = m.chapters.findIndex((c) => c.current);
  const next = m.card ? `Next: ${m.card.name}` : 'All steps are done';
  return `<a class="guide-card" data-theme="${esc(m.theme)}" href="#/guide/${esc(m.id)}/path">${ring({ chapters: m.chapters, total: m.total, size: 70, label: `${m.name} ${Math.round(m.total * 100)}%` })}<span class="guide-info"><strong>${esc(m.name)}</strong><small>Chapter ${at + 1} · ${esc(m.chapters[at].name)}</small><em>${esc(next)}</em></span></a>`;
}

const EMPTY_ARCS = ['', '', ''].map((name) => ({ name, share: 0 }));
const farmingCard = `<a class="guide-card" data-theme="farming" href="#/guide/farming/path">${ring({ chapters: EMPTY_ARCS, total: 0, size: 70, label: 'Farming', showTotal: false })}<span class="guide-info"><strong>Farming</strong><small>Guide coming soon</small></span></a>`;

export function homeView(world) {
  const head = `<div class="home-head"><div class="home-title"><small>${syncedText(world.state, world.now)}</small><h1>Your guides</h1></div><a class="profile" href="#/stats" aria-label="Your stats">${icon('profile', 22)}</a></div>`;
  const bar = bottomBar(HOME_TABS, 'home');
  if (!world.guides.length) return `<div class="screen screen-home" data-theme="home">${head}<div class="empty"><strong>No guide yet</strong><p>Add a guide file in <a href="#/settings">Settings</a>.</p></div>${bar}</div>`;
  const models = world.guides.map((g) => guideModel(g, worldFor(world, g)));
  const lines = bestPerGuide(models);
  const bests = lines.length ? `<section class="bests"><div class="bests-title">BEST STEP PER GUIDE</div>${lines.map((l) => `<div class="best-line"><b>${esc(l.name)}:</b> ${esc(l.step)} <span>· ${esc(l.text)}</span></div>`).join('')}</section>` : '';
  const noSync = world.state?.summary ? '' : '<p class="note">Sync your profile in <a href="#/settings">Settings</a> to see the best steps.</p>';
  const total = coinsForNext(models);
  const week = Object.values(world.dates ?? {}).reduce((n, stamps) => n + unlockedThisWeek(stamps, world.now), 0);
  const tiles = `<div class="tiles"><div class="tile"><small>Coins for all next steps</small><strong>${esc(total.text)}${total.unpriced && total.text !== '…' ? `<small> + ${total.unpriced} unpriced</small>` : ''}</strong></div><div class="tile"><small>Unlocked this week</small><strong>${number(week)} <em>step${week === 1 ? '' : 's'}</em></strong></div></div>`;
  const hasFarming = world.guides.some((g) => g.area === 'farming');
  return `<div class="screen screen-home" data-theme="home">${head}<div class="scroll">${bests}${noSync}${models.map(guideCard).join('')}${hasFarming ? '' : farmingCard}${tiles}</div>${bar}</div>`;
}
