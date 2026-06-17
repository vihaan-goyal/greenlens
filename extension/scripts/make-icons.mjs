// Rasterizes extension/icons/source.svg into the four PNG sizes Chrome wants
// for an MV3 extension action. Run via `npm run icons` after editing the
// source SVG.
//
// Sharp is a dev-only dep (image processing); it doesn't ship in the
// extension bundle.

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = resolve(__dirname, '..', 'icons');

const svg = readFileSync(resolve(ICONS_DIR, 'source.svg'));
const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const out = resolve(ICONS_DIR, `icon-${size}.png`);
  const buf = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.byteLength} bytes)`);
}
