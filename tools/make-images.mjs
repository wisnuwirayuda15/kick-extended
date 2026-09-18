// Generates the project's brand images as PNGs. No dependencies: the art is
// pure pixel blocks, so it is drawn into an RGBA buffer and encoded with
// node's own zlib rather than rasterised by a graphics library.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

// ---------------------------------------------------------------- PNG output

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(img) {
  const { w, h, data } = img;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- the canvas

function canvas(w, h, bg) {
  const img = { w, h, data: Buffer.alloc(w * h * 4) };
  fill(img, 0, 0, w, h, bg);
  return img;
}

function put(img, x, y, c) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.data[i] = c[0];
  img.data[i + 1] = c[1];
  img.data[i + 2] = c[2];
  img.data[i + 3] = 255;
}

function fill(img, x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) put(img, xx, yy, c);
}

/** Nearest-neighbour downscale by an integer factor. Exact for block art. */
function shrink(img, factor) {
  const out = { w: img.w / factor, h: img.h / factor };
  out.data = Buffer.alloc(out.w * out.h * 4);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const i =
        ((y * factor + (factor >> 1)) * img.w + x * factor + (factor >> 1)) * 4;
      const o = (y * out.w + x) * 4;
      img.data.copy(out.data, o, i, i + 4);
    }
  return out;
}

// ----------------------------------------------------------------- the paint

const hex = (s) => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Straight from src/styles.css, so the art and the UI are the same palette.
const GREEN = hex("#53fc18"); // the accent, 13 uses
const GREEN2 = hex("#9dff57"); // the lighter second green
const RED = hex("#ff6b6b"); // the error colour
const BLACK = hex("#070707"); // the panel fill
const WHITE = hex("#ffffff");
const DIM = mix(GREEN, BLACK, 0.8);
const UNFILLED = mix(GREEN, BLACK, 0.68);

// 4x4 ordered dither. Chunky on purpose: the threshold is sampled per grid
// cell, not per pixel, so the fade stays blocky instead of turning to noise.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bayer = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

// ---------------------------------------------------------------- the glyph
//
// An original mark, not a derivative of anyone's logo: a download arrow whose
// head is a play triangle, so it reads as "video" and "save" at once. Drawn on
// a 16x16 cell grid and stamped at integer scale, which is what keeps every
// edge a hard stair-step at any size.

const GLYPH = [
  "................",
  "................",
  "......XXXX......",
  "......XXXX......",
  "......XXXX......",
  "......XXXX......",
  "......XXXX......",
  "..XXXXXXXXXXXX..",
  "...XXXXXXXXXX...",
  "....XXXXXXXX....",
  ".....XXXXXX.....",
  "......XXXX......",
  ".......XX.......",
  "................",
  "..XXXXXXXXXXXX..",
  "................",
];

/**
 * Stamps the glyph. When a bar is given, the base row is split at
 * bar.filled into bar.colour and the glyph colour -- a progress read.
 */
function glyph(img, x, y, cell, colour, bar = null) {
  for (let r = 0; r < GLYPH.length; r++)
    for (let c = 0; c < GLYPH[r].length; c++) {
      if (GLYPH[r][c] !== "X") continue;
      let paint = colour;
      if (bar && r === 14 && c >= 2 + 12 * bar.filled) paint = bar.colour;
      fill(img, x + c * cell, y + r * cell, cell, cell, paint);
    }
}

// ----------------------------------------------------------------- the font
//
// A plain 5x7 grid face. Deliberately generic construction -- it sets the
// project's own name, and is not meant to resemble anyone's wordmark.

const FONT = {
  K: ["X...X", "X..X.", "X.X..", "XX...", "X.X..", "X..X.", "X...X"],
  I: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "XXXXX"],
  C: [".XXX.", "X...X", "X....", "X....", "X....", "X...X", ".XXX."],
  E: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
  X: ["X...X", "X...X", ".X.X.", "..X..", ".X.X.", "X...X", "X...X"],
  T: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
  N: ["X...X", "XX..X", "XX..X", "X.X.X", "X..XX", "X..XX", "X...X"],
  D: ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

function text(img, string, x, y, cell, gap, colour) {
  let cx = x;
  for (const ch of string) {
    const rows = FONT[ch];
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 5; c++)
        if (rows[r][c] === "X")
          fill(img, cx + c * cell, y + r * cell, cell, cell, colour);
    cx += 5 * cell + gap;
  }
  return cx - gap;
}

/** Deterministic, so re-running the script produces byte-identical files. */
function rng(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- 1. banner

function banner() {
  const U = 8; // one grid cell, in pixels
  const COLS = 160;
  const ROWS = 80;
  const img = canvas(COLS * U, ROWS * U, BLACK);
  const cell = (cx, cy, c, w = 1, h = 1) =>
    fill(img, cx * U, cy * U, w * U, h * U, c);

  // The green field: solid out to x=44, then dithering away to nothing by
  // x=64. The solid part has to be wide enough to hold the whole mark -- a
  // black glyph straddling the fade loses its right edge and reads lopsided.
  for (let cx = 0; cx < 64; cx++) {
    const density = Math.min(1, Math.max(0, (44 - cx) / 20 + 1));
    for (let cy = 0; cy < ROWS; cy++)
      if (bayer(cx, cy) < density) cell(cx, cy, GREEN);
  }
  // A second, lighter green weaving through the solid part.
  for (let cx = 0; cx < 30; cx++)
    for (let cy = 0; cy < ROWS; cy++)
      if (bayer(cx + 2, cy + 1) < 0.16) cell(cx, cy, GREEN2);

  // Faint dot grid over the empty right-hand side.
  for (let cx = 68; cx < COLS; cx += 4)
    for (let cy = 2; cy < ROWS; cy += 4) put(img, cx * U, cy * U, DIM);

  // Scattered fragments, densest near the field and thinning to the right.
  const rand = rng(20260918);
  for (let i = 0; i < 90; i++) {
    const cx = 64 + Math.floor(rand() ** 2 * (COLS - 66));
    const cy = Math.floor(rand() * ROWS);
    if (rand() > 1 - (COLS - cx) / (COLS - 64)) continue;
    cell(cx, cy, rand() < 0.35 ? GREEN : DIM, rand() < 0.3 ? 2 : 1);
  }
  // One failed segment, in the colour the panel uses to report exactly that.
  cell(142, 18, RED, 2);

  // The mark, black on the green field, as it sits on the site itself.
  glyph(img, 7 * U, 24 * U, 2 * U, BLACK);

  // The name. Two weights of the same grid face, the second in the accent.
  text(img, "KICK", 66 * U, 26 * U, 3 * U, 3 * U, WHITE);
  text(img, "EXTENDED", 66 * U, 50 * U, 2 * U, 1 * U, GREEN);

  // A CRT scanline pass, kept faint enough to read as texture, not stripes.
  for (let y = 0; y < img.h; y += 4)
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      for (let k = 0; k < 3; k++)
        img.data[i + k] = Math.round(img.data[i + k] * 0.9);
    }
  return img;
}

// ------------------------------------------------------------------ 2. icon

function icon() {
  const U = 8;
  const N = 64; // 64 x 64 cells at 8px = 512px
  const img = canvas(N * U, N * U, BLACK);

  // A dithered wedge in one corner only: enough texture to look deliberate,
  // little enough that the silhouette still carries at 64px.
  for (let cx = 0; cx < 22; cx++)
    for (let cy = 0; cy < 22; cy++) {
      const density = Math.max(0, 1 - (cx + cy) / 26);
      if (bayer(cx, cy) < density * 0.5) fill(img, cx * U, cy * U, U, U, DIM);
    }

  // 16 cells x 3 grid units x 8px = 384px of content, 64px padding each side.
  glyph(img, 8 * U, 8 * U, 3 * U, GREEN, { filled: 0.6, colour: UNFILLED });
  return img;
}

// ------------------------------------------------------------------- output

const out = "assets";
mkdirSync(out, { recursive: true });

const write = (name, img) => {
  const buf = encodePNG(img);
  writeFileSync(`${out}/${name}`, buf);
  console.log(
    `${out}/${name}  ${img.w}x${img.h}  ${(buf.length / 1024).toFixed(1)} KB`,
  );
};

write("social-preview.png", banner());
const big = icon();
write("icon.png", big);
write("icon-128.png", shrink(big, 4));
write("icon-64.png", shrink(big, 8));
