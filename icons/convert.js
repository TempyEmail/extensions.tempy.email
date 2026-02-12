#!/usr/bin/env node

// Simple SVG to PNG converter for extension icons
// Usage: node convert.js

const fs = require('fs');
const path = require('path');

console.log('To convert the logo.svg to PNG icons:');
console.log('');
console.log('Option 1: Use the HTML converter');
console.log('  Open convert-svg.html in your browser');
console.log('  Click the download buttons for each size');
console.log('');
console.log('Option 2: Use ImageMagick (if installed)');
console.log('  brew install imagemagick');
console.log('  convert logo.svg -resize 16x16 icon-16.png');
console.log('  convert logo.svg -resize 32x32 icon-32.png');
console.log('  convert logo.svg -resize 48x48 icon-48.png');
console.log('  convert logo.svg -resize 128x128 icon-128.png');
console.log('');
console.log('Option 3: Use sharp (Node.js)');
console.log('  npm install sharp');
console.log('  Then uncomment and run the code below');
console.log('');

// Uncomment this if you have sharp installed:
/*
const sharp = require('sharp');

const sizes = [16, 32, 48, 128];

async function convertIcons() {
  for (const size of sizes) {
    await sharp('logo.svg')
      .resize(size, size)
      .png()
      .toFile(`icon-${size}.png`);
    console.log(`✓ Created icon-${size}.png`);
  }
  console.log('Done!');
}

convertIcons().catch(console.error);
*/
