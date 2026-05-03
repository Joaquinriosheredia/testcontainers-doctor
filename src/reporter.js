import chalk from 'chalk';

const ICONS = {
  ok:   chalk.green('✔'),
  warn: chalk.yellow('⚠'),
  fail: chalk.red('✖'),
  info: chalk.cyan('ℹ'),
  skip: chalk.gray('–'),
};

const LABELS = {
  ok:   chalk.green('ok'),
  warn: chalk.yellow('warn'),
  fail: chalk.red('FAIL'),
  info: chalk.cyan('info'),
  skip: chalk.gray('skip'),
};

export function printHeader(version) {
  console.log('');
  console.log(chalk.bold.blue('  testcontainers-doctor') + chalk.gray(` v${version}`));
  console.log(chalk.gray('  Diagnosing your Testcontainers environment...\n'));
}

export function printSection(title) {
  console.log(chalk.bold.white(`  ${title}`));
  console.log(chalk.gray('  ' + '─'.repeat(50)));
}

export function printResult(result) {
  const icon = ICONS[result.status] || ICONS.info;
  const label = LABELS[result.status] || LABELS.info;
  const name = chalk.white(result.name.padEnd(28));
  const msg = result.message || '';

  console.log(`    ${icon}  ${name}  ${msg}`);

  if (result.fix) {
    console.log(`       ${chalk.gray('→ Fix:')} ${chalk.yellow(result.fix)}`);
  }
}

export function printSummary(allResults) {
  const counts = { ok: 0, warn: 0, fail: 0, info: 0, skip: 0 };
  for (const r of allResults) counts[r.status] = (counts[r.status] || 0) + 1;

  console.log('');
  console.log(chalk.gray('  ' + '─'.repeat(56)));

  const parts = [
    chalk.green(`${counts.ok} passed`),
    counts.warn > 0 ? chalk.yellow(`${counts.warn} warnings`) : chalk.gray('0 warnings'),
    counts.fail > 0 ? chalk.red(`${counts.fail} failed`) : chalk.gray('0 failed'),
    counts.info > 0 ? chalk.cyan(`${counts.info} info`) : null,
  ].filter(Boolean);

  console.log('  ' + parts.join('  ·  '));
  console.log(chalk.gray('  ' + '─'.repeat(56)));
  console.log('');

  if (counts.fail === 0 && counts.warn === 0) {
    console.log('  ' + chalk.bold.green('Your Testcontainers environment looks healthy!') + ' 🎉');
  } else if (counts.fail === 0) {
    console.log('  ' + chalk.bold.yellow('Environment OK with warnings — review fixes above.'));
  } else {
    console.log('  ' + chalk.bold.red(`${counts.fail} critical issue(s) found — fix before running tests.`));
  }
  console.log('');
}

export function printJSON(sections) {
  const output = {
    timestamp: new Date().toISOString(),
    summary: { ok: 0, warn: 0, fail: 0, info: 0 },
    sections: {},
  };
  for (const [name, results] of Object.entries(sections)) {
    output.sections[name] = results;
    for (const r of results) {
      output.summary[r.status] = (output.summary[r.status] || 0) + 1;
    }
  }
  output.healthy = output.summary.fail === 0;
  console.log(JSON.stringify(output, null, 2));
}
