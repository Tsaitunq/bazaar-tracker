// The sheet: the one window that settings and filters open in (a <dialog class="sheet panel">).
// It closes on its X, a tap on the dimmed page, a swipe down, Escape and the back key.
const CLOSE_PX = 80;
// dy: how far the finger pulled the sheet down
export const swipeCloses = (dy) => dy > CLOSE_PX;
export const outside = (r, x, y) => x < r.left || x > r.right || y < r.top || y > r.bottom;

// modal: false shows the sheet without the dimmed page and without a history entry (the tour does that).
export function openSheet(dialog, modal = true) {
  if (dialog.open) return;
  if (!modal) return dialog.show();
  dialog.showModal();
  // one history entry per open sheet, so the back key (Android's too) closes it instead of leaving the page
  history.pushState({ sheet: dialog.id }, '');
}

export function bindSheet(dialog) {
  dialog.addEventListener('close', () => { if (history.state?.sheet === dialog.id) history.back(); });
  addEventListener('popstate', () => { if (dialog.open) dialog.close(); });

  // The press has to begin on the dimmed page too: a text selection dragged out of the sheet must not close it.
  let pressedOutside = false;
  const onBackdrop = (e) => e.target === dialog && outside(dialog.getBoundingClientRect(), e.clientX, e.clientY);
  dialog.addEventListener('pointerdown', (e) => { pressedOutside = onBackdrop(e); });
  dialog.addEventListener('click', (e) => {
    if ((pressedOutside && onBackdrop(e)) || e.target.closest?.('[data-act="close"]')) dialog.close();
  });

  let startY = null;
  const pull = (dy) => { dialog.style.transform = dy > 0 ? `translateY(${dy}px)` : ''; };
  dialog.addEventListener('touchstart', (e) => {
    // content that is scrolled down scrolls back first; only a drag from its top pulls the sheet
    const body = e.target.closest?.('.sheet-body');
    startY = e.touches.length === 1 && !(body?.scrollTop > 0) ? e.touches[0].clientY : null;
  }, { passive: true });
  dialog.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy < 0) startY = null; // upwards is a scroll
    pull(dy);
  }, { passive: true });
  const end = (e) => {
    if (startY === null) return;
    const dy = e.changedTouches[0].clientY - startY;
    startY = null;
    pull(0);
    if (e.type === 'touchend' && swipeCloses(dy)) dialog.close();
  };
  dialog.addEventListener('touchend', end);
  dialog.addEventListener('touchcancel', end);
}
