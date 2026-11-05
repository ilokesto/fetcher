import { expectTypeOf } from 'vitest';
import { createFetcher } from '../../src/openapi';
import type { InferJson, SafeResult } from '../../src/openapi';
import type { ApiPaths } from '../fixtures/createFetcher';
import type {
  Accepted, JsonResponse, Ready, ResponseError, SuccessResponsePaths,
} from '../fixtures/success-responses';

type InferResponses<Responses> = InferJson<
  { '/resource': { get: { responses: Responses } } }, '/resource', 'get'
>;
type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type StatusString = `2${Digit}${Digit}`;
type StatusNumber = StatusString extends `${infer Status extends number}` ? Status : never;

// Compile-only: each success status and public response surface must retain its JSON schema.
export function assertSuccessResponseContracts(): void {
  expectTypeOf<{
    [Status in StatusNumber]: InferResponses<{ [Code in Status]: JsonResponse<{ status: Status }> }>
  }>().toEqualTypeOf<{ [Status in StatusNumber]: { status: Status } }>();
  expectTypeOf<{
    [Status in StatusString]: InferResponses<{ [Code in Status]: JsonResponse<{ status: Status }> }>
  }>().toEqualTypeOf<{ [Status in StatusString]: { status: Status } }>();

  expectTypeOf<InferResponses<{
    202: JsonResponse<Accepted>; default: JsonResponse<ResponseError>;
  }>>().toEqualTypeOf<Accepted>();
  expectTypeOf<InferResponses<{
    readonly 200: JsonResponse<Ready>;
    readonly '201': JsonResponse<Accepted>;
    readonly 206: { content: { 'application/vnd.example+json': { partial: true } } };
    readonly 204: { content?: never };
    readonly 302: JsonResponse<{ redirect: true }>;
    readonly 404: JsonResponse<ResponseError>;
    readonly default: JsonResponse<ResponseError>;
  }>>().toEqualTypeOf<Ready | Accepted | { partial: true }>();
  expectTypeOf<InferResponses<{ '2XX': JsonResponse<Accepted> }>>().toEqualTypeOf<Accepted>();
  expectTypeOf<InferResponses<{
    200: JsonResponse<Ready>; '2XX': JsonResponse<Accepted>;
  }>>().toEqualTypeOf<Ready | Accepted>();
  expectTypeOf<InferResponses<
    { [Status in StatusNumber]: { content: never } } & { '2XX': JsonResponse<Accepted> }
  >>().toEqualTypeOf<unknown>();

  expectTypeOf<InferResponses<{ default: JsonResponse<ResponseError> }>>().toEqualTypeOf<ResponseError>();
  expectTypeOf<InferResponses<{
    204: { content?: never }; default: JsonResponse<ResponseError>;
  }>>().toEqualTypeOf<ResponseError>();
  expectTypeOf<InferResponses<{ 204: { content?: never } }>>().toEqualTypeOf<unknown>();
  expectTypeOf<InferResponses<{ 200: { content: { 'text/plain': string } } }>>().toEqualTypeOf<unknown>();
  expectTypeOf<InferResponses<{ 202: JsonResponse<null> }>>().toEqualTypeOf<null>();
  expectTypeOf<InferResponses<{
    199: JsonResponse<Ready>; '300': JsonResponse<Ready>; 2020: JsonResponse<Ready>;
    '2xx': JsonResponse<Ready>; '202.5': JsonResponse<Ready>; default: JsonResponse<ResponseError>;
  }>>().toEqualTypeOf<ResponseError>();
  expectTypeOf<InferJson<ApiPaths, '/imports', 'post'>>().toEqualTypeOf<{ accepted: true }>();

  const api = createFetcher<SuccessResponsePaths>();
  expectTypeOf(api.post('/jobs', {}).json()).toEqualTypeOf<Promise<Accepted>>();
  expectTypeOf(api('/jobs', { method: 'POST' }).json()).toEqualTypeOf<Promise<Accepted>>();
  expectTypeOf(api.safe.post('/jobs', {})).toEqualTypeOf<Promise<SafeResult<Accepted>>>();
  expectTypeOf(api.safe('/jobs', { method: 'POST' })).toEqualTypeOf<Promise<SafeResult<Accepted>>>();
  expectTypeOf(api.get('/items', {}).json()).toEqualTypeOf<Promise<Ready | Accepted>>();
  expectTypeOf(api.safe.get('/items', {})).toEqualTypeOf<Promise<SafeResult<Ready | Accepted>>>();
}
