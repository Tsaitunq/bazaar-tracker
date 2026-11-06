// Methods: the list of method cards and one method page, in the theme of the guide's area.
import { esc, coins } from '../../../shared/format.js';
import { bookPrices } from '../../../shared/prices.js';
import { inline, pickedOption } from '../methods.js';
import { backLink, profileLink } from './parts.js';
import { pic, mcPic } from './editors.js';

const PETS = { Scatha: 'SCATHA', 'Glacite Golem': 'GLACITE_GOLEM', Mammoth: 'MAMMOTH' };
const PET_NAME = new RegExp(`\\b(${Object.keys(PETS).join('|')})\\b`, 'g');
const petPic = (name) => pic(`img/hypixel/pets/${PETS[name]}_LEGENDARY.png`, 'pet-pic', name[0]);
// a pet's name gets its head in front of it; text without a known pet stays text
const withHeads = (html) => html.replace(PET_NAME, (name) => `<span class="m-pet">${petPic(name)}${name}</span>`);
const rich = (text) => withHeads(inline(text));

// the picture of a line of "Gear in short": a Minecraft texture, or the first letter
const GEAR_PICS = { Drill: 'diamond', Armor: 'emerald', Equipment: 'gold_ingot', Lantern: 'sea_lantern' };
const gearPic = (name) => (GEAR_PICS[name] ? mcPic(GEAR_PICS[name], 'm-icon') : pic('', 'm-icon', name[0]));

const card = (title, body, cls = '') => `<section class="m-card${cls}"><h2>${esc(title)}</h2>${body}</section>`;

function which(m, world) {
  const price = m.price && bookPrices(world.products?.[m.price.id] ?? {})?.sell;
  const picked = pickedOption(m, price);
  const tag = m.price ? `<p class="m-price">${esc(m.price.name)}: <b>${price ? esc(coins(price)) : world.products ? 'no price' : '…'}</b></p>` : '';
  const opts = m.options.map((o, i) => `<div class="m-opt${i === picked ? ' m-opt-on' : ''}"><b>${esc(o.pick)}</b><small>${esc(o.when)}</small>${i === picked ? `<em>${esc(coins(price))} now</em>` : ''}</div>`).join('');
  return card('Which method?', `${tag}<div class="m-opts">${opts}</div>`);
}

const run = (m) => card('Run', `<ol class="m-steps">${m.run.map((s, i) => `<li class="m-step"><span class="m-num">${i + 1}</span><div class="m-step-text"><b>${esc(s.title)}</b>${s.text ? `<span>${inline(s.text)}</span>` : ''}${s.back ? `<span class="m-back">↩ back to ${s.back}</span>` : ''}</div></li>`).join('')}</ol>`);

function loadouts(m) {
  const { columns, rows } = m.loadouts;
  if (!rows.length) return '';
  const head = `<div class="m-cols">${columns.map((c) => `<b>${esc(c)}</b>`).join('')}</div>`;
  const lines = rows.map((r) => `<div class="m-load"><small>${esc(r.label)}</small><div class="m-cols">${r.cells.map((c) => `<span>${rich(c)}</span>`).join('')}</div></div>`).join('');
  return card('Loadouts', `${head}${lines}${m.note ? `<p class="m-note">${inline(m.note)}</p>` : ''}`);
}

const autopet = (m) => (m.autopet.length ? card('Auto-pet', `<ul class="m-auto">${m.autopet.map((a) => `<li><span>${esc(a.trigger)}</span><i aria-hidden="true">→</i><b>${PETS[a.pet] ? petPic(a.pet) : ''}${esc(a.pet)}</b></li>`).join('')}</ul>`) : '');

const gear = (m, guide) => (m.gear.length ? card('Gear in short', `<ul class="m-gear">${m.gear.map((g) => `<li>${gearPic(g.name)}<div><b>${esc(g.name)}</b><span>${esc(g.text)}</span></div></li>`).join('')}</ul><a class="m-link" href="#/guide/${esc(guide.id)}/path">All of it in the Gear tab</a>`) : '');

const tips = (m) => (m.tips.length ? card('Tips', `<ul class="m-tips">${m.tips.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`, ' m-quiet') : '');

export function methodView(world, guide, m) {
  const body = [which(m, world), run(m), loadouts(m), autopet(m), gear(m, guide), tips(m)].join('');
  return `<div class="screen" data-theme="${esc(guide.area)}"><div class="top"><a class="back" href="#/guide/${esc(guide.id)}/methods"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Methods</a>${profileLink()}</div><h1 class="m-title">${esc(m.title)}</h1><div class="scroll methods">${body}</div></div>`;
}

export function methodsListView(world, guide, tabs) {
  const cards = world.methods.map((m) => `<a class="m-pick" href="#/guide/${esc(guide.id)}/methods/${esc(m.id)}"><strong>${esc(m.title)}</strong><small>${m.options.length} options · ${m.run.length} steps</small><span aria-hidden="true">›</span></a>`).join('');
  return `<div class="screen" data-theme="${esc(guide.area)}"><div class="top">${backLink()}${profileLink()}</div>${tabs}<div class="scroll methods">${cards}</div></div>`;
}
