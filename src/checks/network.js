import { execSync } from 'child_process';
import https from 'https';
import dns from 'dns/promises';

function exec(cmd, timeoutMs = 8000) {
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

function httpsGet(url, timeoutMs = 8000) {
  return new Promise(resolve => {
    const req = https.get(url, { timeout: timeoutMs }, res => {
      resolve({ ok: true, status: res.statusCode });
      res.destroy();
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

export async function checkNetwork() {
  const results = [];

  // 1. DNS resolution for Docker Hub
  try {
    const addresses = await dns.lookup('registry-1.docker.io');
    results.push({
      name: 'DNS: registry-1.docker.io',
      status: 'ok',
      message: `Resolves to ${addresses.address}`,
    });
  } catch (e) {
    results.push({
      name: 'DNS: registry-1.docker.io',
      status: 'fail',
      message: `Cannot resolve: ${e.message}`,
      fix: 'Check /etc/resolv.conf or set a public DNS like 8.8.8.8',
    });
  }

  // 2. Docker Hub HTTPS
  const hub = await httpsGet('https://registry-1.docker.io/v2/');
  if (hub.ok) {
    const okStatus = hub.status === 200 || hub.status === 401; // 401 = auth required = reachable
    results.push({
      name: 'Docker Hub connectivity',
      status: okStatus ? 'ok' : 'warn',
      message: `registry-1.docker.io responded HTTP ${hub.status}`,
    });
  } else {
    results.push({
      name: 'Docker Hub connectivity',
      status: 'fail',
      message: `Cannot reach Docker Hub: ${hub.error}`,
      fix: 'Check firewall rules or configure a registry mirror',
    });
  }

  // 3. Proxy detection
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;

  if (httpsProxy || httpProxy) {
    results.push({
      name: 'Proxy',
      status: 'warn',
      message: `Detected: ${httpsProxy || httpProxy}${noProxy ? `  (NO_PROXY: ${noProxy})` : ''}`,
      fix: 'Ensure proxy allows Docker registry access; set NO_PROXY=localhost,127.0.0.1 if needed',
    });
  } else {
    results.push({ name: 'Proxy', status: 'ok', message: 'None detected' });
  }

  // 4. Docker pull test — check if hello-world image exists locally or Hub is reachable
  const localImage = exec('docker image inspect hello-world:latest --format "{{.Id}}" 2>&1', 5000);
  if (localImage.ok && localImage.output && !localImage.output.includes('No such')) {
    results.push({ name: 'Docker image pull', status: 'ok', message: 'hello-world:latest already cached locally' });
  } else {
    // Try a lightweight check via Docker Hub API (already verified above via HTTPS)
    // Just report based on Hub connectivity result
    const hubReachable = hub.ok && (hub.status === 200 || hub.status === 401);
    results.push({
      name: 'Docker image pull',
      status: hubReachable ? 'ok' : 'warn',
      message: hubReachable
        ? 'Docker Hub reachable — images can be pulled'
        : 'Docker Hub unreachable — image pulls will fail',
      fix: hubReachable ? undefined : 'Check firewall or configure a registry mirror in /etc/docker/daemon.json',
    });
  }

  return results;
}
