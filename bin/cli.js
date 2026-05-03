#!/usr/bin/env node
import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runDoctor } from '../src/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

program
  .name('testcontainers-doctor')
  .description('Diagnose your Testcontainers environment and get actionable fixes')
  .version(pkg.version)
  .option('--json', 'Output results as JSON')
  .option('--check <name>', 'Run only one category: docker | java | config | network | env')
  .option('--no-color', 'Disable colored output')
  .parse();

const opts = program.opts();
process.exitCode = await runDoctor(opts);
