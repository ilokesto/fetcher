import { describe, expect, expectTypeOf, it } from 'vitest';
import { createFetcher } from '../../src/openapi';
import type { Accepted, Ready, SuccessResponsePaths } from '../fixtures/success-responses';

describe('createFetcher success responses', () => {
  it.each(['callable', 'shortcut', 'safe callable', 'safe shortcut'] as const)(
    '%s: 202 JSON -> preserves POST dispatch and accepted data',
    async (surface) => {
      const methods: string[] = [];
      const payload: Accepted = { state: 'accepted', jobId: 'job-1' };
      const api = createFetcher<SuccessResponsePaths>({
        prefixUrl: 'https://example.com',
        fetch: async (input) => {
          const request = input instanceof Request ? input : new Request(input);
          methods.push(request.method);
          return Response.json(payload, { status: 202 });
        },
      });

      if (surface === 'safe callable' || surface === 'safe shortcut') {
        const result = await (surface === 'safe callable'
          ? api.safe('/jobs', { method: 'POST' })
          : api.safe.post('/jobs', {}));
        expect(result).toMatchObject({ ok: true, data: payload });
        expect(result.response?.status).toBe(202);
        if (result.ok) {
          expectTypeOf(result.data).toEqualTypeOf<Accepted>();
        }
      } else {
        const response = await (surface === 'callable'
          ? api('/jobs', { method: 'POST' })
          : api.post('/jobs', {}));
        const data = await response.json();
        expect(data).toEqual(payload);
        expect(response.status).toBe(202);
        expectTypeOf(data).toEqualTypeOf<Accepted>();
      }
      expect(methods).toEqual(['POST']);
    },
  );

  it.each([200, 206])('get: status %i -> parses the corresponding success union member', async (status) => {
    const payload: Ready | Accepted = status === 200
      ? { state: 'ready', id: 'item-1' }
      : { state: 'accepted', jobId: 'job-1' };
    const api = createFetcher<SuccessResponsePaths>({
      prefixUrl: 'https://example.com',
      fetch: async () => Response.json(payload, { status }),
    });

    const data = await api.get('/items', {}).json();
    const safe = await api.safe.get('/items', {});

    expect(data).toEqual(payload);
    expect(safe).toMatchObject({ ok: true, data: payload });
    expect(safe.response?.status).toBe(status);
    expectTypeOf(data).toEqualTypeOf<Ready | Accepted>();
  });
});
