import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:8787';
let checks = 0;
for (const route of ['/', '/markets', '/news', '/watchlist']) {
  const response = await fetch(`${base}${route}`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<div id="root"><\/div>/);
  checks++;
}
for (const route of ['markets', 'global', 'news', 'chart?coin=bitcoin&days=7']) {
  const response = await fetch(`${base}/api/${route}`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, 'demo');
  assert.ok(body.fetchedAt);
  if (route === 'markets') assert.equal(body.data.length, 20);
  if (route === 'news') assert.equal(body.data.length, 8);
  checks++;
}
for (const route of [
  'chart?coin=bitcoin&days=2',
  'chart?coin=unknown&days=7',
  'markets?url=https://example.com',
  'unknown',
]) {
  assert.equal((await fetch(`${base}/api/${route}`)).status, 400);
  checks++;
}
assert.equal((await fetch(`${base}/api/markets`, { method: 'POST' })).status, 405);
checks++;
console.log(
  `${checks} HTTP checks passed at ${base}. This checks responses, not browser rendering.`,
);
