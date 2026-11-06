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

let skin; // undefined = not asked yet, 'loading', an Image, or null = no file
let slim = false;

function load(repaint) {
  if (skin !== undefined) return;
  skin = 'loading';
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, 64, 64).data;
      slim = isSlim((x, y) => px[(y * 64 + x) * 4 + 3]);
    } catch { slim = false; }
    skin = img;
    repaint();
  };
  img.onerror = () => { skin = null; repaint(); };
  img.src = 'img/skin.png';
}

// Paints every canvas[data-figure] under root: the skin, or a flat silhouette while there is none.
export function paintFigures(root) {
  const canvases = [...root.querySelectorAll('canvas[data-figure]')];
  const heads = [...root.querySelectorAll('canvas[data-head]')];
  if (!canvases.length && !heads.length) return;
  load(() => paintFigures(root));
  for (const canvas of heads) {
    if (!(skin instanceof Image)) continue; // until the skin is there the button keeps its icon
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
    if (skin instanceof Image) {
      for (const r of figureRects(slim)) g.drawImage(skin, r.sx, r.sy, r.w, r.h, r.dx * SCALE, r.dy * SCALE, r.w * SCALE, r.h * SCALE);
    } else if (skin === null) {
      g.fillStyle = getComputedStyle(canvas).color;
      for (const r of figureRects(false).slice(0, 6)) g.fillRect(r.dx * SCALE, r.dy * SCALE, r.w * SCALE, r.h * SCALE);
    }
  }
}
