import assert from 'node:assert/strict';

// Run the emitted deployment artifacts in native Node. Vitest/Vite's source
// resolver can hide .ts -> .js import errors, so this is part of every build.
process.env.DATA_MODE = 'demo';
const routes = [
  ['markets', ''],
  ['global', ''],
  ['news', ''],
  ['chart', '?coin=bitcoin&days=7'],
];
for (const [name, query] of routes) {
  const { GET } = await import(new URL(`../.server-build/api/${name}.js`, import.meta.url));
  const response = await GET(new Request(`https://cryptopulse.example/api/${name}${query}`));
  assert.equal(response.status, 200, `${name} must respond successfully`);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.equal(body.mode, 'demo');
  assert.ok(body.data);
}
console.log('4 compiled API entry points passed native Node checks.');
