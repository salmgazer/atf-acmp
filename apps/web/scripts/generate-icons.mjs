import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');

// PWA icon sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  await mkdir(iconsDir, { recursive: true });

  const svgPath = join(publicDir, 'atf-logo-vector.svg');

  for (const size of sizes) {
    await sharp(svgPath)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(join(iconsDir, `icon-${size}x${size}.png`));
    console.log(`Generated icon-${size}x${size}.png`);
  }

  // Generate apple-touch-icon (180x180)
  await sharp(svgPath)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Generate favicon.png (32x32)
  await sharp(svgPath)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'favicon.png'));
  console.log('Generated favicon.png');

  // Generate 16x16 favicon
  await sharp(svgPath)
    .resize(16, 16, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'favicon-16x16.png'));
  console.log('Generated favicon-16x16.png');

  // Generate 32x32 favicon
  await sharp(svgPath)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'favicon-32x32.png'));
  console.log('Generated favicon-32x32.png');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
