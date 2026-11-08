import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const axeSource = path.join(rootDir, 'node_modules', 'axe-core', 'axe.min.js');
const licenseSource = path.join(rootDir, 'node_modules', 'axe-core', 'LICENSE');
const targetDir = path.join(rootDir, 'public', 'vendor');
const axeTarget = path.join(targetDir, 'axe.min.js');
const licenseTarget = path.join(targetDir, 'axe-core.LICENSE.txt');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (fs.existsSync(axeSource)) {
  fs.copyFileSync(axeSource, axeTarget);
  console.log('✓ Successfully synchronized public/vendor/axe.min.js');
} else {
  console.warn('⚠ node_modules/axe-core/axe.min.js not found. Run pnpm install first.');
}

if (fs.existsSync(licenseSource)) {
  fs.copyFileSync(licenseSource, licenseTarget);
  console.log('✓ Successfully synchronized public/vendor/axe-core.LICENSE.txt');
}
