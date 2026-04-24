import { describe, expect, it } from 'vitest';
import { createFetcher } from './openapi';
import { expectHttpError, expectSafeFailure, expectSafeSuccess } from './test-fixtures/createFetcher';
import type { ApiPaths } from './test-fixtures/createFetcher';

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
