import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

function parseProperties(content) {
  const props = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    props[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return props;
}

export async function checkConfig() {
  const results = [];
  const propsPath = join(homedir(), '.testcontainers.properties');

  let props = {};
  if (existsSync(propsPath)) {
    try {
      const content = readFileSync(propsPath, 'utf8');
      props = parseProperties(content);
      results.push({ name: '.testcontainers.properties', status: 'ok', message: `Found at ${propsPath}` });
    } catch (e) {
      results.push({ name: '.testcontainers.properties', status: 'warn', message: `Found but unreadable: ${e.message}` });
    }
  } else {
    results.push({
      name: '.testcontainers.properties',
      status: 'info',
      message: 'Not found — defaults will be used',
    });
  }

  // ryuk.disabled
  const ryukDisabled = props['ryuk.disabled'];
  if (ryukDisabled === 'true') {
    results.push({
      name: 'ryuk.disabled',
      status: 'warn',
      message: 'true — containers will NOT be cleaned up automatically after tests',
      fix: 'Remove ryuk.disabled=true from .testcontainers.properties unless you have a specific reason',
    });
  } else {
    results.push({
      name: 'ryuk.disabled',
      status: 'ok',
      message: ryukDisabled === 'false' ? 'false (explicit)' : 'Not set — Ryuk enabled (default)',
    });
  }

  // testcontainers.reuse.enable
  const reuse = props['testcontainers.reuse.enable'];
  if (reuse === 'true') {
    results.push({
      name: 'Container reuse',
      status: 'ok',
      message: 'Enabled — containers are reused across test runs (faster CI)',
    });
  } else {
    results.push({
      name: 'Container reuse',
      status: 'info',
      message: 'Disabled (default) — add testcontainers.reuse.enable=true to speed up local development',
    });
  }

  // docker.client.strategy
  const strategy = props['docker.client.strategy'];
  if (strategy) {
    results.push({ name: 'Docker client strategy', status: 'ok', message: strategy });
  }

  // hub.image.name.prefix (private registry mirror)
  const prefix = props['hub.image.name.prefix'];
  if (prefix) {
    results.push({ name: 'Image registry prefix', status: 'ok', message: prefix });
  } else {
    results.push({ name: 'Image registry prefix', status: 'info', message: 'Not set — pulling from Docker Hub directly' });
  }

  // TESTCONTAINERS_* env vars
  const tcEnvVars = Object.entries(process.env)
    .filter(([k]) => k.startsWith('TESTCONTAINERS_') || k.startsWith('TC_'));
  if (tcEnvVars.length > 0) {
    for (const [k, v] of tcEnvVars) {
      results.push({ name: `env: ${k}`, status: 'ok', message: v });
    }
  } else {
    results.push({ name: 'TESTCONTAINERS_* env vars', status: 'info', message: 'None set' });
  }

  // DOCKER_HOST override
  const dockerHost = process.env.DOCKER_HOST;
  if (dockerHost) {
    results.push({ name: 'DOCKER_HOST', status: 'ok', message: dockerHost });
  } else {
    results.push({ name: 'DOCKER_HOST', status: 'info', message: 'Not set — using default socket' });
  }

  return results;
}
