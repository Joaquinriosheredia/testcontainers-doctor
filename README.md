# testcontainers-doctor

> Stop guessing why your Testcontainers tests fail. Get a diagnosis in seconds.

[![npm version](https://img.shields.io/npm/v/testcontainers-doctor?color=blue)](https://www.npmjs.com/package/testcontainers-doctor)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

---

## The problem

Your Testcontainers tests fail locally but pass in CI — or the other way around. The error is cryptic. You spend 30 minutes checking Docker, Java, sockets, and config files. You fix one thing and another breaks.

**testcontainers-doctor** runs all those checks in a few seconds and tells you exactly what is wrong and how to fix it.

---

## Quick start

```bash
# No install needed
npx testcontainers-doctor

# Or install globally
npm install -g testcontainers-doctor
testcontainers-doctor
```

---

## What it checks

| Category | Checks |
|---|---|
| **Docker** | Daemon running, socket permissions, storage driver, client version, available memory |
| **Java** | Version compatibility, JAVA_HOME, Maven, Gradle |
| **Config** | `.testcontainers.properties`, Ryuk settings, container reuse, registry prefix, env vars |
| **Network** | DNS resolution, Docker Hub connectivity, proxy detection, manifest pull |
| **Environment** | OS/WSL2 detection, CI platform, ulimits, docker group membership |

---

## Example output

```
  testcontainers-doctor v1.0.0
  Diagnosing your Testcontainers environment...

  Docker
  ──────────────────────────────────────────────────
    ✔  Docker daemon              Running (server version 24.0.5)
    ✔  Docker socket              /var/run/docker.sock found (mode 0666)
    ✔  Storage driver             overlay2
    ✔  Docker client version      24.0.5
    ✔  Available memory           4.2 GB free of 15.9 GB total
    ℹ  Ryuk reaper                Not running (starts automatically with first test)

  Java & Build Tools
  ──────────────────────────────────────────────────
    ✔  Java version               openjdk version "17.0.9" (major: 17)
    ⚠  JAVA_HOME                  Not set
       → Fix: export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
    ✔  Maven                      Apache Maven 3.9.5
    ℹ  Gradle                     Not found (only needed for Gradle projects)

  Testcontainers Config
  ──────────────────────────────────────────────────
    ✔  .testcontainers.properties Found at ~/.testcontainers.properties
    ✔  ryuk.disabled              Not set — Ryuk enabled (default)
    ℹ  Container reuse            Disabled — add testcontainers.reuse.enable=true to speed up local dev
    ℹ  Image registry prefix      Not set — pulling from Docker Hub directly
    ℹ  TESTCONTAINERS_* env vars  None set
    ℹ  DOCKER_HOST                Not set — using default socket

  ────────────────────────────────────────────────────────
  14 passed  ·  1 warnings  ·  0 failed  ·  5 info
  ────────────────────────────────────────────────────────

  Environment OK with warnings — review fixes above.
```

---

## CLI options

```
Usage: testcontainers-doctor [options]

Options:
  -V, --version         show version
  --json                output results as JSON (for CI parsing)
  --check <name>        run only one category: docker | java | config | network | env
  --no-color            disable colored output
  -h, --help            display help
```

---

## CI integration

Add to your pipeline to gate tests on environment health:

```yaml
# GitHub Actions example
- name: Verify Testcontainers environment
  run: npx testcontainers-doctor --json | tee tc-doctor.json
```

The tool exits with code `1` if any check fails, `0` if all pass (warnings are non-blocking).

---

## Run a single category

```bash
testcontainers-doctor --check docker
testcontainers-doctor --check java
testcontainers-doctor --check config
testcontainers-doctor --check network
testcontainers-doctor --check env
```

---

## JSON output

```bash
testcontainers-doctor --json
```

```json
{
  "timestamp": "2026-05-03T09:00:00.000Z",
  "healthy": true,
  "summary": { "ok": 14, "warn": 1, "fail": 0, "info": 5 },
  "sections": {
    "docker": [
      { "name": "Docker daemon", "status": "ok", "message": "Running (server version 24.0.5)" }
    ]
  }
}
```

---

## Common fixes

### Docker daemon not running
```bash
sudo systemctl start docker
# WSL2: start Docker Desktop and enable WSL integration
```

### Socket permission denied
```bash
sudo chmod 666 /var/run/docker.sock
# Permanent fix:
sudo usermod -aG docker $USER && newgrp docker
```

### Java not found
```bash
sudo apt install openjdk-17-jdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

### Container reuse (faster local dev)
```bash
echo "testcontainers.reuse.enable=true" >> ~/.testcontainers.properties
```

### Ryuk left-over containers in CI
```bash
echo "ryuk.disabled=false" >> ~/.testcontainers.properties
```

---

## Requirements

- Node.js 18+
- Docker installed (for Docker checks)
- Java installed (for Java checks — optional)

---

## License

MIT
