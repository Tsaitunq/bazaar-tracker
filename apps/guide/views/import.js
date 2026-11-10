// The profile import: the settings block and the screen of suggestions. No state in here: what is shown comes in from app.js
// (world.imp) and from import/propose.js (world.imp.areas). Every text from outside goes through esc.
import { esc } from '../../../shared/format.js';
import { bottomBar } from './parts.js';
import { HOME_TABS } from './home.js';
import { isPickable, isSuggestion } from '../import/propose.js';

export const NOT_AFFILIATED = 'Not affiliated with or endorsed by Hypixel.';
const STALE_NOTE = 'The data can be up to 1 hour old: the server keeps its copy for an hour, so Reload does not bring anything newer until then.';
const SENT = 'Your name is sent to this app\'s worker, which asks Hypixel and keeps the answer for an hour. Everything else stays on this device.';

const when = (at) => (at ? new Date(at).toISOString().slice(0, 16).replace('T', ' ') : '');
const button = (cls, attr, label, off = false) => `<button type="button" class="${cls}" ${attr}${off ? ' disabled' : ''}>${label}</button>`;

function confirmBlock(imp) {
  const c = imp.confirm;
  if (!c) return '';
  const text = {
    replace: `This replaces your previous import state${imp.savedName ? ` (${esc(imp.savedName)})` : ''}.`,
    foreign: imp.ownName ? `This profile (${esc(imp.name)}) is not the one you saved (${esc(imp.ownName)}). Apply anyway?` : `Apply suggestions from ${esc(imp.name)}? This profile is then saved as yours.`,
    clear: 'Delete the stored profile data? Your checkmarks, build and measurements stay.',
  }[c];
  return `<div class="actions" role="alertdialog"><span class="note">${text}</span>${button('primary', 'data-imp-confirm="yes"', c === 'clear' ? 'Delete' : c === 'replace' ? 'Replace' : 'Apply')}${button('ghost', 'data-imp-confirm="no"', 'Cancel')}</div>`;
}

// The block of the settings page.
export function importSettings(world) {
  const imp = world.imp;
  const head = '<h2>Profile import</h2>';
  if (!imp?.available) return `<section class="panel" data-imp>${head}<p class="note">Reading your SkyBlock profile works in the Android app only.</p><small>${NOT_AFFILIATED}</small></section>`;
  const cool = imp.cooling > 0;
  const profiles = imp.profiles?.length
    ? `<label class="field">Profile<select data-imp-profile>${imp.profiles.map((p) => `<option value="${esc(p.id)}"${p.id === imp.profileId ? ' selected' : ''}>${esc(p.cute_name)}${p.game_mode ? ` (${esc(p.game_mode)})` : ''}${p.selected ? ' · selected' : ''}</option>`).join('')}</select></label>`
    : '';
  const canLoad = !!(imp.profiles?.length || imp.profileId);
  const loaded = imp.hasProfile
    ? `<small>Loaded ${esc(when(imp.fetchedAt))} UTC${imp.profileName ? ` · profile ${esc(imp.profileName)}` : ''}${imp.offline ? ' · you are offline, showing the last import' : ''}</small>`
    : '<small>Nothing loaded yet.</small>';
  return `<section class="panel" data-imp>${head}
    <label class="field">Minecraft name<input type="text" data-imp-name maxlength="16" autocapitalize="off" autocomplete="off" spellcheck="false" value="${esc(imp.name ?? '')}"></label>
    <div class="actions">${button('ghost', 'data-act="imp-profiles"', 'Find profiles', imp.busy || cool)}</div>
    ${profiles}
    <div class="actions">${button('primary', 'data-act="imp-load"', imp.hasProfile && !imp.profiles ? 'Reload' : 'Load profile', imp.busy || cool || !canLoad)}${imp.hasProfile ? '<a class="ghost-link" href="#/import">Review suggestions</a>' : ''}</div>
    <small>${STALE_NOTE}</small>
    ${loaded}
    <small role="status">${esc(imp.busy ? 'Loading …' : cool ? `${imp.message ?? ''} (${imp.cooling} s)`.trim() : imp.message ?? '')}</small>
    ${confirmBlock(imp)}
    <div class="actions">${imp.undo ? button('ghost', 'data-act="imp-undo"', 'Undo last import') : ''}${imp.hasProfile ? button('ghost', 'data-act="imp-clear"', 'Delete profile data') : ''}</div>
    <small>${SENT}</small><small>${NOT_AFFILIATED}</small>
  </section>`;
}

const STATUS = { new: 'new', different: 'differs', conflict: 'not changed', partial: 'partly', suggest: 'suggestion' };

function rowHtml(r, picked) {
  const arrow = r.from !== undefined && r.to !== undefined ? `<small>${esc(String(r.from))} → ${esc(String(r.to))}</small>` : '';
  const where = r.where?.length ? `<small>Found: ${esc(r.where.join(', '))}</small>` : '';
  const note = r.blocked ? `<small class="c-red">${esc(r.blocked)}</small>` : r.note ? `<small>${esc(r.note)}</small>` : '';
  const tag = `<b class="imp-${r.status}">${STATUS[r.status] ?? esc(r.status)}</b>`;
  const body = `<span>${esc(r.label)} ${tag}</span>${arrow}${where}${note}`;
  if (isPickable(r)) return `<label class="check imp-row"><input type="checkbox" data-imp-pick="${esc(r.id)}"${picked.has(r.id) ? ' checked' : ''}><span class="imp-body">${body}</span></label>`;
  if (isSuggestion(r)) return `<div class="imp-row"><span class="imp-body">${body}</span>${button('ghost', `data-imp-one="${esc(r.id)}"`, 'Use')}</div>`;
  return `<div class="imp-row"><span class="imp-body">${body}</span></div>`;
}

function areaHtml(a, picked) {
  const head = `<h2>${esc(a.name)}</h2><small>${a.pick ? `${a.pick} to take` : 'Nothing to take'}${a.equal ? ` · ${a.equal} already match` : ''}</small>`;
  const notes = a.notes.map((n) => `<small>${esc(n)}</small>`).join('');
  let rows;
  if (a.id === 'gear') {
    const groups = new Map();
    for (const r of a.rows) {
      const g = groups.get(r.guide) ?? { title: r.title, sections: new Map() };
      g.sections.set(r.section, [...(g.sections.get(r.section) ?? []), r]);
      groups.set(r.guide, g);
    }
    rows = [...groups].map(([guide, g]) => `<details data-keep-open="imp-${esc(guide)}"${[...g.sections.values()].flat().some(isPickable) ? ' open' : ''}><summary>${esc(g.title)}</summary>${[...g.sections].map(([name, list]) => `<h3>${esc(name)}</h3>${list.map((r) => rowHtml(r, picked)).join('')}`).join('')}</details>`).join('');
  } else rows = a.rows.map((r) => rowHtml(r, picked)).join('');
  const all = a.pick ? `<div class="actions">${button('ghost', `data-imp-all="${esc(a.id)}"`, `Apply all (${a.pick})`)}</div>` : '';
  return `<section class="panel" data-imp-area="${esc(a.id)}">${head}${notes}${rows}${all}</section>`;
}

// The screen of suggestions. world.imp: { areas, picked (Set of row ids), since, name, profileName, fetchedAt, confirm, ... }
export function importView(world) {
  const imp = world.imp;
  const title = '<div class="home-title"><h1>Import</h1></div>';
  const back = '<a class="back" href="#/settings">‹ Settings</a>';
  if (!imp?.hasProfile || !imp.areas) {
    return `<div class="screen screen-home" data-theme="home" data-page="import">${back}${title}<div class="scroll"><section class="panel"><p class="note">No profile loaded yet. Load one in the settings.</p><small>${NOT_AFFILIATED}</small></section></div>${bottomBar(HOME_TABS, 'settings')}</div>`;
  }
  const picked = imp.picked ?? new Set();
  const meta = `<section class="panel"><small>${esc(imp.name ?? '')}${imp.profileName ? ` · ${esc(imp.profileName)}` : ''} · loaded ${esc(when(imp.fetchedAt))} UTC</small><small>${STALE_NOTE}</small><small>${NOT_AFFILIATED}</small>
    <label class="check"><input type="checkbox" data-imp-since${imp.since ? ' checked' : ''}> These checkmarks are new since my last measurement</label>
    <small>Off: they count as already inside your measured base. On: they get today's date and count as a change since the measurement (only accessories use the date).</small>
    ${confirmBlock(imp)}${imp.message ? `<small role="status">${esc(imp.message)}</small>` : ''}</section>`;
  const bar = `<div class="actions">${button('primary', 'data-imp-apply', `Apply selected (${picked.size})`, !picked.size)}${imp.undo ? button('ghost', 'data-act="imp-undo"', 'Undo last import') : ''}</div>`;
  return `<div class="screen screen-home" data-theme="home" data-page="import">${back}${title}<div class="scroll">${meta}${imp.areas.map((a) => areaHtml(a, picked)).join('')}${bar}</div>${bottomBar(HOME_TABS, 'settings')}</div>`;
}
