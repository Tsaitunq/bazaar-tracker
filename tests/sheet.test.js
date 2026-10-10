import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { swipeCloses, outside, openSheet, bindSheet } from '../sheet.js';
import { FILTERS } from '../render.js';

// just enough of a <dialog> and of the browser's history to open and close a sheet
class Dialog extends EventTarget {
  id = 'panel';
  open = false;
  modal = false;
  style = {};
  showModal() { this.open = this.modal = true; }
  show() { this.open = true; }
  close() {
    if (!this.open) return;
    this.open = this.modal = false;
    this.dispatchEvent(new Event('close'));
  }
  getBoundingClientRect() { return { left: 0, right: 100, top: 200, bottom: 400 }; }
}
function browser() {
  const entries = [null];
  const onPop = [];
  globalThis.addEventListener = (type, fn) => type === 'popstate' && onPop.push(fn);
  globalThis.history = {
    get state() { return entries.at(-1); },
    pushState(state) { entries.push(state); },
    back() { entries.pop(); for (const fn of onPop) fn(); },
  };
  return entries;
}
const at = (type, x, y) => Object.assign(new Event(type), { clientX: x, clientY: y });

test('a swipe down closes the sheet only when it is long enough', () => {
  assert.equal(swipeCloses(81), true);
  assert.equal(swipeCloses(80), false);
  assert.equal(swipeCloses(-200), false);
});

test('outside tells the dimmed page from the sheet', () => {
  const r = { left: 0, right: 100, top: 200, bottom: 400 };
  assert.equal(outside(r, 50, 100), true);
  assert.equal(outside(r, 50, 300), false);
  assert.equal(outside(r, 100, 400), false);
});

test('an open sheet has one history entry, and closing it takes the entry away', () => {
  const entries = browser();
  const dialog = new Dialog();
  bindSheet(dialog);
  openSheet(dialog);
  openSheet(dialog); // already open: no second entry
  assert.ok(dialog.open && dialog.modal);
  assert.deepEqual(entries, [null, { sheet: 'panel' }]);
  dialog.close();
  assert.deepEqual(entries, [null]);
});

test('the back key closes the sheet and leaves the page where it was', () => {
  const entries = browser();
  const dialog = new Dialog();
  bindSheet(dialog);
  openSheet(dialog);
  history.back();
  assert.equal(dialog.open, false);
  assert.deepEqual(entries, [null]);
});

test('the tour opens the sheet without the dimmed page and without a history entry', () => {
  const entries = browser();
  const dialog = new Dialog();
  bindSheet(dialog);
  openSheet(dialog, false);
  assert.ok(dialog.open && !dialog.modal);
  dialog.close();
  assert.deepEqual(entries, [null]);
});

test('a tap on the dimmed page closes the sheet, a press that began inside it does not', () => {
  browser();
  const dialog = new Dialog();
  bindSheet(dialog);
  openSheet(dialog);
  dialog.dispatchEvent(at('pointerdown', 50, 300));
  dialog.dispatchEvent(at('click', 50, 100));
  assert.equal(dialog.open, true);
  dialog.dispatchEvent(at('click', 50, 300));
  assert.equal(dialog.open, true);
  dialog.dispatchEvent(at('pointerdown', 50, 100));
  dialog.dispatchEvent(at('click', 50, 100));
  assert.equal(dialog.open, false);
});

test('the page: settings live in the panel, with Apply and Reset, and every filter has a field', () => {
  const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const panel = page.slice(page.indexOf('<dialog id="panel"'), page.indexOf('</dialog>'));
  for (const part of ['<form id="settings" class="sheet-body" novalidate>', 'data-act="close"', 'data-act="reset"', '<button type="submit" form="settings" class="primary">Apply</button>']) {
    assert.ok(panel.includes(part), part);
  }
  assert.ok(page.includes('id="open-filters"') && page.includes('id="filter-count"') && page.includes('id="chips"'));
  for (const key of new Set(Object.values(FILTERS).flat())) assert.ok(panel.includes(`id="${key}"`), key);
});
