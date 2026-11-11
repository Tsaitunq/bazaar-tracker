// The player figure: the front of a 64x64 skin, hat and clothing layers included, drawn on a canvas with whole-pixel scaling.
export const FIGURE = { w: 16, h: 32 };
export const SCALE = 6;
const HEAD_PX = 32;

// Source rects on the skin and where they land on the 16x32 figure. Base layer first, then the clothing over it.
// slim: arms 3 wide (the Alex model) instead of 4.
export function figureRects(slim) {
  const a = slim ? 3 : 4;
  const part = (sx, sy, w, h, dx, dy) => ({ sx, sy, w, h, dx, dy });
  const layer = (head, body, rArm, lArm, rLeg, lLeg) => [
    part(...head, 4, 0), part(...body, 4, 8),
    part(rArm[0], rArm[1], a, 12, 4 - a, 8), part(lArm[0], lArm[1], a, 12, 12, 8),
    part(rLeg[0], rLeg[1], 4, 12, 4, 20), part(lLeg[0], lLeg[1], 4, 12, 8, 20),
  ];
  return [
    ...layer([8, 8, 8, 8], [20, 20, 8, 12], [44, 20], [36, 52], [4, 20], [20, 52]),
    ...layer([40, 8, 8, 8], [20, 36, 8, 12], [44, 36], [52, 52], [4, 36], [4, 52]),
  ];
}

// A skin is slim when the last column of the right arm is empty over its whole height. alpha(x, y) gives 0..255.
export function isSlim(alpha) {
  for (let y = 20; y < 32; y++) if (alpha(47, y) > 0) return false;
  return true;
}

let skin; // undefined = not asked yet, 'loading', a drawable (canvas), or null = no file
let slim = false;
let source = null; // a data url of the imported player's skin; null = the bundled one

// The skin of the imported player, or null for the bundled one. The next paint loads it.
export function setSkin(dataUrl) {
  source = typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png;base64,') ? dataUrl : null;
  skin = undefined;
  slim = false;
}

// A skin from before 1.8 is 64x32: the left arm and leg are the right ones mirrored. Gives a 64x64 canvas either way.
export function normalize(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  if (img.height === 32) {
    for (const [sx, sy, dx, dy] of [[0, 16, 16, 48], [40, 16, 32, 48]]) {
      g.save();
      g.translate(dx + 16, dy);
      g.scale(-1, 1);
      g.drawImage(c, sx, sy, 16, 16, 0, 0, 16, 16);
      g.restore();
    }
  }
  return c;
}

function load(repaint) {
  if (skin !== undefined) return;
  skin = 'loading';
  const wanted = source;
  const img = new Image();
  img.onload = () => {
    if (wanted !== source) return; // the skin was changed while this one loaded
    try {
      const c = normalize(img);
      const px = c.getContext('2d').getImageData(0, 0, 64, 64).data;
      slim = isSlim((x, y) => px[(y * 64 + x) * 4 + 3]);
      skin = c;
    } catch { slim = false; skin = img; }
    repaint();
  };
  // a stored skin that does not load: the bundled one
  img.onerror = () => { if (wanted !== source) return; if (source) { source = null; skin = undefined; } else skin = null; repaint(); };
  img.src = source ?? 'img/skin.png';
}

// Paints every canvas[data-figure] under root: the skin, or a flat silhouette while there is none.
export function paintFigures(root) {
  const canvases = [...root.querySelectorAll('canvas[data-figure]')];
  const heads = [...root.querySelectorAll('canvas[data-head]')];
  if (!canvases.length && !heads.length) return;
  load(() => paintFigures(root));
  for (const canvas of heads) {
    if (!skin || skin === 'loading') continue; // until the skin is there the button keeps its icon
    canvas.width = canvas.height = HEAD_PX;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (const sx of [8, 40]) g.drawImage(skin, sx, 8, 8, 8, 0, 0, HEAD_PX, HEAD_PX); // face, then the hat layer
    canvas.closest('.profile')?.classList.add('has-head');
  }
  for (const canvas of canvases) {
    canvas.width = FIGURE.w * SCALE;
    canvas.height = FIGURE.h * SCALE;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (skin && skin !== 'loading') {
      for (const r of figureRects(slim)) g.drawImage(skin, r.sx, r.sy, r.w, r.h, r.dx * SCALE, r.dy * SCALE, r.w * SCALE, r.h * SCALE);
    } else if (skin === null) {
      g.fillStyle = getComputedStyle(canvas).color;
      for (const r of figureRects(false).slice(0, 6)) g.fillRect(r.dx * SCALE, r.dy * SCALE, r.w * SCALE, r.h * SCALE);
    }
  }
}
