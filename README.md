# @ilokesto/fetcher

<p align="center">
  <a href="./README.md"><kbd>English</kbd></a>
  <a href="./README.ko.md"><kbd>한국어</kbd></a>
</p>

`@ilokesto/fetcher` is a thin, OpenAPI-aware wrapper around the real [`ky`](https://github.com/sindresorhus/ky) runtime.

It keeps the parts people already like about `ky`, such as `create()`, `extend()`, hooks, `prefixUrl`, custom `fetch`, and lazy `ResponsePromise` parsing, while adding OpenAPI-driven typing for route templates, grouped shortcut requests, and inferred `.json()` results.

This README is the canonical documentation for the package. Until a separate docs site exists, treat the English and Korean README pair as the official reference for installation, public entrypoints, request contracts, runtime behavior, migration notes, and development verification.

## Status

- Package name: `@ilokesto/fetcher`
- Runtime core: `ky`
- Build output: compiled `dist/` package
- Public entrypoints: `@ilokesto/fetcher`, `@ilokesto/fetcher/core`, `@ilokesto/fetcher/openapi`
- Built entrypoints share one runtime `createFetcher` implementation identity
- Runtime stance in v1: wrapper over `ky`, not a `ky` fork

This package now ships as a normal dist-based library, not as a source-export-only prototype.

## Documentation map

- [Installation](#installation) and [public entrypoints](#public-entrypoints)
- [Quick start](#quick-start)
- [The shipped request contract](#the-shipped-request-contract)
- [Runtime behavior](#runtime-behavior)
- [Response inference](#response-inference)
- [API notes](#api-notes)
- [Migration from the old prototype shape](#migration-from-the-old-prototype-shape)
- [Development and release checks](#development-and-release-checks)

## Why this exists

Many typed API wrappers smooth over OpenAPI at the cost of losing `ky` ergonomics. They often eagerly parse JSON, hide request options behind a custom client shape, or replace `ky` with a separate runtime model.

`fetcher` takes the smaller approach:

1. keep a real `KyInstance`
2. add a very small runtime layer for route preparation
3. do as much work as possible in the type system
4. return normal `ky` `ResponsePromise` objects on the default surface

## Installation

Install `@ilokesto/fetcher` with `ky`.

```bash
pnpm add @ilokesto/fetcher ky
```

`ky` is a peer dependency.

## Public entrypoints

The package intentionally exposes a small entrypoint surface. Use the narrowest import that matches what you need.

| Import path | Use when | Public surface |
| --- | --- | --- |
| `@ilokesto/fetcher` | You want the full package surface from one import. | Re-exports the core ky-facing surface and the OpenAPI surface. |
| `@ilokesto/fetcher/core` | You want the ky wrapper without OpenAPI helper types. | `createFetcher`, ky types such as `Options` and `ResponsePromise`, and ky errors such as `HTTPError`. |
| `@ilokesto/fetcher/openapi` | You want OpenAPI-aware route typing. | `createFetcher` plus OpenAPI helper types such as `Fetcher`, `OpenApiRequest`, `InferJson`, and `MergePaths`. |

All built entrypoints share the same runtime `createFetcher` implementation identity. The release verifier imports `dist/index.js`, `dist/core.js`, and `dist/openapi.js` and asserts strict `===` identity so consumers do not get subtly different wrapper instances from different import paths.

## Quick start

```ts
import { createFetcher, type MergePaths } from '@ilokesto/fetcher/openapi';
import type { paths as GeneratedPaths } from './__generated__/openapi';

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

type ApiPaths = MergePaths<GeneratedPaths, ExtraPaths>;

const api = createFetcher<ApiPaths>({
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

const quote = await api
  .post('/bff/checkout/quote', {
    json: { cartId: 'cart_123', couponCode: 'WELCOME10' },
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
- top-level `formData` for `multipart/form-data` request bodies
- top-level `formUrlEncoded` for `application/x-www-form-urlencoded` request bodies
- optional third argument for normal `ky` options

### Body selection matrix

| OpenAPI request body | Shortcut property | Runtime body sent to `fetch` | Notes |
| --- | --- | --- | --- |
| `application/json` | `json` | `ky` `json` option | Grouped `json` shallow-merges with third-argument `json` only when both are strict plain objects. |
| `multipart/form-data` | `formData` | `FormData` | Multipart boundaries and `Content-Type` are left to the platform. |
| `application/x-www-form-urlencoded` | `formUrlEncoded` | `URLSearchParams` | Object values are stringified; arrays become repeated keys; `undefined` entries are skipped. |
| Explicit override | third-argument `body` or `json` | The explicit ky option | Raw `body` wins over every grouped body. Explicit `json` is the escape hatch for grouped form bodies. |

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

The runtime stays intentionally small: it prepares OpenAPI-shaped requests and then delegates network behavior to `ky`.

### Compatibility guarantees

- `ky` remains the HTTP runtime; this package does not fork or replace it.
- `create()`, `extend()`, hooks, `prefixUrl`, custom `fetch`, `HTTPError`, timeout behavior, and lazy body parsing keep following ky semantics.
- Public entrypoint paths stay `@ilokesto/fetcher`, `@ilokesto/fetcher/core`, and `@ilokesto/fetcher/openapi`.
- Typed shortcut methods use the grouped request contract documented here.
- Legacy flat shortcut aliases remain runtime-only compatibility for unknown or untyped calls.

### Path interpolation

`params.path` on shortcuts, and `path` on the callable surface, interpolate route templates before forwarding to `ky`.

Missing required path params throw immediately.

### `prefixUrl` with leading slashes

OpenAPI paths often start with `/`, while raw `ky` rejects leading slashes when `prefixUrl` is set.

`@ilokesto/fetcher` retries that specific `ky` error with the leading slash removed, so OpenAPI-style route literals still work with `prefixUrl`. This is a narrow `ky` compatibility shim for string inputs like `/users/{id}`. It is not a general URL rewrite layer, and it preserves query strings, hashes, and encoded path text such as `%2F`.

### `params.cookie` is type-only

`params.cookie` exists so route-level cookie parameters can participate in OpenAPI typing.

It is not serialized into request headers or any other runtime output. If you need real cookie behavior, handle it through your own runtime setup or normal `ky` options.

### Header merging

Typed top-level `headers` are merged with explicit `ky` headers from the third argument. Header keys are merged case-insensitively, and later explicit `ky` headers win on collisions.

### Body precedence and JSON merge boundary

An explicit raw `body` in the third `ky` options argument wins over grouped shortcut bodies. When `body` is present, grouped `json`, `formData`, and `formUrlEncoded` payloads are ignored.

The third argument also acts as an explicit `json` escape hatch for grouped form bodies. If a shortcut request provides `formData` or `formUrlEncoded` and the third `ky` options object provides `json`, the runtime sends that explicit `json` value instead of the grouped form body.

When a shortcut request provides `json` and the third `ky` options object also provides `json`, the runtime only shallow-merges them when both values are strict plain objects.

If either side is non-plain, such as an array, class instance, or `Date`, the explicit `kyOptions.json` value replaces the grouped request JSON.

### Multipart and `formData`

`formData` is only for multipart bodies. It becomes a real `FormData` body.

- passing an existing `FormData` instance keeps it as-is
- passing a plain object appends its fields into a new `FormData`
- array values append one entry per item
- `Blob` values are appended directly
- `undefined` entries are skipped

`@ilokesto/fetcher` does not force a multipart `Content-Type` header or set a boundary manually. It leaves that to the platform and `fetch`, which is the safe behavior for multipart requests.

### URL encoded bodies and `formUrlEncoded`

`formUrlEncoded` is for `application/x-www-form-urlencoded` bodies. It becomes a real `URLSearchParams` body, not `FormData`.

```ts
await api.post('/sessions', {
  formUrlEncoded: {
    username: 'ada',
    scope: ['read', 'write'],
  },
});
```

- passing an existing `URLSearchParams` instance keeps it as-is
- passing a plain object appends its fields into a new `URLSearchParams`
- array values append one repeated key per item
- `undefined` entries are skipped
- scalar values are stringified

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

### `createFetcher<Paths>()`

Supported overloads:

```ts
createFetcher<Paths>()
createFetcher<Paths>(defaultOptions: Options)
createFetcher<Paths>(instance: KyInstance)
```

### `Fetcher<Paths>`

The typed client keeps `ky` behavior while adding:

- typed callable requests
- typed shortcut methods for `get`, `post`, `put`, `patch`, and `delete`
- `safe` mirrors for the callable and those shortcut methods
- typed `create()` and `extend()` return values

`head` intentionally remains on the plain `ky` surface in v1. It is available at runtime, but it does not get the OpenAPI shortcut typing that the other methods have.

### Public OpenAPI types

The package exports these OpenAPI helper types from `@ilokesto/fetcher/openapi` and from the root package entrypoint:

| Type | Purpose |
| --- | --- |
| `Fetcher<Paths>` | The typed client surface returned by `createFetcher<Paths>()`. |
| `OpenApiRequest` | The typed shortcut request shape for an OpenAPI path and method. |
| `OpenApiRequestOptions` | The ky-compatible options shape after OpenAPI request typing is applied. |
| `OpenApiOptions` | OpenAPI-aware options accepted by `createFetcher`. |
| `OpenApiContext` | Metadata injected into `options.context.openapi` for hooks and observability. |
| `OpenApiHttpMethod` | The supported lowercase OpenAPI method union used by typed shortcuts. |
| `PathTemplateParams` | Extracts route-template parameter names from a path literal. |
| `PathsLike` | Minimal OpenAPI paths-map constraint used by helper generics. |
| `InferJson` | Infers the `.json()` result type from OpenAPI response content. |
| `MergePaths` | Combines generated paths with app-local additions at path and method-map depth. |
| `SafeResult` | Result union returned by the non-throwing `safe` surface. |

### `MergePaths<Base, Extra>`

`MergePaths` is a shallow OpenAPI path-map helper for combining generated paths with app-local additions.

- paths that exist only in `Base` are preserved
- paths that exist only in `Extra` are added
- when a path exists in both, method maps are merged
- when the same path and method exist in both, the `Extra` operation replaces the `Base` operation wholesale

It does not deep-merge operation internals such as `parameters`, `requestBody`, or `responses`.

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
- use top-level `formData` for multipart request bodies
- use top-level `formUrlEncoded` for URL encoded request bodies
- keep plain `ky` overrides in the third argument

The callable client remains closer to raw `ky`, so this migration guidance is specifically about typed shortcut methods.

For runtime compatibility, unknown or untyped shortcut calls still understand legacy flat `path`, `query`, `cookie`, and `header` aliases. That compatibility is intentionally runtime-only. The typed shortcut contract is grouped `params` and top-level `headers`, and TypeScript rejects those flat aliases on typed shortcut calls.

## Wrapper stance

`@ilokesto/fetcher` is intentionally a wrapper-first package in v1.

- `ky` remains the runtime core
- the package does not ship a `ky` fork
- `bindClientHooks` is not a shipped feature
- hook and extension behavior should keep feeling like normal `ky`

If deeper runtime divergence is needed later, that can be evaluated separately. It is not part of the current shipped contract.

## Development and release checks

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:dist
```

`pnpm test:dist` must run after `pnpm build`. It verifies the built package surface, including strict `createFetcher` identity across the root, core, and OpenAPI entrypoints. CI runs these checks on Node 22, which matches the package engine requirement.

## Current limitations

- `head` remains plain `ky` typing in v1
- `params.cookie` is type-only and intentionally not serialized
- response inference only considers `200`, `201`, `204`, and `default`
- this package does not claim automatic auth or cookie management
