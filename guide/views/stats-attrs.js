// The attribute editor: the attributes the guides ask for first, then all of them with a search.
import { esc } from '../../format.js';
import { usedAttrs, findAttrs, nextShards, shardsToMax, effectLines, effectShort } from '../attrs-model.js';
import { draftBar, stepper, pic } from './editors.js';

const SHOWN = 60;
const RARITY = { COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary' };

// The shard picture (from img/hypixel/shards, not in git; seven come from img/mc, Vanilla textures); without it two letters in the colour of the rarity.
const icon = (a) => pic(a.mcIcon ? `img/mc/${a.mcIcon}.png` : `img/hypixel/shards/${a.icon ?? a.key}.png`, `attr-pic r-${a.rarity}`, a.name.slice(0, 2));

const row = (data, a, level, need) => `<button type="button" class="attr${level === 0 ? ' attr-zero' : ''}${level >= a.maxLevel ? ' attr-max' : ''}" data-attr="${esc(a.key)}" aria-label="${esc(a.name)}, level ${level} of ${a.maxLevel}">${icon(a)}<span class="attr-text"><span class="attr-name">${esc(a.name)}</span><small class="attr-fx">${esc(effectShort(data, a, level))}</small></span><span class="attr-lv">${level}/${a.maxLevel}${need ? ` <em>needs ${need}</em>` : ''}</span></button>`;

// A bottom sheet over the list: everything of one attribute without a scroll.
function sheet(data, a, level) {
  const text = (l) => `${esc(l.text)}${l.cond === 'always' ? '' : ` <em>(${esc(l.cond)})</em>`}`;
  const lines = (at) => effectLines(data, a, at).map(text).join(', ') || 'no stat effect known';
  const next = nextShards(data, a, level);
  const upcoming = next === null ? '<small>Maxed.</small>' : `<small>Level ${level + 1}: ${lines(level + 1)}</small>`;
  const shards = next === null ? '' : `<small>Shards: <b>${next}</b> to level ${level + 1}, <b>${shardsToMax(data, a, level)}</b> to max</small>`;
  return `<button type="button" class="sheet-back" data-attr-close aria-label="Close" tabindex="-1"></button>
    <section class="bsheet" role="dialog" aria-label="${esc(a.name)}" data-attr-sheet="${esc(a.key)}">
    <div class="bs-head">${icon(a)}<div class="bs-title"><h2>${esc(a.name)}</h2><small>${esc(a.shard)} shard · ${RARITY[a.rarity]} · ${esc(a.areas.join(', '))}</small></div><button type="button" class="bs-close" data-attr-close aria-label="Close">✕</button></div>
    ${stepper('attr', level, a.maxLevel)}<small>Level ${level}: ${lines(level)}</small>${upcoming}${shards}</section>`;
}

export function attrsView(world, r, head) {
  const data = world.gamedata;
  if (!data) return `<div class="scroll">${head}<p class="note">Loading game data…</p></div>`;
  const levels = world.draft?.attrs ?? world.build.attrs ?? {};
  const all = data.attributes.attributes;
  const used = usedAttrs(world.guides);
  const inGuides = all.filter((a) => used.has(a.key));
  const unknown = [...used.keys()].filter((k) => !all.some((a) => a.key === k));
  const open = all.find((a) => a.key === world.ui?.attr);
  const list = (items) => items.map((a) => row(data, a, levels[a.key] ?? 0, used.get(a.key))).join('');
  const found = findAttrs(all, world.ui?.attrQuery);
  const allBox = world.ui?.attrAll
    ? `<div class="panel"><label class="field">Search<input type="search" data-attr-query value="${esc(world.ui?.attrQuery ?? '')}" placeholder="Name or shard"></label><div class="attr-list">${list(found.slice(0, SHOWN))}</div>${found.length > SHOWN ? `<small>${found.length - SHOWN} more: narrow the search.</small>` : ''}${found.length ? '' : '<small>Nothing found.</small>'}<button type="button" class="ghost" data-attr-all>Hide all</button></div>`
    : `<button type="button" class="ghost" data-attr-all>Show all ${all.length}</button>`;
  const set = Object.values(levels).filter((v) => v > 0).length;
  return `<div class="scroll">${head}${draftBar(world, 'attrs', 'attributes')}
    <div class="panel"><h2>In your guides <span class="count">${set} set</span></h2><div class="attr-list">${list(inGuides) || '<small>No guide asks for an attribute.</small>'}</div>${unknown.length ? `<small>Not in the data: ${esc(unknown.join(', '))}</small>` : ''}</div>
    <p class="note">Tap an attribute to set its level.</p>
    ${allBox}${open ? sheet(data, open, levels[open.key] ?? 0) : ''}</div>`;
}
