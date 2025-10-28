/**
 * Simple script to generate placeholder PNG icons for the extension
 * This creates solid color squares as temporary icons for testing
 *
 * For production, use the GENERATE_ICONS.md instructions to create proper icons
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG file header and data for a solid blue square
// This is a base64-encoded 1x1 blue pixel PNG that we'll use as a placeholder
const BLUE_PIXEL_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

console.log('Generating placeholder icons...');
console.log('Note: These are minimal placeholders. See GENERATE_ICONS.md for creating proper icons.\n');

// Create a simple blue square SVG for each size and save as PNG placeholder
sizes.forEach(size => {
  const fileName = `icon${size}.png`;
  const filePath = path.join(iconsDir, fileName);

  // For now, just copy the same 1x1 pixel
  // In a real scenario, you'd use a proper image library or canvas
  const buffer = Buffer.from(BLUE_PIXEL_BASE64, 'base64');

  fs.writeFileSync(filePath, buffer);
  console.log(`Created: ${fileName} (placeholder)`);
});

console.log('\nPlaceholder icons created successfully!');
console.log('To create proper icons, see: extension/icons/GENERATE_ICONS.md');
