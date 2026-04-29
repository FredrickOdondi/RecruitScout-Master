#!/usr/bin/env node

/**
 * Simple script to generate placeholder icon files
 * In production, you would use real PNG icons
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [16, 32, 48, 128];
const publicDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate placeholder files
sizes.forEach(size => {
  const filename = `icon-${size}.png`;
  const filepath = path.join(publicDir, filename);

  // Create a minimal PNG file (1x1 transparent PNG)
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk start
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // Width and height (1x1)
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // Bit depth, color type, etc.
    0x89, // CRC
    0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, // IDAT chunk start
    0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // Compressed data
    0x0D, 0x0A, 0x2D, 0xB4, // CRC
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
    0xAE, 0x42, 0x60, 0x82 // CRC
  ]);

  fs.writeFileSync(filepath, minimalPNG);
  console.log(`Generated ${filename}`);
});

console.log('\nPlaceholder icons generated successfully!');
console.log('Note: These are minimal 1x1 transparent PNG files.');
console.log('For production, replace them with actual icon images.');
