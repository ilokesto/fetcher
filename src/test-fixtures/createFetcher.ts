import { HTTPError } from 'ky';
import { expect, expectTypeOf } from 'vitest';
import { createFetcher as createFetcherFromRoot } from '..';
import { createFetcher as createFetcherFromCore } from '../core';
import { createFetcher } from '../openapi';
import type { Fetcher, MergePaths } from '../openapi';
import type { SafeResult } from '../openapi/types';

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
  '/sessions': {
    post: {
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            username: string;
            password: string;
            scope?: string[];
            empty?: undefined;
            remember?: boolean;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              token: string;
            };
          };
        };
      };
    };
  };
  '/imports': {
    post: {
      requestBody: {
        content: {
          'multipart/form-data': {
            file: Blob;
          };
          'application/x-www-form-urlencoded': {
            sourceUrl: string;
            labels?: string[];
          };
        };
      };
      responses: {
        202: {
          content: {
            'application/json': {
              accepted: true;
            };
          };
        };
      };
    };
  };
};

type ExtraPaths = {
  '/bff/checkout/quote': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            cartId: string;
            couponCode?: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              total: number;
              currency: 'KRW' | 'USD';
              discountApplied: boolean;
            };
          };
        };
      };
    };
  };
};

export type ApiPaths = MergePaths<GeneratedPaths, ExtraPaths>;
export type UntypedShortcutPost = (input: string, request?: unknown) => { json: () => Promise<unknown> };

type MergePathsBaseFixture = {
  '/base-only': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': {
              baseOnly: true;
            };
          };
        };
      };
    };
  };
  '/shared': {
    get: {
      parameters: {
        query: {
          fromBase: string;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              baseGet: true;
            };
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          'application/json': {
            basePost: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            'application/json': {
              createdFromBase: true;
            };
          };
        };
      };
    };
  };
};

type MergePathsExtraFixture = {
  '/extra-only': {
    delete: {
      responses: {
        204: {
          content: never;
        };
      };
    };
  };
  '/shared': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': {
              extraGet: true;
            };
          };
        };
      };
    };
    patch: {
      requestBody: {
        content: {
          'application/json': {
            extraPatch: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              patchedFromExtra: true;
            };
          };
        };
      };
    };
  };
};

type MergePathsFixture = MergePaths<MergePathsBaseFixture, MergePathsExtraFixture>;

export const assertMergePathsTyping = () => {
  expectTypeOf<MergePathsFixture['/base-only']>().toEqualTypeOf<MergePathsBaseFixture['/base-only']>();
  expectTypeOf<MergePathsFixture['/extra-only']>().toEqualTypeOf<MergePathsExtraFixture['/extra-only']>();
  expectTypeOf<MergePathsFixture['/shared']['post']>().toEqualTypeOf<
    MergePathsBaseFixture['/shared']['post']
  >();
  expectTypeOf<MergePathsFixture['/shared']['patch']>().toEqualTypeOf<
    MergePathsExtraFixture['/shared']['patch']
  >();
  expectTypeOf<MergePathsFixture['/shared']['get']>().toEqualTypeOf<
    MergePathsExtraFixture['/shared']['get']
  >();

  // @ts-expect-error same-path same-method replacement must not retain Base operation internals
  expectTypeOf<MergePathsFixture['/shared']['get']['parameters']>().toEqualTypeOf<never>();
};

export const assertTypedShortcutUrlOptionFoundations = (api: Fetcher<ApiPaths>) => {
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

  api.post('/sessions', {
    formUrlEncoded: {
      username: 'ada',
      password: 'secret',
      scope: ['read', 'write'],
    },
  });

  api.post('/imports', {
    formData: {
      file: new Blob(['payload']),
    },
  });

  api.post('/imports', {
    formUrlEncoded: {
      sourceUrl: 'https://example.com/input.csv',
      labels: ['a', 'b'],
    },
  });

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

  // @ts-expect-error urlencoded-only routes reject `formData`
  api.post('/sessions', {
    formData: {
      username: 'ada',
      password: 'secret',
    },
  });

  // @ts-expect-error urlencoded-only routes reject `json`
  api.post('/sessions', {
    json: {
      username: 'ada',
      password: 'secret',
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

  // @ts-expect-error payload groups stay mutually exclusive when multiple body media types exist
  api.post('/imports', {
    formData: {
      file: new Blob(['payload']),
    },
    formUrlEncoded: {
      sourceUrl: 'https://example.com/input.csv',
    },
  });
};

export const assertUnknownShortcutUrlOptionFallback = (api: Fetcher<ApiPaths>) => {
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

  api.post('/unknown-urlencoded', {
    formUrlEncoded: new URLSearchParams([['anything', 'true']]),
  });

  // @ts-expect-error unknown URL fallback still rejects the removed legacy flat shortcut fields
  api.post('/unknown', {
    path: { widgetId: '42' },
    json: {
      anything: true,
    },
  });
};

export const assertNoTypedOptionsShortcut = (api: Fetcher<ApiPaths>) => {
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

export const assertHeadStaysOnPlainKyTyping = (api: Fetcher<ApiPaths>) => {
  api.head('/health', {
    headers: {
      authorization: 'Bearer token',
    },
  });

  // @ts-expect-error `head` stays on the plain ky surface instead of typed shortcut groups
  const invalidHeadOptions: Parameters<typeof api.head>[1] = { path: { id: '42' } };

  void invalidHeadOptions;
};

export const assertBarrelImportContinuity = () => {
  expectTypeOf(createFetcherFromCore<ApiPaths>()).toEqualTypeOf<Fetcher<ApiPaths>>();
  expectTypeOf(createFetcherFromRoot<ApiPaths>()).toEqualTypeOf<Fetcher<ApiPaths>>();
};

export const assertReadmeQuickStartSnippet = () => {
  const api = createFetcher<ApiPaths>({
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

  const quote = api
    .post('/bff/checkout/quote', {
      json: { cartId: 'cart_123', couponCode: 'WELCOME10' },
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
  expectTypeOf(quote).toEqualTypeOf<
    Promise<{
      total: number;
      currency: 'KRW' | 'USD';
      discountApplied: boolean;
    }>
  >();
  expectTypeOf(authed).toEqualTypeOf<Fetcher<ApiPaths>>();
};

export const assertSafeSurfaceTyping = (api: Fetcher<ApiPaths>) => {
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

export const expectSafeSuccess = <Data>(
  result: SafeResult<Data>,
): Extract<SafeResult<Data>, { ok: true }> => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error('Expected safe success result');
  }

  return result;
};

export const expectSafeFailure = <Data>(
  result: SafeResult<Data>,
): Extract<SafeResult<Data>, { ok: false }> => {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error('Expected safe failure result');
  }

  return result;
};

export const expectHttpError = (error: unknown): HTTPError => {
  expect(error).toBeInstanceOf(HTTPError);

  if (!(error instanceof HTTPError)) {
    throw new Error('Expected ky HTTPError');
  }

  return error;
};
