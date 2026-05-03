import { execSync } from 'child_process';

function exec(cmd, timeoutMs = 8000) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
    }).trim();
    return { ok: true, output };
  } catch (e) {
    // java -version writes to stderr
    const output = (e.stderr || e.stdout || e.message || '').trim();
    return { ok: false, output };
  }
}

function parseJavaVersion(raw) {
  // Handles: openjdk version "17.0.9" and java version "1.8.0_391"
  const m = raw.match(/"(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  const major = parseInt(m[1], 10);
  // Java 8 reports as 1.8, modern as 17, 21, etc.
  return major === 1 ? parseInt(m[2] || '0', 10) : major;
}

export async function checkJava() {
  const results = [];

  // 1. Java version (writes to stderr)
  const javaRaw = exec('java -version 2>&1');
  if (javaRaw.output) {
    const version = parseJavaVersion(javaRaw.output);
    const firstLine = javaRaw.output.split('\n')[0];
    if (version !== null) {
      const ok = version >= 8;
      const warn = version < 11;
      results.push({
        name: 'Java version',
        status: ok ? (warn ? 'warn' : 'ok') : 'fail',
        message: `${firstLine} (major: ${version})${warn ? ' — Java 11+ recommended' : ''}`,
        fix: !ok ? 'Install Java 11+: sudo apt install openjdk-17-jdk' : undefined,
      });
    } else {
      results.push({ name: 'Java version', status: 'warn', message: `Detected but version unclear: ${firstLine}` });
    }
  } else {
    results.push({
      name: 'Java version',
      status: 'fail',
      message: 'java not found in PATH',
      fix: 'Install Java: sudo apt install openjdk-17-jdk  or set JAVA_HOME',
    });
  }

  // 2. JAVA_HOME
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    results.push({ name: 'JAVA_HOME', status: 'ok', message: javaHome });
  } else {
    results.push({
      name: 'JAVA_HOME',
      status: 'warn',
      message: 'Not set (some tools require it)',
      fix: 'export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))',
    });
  }

  // 3. Maven
  const mvn = exec('mvn --version 2>&1');
  if (mvn.ok || mvn.output.toLowerCase().includes('apache maven')) {
    const firstLine = mvn.output.split('\n')[0];
    results.push({ name: 'Maven', status: 'ok', message: firstLine });
  } else {
    results.push({
      name: 'Maven',
      status: 'warn',
      message: 'Not found (required for Maven projects)',
      fix: 'sudo apt install maven  or use Maven wrapper (./mvnw)',
    });
  }

  // 4. Gradle
  const gradle = exec('gradle --version 2>&1');
  const gradleFound = gradle.ok && gradle.output && !gradle.output.includes('not found') && !gradle.output.includes('No such');
  if (gradleFound) {
    const versionLine = gradle.output.split('\n').find(l => l.startsWith('Gradle')) || gradle.output.split('\n')[0];
    results.push({ name: 'Gradle', status: 'ok', message: versionLine.trim() });
  } else {
    results.push({
      name: 'Gradle',
      status: 'info',
      message: 'Not found (only needed for Gradle projects)',
    });
  }

  return results;
}
