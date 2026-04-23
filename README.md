# fetcher

`fetcher` is a thin, OpenAPI-aware wrapper around the real [`ky`](https://github.com/sindresorhus/ky) runtime.

It keeps the parts people already like about `ky`, such as `create()`, `extend()`, hooks, `prefixUrl`, custom `fetch`, and lazy `ResponsePromise` parsing, while adding OpenAPI-driven typing for route templates, grouped shortcut requests, and inferred `.json()` results.

## Status

- Package name: `fetcher`
- Runtime core: `ky`
- Build output: compiled `dist/` package
- Public entrypoints: `.`, `./core`, `./openapi`
- Runtime stance in v1: wrapper over `ky`, not a `ky` fork

This package now ships as a normal dist-based library, not as a source-export-only prototype.

## Why this exists

Many typed API wrappers smooth over OpenAPI at the cost of losing `ky` ergonomics. They often eagerly parse JSON, hide request options behind a custom client shape, or replace `ky` with a separate runtime model.

`fetcher` takes the smaller approach:

1. keep a real `KyInstance`
2. add a very small runtime layer for route preparation
3. do as much work as possible in the type system
4. return normal `ky` `ResponsePromise` objects on the default surface

## Installation

Install `fetcher` with `ky`.

```bash
pnpm add fetcher ky
```

`ky` is a peer dependency.

## Quick start

```ts
import { createTypedKy, type MergePaths } from 'fetcher/openapi';
import type { paths as GeneratedPaths } from './__generated__/openapi';

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

const api = createTypedKy<ApiPaths>({
  prefixUrl: '/api',
  hooks: {
    beforeRequest: [
      (_request, options) => {
        options.context.openapi?.pathTemplate;
        options.context.openapi?.method;
      },
    ],
  },
});

const user = await api
  .get('/users/{id}', {
    params: {
      path: { id: '42' },
      query: { include: 'profile' },
    },
  })
  .json();

const mdx = await api
  .post('/api/bff/serialize-mdx', {
    json: { title: 'A', mdx: '# hello' },
  })
  .json();

const authed = api.extend({
  headers: {
    Authorization: 'Bearer ...',
  },
});
```

## The shipped request contract

Typed shortcut methods use a grouped request object.

```ts
api.post('/uploads/{id}', {
  params: {
    path: { id: 'upload-1' },
    query: { draft: true },
    cookie: { session: 'type-only' },
  },
  headers: {
    'x-upload-token': 'token',
  },
  formData: {
    file,
    tags: ['a', 'b'],
  },
});
```

### Shortcut shape

- `params.path` for route template values
- `params.query` for query parameters
- `params.cookie` for typed cookie parameters, type-only at runtime
- top-level `headers` for typed header parameters
- top-level `json` for JSON request bodies
- top-level `formData` for multipart or form-style bodies
- optional third argument for normal `ky` options

### Direct callable shape

The callable client still keeps the normal `ky` options style, with OpenAPI-aware typing layered onto it.

```ts
await api('/users/{id}', {
  method: 'GET',
  path: { id: '42' },
  searchParams: { include: 'profile' },
}).json();
```

That split is intentional in v1. Shortcut methods use the grouped OSS request contract. The callable surface stays close to plain `ky`.

## `safe` surface

The default surface behaves like `ky`. It returns a `ResponsePromise` and still throws on HTTP failures.

If you want a non-throwing branch, use `safe`.

```ts
const result = await api.safe.get('/users/{id}', {
  params: {
    path: { id: '42' },
  },
});

if (result.ok) {
  result.data;
  result.response;
} else {
  result.error;
  result.response;
}
```

Practical result shape:

```ts
type SafeResult<Data, Error = unknown> =
  | {
      ok: true;
      data: Data;
      error: null;
      response: Response;
    }
  | {
      ok: false;
      data: null;
      error: Error;
      response: Response | null;
    };
```

Notes:

- success resolves with parsed `data` plus the original response
- failure resolves with the original thrown error in `error`
- `response` is `null` when `ky` fails before a response exists
- `safe` mirrors the callable surface and the typed shortcut methods except `head`

## Runtime behavior

### Path interpolation

`params.path` on shortcuts, and `path` on the callable surface, interpolate route templates before forwarding to `ky`.

Missing required path params throw immediately.

### `prefixUrl` with leading slashes

OpenAPI paths often start with `/`, while raw `ky` rejects leading slashes when `prefixUrl` is set.

`fetcher` retries that specific `ky` error with the leading slash removed, so OpenAPI-style route literals still work with `prefixUrl`.

### `params.cookie` is type-only

`params.cookie` exists so route-level cookie parameters can participate in OpenAPI typing.

It is not serialized into request headers or any other runtime output. If you need real cookie behavior, handle it through your own runtime setup or normal `ky` options.

### Header merging

Typed top-level `headers` are merged with explicit `ky` headers from the third argument. Header keys are merged case-insensitively, and later explicit `ky` headers win on collisions.

### JSON merge boundary

When a shortcut request provides `json` and the third `ky` options object also provides `json`, the runtime only shallow-merges them when both values are strict plain objects.

If either side is non-plain, such as an array, class instance, or `Date`, the explicit `kyOptions.json` value replaces the grouped request JSON.

If `kyOptions.body` is provided, it wins and the grouped JSON payload is not used.

### Multipart and `formData`

`formData` becomes a real `FormData` body.

- passing an existing `FormData` instance keeps it as-is
- passing a plain object appends its fields into a new `FormData`
- array values append one entry per item
- `Blob` values are appended directly
- `undefined` entries are skipped

`fetcher` does not force a multipart `Content-Type` header or set a boundary manually. It leaves that to the platform and `fetch`, which is the safe behavior for multipart requests.

### Hook metadata

Requests inject `context.openapi` metadata for hooks and observability.

```ts
options.context.openapi = {
  pathTemplate: '/users/{id}',
  method: 'get',
};
```

## Response inference

`.json()` inference is deterministic.

For typed routes, `InferJson` resolves in this order:

1. `200`
2. `201`
3. `204`
4. `default`
5. `unknown`

The type only moves to the next step when the current candidate has no JSON content.

This keeps response inference predictable, even when an operation declares several possible responses.

## API notes

### `createTypedKy<Paths>()`

Supported overloads:

```ts
createTypedKy<Paths>()
createTypedKy<Paths>(defaultOptions: Options)
createTypedKy<Paths>(instance: KyInstance)
```

### `TypedKy<Paths>`

The typed client keeps `ky` behavior while adding:

- typed callable requests
- typed shortcut methods for `get`, `post`, `put`, `patch`, and `delete`
- `safe` mirrors for the callable and those shortcut methods
- typed `create()` and `extend()` return values

`head` intentionally remains on the plain `ky` surface in v1. It is available at runtime, but it does not get the OpenAPI shortcut typing that the other methods have.

### Public OpenAPI types

The package exports these main OpenAPI helper types from `fetcher/openapi`:

- `OpenApiRequest`
- `OpenApiRequestOptions`
- `OpenApiOptions`
- `InferJson`
- `MergePaths`
- `SafeResult`

## Migration from the old prototype shape

Old shortcut examples used a flat request shape. That is no longer the shipped shortcut contract.

### Before

```ts
await api.get('/users/{id}', {
  path: { id: '42' },
  searchParams: { include: 'profile' },
});

await api.post('/posts', {
  json: { title: 'Hello' },
});
```

### After

```ts
await api.get('/users/{id}', {
  params: {
    path: { id: '42' },
    query: { include: 'profile' },
  },
});

await api.post('/posts', {
  json: { title: 'Hello' },
});
```

Header and cookie parameters also moved into the shipped grouped contract:

```ts
await api.post('/uploads/{id}', {
  params: {
    path: { id: 'upload-1' },
    cookie: { session: 'type-only' },
  },
  headers: {
    'x-upload-token': 'token',
  },
  formData: {
    file,
  },
});
```

Migration checklist:

- move shortcut `path` to `params.path`
- move shortcut `searchParams` to `params.query`
- move shortcut cookie parameters to `params.cookie`
- move typed header parameters to top-level `headers`
- keep JSON bodies at top-level `json`
- use top-level `formData` for multipart or form-style request bodies
- keep plain `ky` overrides in the third argument

The callable client remains closer to raw `ky`, so this migration guidance is specifically about typed shortcut methods.

## Wrapper stance

`fetcher` is intentionally a wrapper-first package in v1.

- `ky` remains the runtime core
- the package does not ship a `ky` fork
- `bindClientHooks` is not a shipped feature
- hook and extension behavior should keep feeling like normal `ky`

If deeper runtime divergence is needed later, that can be evaluated separately. It is not part of the current shipped contract.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Current limitations

- `head` remains plain `ky` typing in v1
- `params.cookie` is type-only and intentionally not serialized
- response inference only considers `200`, `201`, `204`, and `default`
- this package does not claim automatic auth or cookie management
