// The start page: one card per guide, each guide's best step, and what was unlocked this week.
import { esc, number } from '../../format.js';
import { guideModel, worldFor, nextPerGuide, unlockedThisWeek, firstOfFamilies } from '../model.js';
import { ring, bottomBar, profileLink, nextMilestone } from './parts.js';

export const HOME_TABS = [{ id: 'home', label: 'Home' }, { id: 'settings', label: 'Settings' }];
const HOUR = 3600e3;

function syncedText(state, now, personal) {
  if (!state?.syncedAt) return personal ? 'Not synced yet' : '';
  const hours = Math.floor((now - state.syncedAt) / HOUR);
  if (hours < 1) return 'Synced just now';
  return hours < 48 ? `Synced ${number(hours)} h ago` : `Synced ${number(Math.floor(hours / 24))} d ago`;
}

function guideCard(m) {
  const at = m.chapters.findIndex((c) => c.current);
  const next = m.card ? `Next: ${m.card.name}` : 'All steps are done';
  const label = `${m.name} ${Math.round(m.total * 100)}%`;
  const arcs = m.milestones ? ring({ chapters: [{ share: m.total }], total: m.total, size: 70, label, marks: m.milestones.marks }) : ring({ chapters: m.chapters, total: m.total, size: 70, label });
  const where = m.milestones ? nextMilestone(m.milestones) : `Chapter ${at + 1} · ${m.chapters[at].name}`;
  return `<a class="guide-card" data-theme="${esc(m.theme)}" href="#/guide/${esc(m.id)}/path">${arcs}<span class="guide-info"><strong>${esc(m.name)}</strong><small>${esc(where)}</small><em>${esc(next)}</em></span></a>`;
}

const EMPTY_ARCS = ['', '', ''].map((name) => ({ name, share: 0 }));
const farmingCard = `<a class="guide-card" data-theme="farming" href="#/guide/farming/path">${ring({ chapters: EMPTY_ARCS, total: 0, size: 70, label: 'Farming', showTotal: false })}<span class="guide-info"><strong>Farming</strong><small>Guide coming soon</small></span></a>`;

export function homeView(world) {
  const head = `<div class="home-head"><div class="home-title"><small>${syncedText(world.state, world.now, world.personal)}</small><h1>Your guides</h1></div>${profileLink()}</div>`;
  const bar = bottomBar(HOME_TABS, 'home');
  if (!world.guides.length) return `<div class="screen screen-home" data-theme="home">${head}<div class="empty"><strong>No guide yet</strong><p>Add a guide file in <a href="#/settings">Settings</a>.</p></div>${bar}</div>`;
  const models = world.guides.map((g) => guideModel(g, worldFor(world, g)));
  const lines = nextPerGuide(models);
  const bests = lines.length ? `<section class="bests"><div class="bests-title">NEXT STEP PER GUIDE</div>${lines.map((l) => `<div class="best-line"><b>${esc(l.name)}:</b> ${esc(l.step)}${l.text ? ` <span>· ${esc(l.text)}</span>` : ''}</div>`).join('')}</section>` : '';
  const week = Object.values(world.dates ?? {}).reduce((n, stamps) => n + unlockedThisWeek(stamps, world.now), 0);
  const tiles = `<div class="tile"><small>Unlocked this week</small><strong>${number(week)} <em>step${week === 1 ? '' : 's'}</em></strong></div>`;
  const hasFarming = world.guides.some((g) => g.area === 'farming');
  return `<div class="screen screen-home" data-theme="home">${head}<div class="scroll">${bests}${models.filter((m) => firstOfFamilies(world.guides).some((g) => g.id === m.id)).map(guideCard).join('')}${hasFarming ? '' : farmingCard}${tiles}</div>${bar}</div>`;
}
