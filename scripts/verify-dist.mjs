import assert from 'node:assert/strict';

const root = await import('../dist/index.js');
const core = await import('../dist/core.js');
const openapi = await import('../dist/openapi.js');

assert.equal(
  root.createFetcher,
  core.createFetcher,
  'dist root and core createFetcher exports must share identity',
);
assert.equal(
  root.createFetcher,
  openapi.createFetcher,
  'dist root and openapi createFetcher exports must share identity',
);

const seenRequests = [];

const api = root.createFetcher({
  prefixUrl: 'https://example.com/api',
  fetch: async (input) => {
    const request = input instanceof Request ? input : new Request(input);

    seenRequests.push({
      url: request.url,
      method: request.method,
    });

    return new Response(JSON.stringify({ id: '42', role: 'member' }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
  },
});

const payload = await api
  .get('/users/{id}', {
    params: {
      path: { id: '42' },
    },
  })
  .json();

assert.deepEqual(payload, { id: '42', role: 'member' });
assert.equal(seenRequests[0]?.url, 'https://example.com/api/users/42');
assert.equal(seenRequests[0]?.method, 'GET');
