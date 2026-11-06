// The attribute editor: the attributes the guides ask for first, then all of them with a search.
import { esc } from '../../../shared/format.js';
import { usedAttrs, findAttrs, nextShards, shardsToMax, effectLines, effectShort, ATTR_CATEGORIES, attrCategory } from '../attrs-model.js';
import { draftBar, stepper, pic } from './editors.js';

const SHOWN = 60;
const RARITY = { COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary' };

// The shard picture (from img/hypixel/shards, not in git; seven come from img/mc, Vanilla textures); without it two letters in the colour of the rarity.
const icon = (a) => pic(a.mcIcon ? `img/mc/${a.mcIcon}.png` : `img/hypixel/shards/${a.icon ?? a.key}.png`, `attr-pic r-${a.rarity}`, a.name.slice(0, 2));

const row = (data, a, level, need) => `<button type="button" class="attr${level === 0 ? ' attr-zero' : ''}${level >= a.maxLevel ? ' attr-max' : ''}" data-attr="${esc(a.key)}" aria-label="${esc(a.name)}, level ${level} of ${a.maxLevel}">${icon(a)}<span class="attr-text"><span class="attr-name">${esc(a.name)}</span><small class="attr-fx">${esc(effectShort(data, a, level))}</small></span><span class="attr-lv">${level}/${a.maxLevel}${need ? ` <em>needs ${need}</em>` : ''}</span></button>`;

// A bottom sheet over the list: everything of one attribute without a scroll.
function sheet(data, a, level, have) {
  const text = (l) => `${esc(l.text)}${l.stat === null || l.cond === 'always' ? '' : ` <em>(${esc(l.cond)})</em>`}${l.now ? ` <b>${esc(l.now)}</b>` : ''}`;
  const lines = (at) => effectLines(data, a, at, have).map(text).join(', ') || 'effect not confirmed';
  const next = nextShards(data, a, level);
  const upcoming = next === null ? '<small>Maxed.</small>' : `<small>Level ${level + 1}: ${lines(level + 1)}</small>`;
  const shards = next === null ? '' : `<small>Shards: <b>${next}</b> to level ${level + 1}, <b>${shardsToMax(data, a, level)}</b> to max</small>`;
  return `<button type="button" class="sheet-back" data-attr-close aria-label="Close" tabindex="-1"></button>
    <section class="bsheet" role="dialog" aria-label="${esc(a.name)}" data-attr-sheet="${esc(a.key)}">
    <div class="bs-head">${icon(a)}<div class="bs-title"><h2>${esc(a.name)}</h2><small>${esc(a.shard)} shard · ${RARITY[a.rarity]} · ${esc(a.areas.join(', '))}</small></div><button type="button" class="bs-close" data-attr-close aria-label="Close">✕</button></div>
    ${stepper('attr', level, a.maxLevel)}<small>Level ${level}: ${lines(level)}</small>${upcoming}${shards}</section>`;
}

// The measured value of each stat, for effects that scale with another stat (Freezing Spread: per Cold Resistance).
const statsNow = (world) => Object.assign({}, ...Object.values(world.base ?? {}).map((e) => e.values ?? {}));

const cap = (c) => c[0].toUpperCase() + c.slice(1);

// The list under the search: the only part a keystroke redraws, so the field keeps its focus and cursor.
export function attrResults(world) {
  const data = world.gamedata;
  const levels = world.draft?.attrs ?? world.build.attrs ?? {};
  const used = usedAttrs(world.guides);
  const cat = world.ui?.attrCat ?? 'all';
  const found = findAttrs(data.attributes.attributes, world.ui?.attrQuery).filter((a) => cat === 'all' || attrCategory(data, a) === cat);
  const rows = ATTR_CATEGORIES.map((c) => ({ c, items: found.filter((a) => attrCategory(data, a) === c) })).filter((g) => g.items.length);
  let left = SHOWN;
  const groups = rows.map((g) => {
    const items = g.items.slice(0, Math.max(left, 0));
    left -= items.length;
    return items.length ? `<h3 class="attr-cat">${cap(g.c)}</h3><div class="attr-list">${items.map((a) => row(data, a, levels[a.key] ?? 0, used.get(a.key))).join('')}</div>` : '';
  }).join('');
  return `${groups}${found.length > SHOWN ? `<small>${found.length - SHOWN} more: pick a category or narrow the search.</small>` : ''}${found.length ? '' : '<small>Nothing found.</small>'}`;
}

export function attrsView(world, r, head) {
  const data = world.gamedata;
  if (!data) return `<div class="scroll">${head}<p class="note">Loading game data…</p></div>`;
  const levels = world.draft?.attrs ?? world.build.attrs ?? {};
  const open = data.attributes.attributes.find((a) => a.key === world.ui?.attr);
  const cat = world.ui?.attrCat ?? 'all';
  const chip = (c) => `<button type="button" class="chip-btn${cat === c ? ' on' : ''}" data-attr-cat="${c}" aria-pressed="${cat === c}">${cap(c)}</button>`;
  const set = Object.values(levels).filter((v) => v > 0).length;
  return `<div class="scroll">${head}${draftBar(world, 'attrs', 'attributes')}
    <div class="panel"><h2>Attributes <span class="count">${set} set</span></h2><div class="chips cat-chips" role="group" aria-label="Category">${['all', ...ATTR_CATEGORIES].map(chip).join('')}</div>
    <label class="field">Search<input type="search" data-attr-query value="${esc(world.ui?.attrQuery ?? '')}" placeholder="Name or shard"></label>
    <div data-attr-results>${attrResults(world)}</div></div>
    <p class="note">Tap an attribute to set its level.</p>
    ${open ? sheet(data, open, levels[open.key] ?? 0, statsNow(world)) : ''}</div>`;
}
