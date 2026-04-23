import ky, { HTTPError } from 'ky';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createTypedKy as createTypedKyFromRoot } from '.';
import { createTypedKy as createTypedKyFromCore } from './core';
import { createTypedKy } from './openapi';
import type { MergePaths, TypedKy } from './openapi';
import { interpolatePathTemplate, normalizeGroupedRequestOptions } from './internal/runtime';
import type { SafeResult } from './openapi/types';

type GeneratedPaths = {
  '/users/{id}': {
    get: {
      parameters: {
        path: {
          id: string;
        };
        query?: {
          include?: 'profile' | 'settings';
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              id: string;
              role: 'admin' | 'member';
            };
          };
        };
      };
    };
  };
  '/search': {
    get: {
      parameters: {
        query?: {
          term?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      responses: {
        200: {
          content: {
            'application/json': {
              results: string[];
            };
          };
        };
      };
    };
  };
  '/posts': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            title: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            'application/json': {
              id: string;
              title: string;
            };
          };
        };
      };
    };
  };
  '/widgets/{widgetId}': {
    post: {
      parameters: {
        path: {
          widgetId: string;
        };
        query?: {
          draft?: boolean;
        };
        header: {
          'x-trace': string;
        };
        cookie?: {
          session?: string;
        };
      };
      requestBody: {
        content: {
          'application/json': {
            title: string;
            tags?: string[];
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              id: string;
            };
          };
        };
      };
    };
  };
  '/uploads/{uploadId}': {
    post: {
      parameters: {
        path: {
          uploadId: string;
        };
        query?: {
          overwrite?: boolean;
        };
        header: {
          'x-upload-token': string;
        };
        cookie?: {
          session?: string;
        };
      };
      requestBody: {
        content: {
          'multipart/form-data': {
            file: Blob;
            visibility?: 'private' | 'public';
          };
        };
      };
      responses: {
        201: {
          content: {
            'application/json': {
              id: string;
              status: 'stored';
            };
          };
        };
      };
    };
  };
};

type ExtraPaths = {
  '/api/bff/serialize-mdx': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            title: string;
            mdx: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              serializedMdx: string;
            };
          };
        };
      };
    };
  };
};

type ApiPaths = MergePaths<GeneratedPaths, ExtraPaths>;

const assertTypedShortcutUrlOptionFoundations = (api: TypedKy<ApiPaths>) => {
  api.get('/users/{id}', {
    params: {
      path: { id: '42' },
    },
  });

  api.post(
    '/widgets/{widgetId}',
    {
      params: {
        path: { widgetId: '42' },
        query: { draft: true },
        cookie: { session: 'abc' },
      },
      headers: { 'x-trace': 'trace-1' },
      json: {
        title: 'typed widget',
        tags: ['stable'],
      },
    },
    {
      headers: {
        authorization: 'Bearer token',
      },
      retry: 1,
    },
  );

  api.post(
    '/uploads/{uploadId}',
    {
      params: {
        path: { uploadId: 'upload-1' },
        query: { overwrite: true },
        cookie: { session: 'abc' },
      },
      headers: { 'x-upload-token': 'upload-token' },
      formData: {
        file: new Blob(['payload']),
        visibility: 'public',
      },
    },
    {
      headers: {
        authorization: 'Bearer token',
      },
      timeout: 500,
    },
  );

  // @ts-expect-error typed shortcuts with required grouped params must still receive a request envelope
  api.get('/users/{id}');

  // @ts-expect-error typed shortcuts with required grouped request data must still receive a request envelope
  api.post('/widgets/{widgetId}');

  // @ts-expect-error legacy top-level `path` stays forbidden on typed grouped shortcuts
  api.get('/users/{id}', {
    path: { id: '42' },
  });

  // @ts-expect-error legacy top-level `query` stays forbidden on typed grouped shortcuts
  api.get('/search', {
    query: { term: 'widgets' },
  });

  // @ts-expect-error legacy top-level `header` stays forbidden on typed grouped shortcuts
  api.post('/widgets/{widgetId}', {
    params: {
      path: { widgetId: '42' },
    },
    header: { 'x-trace': 'trace-1' },
    json: {
      title: 'typed widget',
    },
  });

  // @ts-expect-error legacy top-level `cookie` stays forbidden on typed grouped shortcuts
  api.post('/widgets/{widgetId}', {
    params: {
      path: { widgetId: '42' },
    },
    cookie: { session: 'abc' },
    headers: { 'x-trace': 'trace-1' },
    json: {
      title: 'typed widget',
    },
  });

  // @ts-expect-error typed header params stay top-level instead of nested under `params`
  api.post('/widgets/{widgetId}', {
    params: {
      path: { widgetId: '42' },
      header: { 'x-trace': 'trace-1' },
    },
    json: {
      title: 'typed widget',
    },
  });

  // @ts-expect-error `searchParams` stays on the route-bound `query` group
  api.post(
    '/widgets/{widgetId}',
    {
      params: {
        path: { widgetId: '42' },
      },
      headers: { 'x-trace': 'trace-1' },
      json: {
        title: 'typed widget',
      },
    },
    {
      searchParams: {
        draft: 'true',
      },
    },
  );

  // @ts-expect-error raw `body` stays disallowed on typed shortcut kyOptions
  api.post(
    '/widgets/{widgetId}',
    {
      params: {
        path: { widgetId: '42' },
      },
      headers: { 'x-trace': 'trace-1' },
      json: {
        title: 'typed widget',
      },
    },
    {
      body: JSON.stringify({ title: 'typed widget' }),
    },
  );

  // @ts-expect-error raw `json` stays disallowed on typed shortcut kyOptions
  api.post(
    '/widgets/{widgetId}',
    {
      params: {
        path: { widgetId: '42' },
      },
      headers: { 'x-trace': 'trace-1' },
      json: {
        title: 'typed widget',
      },
    },
    {
      json: {
        audit: true,
      },
    },
  );

  // @ts-expect-error routes without typed headers stay compile-time excluded from top-level `headers`
  api.get('/search', {
    params: {
      query: { term: 'widgets' },
    },
    headers: { 'x-trace': 'trace-1' },
  });

  // @ts-expect-error routes without path params stay compile-time excluded from `params.path`
  api.post('/posts', {
    params: {
      path: { postId: '42' },
    },
    json: {
      title: 'typed post',
    },
  });

  // @ts-expect-error form-data routes reject `json` when only `formData` is supported
  api.post('/uploads/{uploadId}', {
    params: {
      path: { uploadId: 'upload-1' },
    },
    headers: { 'x-upload-token': 'upload-token' },
    json: {
      file: new Blob(['payload']),
    },
  });

  // @ts-expect-error json-only routes reject `formData` when only `json` is supported
  api.post('/posts', {
    formData: {
      title: 'typed post',
    },
  });

  // @ts-expect-error payload groups stay mutually exclusive when the route only supports `formData`
  api.post('/uploads/{uploadId}', {
    params: {
      path: { uploadId: 'upload-1' },
    },
    headers: { 'x-upload-token': 'upload-token' },
    formData: {
      file: new Blob(['payload']),
    },
    json: {
      file: new Blob(['payload']),
    },
  });
};

const assertUnknownShortcutUrlOptionFallback = (api: TypedKy<ApiPaths>) => {
  const response = api.post(
    '/unknown',
    {
      params: {
        query: new URLSearchParams([['draft', 'true']]),
        path: { widgetId: '42' },
        cookie: {
          session: 'abc',
          preview: true,
        },
      },
      headers: new Headers({ 'x-trace': 'trace-1' }),
      json: {
        anything: true,
      },
    },
    {
      headers: {
        authorization: 'Bearer token',
      },
    },
  );

  expectTypeOf(response.json()).toEqualTypeOf<Promise<unknown>>();

  // @ts-expect-error unknown URL fallback still rejects the removed legacy flat shortcut fields
  api.post('/unknown', {
    path: { widgetId: '42' },
    json: {
      anything: true,
    },
  });
};

const assertNoTypedOptionsShortcut = (api: TypedKy<ApiPaths>) => {
  // @ts-expect-error `options` stays on the raw ky surface
  api.options(
    '/widgets/{widgetId}',
    {
      path: { widgetId: '42' },
    },
    {
      headers: {
        authorization: 'Bearer token',
      },
    },
  );
};

const assertHeadStaysOnPlainKyTyping = (api: TypedKy<ApiPaths>) => {
  api.head('/health', {
    headers: {
      authorization: 'Bearer token',
    },
  });

  // @ts-expect-error `head` stays on the plain ky surface instead of typed shortcut groups
  const invalidHeadOptions: Parameters<typeof api.head>[1] = { path: { id: '42' } };

  void invalidHeadOptions;
};

const assertBarrelImportContinuity = () => {
  expectTypeOf(createTypedKyFromCore<ApiPaths>()).toEqualTypeOf<TypedKy<ApiPaths>>();
  expectTypeOf(createTypedKyFromRoot<ApiPaths>()).toEqualTypeOf<TypedKy<ApiPaths>>();
};

const assertReadmeQuickStartSnippet = () => {
  const api = createTypedKy<ApiPaths>({
    prefixUrl: '/api',
    hooks: {
      beforeRequest: [
        (_request, options) => {
          const openapi = options.context.openapi as Record<string, unknown> | undefined;
          const pathTemplate = openapi?.pathTemplate as string | undefined;
          const method = openapi?.method as string | undefined;

          void [pathTemplate, method];
        },
      ],
    },
  });

  const user = api
    .get('/users/{id}', {
      params: {
        path: { id: '42' },
        query: { include: 'profile' },
      },
    })
    .json();

  const mdx = api
    .post('/api/bff/serialize-mdx', {
      json: { title: 'A', mdx: '# hello' },
    })
    .json();

  const authed = api.extend({
    headers: {
      Authorization: 'Bearer ...',
    },
  });

  expectTypeOf(user).toEqualTypeOf<
    Promise<{
      id: string;
      role: 'admin' | 'member';
    }>
  >();
  expectTypeOf(mdx).toEqualTypeOf<
    Promise<{
      serializedMdx: string;
    }>
  >();
  expectTypeOf(authed).toEqualTypeOf<TypedKy<ApiPaths>>();
};

const assertSafeSurfaceTyping = (api: TypedKy<ApiPaths>) => {
  const shortcutResult = api.safe.get('/users/{id}', {
    params: {
      path: { id: '42' },
    },
  });
  const callableResult = api.safe('/posts', {
    method: 'POST',
    json: {
      title: 'typed facade',
    },
  });

  expectTypeOf(shortcutResult).toEqualTypeOf<
    Promise<
      SafeResult<{
        id: string;
        role: 'admin' | 'member';
      }>
    >
  >();
  expectTypeOf(callableResult).toEqualTypeOf<
    Promise<
      SafeResult<{
        id: string;
        title: string;
      }>
    >
  >();

  expectTypeOf<Extract<Awaited<typeof shortcutResult>, { ok: true }>['data']>().toEqualTypeOf<{
    id: string;
    role: 'admin' | 'member';
  }>();
  expectTypeOf<Extract<Awaited<typeof shortcutResult>, { ok: true }>['error']>().toEqualTypeOf<null>();
  expectTypeOf<Extract<Awaited<typeof shortcutResult>, { ok: false }>['data']>().toEqualTypeOf<null>();
  expectTypeOf<Extract<Awaited<typeof shortcutResult>, { ok: false }>['error']>().toEqualTypeOf<unknown>();

  expectTypeOf<Extract<Awaited<typeof callableResult>, { ok: true }>['data']>().toEqualTypeOf<{
    id: string;
    title: string;
  }>();
  expectTypeOf<Extract<Awaited<typeof callableResult>, { ok: false }>['data']>().toEqualTypeOf<null>();

  const extendedSafeResult = api.extend({}).safe.get('/users/{id}', {
    params: {
      path: { id: '42' },
    },
  });
  const createdSafeResult = api
    .create({
      prefixUrl: 'https://example.com/api',
    })
    .safe('/posts', {
      method: 'POST',
      json: {
        title: 'typed facade',
      },
    });

  expectTypeOf(extendedSafeResult).toEqualTypeOf<typeof shortcutResult>();
  expectTypeOf(createdSafeResult).toEqualTypeOf<typeof callableResult>();
};

const expectSafeSuccess = <Data>(
  result: SafeResult<Data>,
): Extract<SafeResult<Data>, { ok: true }> => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error('Expected safe success result');
  }

  return result;
};

const expectSafeFailure = <Data>(
  result: SafeResult<Data>,
): Extract<SafeResult<Data>, { ok: false }> => {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error('Expected safe failure result');
  }

  return result;
};

const expectHttpError = (error: unknown): HTTPError => {
  expect(error).toBeInstanceOf(HTTPError);

  if (!(error instanceof HTTPError)) {
    throw new Error('Expected ky HTTPError');
  }

  return error;
};

void [
  assertTypedShortcutUrlOptionFoundations,
  assertUnknownShortcutUrlOptionFallback,
  assertNoTypedOptionsShortcut,
  assertHeadStaysOnPlainKyTyping,
  assertBarrelImportContinuity,
  assertReadmeQuickStartSnippet,
  assertSafeSurfaceTyping,
];

describe('createTypedKy', () => {
  it('interpolates path params, preserves ky behavior, and injects openapi context', async () => {
    const seenRequests: Array<{
      url: string;
      method: string;
      headers: Headers;
    }> = [];
    const seenContexts: Array<Record<string, unknown>> = [];

    const api = createTypedKy<ApiPaths>({
      prefixUrl: 'https://example.com/api',
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

  it('keeps extend typed and preserves inherited ky defaults', async () => {
    const authorizationValues: string[] = [];

    const api = createTypedKy<ApiPaths>({
      prefixUrl: 'https://example.com',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        const authorization = request.headers.get('authorization');

        if (authorization) {
          authorizationValues.push(authorization);
        }

        return new Response(JSON.stringify({ serializedMdx: 'compiled' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const authed = api.extend({
      headers: {
        Authorization: 'Bearer token',
      },
    });

    const payload = await authed
      .post('/api/bff/serialize-mdx', {
        json: {
          title: 'hello',
          mdx: '# hi',
        },
      })
      .json();

    expect(payload).toEqual({ serializedMdx: 'compiled' });
    expect(authorizationValues).toEqual(['Bearer token']);
    expectTypeOf(authed).toEqualTypeOf<TypedKy<ApiPaths>>();
  });

  it('keeps create typed and returns a usable derived client', async () => {
    const seenUrls: string[] = [];
    const seenHeaders: string[] = [];

    const api = createTypedKy<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenUrls.push(request.url);
        seenHeaders.push(request.headers.get('x-created') ?? '');

        return new Response(JSON.stringify({ serializedMdx: 'derived' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const derived = api.create({
      prefixUrl: 'https://example.com/api',
      headers: {
        'x-created': 'yes',
      },
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenUrls.push(request.url);
        seenHeaders.push(request.headers.get('x-created') ?? '');

        return new Response(JSON.stringify({ serializedMdx: 'derived' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const payload = await derived
      .post('/api/bff/serialize-mdx', {
        json: {
          title: 'hello',
          mdx: '# hi',
        },
      })
      .json();

    expect(payload).toEqual({ serializedMdx: 'derived' });
    expect(seenUrls).toEqual(['https://example.com/api/api/bff/serialize-mdx']);
    expect(seenHeaders).toEqual(['yes']);
    expectTypeOf(derived).toEqualTypeOf<TypedKy<ApiPaths>>();
  });

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

    const api = createTypedKy<ApiPaths>(instance);

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

    const api = createTypedKy<ApiPaths>({
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
    const api = createTypedKy<ApiPaths>({
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

  it('supports direct callable usage with inferred method typing', async () => {
    const api = createTypedKy<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async () => {
        return new Response(JSON.stringify({ id: '99', title: 'typed facade' }), {
          status: 201,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const payload = await api('/posts', {
      method: 'post',
      json: {
        title: 'typed facade',
      },
    }).json();

    expect(payload).toEqual({ id: '99', title: 'typed facade' });
  });

  it('keeps head on the plain ky surface while still forwarding plain ky options to ky', async () => {
    const seenMethods: string[] = [];
    const seenUrls: string[] = [];
    const seenTimeouts: Array<number | false | undefined> = [];

    const api = createTypedKy<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      hooks: {
        beforeRequest: [
          (_request, options) => {
            seenTimeouts.push((options as { timeout?: number | false }).timeout);
          },
        ],
      },
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenMethods.push(request.method);
        seenUrls.push(request.url);

        return new Response(null, {
          status: 204,
        });
      },
    });

    const response = await api.head('/health', {
      headers: {
        'x-head': '1',
      },
      searchParams: {
        probe: 'true',
      },
      timeout: 321,
    });

    expect(response.status).toBe(204);
    expect(seenMethods).toEqual(['HEAD']);
    expect(seenUrls).toEqual(['https://example.com/api/health?probe=true']);
    expect(seenTimeouts).toEqual([321]);
  });

  it('re-exposes stop and retry on the decorated client', () => {
    const instance = ky.create({
      prefixUrl: 'https://example.com/api',
    });

    const api = createTypedKy<ApiPaths>(instance);
    const derived = api.extend({
      headers: {
        'x-derived': '1',
      },
    });

    expect(api.stop).toBe(instance.stop);
    expect(api.retry).toBe(instance.retry);
    expect(derived.stop).toBe(instance.stop);
    expect(derived.retry).toBe(instance.retry);
  });

  it('retries leading-slash inputs with prefixUrl for direct callable usage', async () => {
    const seenUrls: string[] = [];

    const api = createTypedKy<ApiPaths>({
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

  it('injects openapi context for typed shortcut requests', async () => {
    const seenContexts: Array<Record<string, unknown>> = [];

    const api = createTypedKy<ApiPaths>({
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

    const api = createTypedKy<ApiPaths>({
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

  it('replaces grouped json with explicit ky json when either side is non-plain', async () => {
    const seenBodies: string[] = [];

    const api = createTypedKy<ApiPaths>({
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

    const api = createTypedKy<ApiPaths>({
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

  it('does not auto-serialize params.cookie into a cookie header', async () => {
    const seenHeaders: Headers[] = [];

    const api = createTypedKy<ApiPaths>({
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

  it('keeps the root, core, and openapi barrels aligned', () => {
    expect(createTypedKyFromCore).toBe(createTypedKy);
    expect(createTypedKyFromRoot).toBe(createTypedKy);
  });

  it('forwards non-string inputs without fabricating a path template', async () => {
    const seenUrls: string[] = [];
    const seenMethods: string[] = [];
    const seenContexts: Array<Record<string, unknown>> = [];

    const api = createTypedKy<ApiPaths>({
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

    const api = createTypedKy<ApiPaths>({
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

  it('exposes inferred json types for shortcut and callable forms', () => {
    const api = createTypedKy<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async () => {
        return new Response(null, {
          status: 204,
        });
      },
    });

    const userResponse = api.get('/users/{id}', {
      params: {
        path: { id: '42' },
      },
    });
    const mdxResponse = api.post('/api/bff/serialize-mdx', {
      json: {
        title: 'A',
        mdx: '# hello',
      },
    });
    const postResponse = api('/posts', {
      method: 'POST',
      json: {
        title: 'typed facade',
      },
    });

    expectTypeOf(userResponse.json()).toEqualTypeOf<
      Promise<{
        id: string;
        role: 'admin' | 'member';
      }>
    >();
    expectTypeOf(mdxResponse.json()).toEqualTypeOf<
      Promise<{
        serializedMdx: string;
      }>
    >();
    expectTypeOf(postResponse.json()).toEqualTypeOf<
      Promise<{
        id: string;
        title: string;
      }>
    >();
    expectTypeOf(userResponse.json<{ overridden: true }>()).toEqualTypeOf<
      Promise<{
        overridden: true;
      }>
    >();
  });

  it('returns safe success and failure results without throwing', async () => {
    const seenUrls: string[] = [];
    let requestCount = 0;

    const api = createTypedKy<ApiPaths>({
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

    const api = createTypedKy<ApiPaths>({
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
