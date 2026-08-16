import ky from 'ky';
import { describe, expect, it, vi } from 'vitest';
import { createFetcher } from './openapi';
import type { HeadPaths } from './test-fixtures/head';

describe('createFetcher HEAD shortcut', () => {
  it('delegates typed HEAD requests to ky.head with head metadata and no body parsing', async () => {
    const seenContexts: Array<Record<string, unknown>> = [];
    const instance = ky.create({
      prefixUrl: 'https://example.com/api',
      hooks: {
        beforeRequest: [
          (_request, options) => {
            seenContexts.push(options.context.openapi as Record<string, unknown>);
          },
        ],
      },
      fetch: async () => new Response(null, { status: 204 }),
    });
    const headSpy = vi.spyOn(instance, 'head');
    const api = createFetcher<HeadPaths>(instance);

    const response = await api.head('/resources/{resourceId}', {
      params: {
        path: { resourceId: 'resource-1' },
        query: { revision: 7 },
        cookie: { session: 'session-1' },
      },
      headers: { 'x-tenant-id': 'tenant-1' },
    });

    expect(response.status).toBe(204);
    expect(headSpy).toHaveBeenCalled();
    expect(seenContexts).toEqual([
      {
        method: 'head',
        pathTemplate: '/resources/{resourceId}',
      },
    ]);
  });

  it('preserves two-argument ky options for untyped HEAD URLs', async () => {
    const seenRequests: Array<{ readonly url: string; readonly authorization: string | null }> = [];
    const api = createFetcher<HeadPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenRequests.push({
          url: request.url,
          authorization: request.headers.get('authorization'),
        });

        return new Response(null, { status: 204 });
      },
    });

    await api.head('/health', {
      headers: { authorization: 'Bearer token' },
      searchParams: { probe: 'ready' },
    });

    expect(seenRequests).toEqual([
      {
        url: 'https://example.com/api/health?probe=ready',
        authorization: 'Bearer token',
      },
    ]);
  });
});
