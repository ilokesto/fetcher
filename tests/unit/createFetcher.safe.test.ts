import { describe, expect, it, vi } from 'vitest';
import { createFetcher } from '../../src/openapi';
import { expectHttpError, expectSafeFailure, expectSafeSuccess } from '../fixtures/createFetcher.assertions';
import type { ApiPaths } from '../fixtures/createFetcher';

describe.each(['callable', 'shortcut'] as const)('createFetcher safe %s failures', (surface) => {
  it('returns a network rejection without a response', async () => {
    const error = new TypeError('Connection failed');
    const api = createFetcher<ApiPaths>({
      retry: 0,
      fetch: async () => {
        throw error;
      },
    });

    const result = expectSafeFailure(await (surface === 'callable'
      ? api.safe('https://example.com/network')
      : api.safe.get('https://example.com/network', {})));

    expect(result.error).toBe(error);
    expect(result.data).toBeNull();
    expect(result.response).toBeNull();
  });

  it('returns an in-flight abort without a response', async () => {
    const controller = new AbortController();
    const error = new DOMException('Request cancelled', 'AbortError');
    const started = Promise.withResolvers<void>();
    const api = createFetcher<ApiPaths>({
      retry: 0,
      signal: controller.signal,
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        return new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
          started.resolve();
        });
      },
    });

    const pending = surface === 'callable'
      ? api.safe('https://example.com/abort')
      : api.safe.get('https://example.com/abort', {});
    await started.promise;
    controller.abort(error);
    const result = expectSafeFailure(await pending);

    expect(result.error).toBe(error);
    expect(result.data).toBeNull();
    expect(result.response).toBeNull();
  });

  it('preserves a successful HTTP response when JSON parsing fails', async () => {
    const api = createFetcher<ApiPaths>({
      fetch: async () => new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-request-id': 'malformed-response' },
      }),
    });

    const result = expectSafeFailure(await (surface === 'callable'
      ? api.safe('https://example.com/malformed')
      : api.safe.get('https://example.com/malformed', {})));

    expect(result.error).toBeInstanceOf(SyntaxError);
    expect(result.data).toBeNull();
    expect(result.response?.status).toBe(200);
    expect(result.response?.headers.get('x-request-id')).toBe('malformed-response');
  });

  it('returns path preparation errors without invoking the transport', async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true }));
    const api = createFetcher<ApiPaths>({ fetch });

    const result = expectSafeFailure(await (surface === 'callable'
      ? api.safe('https://example.com/unknown/{id}')
      : api.safe.get('https://example.com/unknown/{id}', {})));

    expect(result.error).toBeInstanceOf(Error);
    expect(result.data).toBeNull();
    expect(result.response).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('createFetcher safe surface', () => {
  it('returns safe success and failure results without throwing', async () => {
    const seenUrls: string[] = [];
    let requestCount = 0;

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenUrls.push(request.url);
        requestCount += 1;

        if (requestCount === 1) {
          return new Response(JSON.stringify({ id: '42', role: 'member' }), {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          });
        }

        return new Response(JSON.stringify({ message: 'missing' }), {
          status: 404,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const success = await api.safe.get('/users/{id}', {
      params: {
        path: { id: '42' },
      },
    });
    const failure = await api.safe.get('/users/{id}', {
      params: {
        path: { id: '99' },
      },
    });

    const safeSuccess = expectSafeSuccess(success);
    const safeFailure = expectSafeFailure(failure);
    const failureError = expectHttpError(safeFailure.error);

    expect(safeSuccess).toMatchObject({
      ok: true,
      data: { id: '42', role: 'member' },
      error: null,
    });
    expect(safeSuccess.response.status).toBe(200);

    expect(safeFailure.data).toBeNull();
    expect(safeFailure.response).not.toBeNull();

    if (safeFailure.response === null) {
      throw new Error('Expected safe failure to preserve ky HTTPError and response');
    }

    expect(safeFailure.response.status).toBe(404);
    expect(failureError.response).toBe(safeFailure.response);

    expect(seenUrls).toEqual([
      'https://example.com/api/users/42',
      'https://example.com/api/users/99',
    ]);
  });

  it('keeps safe available and working on create and extend derived clients', async () => {
    const seenUrls: string[] = [];
    const seenHeaders: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      headers: {
        authorization: 'Bearer base',
      },
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenUrls.push(request.url);
        seenHeaders.push(request.headers.get('authorization') ?? '');

        return new Response(JSON.stringify({ id: '42', role: 'member' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const extended = api.extend({
      headers: {
        authorization: 'Bearer extended',
      },
    });
    const created = api.create({
      prefixUrl: 'https://example.com/api',
      headers: {
        authorization: 'Bearer created',
      },
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenUrls.push(request.url);
        seenHeaders.push(request.headers.get('authorization') ?? '');

        return new Response(JSON.stringify({ id: '99', title: 'created post' }), {
          status: 201,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const extendedResult = expectSafeSuccess(
      await extended.safe.get('/users/{id}', {
        params: {
          path: { id: '42' },
        },
      }),
    );
    const createdResult = expectSafeSuccess(
      await created.safe('/posts', {
        method: 'POST',
        json: {
          title: 'typed facade',
        },
      }),
    );

    expect(extendedResult.data).toEqual({ id: '42', role: 'member' });
    expect(extendedResult.response.status).toBe(200);
    expect(createdResult.data).toEqual({ id: '99', title: 'created post' });
    expect(createdResult.response.status).toBe(201);
    expect(seenUrls).toEqual([
      'https://example.com/api/users/42',
      'https://example.com/api/posts',
    ]);
    expect(seenHeaders).toEqual(['Bearer extended', 'Bearer created']);
  });
});
