# @ilokesto/fetcher

A thin OpenAPI-aware wrapper around ky, with typed requests and inferred JSON responses.

[![npm](https://img.shields.io/npm/v/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](https://www.npmjs.com/package/@ilokesto/fetcher)
[![License](https://img.shields.io/npm/l/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](./LICENSE)

[한국어](./README.ko.md)

- Keep ky hooks, retries, `create()`, `extend()`, and lazy response parsing.
- Type route templates, grouped parameters, and JSON or form bodies from OpenAPI.
- Choose throwing requests or non-throwing `safe` results with parsed data.

## Installation

Requires Node.js 24.22.1+ and the `ky ^1.14.0` peer dependency.

```bash
pnpm add @ilokesto/fetcher ky@^1.14.0
```

## Quick start

This example defines its schema inline; point `prefixUrl` at your API.

```ts
import { createFetcher } from '@ilokesto/fetcher/openapi';

type User = { id: string; name: string };

type Paths = {
  '/users/{id}': {
    get: {
      parameters: {
        path: { id: string };
        query?: { include?: 'profile' };
      };
      responses: {
        200: { content: { 'application/json': User } };
      };
    };
  };
};

const api = createFetcher<Paths>({
  prefixUrl: 'https://api.example.com',
});

const user = await api
  .get('/users/{id}', {
    params: {
      path: { id: '42' },
      query: { include: 'profile' },
    },
  })
  .json();

console.log(user.name);
```

`.json()` infers `User` without a response generic. Use generated OpenAPI types for larger APIs.

Response inference unions JSON schemas from all declared 200-299 statuses, using numeric or string keys and the OpenAPI `2XX` range. Exact status declarations override the range. When no success response supplies JSON, inference falls back to `default` JSON, then `unknown`. For multiple success shapes, narrow the resulting union before reading fields specific to one shape.

Registered typed paths require an explicit HTTP `method` on callable and `safe` callable requests, even when the client's default is GET. This also applies to wrapped ky instances and clients returned by `extend()` or `create()`. The method selects the request contract, required JSON body and inferred response. Supply required request fields at the call site, even when defaults already contain values.

To migrate `api('/x')`, use `api('/x', { method: 'GET' })` or `api.get('/x', envelope)`. Use `api.safe('/x', { method: 'GET' })` or `api.safe.get('/x', envelope)` for safe requests. Keep direct-call `path` and `searchParams` in ky-style options; shortcuts use `params.path` and `params.query`:

```ts
const sameUser = await api('/users/{id}', {
  method: 'GET',
  path: { id: '42' },
}).json();

const safeUser = await api.safe.get('/users/{id}', {
  params: { path: { id: '42' } },
});
```

This is an intentional type compatibility change released as a minor update during beta. Shortcuts retain their existing signatures. Unregistered or wide string URLs and `URL`/`Request` inputs keep ky's runtime default-method behavior; their response type remains untyped unless a response generic is supplied.

The default client throws on HTTP failures. `params.cookie` is type-only, not automatic cookie or auth management. Typed `head` stays lazy and has no `safe.head`; OPTIONS uses the callable client, not `api.options()`.

<details>
<summary>Development</summary>

Use Node 24.22.1 and pnpm 10.17.1 from this repository root. No sibling checkout is required.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

`pnpm test` builds once and runs unit, type, tooling, and packed-consumer checks. Tests live under `tests/unit`, `tests/types`, `tests/tooling`, and `tests/fixtures`. Use `test:unit`, `test:types`, `test:tooling`, or `test:pack` to run an individual suite; build before running `test:pack` alone.

Follow [JSDOC.md](./JSDOC.md) when changing public APIs. `pnpm lint:jsdoc` checks runtime exports, owned nested fields and callable controls without expanding ky/Fetch internals; `test:tooling` enforces it. Public declaration documentation needs a patch Changeset.

`pnpm release:verify --sha <full-SHA>` checks live GitHub Verify evidence, its packed artifact, main, and registry state without publishing. It requires remote bootstrap and exact-SHA CI verification. Pull requests run Verify CI. Main merges create or update a Changesets release PR; merging
that PR publishes only the exact successful Verify artifact through GitHub Actions. Enable
`Allow GitHub Actions to create and approve pull requests` and configure `NPM_TOKEN` in the
`Production` environment before rollout. Never publish locally.

</details>
