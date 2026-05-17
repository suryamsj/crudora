#!/usr/bin/env node
import 'reflect-metadata';
import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _require = createRequire(import.meta.url);

const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('crudora')
  .description('Crudora CLI — tools for Crudora projects')
  .version(pkg.version ?? '0.0.0');

program
  .command('generate-schema')
  .description('Generate a Drizzle TypeScript schema file from registered Crudora models')
  .option('-e, --entry <file>', 'Entry file (JS/TS) that exports a CrudoraServer or Crudora instance', 'src/server.ts')
  .option('-o, --output <file>', 'Output path for the generated schema', 'src/db/schema.ts')
  .action(async (opts) => {
    const entryPath = resolve(process.cwd(), opts.entry);
    if (!existsSync(entryPath)) {
      console.error(`Error: entry file not found — ${entryPath}`);
      process.exit(1);
    }

    try {
      let mod: any;
      try {
        // ESM dynamic import — works for compiled .js / .mjs entry files
        mod = await import(pathToFileURL(entryPath).href);
      } catch {
        // Fallback: CJS require — for pre-compiled CommonJS output
        try {
          _require('ts-node/register');
        } catch {
          // ts-node not installed — entry must be pre-compiled JS
        }
        mod = _require(entryPath);
      }
      const instance = mod.default ?? mod.server ?? mod.crudora;

      if (!instance) {
        console.error(
          'Error: entry file must export a CrudoraServer or Crudora instance as default, "server", or "crudora".',
        );
        process.exit(1);
      }

      const crudora = typeof instance.getCrudora === 'function' ? instance.getCrudora() : instance;

      if (typeof crudora.generateDrizzleSchema !== 'function') {
        console.error('Error: could not find generateDrizzleSchema() on the exported instance.');
        process.exit(1);
      }

      const schema: string = crudora.generateDrizzleSchema();
      const outputPath = resolve(process.cwd(), opts.output);
      const cwd = process.cwd() + path.sep;
      if (!outputPath.startsWith(cwd)) {
        console.error('Error: output path must be within the project directory.');
        process.exit(1);
      }
      writeFileSync(outputPath, schema, 'utf-8');
      console.log(`Schema written to ${outputPath}`);
      console.log('Run: npx drizzle-kit push  — to apply the schema to your database.');
    } catch (err: any) {
      console.error('Error generating schema:', err.message);
      process.exit(1);
    }
  });

program.parse();
