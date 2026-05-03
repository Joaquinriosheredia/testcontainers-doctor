import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { checkDocker } from './checks/docker.js';
import { checkJava } from './checks/java.js';
import { checkConfig } from './checks/config.js';
import { checkNetwork } from './checks/network.js';
import { checkEnvironment } from './checks/environment.js';
import {
  printHeader,
  printSection,
  printResult,
  printSummary,
  printJSON,
} from './reporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const ALL_CHECKS = [
  { id: 'docker',  label: 'Docker',              fn: checkDocker },
  { id: 'java',    label: 'Java & Build Tools',  fn: checkJava },
  { id: 'config',  label: 'Testcontainers Config', fn: checkConfig },
  { id: 'network', label: 'Network',             fn: checkNetwork },
  { id: 'env',     label: 'Environment',         fn: checkEnvironment },
];

export async function runDoctor(opts = {}) {
  const only = opts.check ? opts.check.toLowerCase() : null;
  const checks = only
    ? ALL_CHECKS.filter(c => c.id === only)
    : ALL_CHECKS;

  if (only && checks.length === 0) {
    console.error(`Unknown check: "${only}". Valid: ${ALL_CHECKS.map(c => c.id).join(', ')}`);
    return 1;
  }

  const sections = {};
  const allResults = [];

  if (!opts.json) {
    printHeader(pkg.version);
  }

  for (const check of checks) {
    let results;
    try {
      results = await check.fn();
    } catch (e) {
      results = [{ name: check.label, status: 'fail', message: `Unexpected error: ${e.message}` }];
    }
    sections[check.id] = results;
    allResults.push(...results);

    if (!opts.json) {
      printSection(check.label);
      for (const r of results) printResult(r);
      console.log('');
    }
  }

  if (opts.json) {
    printJSON(sections);
  } else {
    printSummary(allResults);
  }

  const hasFail = allResults.some(r => r.status === 'fail');
  return hasFail ? 1 : 0;
}
