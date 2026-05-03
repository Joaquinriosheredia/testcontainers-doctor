#!/usr/bin/env node
/**
 * github-search.js — Busca proyectos open source donde contribuir
 * Uso: node ~/github-search.js "kafka java"
 *      node ~/github-search.js "spring-boot"
 *      GITHUB_TOKEN=ghp_xxx node ~/github-search.js "testcontainers kotlin"
 *
 * Sin token: 60 req/hora  |  Con GITHUB_TOKEN: 5 000 req/hora
 */

const LANGUAGES = new Set([
  'java', 'kotlin', 'python', 'javascript', 'typescript',
  'go', 'rust', 'cpp', 'c', 'ruby', 'scala', 'clojure',
]);

const TOKEN   = process.env.GITHUB_TOKEN || '';
const HEADERS = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'github-search-cli/1.0',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
};

async function ghFetch(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (res.status === 403) {
    const reset = res.headers.get('X-RateLimit-Reset');
    const when  = reset ? new Date(reset * 1000).toLocaleTimeString() : '?';
    throw new Error(`Rate limit alcanzado. Se restablece a las ${when}. Exporta GITHUB_TOKEN para 5 000 req/hora.`);
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

function buildQuery(tema) {
  const terms    = tema.trim().split(/\s+/).filter(Boolean);
  const langTerm = terms.find(t => LANGUAGES.has(t.toLowerCase()));
  const keywords = terms.filter(t => t.toLowerCase() !== langTerm?.toLowerCase());

  let q = `label:"good first issue" state:open`;
  if (keywords.length) q += ` ${keywords.join(' ')}`;
  if (langTerm)        q += ` language:${langTerm.toLowerCase()}`;

  return q;
}

async function fetchRepoStars(repoUrl, cache) {
  if (cache.has(repoUrl)) return cache.get(repoUrl);
  try {
    const repo = await ghFetch(repoUrl);
    const data = { stars: repo.stargazers_count, fullName: repo.full_name };
    cache.set(repoUrl, data);
    return data;
  } catch {
    const fallback = { stars: null, fullName: repoUrl.replace('https://api.github.com/repos/', '') };
    cache.set(repoUrl, fallback);
    return fallback;
  }
}

function fmt(isoDate) {
  return isoDate.slice(0, 10);
}

function stars(n) {
  if (n === null) return '?';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

async function search(tema) {
  const q   = buildQuery(tema);
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=10`;

  console.log(`\n🔍 Query: ${q}`);
  if (!TOKEN) console.log('   ℹ️  Sin GITHUB_TOKEN — límite 60 req/hora');
  console.log('');

  const data   = await ghFetch(url);
  const issues = data.items || [];

  if (issues.length === 0) {
    console.log('Sin resultados. Prueba con otros términos (ej: "spring java", "kafka kotlin").');
    return;
  }

  // Fetch stars de repos únicos (hasta 10 llamadas extra, deduplica repos)
  const repoCache = new Map();
  await Promise.all(
    [...new Set(issues.map(i => i.repository_url))].map(u => fetchRepoStars(u, repoCache))
  );

  const pad = Math.max(...issues.map(i => {
    const r = repoCache.get(i.repository_url);
    return (r?.fullName || '').length;
  }));

  console.log(`📋 ${issues.length} good-first-issues encontrados:\n`);
  console.log(`${'Repo'.padEnd(pad)}  Stars   Fecha       Título`);
  console.log(`${'─'.repeat(pad)}  ──────  ──────────  ${'─'.repeat(50)}`);

  for (const issue of issues) {
    const repo  = repoCache.get(issue.repository_url);
    const title = issue.title.length > 60 ? issue.title.slice(0, 57) + '…' : issue.title;
    console.log(
      `${(repo?.fullName || '?').padEnd(pad)}  ${stars(repo?.stars).padStart(6)}  ${fmt(issue.created_at)}  ${title}`
    );
    console.log(`${''.padEnd(pad)}          🔗 ${issue.html_url}`);
  }

  console.log(`\n💡 Tip: node ~/github-search.js "spring java"  |  GITHUB_TOKEN=... para más rate`);
}

const tema = process.argv[2];
if (!tema) {
  console.error('Uso: node ~/github-search.js "<tema>"');
  console.error('Ej:  node ~/github-search.js "kafka java"');
  process.exit(1);
}

search(tema).catch(e => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
