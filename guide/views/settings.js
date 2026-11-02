// Settings and profile. The key is only ever written, never read back into the page.
import { esc } from '../../format.js';
import { syncView } from '../../sync.js';
import { PRESETS } from '../../optimizer.js';
import { bottomBar } from './parts.js';
import { HOME_TABS } from './home.js';

const WEIGHTS = [['wF', 'Fortune weight'], ['wS', 'Speed weight'], ['wP', 'Pristine weight'], ['blockStrength', 'Block strength']];
const words = (s) => s[0].toUpperCase() + s.slice(1);
const check = (flag, label, on) => `<label class="check"><input type="checkbox" data-flag="${flag}"${on ? ' checked' : ''}> ${label}</label>`;

function resetRow(guide, armed) {
  const name = esc(guide.title);
  const id = esc(guide.id);
  return armed === guide.id
    ? `<div class="actions"><span class="note">Clear all checkmarks of ${name}?</span><button type="button" class="primary" data-reset-yes="${id}">Reset</button><button type="button" class="ghost" data-reset-no>Cancel</button></div>`
    : `<div class="actions"><button type="button" class="ghost" data-reset="${id}">Reset ${name}</button></div>`;
}

export function settingsView(world) {
  const s = world.settings;
  const profile = `<section class="panel"><h2>Profile</h2>
    <label class="field">Minecraft UUID<input type="text" data-set="uuid" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(world.uuid ?? '')}"></label>
    <label class="field">API key<input type="password" data-set="key" autocomplete="off" autocapitalize="off" spellcheck="false" value=""></label>
    <small>${world.hasKey ? 'Key saved' : 'No key saved'}</small>
    ${world.canSync ? syncView(world.state, world.now, esc, { message: world.message, choices: world.choices }) : '<p>Sync needs the Android app.</p>'}
  </section>`;
  const mining = `<section class="panel"><h2>Mining target</h2>
    <label class="field">Preset<select data-mining="preset">${Object.keys(PRESETS).map((p) => `<option value="${p}"${p === s.preset ? ' selected' : ''}>${words(p)}</option>`).join('')}</select></label>
    ${WEIGHTS.map(([key, label]) => `<label class="field">${label}<input type="number" step="any" min="0" inputmode="decimal" data-mining="${key}" value="${esc(s[key])}"></label>`).join('')}
    <div class="actions"><button type="button" class="ghost" data-act="mining-reset">Reset weights</button></div>
    ${check('keepOldGear', 'I keep old gear', world.keepOldGear)}
    ${check('godPotion', 'God Potion active', world.boosts?.godPotion)}
    ${check('boosterCookie', 'Booster Cookie active', world.boosts?.boosterCookie)}
  </section>`;
  const data = `<section class="panel"><h2>Guides and data</h2>
    <div class="actions"><button type="button" class="ghost" data-act="import">Import</button><button type="button" class="ghost" data-act="export">Export</button></div>
    <small role="status">${esc(world.dataMessage ?? '')}</small>
    ${world.guides.map((g) => resetRow(g, world.armed)).join('')}
  </section>`;
  return `<div class="screen screen-home" data-theme="home"><div class="home-title"><h1>Settings</h1></div><div class="scroll">${profile}${mining}${data}</div>${bottomBar(HOME_TABS, 'settings')}</div>`;
}
