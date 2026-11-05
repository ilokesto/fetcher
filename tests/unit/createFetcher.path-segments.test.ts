import { describe, expect, it, vi } from 'vitest';
import { createFetcher } from '../../src/openapi';
import { interpolatePathTemplate } from '../../src/internal/runtime';

type Paths = {
  '/users/{id}': { get: {}; delete: {}; head: {} };
};

describe.each(['.', '..'])('createFetcher dot path parameter %j', (id) => {
  it.each(['callable', 'shortcut', 'head'] as const)(
    '%s: dot path segment -> throws before transport',
    (surface) => {
      const fetch = vi.fn(async () => Response.json({ ok: true }));
      const api = createFetcher<Paths>({ prefixUrl: 'https://example.com/api', fetch });
      const run = () => {
        if (surface === 'callable') {
          return api('/users/{id}', { method: 'DELETE', path: { id } });
        }
        if (surface === 'head') {
          return api.head('/users/{id}', { params: { path: { id } } });
        }
        return api.delete('/users/{id}', { params: { path: { id } } });
      };

      expect(run).toThrow(/dot path segment/);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each(['callable', 'shortcut'] as const)(
    'safe %s: dot path segment -> failure without transport',
    async (surface) => {
      const fetch = vi.fn(async () => Response.json({ ok: true }));
      const api = createFetcher<Paths>({ prefixUrl: 'https://example.com/api', fetch });

      const result = await (surface === 'callable'
        ? api.safe('/users/{id}', { method: 'DELETE', path: { id } })
        : api.safe.delete('/users/{id}', { params: { path: { id } } }));

      expect(result).toMatchObject({ ok: false, data: null, response: null });
      expect(result.error).toBeInstanceOf(Error);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe('path template segment boundaries', () => {
  it.each([
    ['/users/{id}', { id: '..' }],
    ['/users/{id}/details', { id: '.' }],
    ['/users/.{id}', { id: '.' }],
    ['/users/{id}%2e', { id: '.' }],
    ['/users/%2E{id}', { id: '.' }],
    ['/users/{left}{right}', { left: '.', right: '.' }],
    ['https://example.com/users/{id}?keep=true#section', { id: '..' }],
  ])('interpolation: %s creates a dot path segment -> rejects', (template, path) => {
    expect(() => interpolatePathTemplate(template, path)).toThrow(/dot path segment/);
  });

  it.each([
    ['/users/{id}.json', { id: '.' }, '/users/..json'],
    ['/users/id-{id}', { id: '..' }, '/users/id-..'],
    ['/users/{id}', { id: '...' }, '/users/...'],
    ['/users/{id}', { id: '%2e%2e' }, '/users/%252e%252e'],
    ['/users/{id}', { id: '../admin' }, '/users/..%2Fadmin'],
    ['/users/../{id}', { id: '42' }, '/users/../42'],
    ['/users?value={id}', { id: '..' }, '/users?value=..'],
    ['/users#{id}', { id: '.' }, '/users#.'],
    ['/users/..', undefined, '/users/..'],
  ])('interpolation: %s has no generated dot segment -> preserves URL', (template, path, expected) => {
    expect(interpolatePathTemplate(template, path)).toBe(expected);
  });

  it.each([
    ['a.b', 'a.b'],
    ['...', '...'],
    ['a/b', 'a%2Fb'],
    ['%2e%2e', '%252e%252e'],
    [0, '0'],
    [false, 'false'],
  ])('get: valid identifier %j -> preserves encoded request path', async (id, encoded) => {
    const seenUrls: string[] = [];
    const api = createFetcher<Paths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenUrls.push(request.url);
        return Response.json({ ok: true });
      },
    });

    await api.get('/users/{id}', { params: { path: { id } } });

    expect(seenUrls).toEqual([`https://example.com/api/users/${encoded}`]);
  });
});
