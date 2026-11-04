// The attribute editor: the attributes the guides ask for first, then all of them with a search.
import { esc } from '../../format.js';
import { usedAttrs, findAttrs, nextShards, effectLines } from '../attrs-model.js';
import { draftBar, stepper } from './editors.js';

const SHOWN = 60;
const RARITY = { COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary' };

// No images yet: two letters in the colour of the rarity.
const row = (a, level, open, need) => `<button type="button" class="attr${open ? ' attr-open' : ''}${level >= a.maxLevel ? ' attr-max' : ''}" data-attr="${esc(a.key)}" aria-label="${esc(a.name)}, level ${level} of ${a.maxLevel}"><span class="attr-icon r-${a.rarity}" aria-hidden="true">${esc(a.name.slice(0, 2))}</span><span class="attr-name">${esc(a.name)}</span><span class="attr-lv">${level}/${a.maxLevel}${need ? ` <em>needs ${need}</em>` : ''}</span></button>`;

function sheet(data, a, level) {
  const next = nextShards(data, a, level);
  const lines = effectLines(data, a, level).map((l) => `<small>${esc(l.text)}${l.cond === 'always' ? '' : ` <em>(${esc(l.cond)})</em>`}</small>`).join('') || '<small>No stat effect known.</small>';
  return `<section class="panel sheet" data-attr-sheet="${esc(a.key)}"><h2>${esc(a.name)}</h2>
    <small>${esc(a.shard)} shard · ${RARITY[a.rarity]} · ${a.areas.join(', ')}</small>
    ${stepper('attr', level, a.maxLevel)}${lines}
    <small>${next === null ? 'Maxed.' : `Next level: ${next} ${next === 1 ? 'shard' : 'shards'}`}</small></section>`;
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
  const list = (items) => items.map((a) => row(a, levels[a.key] ?? 0, a === open, used.get(a.key))).join('');
  const found = findAttrs(all, world.ui?.attrQuery);
  const allBox = world.ui?.attrAll
    ? `<div class="panel"><label class="field">Search<input type="search" data-attr-query value="${esc(world.ui?.attrQuery ?? '')}" placeholder="Name or shard"></label><div class="attr-list">${list(found.slice(0, SHOWN))}</div>${found.length > SHOWN ? `<small>${found.length - SHOWN} more: narrow the search.</small>` : ''}${found.length ? '' : '<small>Nothing found.</small>'}<button type="button" class="ghost" data-attr-all>Hide all</button></div>`
    : `<button type="button" class="ghost" data-attr-all>Show all ${all.length}</button>`;
  const set = Object.values(levels).filter((v) => v > 0).length;
  return `<div class="scroll">${head}${draftBar(world, 'attrs', 'attributes')}
    <div class="panel"><h2>In your guides <span class="count">${set} set</span></h2><div class="attr-list">${list(inGuides) || '<small>No guide asks for an attribute.</small>'}</div>${unknown.length ? `<small>Not in the data: ${esc(unknown.join(', '))}</small>` : ''}</div>
    ${open ? sheet(data, open, levels[open.key] ?? 0) : '<p class="note">Tap an attribute to set its level.</p>'}
    ${allBox}</div>`;
}
