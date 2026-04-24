import { describe, expect, it } from 'vitest';
import { createFetcher } from './openapi';
import type { ApiPaths } from './test-fixtures/createFetcher';
import { interpolatePathTemplate, normalizeGroupedRequestOptions } from './internal/runtime';
import type { UntypedShortcutPost } from './test-fixtures/createFetcher';

describe('createFetcher runtime normalization', () => {
  it('interpolates path params, preserves ky behavior, and injects openapi context', async () => {
    const seenRequests: Array<{
      url: string;
      method: string;
      headers: Headers;
    }> = [];
    const seenContexts: Array<Record<string, unknown>> = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      retry: {
        limit: 0,
      },
      hooks: {
        beforeRequest: [
          (_request, options) => {
            seenContexts.push(options.context.openapi as Record<string, unknown>);
          },
        ],
      },
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenRequests.push({
          url: request.url,
          method: request.method,
          headers: request.headers,
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

    expect(payload).toEqual({ id: '42', role: 'member' });
    expect(seenRequests[0]?.url).toBe('https://example.com/api/users/42');
    expect(seenRequests[0]?.method).toBe('GET');
    expect(seenContexts[0]).toEqual({
      method: 'get',
      pathTemplate: '/users/{id}',
    });
  });

  it('injects openapi context for typed shortcut requests', async () => {
    const seenContexts: Array<Record<string, unknown>> = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      hooks: {
        beforeRequest: [
          (_request, options) => {
            seenContexts.push(options.context as Record<string, unknown>);
          },
        ],
      },
      fetch: async () => {
        return new Response(JSON.stringify({ results: ['widget'] }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    await api.get(
      '/search',
      {
        params: {
          query: {
            term: 'widget',
          },
        },
      },
      {
        context: {
          openapi: {},
        },
      },
    ).json();

    expect(seenContexts).toEqual([
      {
        openapi: {
          method: 'get',
          pathTemplate: '/search',
        },
      },
    ]);
  });

  it('translates grouped json shortcut requests into runtime ky options', async () => {
    const seenRequests: Array<{
      url: string;
      method: string;
      headers: Headers;
      body: unknown;
    }> = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenRequests.push({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: await request.json(),
        });

        return new Response(JSON.stringify({ id: 'widget-42' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const firstPayload = await api
      .post(
        '/widgets/{widgetId}',
        {
          params: {
            path: { widgetId: '42' },
            query: { draft: true },
            cookie: { session: 'abc' },
          },
          headers: {
            'x-trace': 'typed-trace',
          },
          json: {
            title: 'typed widget',
            tags: ['stable'],
          },
        },
        {
          headers: {
            authorization: 'Bearer token',
          },
        },
      )
      .json();

    const secondPayload = await api
      .post(
        '/widgets/{widgetId}',
        {
          params: {
            path: { widgetId: '42' },
            query: { draft: true },
            cookie: { session: 'abc' },
          },
          headers: {
            'x-trace': 'typed-trace',
          },
          json: {
            title: 'typed widget',
            tags: ['stable'],
          },
        },
        {
          headers: {
            'X-Trace': 'explicit-trace',
            authorization: 'Bearer token',
          },
        },
      )
      .json();

    expect(firstPayload).toEqual({ id: 'widget-42' });
    expect(secondPayload).toEqual({ id: 'widget-42' });
    expect(seenRequests).toHaveLength(2);
    expect(seenRequests[0]?.url).toBe('https://example.com/api/widgets/42?draft=true');
    expect(seenRequests[0]?.method).toBe('POST');
    expect(seenRequests[0]?.headers.get('x-trace')).toBe('typed-trace');
    expect(seenRequests[0]?.headers.get('authorization')).toBe('Bearer token');
    expect(seenRequests[0]?.headers.get('cookie')).toBeNull();
    expect(seenRequests[0]?.body).toEqual({
      title: 'typed widget',
      tags: ['stable'],
    });
    expect(seenRequests[1]?.url).toBe('https://example.com/api/widgets/42?draft=true');
    expect(seenRequests[1]?.method).toBe('POST');
    expect(seenRequests[1]?.headers.get('x-trace')).toBe('explicit-trace');
    expect(seenRequests[1]?.headers.get('authorization')).toBe('Bearer token');
    expect(seenRequests[1]?.headers.get('cookie')).toBeNull();
    expect(seenRequests[1]?.body).toEqual({
      title: 'typed widget',
      tags: ['stable'],
    });
  });

  it('keeps legacy flat aliases as compatibility-only unknown shortcut behavior', async () => {
    const seenRequests: Array<{
      url: string;
      method: string;
      headers: Headers;
      body: unknown;
    }> = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        const rawBody = await request.text();

        seenRequests.push({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: rawBody ? JSON.parse(rawBody) : null,
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });
    const postUntyped = api.post as unknown as UntypedShortcutPost;

    const legacyAliasRequest: unknown = {
      path: { widgetId: 'legacy-42' },
      query: { draft: true },
      cookie: { session: 'legacy-cookie' },
      header: { 'x-trace': 'legacy-trace' },
      json: { title: 'legacy alias' },
    };

    const canonicalRequest = {
      params: {
        path: { widgetId: 'canonical-42' },
        query: { draft: false },
        cookie: { session: 'canonical-cookie' },
      },
      headers: { 'x-trace': 'canonical-trace' },
      json: { title: 'canonical grouped' },
    };

    const mixedRequest: unknown = {
      params: {
        path: { widgetId: 'canonical-wins' },
        query: { draft: false },
        cookie: { session: 'canonical-cookie' },
      },
      path: { widgetId: 'legacy-loses' },
      query: { draft: true, ignored: 'yes' },
      cookie: { session: 'legacy-cookie' },
      headers: { 'x-trace': 'canonical-trace' },
      header: { 'x-trace': 'legacy-trace', 'x-legacy': 'ignored' },
      json: { title: 'mixed precedence' },
    };

    await postUntyped('/unknown/{widgetId}', legacyAliasRequest).json();
    await postUntyped('/unknown/{widgetId}', canonicalRequest).json();
    await postUntyped('/unknown/{widgetId}', mixedRequest).json();

    expect(seenRequests).toHaveLength(3);
    expect(seenRequests[0]?.url).toBe('https://example.com/api/unknown/legacy-42?draft=true');
    expect(seenRequests[0]?.method).toBe('POST');
    expect(seenRequests[0]?.headers.get('x-trace')).toBe('legacy-trace');
    expect(seenRequests[0]?.headers.get('cookie')).toBeNull();
    expect(seenRequests[0]?.body).toEqual({ title: 'legacy alias' });

    expect(seenRequests[1]?.url).toBe('https://example.com/api/unknown/canonical-42?draft=false');
    expect(seenRequests[1]?.method).toBe('POST');
    expect(seenRequests[1]?.headers.get('x-trace')).toBe('canonical-trace');
    expect(seenRequests[1]?.headers.get('cookie')).toBeNull();
    expect(seenRequests[1]?.body).toEqual({ title: 'canonical grouped' });

    expect(seenRequests[2]?.url).toBe('https://example.com/api/unknown/canonical-wins?draft=false');
    expect(seenRequests[2]?.method).toBe('POST');
    expect(seenRequests[2]?.headers.get('x-trace')).toBe('canonical-trace');
    expect(seenRequests[2]?.headers.get('x-legacy')).toBeNull();
    expect(seenRequests[2]?.headers.get('cookie')).toBeNull();
    expect(seenRequests[2]?.body).toEqual({ title: 'mixed precedence' });
  });

  it('replaces grouped json with explicit ky json when either side is non-plain', async () => {
    const seenBodies: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        const rawBody = await request.text();

        seenBodies.push(rawBody);

        return new Response(
          JSON.stringify({
            body: rawBody,
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      },
    });

    const arrayPayload = await api
      ('https://example.com/api/unknown', {
        method: 'POST',
        ...normalizeGroupedRequestOptions({
          request: {
            headers: new Headers({ 'x-trace': 'typed-trace' }),
            json: {
              title: 'grouped object',
            },
          },
          options: {
            json: ['explicit', 'array'],
          },
        }),
      })
      .json<{ body: string }>();

    const date = new Date('2026-04-23T00:00:00.000Z');
    const datePayload = await api
      ('https://example.com/api/unknown', {
        method: 'POST',
        ...normalizeGroupedRequestOptions({
          request: {
            headers: new Headers({ 'x-trace': 'typed-trace' }),
            json: ['grouped', 'array'],
          },
          options: {
            json: date,
          },
        }),
      })
      .json<{ body: string }>();

    expect(arrayPayload).toEqual({
      body: '["explicit","array"]',
    });
    expect(datePayload).toEqual({
      body: '"2026-04-23T00:00:00.000Z"',
    });
    expect(seenBodies).toEqual(['["explicit","array"]', '"2026-04-23T00:00:00.000Z"']);
  });

  it('translates grouped multipart shortcut requests into a FormData body', async () => {
    const seenRequests: Array<{
      url: string;
      method: string;
      headers: Headers;
      body: FormData | null;
    }> = [];

    const file = new Blob(['payload'], { type: 'text/plain' });

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        const body = await request.formData();

        seenRequests.push({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body,
        });

        return new Response(JSON.stringify({ id: 'upload-1', status: 'stored' }), {
          status: 201,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const payload = await api
      .post(
        '/uploads/{uploadId}',
        {
          params: {
            path: { uploadId: 'upload-1' },
            query: { overwrite: true },
            cookie: { session: 'abc' },
          },
          headers: {
            'x-upload-token': 'typed-upload-token',
          },
          formData: {
            file,
            visibility: 'public',
          },
        },
        {
          headers: {
            authorization: 'Bearer token',
          },
        },
      )
      .json();

    expect(payload).toEqual({ id: 'upload-1', status: 'stored' });
    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0]?.url).toBe('https://example.com/api/uploads/upload-1?overwrite=true');
    expect(seenRequests[0]?.method).toBe('POST');
    expect(seenRequests[0]?.headers.get('x-upload-token')).toBe('typed-upload-token');
    expect(seenRequests[0]?.headers.get('authorization')).toBe('Bearer token');
    expect(seenRequests[0]?.headers.get('cookie')).toBeNull();
    expect(seenRequests[0]?.headers.get('content-type')).not.toBe('multipart/form-data');
    expect(seenRequests[0]?.body).toBeInstanceOf(FormData);
    expect(seenRequests[0]?.body?.get('visibility')).toBe('public');

    const seenFile = seenRequests[0]?.body?.get('file');

    expect(seenFile).toBeInstanceOf(File);
    expect(await (seenFile as File).text()).toBe('payload');
  });

  it('translates grouped urlencoded shortcut requests into a URLSearchParams body', async () => {
    const seenRequests: Array<{
      url: string;
      method: string;
      headers: Headers;
      body: string;
    }> = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        const body = await request.text();

        seenRequests.push({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body,
        });

        return new Response(JSON.stringify({ token: 'session-token' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const payload = await api
      .post('/sessions', {
        formUrlEncoded: {
          username: 'ada',
          password: 'secret',
          scope: ['read', 'write'],
          empty: undefined,
          remember: true,
        },
      })
      .json();

    expect(payload).toEqual({ token: 'session-token' });
    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0]?.url).toBe('https://example.com/api/sessions');
    expect(seenRequests[0]?.method).toBe('POST');
    expect(seenRequests[0]?.headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded;charset=UTF-8',
    );
    expect(seenRequests[0]?.body).toBe(
      'username=ada&password=secret&scope=read&scope=write&remember=true',
    );
  });

  it('passes existing URLSearchParams through for grouped urlencoded requests', async () => {
    const seenBodies: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenBodies.push(await request.text());

        return new Response(JSON.stringify({ token: 'session-token' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    await api
      .post('/unknown-urlencoded', {
        formUrlEncoded: new URLSearchParams([
          ['scope', 'read'],
          ['scope', 'write'],
        ]),
      })
      .json();

    expect(seenBodies).toEqual(['scope=read&scope=write']);
  });

  it('lets explicit ky body override grouped json, multipart, and urlencoded bodies', async () => {
    const seenBodies: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenBodies.push(await request.text());

        return new Response(JSON.stringify({ body: seenBodies.at(-1) }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    await api
      ('https://example.com/api/unknown', {
        method: 'POST',
        ...normalizeGroupedRequestOptions({
          request: {
            json: {
              title: 'grouped json',
            },
          },
          options: {
            body: 'explicit json body',
          },
        }),
      })
      .json();

    await api
      ('https://example.com/api/unknown', {
        method: 'POST',
        ...normalizeGroupedRequestOptions({
          request: {
            formData: {
              file: new Blob(['grouped multipart']),
            },
          },
          options: {
            body: 'explicit multipart body',
          },
        }),
      })
      .json();

    await api
      ('https://example.com/api/unknown', {
        method: 'POST',
        ...normalizeGroupedRequestOptions({
          request: {
            formUrlEncoded: {
              username: 'grouped-urlencoded',
            },
          },
          options: {
            body: 'explicit urlencoded body',
          },
        }),
      })
      .json();

    expect(seenBodies).toEqual([
      'explicit json body',
      'explicit multipart body',
      'explicit urlencoded body',
    ]);
  });

  it('does not auto-serialize params.cookie into a cookie header', async () => {
    const seenHeaders: Headers[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenHeaders.push(request.headers);

        return new Response(JSON.stringify({ id: 'widget-42' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    await api
      .post('/widgets/{widgetId}', {
        params: {
          path: { widgetId: '42' },
          cookie: {
            session: 'abc',
          },
        },
        headers: {
          'x-trace': 'typed-trace',
        },
        json: {
          title: 'typed widget',
        },
      })
      .json();

    expect(seenHeaders).toHaveLength(1);
    expect(seenHeaders[0]?.get('cookie')).toBeNull();
    expect(seenHeaders[0]?.get('x-trace')).toBe('typed-trace');
  });

  it('forwards non-string inputs without fabricating a path template', async () => {
    const seenUrls: string[] = [];
    const seenMethods: string[] = [];
    const seenContexts: Array<Record<string, unknown>> = [];

    const api = createFetcher<ApiPaths>({
      hooks: {
        beforeRequest: [
          (_request, options) => {
            seenContexts.push(options.context.openapi as Record<string, unknown>);
          },
        ],
      },
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenUrls.push(request.url);
        seenMethods.push(request.method);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const url = new URL('https://example.com/raw');

    await api(url, {
      method: 'POST',
    }).json();

    expect(seenUrls).toEqual(['https://example.com/raw']);
    expect(seenMethods).toEqual(['POST']);
    expect(seenContexts).toEqual([
      {
        method: 'post',
      },
    ]);
  });

  it('preserves custom methods when forwarding to ky', async () => {
    const seenMethods: string[] = [];
    const seenContexts: Array<Record<string, unknown>> = [];

    const api = createFetcher<ApiPaths>({
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenMethods.push(request.method);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
      hooks: {
        beforeRequest: [
          (_request, options) => {
            seenContexts.push(options.context.openapi as Record<string, unknown>);
          },
        ],
      },
    });

    await api('https://example.com/dav', {
      method: 'PROPFIND',
    }).json();

    expect(seenMethods).toEqual(['PROPFIND']);
    expect(seenContexts).toEqual([
      {
        method: 'propfind',
        pathTemplate: 'https://example.com/dav',
      },
    ]);
  });

  it('throws when a required path parameter is missing at runtime', () => {
    expect(() => interpolatePathTemplate('/users/{id}', {})).toThrow(
      'Missing path parameter "id" for template: /users/{id}',
    );
  });
});
