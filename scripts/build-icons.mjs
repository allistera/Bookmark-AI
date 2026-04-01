import sharp from 'sharp';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'icons', 'icon.svg');
const svg = readFileSync(svgPath);

const sizes = [16, 24, 32, 48, 128];
await Promise.all(
  sizes.map((size) =>
    sharp(svg)
      .resize(size, size)
      .png()
      .toFile(join(root, 'icons', `icon${size}.png`))
  )
);
console.log('Built icons:', sizes.map((s) => `icon${s}.png`).join(', '));
