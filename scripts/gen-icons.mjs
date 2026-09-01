// Generates the PWA icons (solid ink background, off-white "V") without any
// image dependency: hand-rolled PNG encoder over Node's zlib.
// Run: node scripts/gen-icons.mjs   (writes into public/)
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const BG = [0x24, 0x27, 0x30]; // ink (matches the dark card panel)
const FG = [0xf7, 0xf6, 0xf3]; // off-white

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
}

function png(width, height, rgb) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    raw[row] = 0; // filter: none
    rgb.copy(raw, row + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  );
  const qx = ax + t * dx,
    qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** Solid background with a "V" made of two thick strokes. `inset` shrinks the
 *  glyph (maskable icons need a bigger safe zone). Anti-aliased by distance. */
function icon(size, inset) {
  const rgb = Buffer.alloc(size * size * 3);
  const s = size;
  const top = s * (0.30 + inset);
  const bottom = s * (0.74 - inset);
  const left = s * (0.29 + inset);
  const right = s * (0.71 - inset);
  const mid = s * 0.5;
  const r = s * (0.055 - inset * 0.25); // half stroke width
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.min(
        distToSegment(x + 0.5, y + 0.5, left, top, mid, bottom),
        distToSegment(x + 0.5, y + 0.5, right, top, mid, bottom)
      );
      // coverage: 1 inside the stroke, 0 outside, 1px linear falloff
      const a = Math.max(0, Math.min(1, r + 0.5 - d));
      const i = (y * s + x) * 3;
      for (let ch = 0; ch < 3; ch++)
        rgb[i + ch] = Math.round(BG[ch] + (FG[ch] - BG[ch]) * a);
    }
  }
  return png(s, s, rgb);
}

writeFileSync(join(pub, "icon-192.png"), icon(192, 0));
writeFileSync(join(pub, "icon-512.png"), icon(512, 0));
writeFileSync(join(pub, "icon-512-maskable.png"), icon(512, 0.08));
writeFileSync(join(pub, "apple-touch-icon.png"), icon(180, 0.02));
console.log("wrote icon-192/512/512-maskable/apple-touch-icon into public/");
