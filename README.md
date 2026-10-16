# testcontainers-doctor

> Stop guessing why your Testcontainers tests fail. Get a diagnosis in seconds.

[![npm version](https://img.shields.io/npm/v/testcontainers-doctor?color=blue)](https://www.npmjs.com/package/testcontainers-doctor)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/Joaquinriosheredia/testcontainers-doctor/blob/master/LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

---

## The problem

Your Testcontainers tests fail locally but pass in CI — or the other way around. The error is cryptic. You end up checking Docker, Java, sockets, and config files by hand. You fix one thing and another breaks.

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
| **Network** | DNS resolution, Docker Hub connectivity, proxy detection, whether `hello-world` is cached locally (no image is pulled) |
| **Environment** | OS/WSL2 detection, CI platform, ulimits, docker group membership |

---

## Example output

Real output of `npx testcontainers-doctor@1.0.0 --no-color` (Linux, WSL2, Docker 29; the home directory is replaced by `/home/<user>` and one stray ANSI code in the Maven line is removed):

```

  testcontainers-doctor v1.0.0
  Diagnosing your Testcontainers environment...

  Docker
  ──────────────────────────────────────────────────
    ✔  Docker daemon                 Running (server version 29.1.3)
    ✔  Docker socket                 /var/run/docker.sock found (mode 0660)
    ⚠  Storage driver                overlayfs — consider switching to overlay2
    ✔  Docker client version         29.1.3
    ✔  Available memory              11.1 GB free of 15.6 GB total
    ℹ  Ryuk reaper                   Not running (starts automatically with first test)

  Java & Build Tools
  ──────────────────────────────────────────────────
    ✔  Java version                  openjdk version "21.0.12.1" 2026-08-18 (major: 21)
    ✔  JAVA_HOME                     /usr/lib/jvm/java-21-openjdk-amd64
    ✔  Maven                         Apache Maven 3.8.7
    ℹ  Gradle                        Not found (only needed for Gradle projects)

  Testcontainers Config
  ──────────────────────────────────────────────────
    ✔  .testcontainers.properties    Found at /home/<user>/.testcontainers.properties
    ✔  ryuk.disabled                 Not set — Ryuk enabled (default)
    ℹ  Container reuse               Disabled (default) — add testcontainers.reuse.enable=true to speed up local development
    ✔  Docker client strategy        org.testcontainers.dockerclient.UnixSocketClientProviderStrategy
    ℹ  Image registry prefix         Not set — pulling from Docker Hub directly
    ℹ  TESTCONTAINERS_* env vars     None set
    ℹ  DOCKER_HOST                   Not set — using default socket

  Network
  ──────────────────────────────────────────────────
    ✔  DNS: registry-1.docker.io     Resolves to 3.213.98.10
    ✔  Docker Hub connectivity       registry-1.docker.io responded HTTP 401
    ✔  Proxy                         None detected
    ✔  Docker image pull             hello-world:latest already cached locally

  Environment
  ──────────────────────────────────────────────────
    ✔  Platform                      linux x64 (WSL2) — kernel 6.6.87.2-microsoft-standard-WSL2
    ✔  WSL Docker socket             /var/run/docker.sock present — Docker Desktop WSL integration active
    ✔  Node.js                       v22.22.1
    ℹ  CI environment                Not detected (local development)
    ℹ  DOCKER_BUILDKIT               Not set (BuildKit enabled by default in Docker 23+)
    ✔  Open files ulimit             1048576
    ✔  Docker group membership       Current user is in docker group

  ────────────────────────────────────────────────────────
  19 passed  ·  1 warnings  ·  0 failed  ·  8 info
  ────────────────────────────────────────────────────────

  Environment OK with warnings — review fixes above.
```

---

## CLI options

```
Usage: testcontainers-doctor [options]

Diagnose your Testcontainers environment and get actionable fixes

Options:
  -V, --version   output the version number
  --json          Output results as JSON
  --check <name>  Run only one category: docker | java | config | network | env
  --no-color      Disable colored output
  -h, --help      display help for command
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
  "timestamp": "2026-10-16T09:00:00.000Z",
  "summary": { "ok": 19, "warn": 1, "fail": 0, "info": 8 },
  "sections": {
    "docker": [
      { "name": "Docker daemon", "status": "ok", "message": "Running (server version 29.1.3)" }
    ]
  },
  "healthy": true
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
Add your user to the `docker` group, then log out and back in (or run `newgrp docker`):
```bash
sudo usermod -aG docker $USER
newgrp docker
```

> **Do not use `chmod 666 /var/run/docker.sock`.** Anyone who can write to the Docker socket can
> start a privileged container and mount the host's filesystem: making it world-writable gives
> **root-equivalent access to every user and process on the machine**. Membership of the `docker`
> group grants the same power, but only to the users you add. For stronger isolation, use
> [rootless Docker](https://docs.docker.com/engine/security/rootless/).

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
Ryuk (which removes containers after the tests) is enabled by default. If containers are left
behind, check that nothing disables it: remove `ryuk.disabled=true` from
`~/.testcontainers.properties` and unset `TESTCONTAINERS_RYUK_DISABLED`.

---

## Requirements

- Node.js 18+
- Docker installed (for Docker checks)
- Java installed (for Java checks — optional)

---

## License

MIT
