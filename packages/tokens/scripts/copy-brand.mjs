#!/usr/bin/env node
/**
 * Copies brand assets from this package into each web app's public/brand.
 * Run after replacing files in assets/ (or from the guia de estilos folder).
 */
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const targets = [
  join(root, '../../apps/web-establishment/public/brand'),
  join(root, '../../apps/web-admin/public/brand'),
];

for (const dest of targets) {
  mkdirSync(join(dest, 'png'), { recursive: true });
  cpSync(assets, dest, { recursive: true });
  console.log('synced brand →', dest);
}
