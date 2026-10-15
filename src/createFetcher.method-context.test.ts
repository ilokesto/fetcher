import ky, { type Input, type Options } from 'ky';
import { describe, expect, it } from 'vitest';
import { createFetcher } from './openapi';

describe('createFetcher method metadata', () => {
  const cases: Array<{
    name: string;
    input: () => Input;
    options?: Options;
    expected: string;
  }> = [
    { name: 'instance default', input: () => 'https://example.com', expected: 'POST' },
    {
      name: 'explicit override',
      input: () => 'https://example.com',
      options: { method: 'PATCH' },
      expected: 'PATCH',
    },
    {
      name: 'cleared default',
      input: () => 'https://example.com',
      options: { method: undefined },
      expected: 'GET',
    },
    {
      name: 'Request overridden by instance default',
      input: () => new Request('https://example.com', { method: 'PUT' }),
      expected: 'POST',
    },
    {
      name: 'Request fallback after clearing default',
      input: () => new Request('https://example.com', { method: 'PUT' }),
      options: { method: undefined },
      expected: 'PUT',
    },
  ];

  describe.each(['callable', 'safe'] as const)('%s', (surface) => {
    it.each(cases)('matches the actual method for $name', async ({ input, options, expected }) => {
      const seen: Array<{ method: string; metadata: unknown }> = [];
      const api = createFetcher(ky.create({
        method: 'POST',
        hooks: {
          beforeRequest: [
            (request, normalized) => {
              seen.push({ method: request.method, metadata: normalized.context.openapi });
            },
          ],
        },
        fetch: async () => Response.json({ ok: true }),
      }));

      const target = input();
      if (typeof target === 'string') {
        await (surface === 'safe' ? api.safe(target, options) : api(target, options));
      } else {
        await (surface === 'safe' ? api.safe(target, options) : api(target, options));
      }

      expect(seen).toHaveLength(1);
      expect(seen[0]?.method).toBe(expected);
      expect(seen[0]?.metadata).toMatchObject({ method: expected.toLowerCase() });
    });
  });

  it.each(['fetcher', 'ky'] as const)('reads parent defaults mutated through %s.extend', async (source) => {
    const seen: Array<{ method: string; metadata: unknown }> = [];
    const instance = ky.create({
      method: 'POST',
      hooks: {
        beforeRequest: [
          (request, options) => {
            seen.push({ method: request.method, metadata: options.context.openapi });
          },
        ],
      },
      fetch: async () => Response.json({ ok: true }),
    });
    const api = createFetcher(instance);
    const updateDefaults = (defaults: Options) => {
      defaults.method = 'PUT';
      return {};
    };
    if (source === 'ky') {
      instance.extend(updateDefaults);
    } else {
      api.extend(updateDefaults);
    }

    await api('https://example.com');
    await api.safe('https://example.com');

    expect(seen).toEqual([
      { method: 'PUT', metadata: { method: 'put', pathTemplate: 'https://example.com' } },
      { method: 'PUT', metadata: { method: 'put', pathTemplate: 'https://example.com' } },
    ]);
  });

  it('tracks create and extend defaults without changing the parent or shortcuts', async () => {
    const seen: Array<{ method: string; metadata: unknown }> = [];
    const defaults: Options = {
      method: 'POST',
      hooks: {
        beforeRequest: [
          (request, options) => {
            seen.push({ method: request.method, metadata: options.context.openapi });
          },
        ],
      },
      fetch: async () => Response.json({ ok: true }),
    };
    const api = createFetcher(defaults);
    const extended = api.extend((options) => ({ method: options.method === 'POST' ? 'PUT' : 'DELETE' }));
    const cleared = extended.extend({ method: undefined });
    const created = api.create({ ...defaults, method: 'PATCH' });

    await api('https://example.com');
    await extended.safe('https://example.com');
    await cleared('https://example.com');
    await created.safe('https://example.com');
    await extended.get('https://example.com', {});

    expect(seen.map(({ method }) => method)).toEqual(['POST', 'PUT', 'GET', 'PATCH', 'GET']);
    expect(seen.map(({ metadata }) => metadata)).toEqual(
      ['post', 'put', 'get', 'patch', 'get'].map((method) => ({
        method,
        pathTemplate: 'https://example.com',
      })),
    );
  });
});
