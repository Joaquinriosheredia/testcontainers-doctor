import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import os from 'os';
import process from 'process';

function exec(cmd, timeoutMs = 5000) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs }).trim();
  } catch {
    return null;
  }
}

function detectCI() {
  const ciVars = {
    GITHUB_ACTIONS: 'GitHub Actions',
    GITLAB_CI: 'GitLab CI',
    JENKINS_URL: 'Jenkins',
    CIRCLECI: 'CircleCI',
    TRAVIS: 'Travis CI',
    BUILDKITE: 'Buildkite',
    TEAMCITY_VERSION: 'TeamCity',
    AZURE_HTTP_USER_AGENT: 'Azure Pipelines',
    CI: 'Generic CI',
  };
  for (const [envVar, name] of Object.entries(ciVars)) {
    if (process.env[envVar]) return name;
  }
  return null;
}

function detectWSL() {
  try {
    const release = readFileSync('/proc/version', 'utf8');
    return release.toLowerCase().includes('microsoft') || release.toLowerCase().includes('wsl');
  } catch {
    return false;
  }
}

export async function checkEnvironment() {
  const results = [];

  // 1. OS / Platform
  const platform = os.platform();
  const arch = os.arch();
  const isWSL = detectWSL();
  const kernelRelease = exec('uname -r') || os.release();
  results.push({
    name: 'Platform',
    status: 'ok',
    message: `${platform} ${arch}${isWSL ? ' (WSL2)' : ''} — kernel ${kernelRelease}`,
  });

  // 2. WSL-specific: Docker socket path
  if (isWSL) {
    const socketOk = existsSync('/var/run/docker.sock');
    results.push({
      name: 'WSL Docker socket',
      status: socketOk ? 'ok' : 'warn',
      message: socketOk
        ? '/var/run/docker.sock present — Docker Desktop WSL integration active'
        : '/var/run/docker.sock missing — enable Docker Desktop > Settings > WSL Integration',
      fix: socketOk ? undefined : 'Docker Desktop → Settings → Resources → WSL Integration → enable your distro',
    });
  }

  // 3. Node.js version
  const nodeVer = process.version;
  const major = parseInt(nodeVer.slice(1), 10);
  results.push({
    name: 'Node.js',
    status: major >= 18 ? 'ok' : 'warn',
    message: nodeVer + (major < 18 ? ' — Node 18+ recommended' : ''),
  });

  // 4. CI detection
  const ci = detectCI();
  if (ci) {
    results.push({
      name: 'CI environment',
      status: 'ok',
      message: `${ci} detected`,
    });
    // In CI: check if DOCKER_TLS_VERIFY or similar are set
    if (process.env.GITHUB_ACTIONS) {
      results.push({
        name: 'GitHub Actions note',
        status: 'info',
        message: 'Use services: or docker/setup-buildx-action for faster image pulls',
      });
    }
  } else {
    results.push({ name: 'CI environment', status: 'info', message: 'Not detected (local development)' });
  }

  // 5. DOCKER_BUILDKIT
  const buildkit = process.env.DOCKER_BUILDKIT;
  results.push({
    name: 'DOCKER_BUILDKIT',
    status: 'info',
    message: buildkit ? `Set to ${buildkit}` : 'Not set (BuildKit enabled by default in Docker 23+)',
  });

  // 6. Ulimits (open files) — relevant for heavy parallel container tests
  const ulimit = exec('ulimit -n');
  if (ulimit) {
    const limit = parseInt(ulimit, 10);
    results.push({
      name: 'Open files ulimit',
      status: limit < 1024 ? 'warn' : 'ok',
      message: `${ulimit}${limit < 1024 ? ' — low, may cause issues with many containers' : ''}`,
      fix: limit < 1024 ? 'ulimit -n 65536  or set in /etc/security/limits.conf' : undefined,
    });
  }

  // 7. Docker group membership
  const groups = exec('groups');
  if (groups) {
    const inDockerGroup = groups.split(' ').includes('docker');
    results.push({
      name: 'Docker group membership',
      status: inDockerGroup ? 'ok' : 'warn',
      message: inDockerGroup
        ? 'Current user is in docker group'
        : 'Not in docker group — may need sudo for Docker commands',
      fix: inDockerGroup ? undefined : 'sudo usermod -aG docker $USER  (then log out and back in)',
    });
  }

  return results;
}
