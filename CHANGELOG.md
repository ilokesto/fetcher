# @ilokesto/fetcher

## 1.1.0

### Minor Changes

- 0dc14ef: Require an explicit HTTP method on callable and safe callable requests for registered typed paths, even when the client's default is GET. Migrate `api('/x')` to `api('/x', { method: 'GET' })` or `api.get('/x', envelope)`, and use the matching safe form.

  Infer the response from the selected method and enforce its required request body, including options held in variables. Shortcuts and ky runtime defaults for unregistered or wide URLs and URL/Request inputs remain unchanged. This intentional type compatibility change ships as a minor release during beta by explicit user decision.

### Patch Changes

- 73a420b: Infer JSON from all numeric and string 200-299 response keys and OpenAPI 2XX ranges before considering default responses. Return the union of declared success JSON schemas instead of preferring one status, while preserving default/unknown fallback and runtime request behavior.
- b3f9815: Reject path parameters that create standalone dot path segments before sending a request, preventing URL normalization from changing the target endpoint. Preserve dotted identifiers, query and fragment values, and normal percent encoding.

## 1.0.5

### Patch Changes

- 4ebebbd: Document the OpenAPI-aware client, safe results and owned facade controls in emitted TypeScript declarations.

## 1.0.4

### Patch Changes

- 7567c2e: Require Node.js 24.22.1 or newer and use the security-patched 24.22.1 release for development and CI.

## 1.0.3

### Patch Changes

- 34de277: Separate grouped request normalization from ky request preparation while preserving request headers, body precedence, path interpolation, and OpenAPI context behavior.

## 1.0.2

### Patch Changes

- e747b9a: Keep optional OpenAPI request bodies optional for JSON, multipart, and URL-encoded requests while preserving required payload checks.

  Preserve header deletion markers when grouped shortcut headers are merged with explicit ky options, including removal of inherited default headers.

  Align OpenAPI method metadata with ky instance defaults, explicit overrides, and Request input methods across callable, safe, create, and extend surfaces.

## 1.0.1

### Patch Changes

- b4d905e: Remove an intermediate compatibility request conversion while preserving canonical field precedence and legacy aliases.

## 1.0.0

### Minor Changes

- 4f7e245: Add OpenAPI-aware typed HEAD shortcuts while keeping OPTIONS on the callable client surface.

### Patch Changes

- c850635: Introduce Changesets for automated versioning and changelog management
- d483084: Relax `PathsLike` constraint from `Record<string, ...>` to `object` so canonical OpenAPI generators (e.g. `openapi-typescript`) that emit `interface paths { '/users': ... }` satisfy the generic constraint. TypeScript interfaces do not have implicit string index signatures, so the previous `Record<string, ...>` constraint rejected them.
- bb26d48: Point package repository links to the ilokesto organization monorepo and update the fetcher homepage before retiring the legacy repositories.
