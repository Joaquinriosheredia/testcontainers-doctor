import { execSync } from 'child_process';
import { existsSync, statSync, accessSync, constants } from 'fs';
import os from 'os';

function exec(cmd, timeoutMs = 10000) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
    }).trim();
    return { ok: true, output };
  } catch (e) {
    return { ok: false, output: (e.stderr || e.message || '').trim() };
  }
}

export async function checkDocker() {
  const results = [];

  // 1. Docker daemon
  const info = exec('docker info --format "{{.ServerVersion}}"');
  if (info.ok && info.output) {
    results.push({
      name: 'Docker daemon',
      status: 'ok',
      message: `Running (server version ${info.output})`,
    });
  } else {
    results.push({
      name: 'Docker daemon',
      status: 'fail',
      message: 'Not running or not accessible',
      fix: 'Start Docker: sudo systemctl start docker  (or start Docker Desktop)',
    });
  }

  // 2. Docker socket
  const socketPath =
    (process.env.DOCKER_HOST || '').replace(/^unix:\/\//, '') ||
    '/var/run/docker.sock';

  if (existsSync(socketPath)) {
    let readable = false;
    try {
      accessSync(socketPath, constants.R_OK | constants.W_OK);
      readable = true;
    } catch {}
    const stat = statSync(socketPath);
    const mode = '0' + (stat.mode & 0o777).toString(8);
    results.push({
      name: 'Docker socket',
      status: readable ? 'ok' : 'warn',
      message: `${socketPath} found (mode ${mode})${readable ? '' : ' — not writable by current user'}`,
      fix: readable ? undefined : `sudo chmod 666 ${socketPath}  or add user to docker group`,
    });
  } else {
    results.push({
      name: 'Docker socket',
      status: 'fail',
      message: `${socketPath} not found`,
      fix: 'Check DOCKER_HOST env var or start the Docker daemon',
    });
  }

  // 3. Storage driver
  const driver = exec('docker info --format "{{.Driver}}"');
  if (driver.ok && driver.output) {
    const recommended = ['overlay2', 'btrfs', 'zfs', 'fuse-overlayfs'];
    const ok = recommended.includes(driver.output);
    results.push({
      name: 'Storage driver',
      status: ok ? 'ok' : 'warn',
      message: driver.output + (ok ? '' : ' — consider switching to overlay2'),
    });
  }

  // 4. Docker client version
  const clientVer = exec('docker version --format "{{.Client.Version}}"');
  if (clientVer.ok && clientVer.output) {
    const parts = clientVer.output.split('.');
    const major = parseInt(parts[0], 10);
    results.push({
      name: 'Docker client version',
      status: major >= 20 ? 'ok' : 'warn',
      message: clientVer.output + (major < 20 ? ' — upgrade recommended (≥ 20.x)' : ''),
    });
  }

  // 5. Available memory
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const freeGB = (freeMem / 1073741824).toFixed(1);
  const totalGB = (totalMem / 1073741824).toFixed(1);
  const lowMem = freeMem < 512 * 1024 * 1024;
  results.push({
    name: 'Available memory',
    status: lowMem ? 'warn' : 'ok',
    message: `${freeGB} GB free of ${totalGB} GB total`,
    fix: lowMem ? 'Close other processes or increase container memory limits' : undefined,
  });

  // 6. Ryuk container (optional, only if daemon is up)
  if (info.ok) {
    const ryuk = exec('docker ps --filter "name=testcontainers-ryuk" --format "{{.Names}}"');
    if (ryuk.ok && ryuk.output.includes('ryuk')) {
      results.push({ name: 'Ryuk reaper', status: 'ok', message: 'Running' });
    } else {
      results.push({ name: 'Ryuk reaper', status: 'info', message: 'Not running (starts automatically with first test)' });
    }
  }

  return results;
}
