import ky, { type Input, type KyInstance, type Options } from 'ky';
import { describe, expect, it } from 'vitest';
import { createFetcher } from './openapi';
import type { ApiPaths } from './test-fixtures/createFetcher';

describe('createFetcher prefixUrl behavior', () => {
  it('supports wrapping an existing ky instance with prefixUrl defaults', async () => {
    const seenUrls: string[] = [];

    const instance = ky.create({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenUrls.push(request.url);

        return new Response(JSON.stringify({ id: '42', role: 'member' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const api = createFetcher<ApiPaths>(instance);

    const payload = await api
      .get('/users/{id}', {
        params: {
          path: { id: '42' },
        },
      })
      .json();

    expect(payload).toEqual({ id: '42', role: 'member' });
    expect(seenUrls).toEqual(['https://example.com/api/users/42']);
  });

  it('preserves prefixUrl handling across extend callback forms', async () => {
    const seenUrls: string[] = [];
    const seenHeaders: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenUrls.push(request.url);
        seenHeaders.push(request.headers.get('x-prefix') ?? '');

        return new Response(JSON.stringify({ id: '42', role: 'member' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const extended = api.extend((defaults) => ({
      headers: {
        'x-prefix': String(defaults.prefixUrl),
      },
    }));

    await extended
      .get('/users/{id}', {
        params: {
          path: { id: '42' },
        },
      })
      .json();

    expect(seenUrls).toEqual(['https://example.com/api/users/42']);
    expect(seenHeaders).toEqual(['https://example.com/api']);
  });

  it('does not pretend prefixUrl still exists after extend clears it', async () => {
    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async () => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    }).extend({
      prefixUrl: undefined,
    });

    expect(() =>
      api.get('/users/{id}', {
        params: {
          path: { id: '42' },
        },
      }),
    ).toThrow(/Invalid URL|Failed to parse URL/);
  });

  it('retries leading-slash inputs with prefixUrl for direct callable usage', async () => {
    const seenUrls: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenUrls.push(request.url);

        return new Response(JSON.stringify({ id: '99', title: 'typed facade' }), {
          status: 201,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const payload = await api('/posts', {
      method: 'POST',
      json: {
        title: 'typed facade',
      },
    }).json();

    expect(payload).toEqual({ id: '99', title: 'typed facade' });
    expect(seenUrls).toEqual(['https://example.com/api/posts']);
  });

  it('preserves query strings, hashes, and encoded slashes when retrying prefixUrl leading slashes', async () => {
    const seenUrls: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenUrls.push(request.url);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    await api('/posts?draft=true#section').json();
    await api('/files/%2Froot').json();

    expect(seenUrls).toEqual([
      'https://example.com/api/posts?draft=true#section',
      'https://example.com/api/files/%2Froot',
    ]);
  });

  it('does not retry no-prefix invalid URL behavior', () => {
    const api = createFetcher<ApiPaths>();

    expect(() => api('/posts')).toThrow(/Invalid URL|Failed to parse URL/);
  });

  it('does not retry non-string URL or Request inputs with prefixUrl', async () => {
    const seenUrls: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenUrls.push(request.url);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    await api(new URL('https://outside.example/from-url')).json();
    await api(new Request('https://outside.example/from-request')).json();

    expect(seenUrls).toEqual([
      'https://outside.example/from-url',
      'https://outside.example/from-request',
    ]);
  });

  it('does not retry unrelated synchronous errors and rethrows the same error', () => {
    const thrownError = new Error('runner failure');
    const seenInputs: Input[] = [];
    const throwingMethod = (input: Input, _options?: Options) => {
      seenInputs.push(input);
      throw thrownError;
    };
    const throwingInstance = Object.assign(throwingMethod, {
      delete: throwingMethod,
      extend: () => throwingInstance,
      get: throwingMethod,
      head: throwingMethod,
      patch: throwingMethod,
      post: throwingMethod,
      put: throwingMethod,
      create: () => throwingInstance,
      retry: ky.retry,
      stop: ky.stop,
    }) as unknown as KyInstance;
    const api = createFetcher<ApiPaths>(throwingInstance);

    expect(() => api('/posts')).toThrow(thrownError);
    expect(seenInputs).toEqual(['/posts']);
  });

  it('does not retry absolute URL strings or rewrite normalized relative inputs', async () => {
    const seenUrls: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenUrls.push(request.url);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    await api('https://outside.example/absolute').json();
    await api('posts?draft=true').json();

    expect(seenUrls).toEqual([
      'https://example.com/api/https://outside.example/absolute',
      'https://example.com/api/posts?draft=true',
    ]);
  });
});
