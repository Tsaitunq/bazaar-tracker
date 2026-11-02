// Settings and profile. The key is only ever written, never read back into the page.
import { esc } from '../../format.js';
import { syncView } from '../../sync.js';
import { PRESETS } from '../../optimizer.js';
import { bottomBar } from './parts.js';
import { HOME_TABS } from './home.js';

const WEIGHTS = [['wF', 'Fortune weight'], ['wS', 'Speed weight'], ['wP', 'Pristine weight'], ['blockStrength', 'Block strength']];
const words = (s) => s[0].toUpperCase() + s.slice(1);
const TAXES = [['1.25', '1.25%'], ['1.125', '1.125%'], ['1', '1.0%'], ['5', '5% (Derpy, 1.25% × 4)'], ['4.5', '4.5% (Derpy, 1.125% × 4)']];
const check = (flag, label, on) => `<label class="check"><input type="checkbox" data-flag="${flag}"${on ? ' checked' : ''}> ${label}</label>`;

function resetRow(guide, armed, removable) {
  const name = esc(guide.title);
  const id = esc(guide.id);
  return armed === guide.id
    ? `<div class="actions"><span class="note">Clear all checkmarks of ${name}?</span><button type="button" class="primary" data-reset-yes="${id}">Reset</button><button type="button" class="ghost" data-reset-no>Cancel</button></div>`
    : `<div class="actions"><button type="button" class="ghost" data-reset="${id}">Reset ${name}</button>${removable ? `<button type="button" class="ghost" data-remove-guide="${id}">Remove imported copy</button>` : ''}</div>`;
}

export function settingsView(world) {
  const s = world.settings;
  const profile = `<section class="panel"><h2>Profile</h2>
    <label class="field">Minecraft UUID<input type="text" data-set="uuid" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(world.uuid ?? '')}"></label>
    <label class="field">API key<input type="password" data-set="key" autocomplete="off" autocapitalize="off" spellcheck="false" value=""></label>
    <small>${esc(world.keyMessage ?? (world.hasKey ? 'Key saved' : 'No key saved'))}</small>
    ${world.canSync ? syncView(world.state, world.now, esc, { message: world.message, choices: world.choices }) : '<p>Sync needs the Android app.</p>'}
    <small role="status">${esc(world.profileMessage ?? '')}</small>
    <div class="actions"><button type="button" class="ghost" data-act="remove">${world.removeArmed ? 'Tap again to remove' : 'Remove key and profile data'}</button></div>
  </section>`;
  const mining = `<section class="panel"><h2>Prices and mining target</h2>
    <label class="field">Bazaar tax<select data-tax>${TAXES.map(([v, label]) => `<option value="${v}"${Number(v) === (world.tax ?? 1.25) ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
    <label class="field">Preset<select data-mining="preset">${Object.keys(PRESETS).map((p) => `<option value="${p}"${p === s.preset ? ' selected' : ''}>${words(p)}</option>`).join('')}</select></label>
    ${WEIGHTS.map(([key, label]) => `<label class="field">${label}<input type="number" step="any" min="0" inputmode="decimal" data-mining="${key}" value="${esc(s[key])}"></label>`).join('')}
    <div class="actions"><button type="button" class="ghost" data-act="mining-reset">Reset weights</button></div>
    ${check('keepOldGear', 'I keep old gear', world.keepOldGear)}
    ${check('godPotion', 'God Potion active', world.boosts?.godPotion)}
    ${check('boosterCookie', 'Booster Cookie active', world.boosts?.boosterCookie)}
  </section>`;
  const data = `<section class="panel"><h2>Guides and data</h2>
    <label class="field">Guide file or export as text<textarea data-json rows="4" spellcheck="false">${esc(world.dataText ?? '')}</textarea></label>
    <input type="file" data-import-file accept=".json,application/json" hidden>
    <div class="actions"><button type="button" class="ghost" data-act="import-file">Import file</button><button type="button" class="ghost" data-act="import">Import text</button><button type="button" class="ghost" data-act="export">Export</button></div>
    <small role="status">${esc(world.dataMessage ?? '')}</small>
    ${world.guides.map((g) => resetRow(g, world.armed, world.importedIds?.includes(g.id))).join('')}
  </section>`;
  return `<div class="screen screen-home" data-theme="home" data-page="settings"><div class="home-title"><h1>Settings</h1></div><div class="scroll">${profile}${mining}${data}</div>${bottomBar(HOME_TABS, 'settings')}</div>`;
}
