'use strict';

const fs = require('node:fs');
const path = require('node:path');

// The yt-dlp binary package is published without executable mode bits. Restore them at install time
// so the Linux serverless function can spawn the platform binary after it is bundled by Vercel.
const binaryPackages = [
  'yt-dlp-binary-linux-x64',
  'yt-dlp-binary-linux-arm64',
  'yt-dlp-binary-linux-musl-x64'
];

for (const packageName of binaryPackages) {
  const binaryPath = path.join(process.cwd(), 'node_modules', '@involvex', packageName, 'yt-dlp');
  if (!fs.existsSync(binaryPath)) continue;
  fs.chmodSync(binaryPath, 0o755);
  console.log(`[yt-dlp] executable permissions set for ${packageName}`);
}
