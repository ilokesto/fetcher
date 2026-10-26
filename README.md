# @ilokesto/fetcher

A thin OpenAPI-aware wrapper around ky, with typed requests and inferred JSON responses.

[![npm](https://img.shields.io/npm/v/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](https://www.npmjs.com/package/@ilokesto/fetcher)
[![License](https://img.shields.io/npm/l/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](./LICENSE)

[Docs](https://ilokesto.ayden94.com/en/fetcher) | [API](./docs/reference/create-fetcher.mdx) | [한국어](./README.ko.md)

- Keep ky hooks, retries, `create()`, `extend()`, and lazy response parsing.
- Type route templates, grouped parameters, and JSON or form bodies from OpenAPI.
- Choose throwing requests or non-throwing `safe` results with parsed data.

## Installation

Requires Node.js 22+ and the `ky ^1.14.0` peer dependency.

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

`.json()` infers `User` without a response generic. Use [generated OpenAPI types](./docs/guides/generated-openapi.mdx) for larger APIs; [response inference](./docs/advanced/response-inference.mdx) explains status selection.

The default client throws on HTTP failures. `params.cookie` is type-only, not automatic cookie or auth management. Typed `head` stays lazy and has no `safe.head`; OPTIONS uses the callable client, not `api.options()`.

## Further reading

- [Grouped requests and parameter handling](./docs/reference/request-grouped-request.mdx)
- [JSON, forms, and body precedence](./docs/reference/request-bodies.mdx)
- [Error handling and safe results](./docs/reference/safe.mdx)
- [prefixUrl and leading-slash behavior](./docs/advanced/prefix-url.mdx)
- [Migration from ky and prototype request shapes](./docs/advanced/migration.mdx)

<details>
<summary>Development</summary>

Use Node 22 and pnpm 10.17.1 from this repository root. No sibling checkout is required.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test:types
pnpm test
pnpm test:dist
pnpm test:tooling
pnpm migrate:verify
pnpm docs:publication:verify
pnpm docs:typecheck
pnpm docs:build
pnpm docs:test
```

`test:types` compiles the type-contract cases without executing requests; `test` runs runtime tests. `test:dist` runs after `build`: it checks entrypoint identity and packed-consumer HEAD/OPTIONS contracts. Install the docs browser once with `pnpm --dir website exec playwright install chromium`; preview with `pnpm docs:start --hostname 127.0.0.1 --port 0`.

Canonical bilingual docs live in `docs/`; `website/` renders them. Released examples use the exact npm identity in `docs-publication/active.json`; `/en/fetcher/next` and `/ko/fetcher/next` use this checkout. Schema 1/2 archives are immutable; new captures require explicit schema 3 standalone layout and a reviewed release catalog entry.

`pnpm release:verify --sha <full-SHA>` checks live GitHub Verify evidence, its packed artifact, main, and registry state without publishing. It requires remote bootstrap and exact-SHA CI verification. Pull requests run Verify CI. Main merges create or update a Changesets release PR; merging
that PR publishes only the exact successful Verify artifact through GitHub Actions. Enable
`Allow GitHub Actions to create and approve pull requests` and configure `NPM_TOKEN` in the
`Production` environment before rollout. Never publish locally or deploy documentation.

</details>
