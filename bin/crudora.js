#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cliPath;
try {
  cliPath = new URL('../dist/cli.js', import.meta.url);
  await import(cliPath);
} catch (error) {
  try {
    cliPath = new URL('../src/cli.ts', import.meta.url);
    const tsNodePath = require.resolve('ts-node/register');
    require(tsNodePath);
    await import(cliPath);
  } catch (innerError) {
    console.error('Error loading CLI:', innerError);
    process.exit(1);
  }
}
