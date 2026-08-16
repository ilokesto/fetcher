import { expectTypeOf } from 'vitest';
import type { Options } from 'ky';
import type { Fetcher, OpenApiOptions, OpenApiRequest } from '../openapi';

type HeadResponse = {
  readonly available: true;
  readonly revision: string;
};

export type HeadPaths = {
  readonly '/resources/{resourceId}': {
    readonly head: {
      readonly parameters: {
        readonly path: {
          readonly resourceId: string;
        };
        readonly query: {
          readonly revision: number;
        };
        readonly header: {
          readonly 'x-tenant-id': string;
        };
        readonly cookie: {
          readonly session: string;
        };
      };
      readonly responses: {
        readonly 200: {
          readonly content: {
            readonly 'application/json': HeadResponse;
          };
        };
      };
    };
  };
  readonly '/capabilities/{resourceId}': {
    readonly options: {
      readonly parameters: {
        readonly path: {
          readonly resourceId: string;
        };
        readonly query: {
          readonly verbose: boolean;
        };
        readonly header: {
          readonly 'x-capability-token': string;
        };
        readonly cookie: {
          readonly session: string;
        };
      };
      readonly responses: {
        readonly 200: {
          readonly content: {
            readonly 'application/json': {
              readonly methods: readonly ['GET', 'HEAD', 'OPTIONS'];
            };
          };
        };
      };
    };
  };
};

type HeadRequest = OpenApiRequest<HeadPaths, '/resources/{resourceId}', 'head'>;
type OptionsRequest = OpenApiOptions<HeadPaths, '/capabilities/{resourceId}', 'options'>;

export const assertTypedHeadAndCallableOptions = (api: Fetcher<HeadPaths>) => {
  const headResponse = api.head('/resources/{resourceId}', {
    params: {
      path: { resourceId: 'resource-1' },
      query: { revision: 7 },
      cookie: { session: 'session-1' },
    },
    headers: { 'x-tenant-id': 'tenant-1' },
  });
  const optionsResponse = api('/capabilities/{resourceId}', {
    method: 'OPTIONS',
    path: { resourceId: 'resource-1' },
    searchParams: { verbose: true },
    headers: { 'x-capability-token': 'capability-token' },
    cookie: { session: 'session-1' },
  });
  const unknownResponse = api('/unknown', {
    headers: { authorization: 'Bearer token' },
    searchParams: { probe: 'ready' },
  });

  expectTypeOf(headResponse.json()).toEqualTypeOf<Promise<HeadResponse>>();
  expectTypeOf(optionsResponse.json()).toEqualTypeOf<
    Promise<{ readonly methods: readonly ['GET', 'HEAD', 'OPTIONS'] }>
  >();
  expectTypeOf(unknownResponse.json()).toEqualTypeOf<Promise<unknown>>();

  expectTypeOf<{
    readonly method: 'OPTIONS';
    readonly searchParams: { readonly verbose: boolean };
    readonly headers: { readonly 'x-capability-token': string };
    readonly cookie: { readonly session: string };
  }>().not.toMatchTypeOf<OptionsRequest>();
  expectTypeOf<{
    readonly method: 'OPTIONS';
    readonly path: { readonly resourceId: string };
    readonly headers: { readonly 'x-capability-token': string };
    readonly cookie: { readonly session: string };
  }>().not.toMatchTypeOf<OptionsRequest>();

  expectTypeOf<{
    readonly params: {
      readonly query: { readonly revision: number };
      readonly cookie: { readonly session: string };
    };
    readonly headers: { readonly 'x-tenant-id': string };
  }>().not.toMatchTypeOf<HeadRequest>();
  expectTypeOf<{
    readonly params: {
      readonly path: { readonly resourceId: string };
      readonly cookie: { readonly session: string };
    };
    readonly headers: { readonly 'x-tenant-id': string };
  }>().not.toMatchTypeOf<HeadRequest>();
  expectTypeOf<{
    readonly params: {
      readonly path: { readonly resourceId: string };
      readonly query: { readonly revision: number };
      readonly cookie: { readonly session: string };
    };
  }>().not.toMatchTypeOf<HeadRequest>();
  expectTypeOf<{
    readonly params: {
      readonly path: { readonly resourceId: string };
      readonly query: { readonly revision: number };
    };
    readonly headers: { readonly 'x-tenant-id': string };
  }>().not.toMatchTypeOf<HeadRequest>();

  api.head('/health', {
    headers: { authorization: 'Bearer token' },
    searchParams: { probe: 'ready' },
  } satisfies Options);

  expectTypeOf<'options' extends keyof Fetcher<HeadPaths> ? true : false>().toEqualTypeOf<false>();
  expectTypeOf<'head' extends keyof Fetcher<HeadPaths>['safe'] ? true : false>().toEqualTypeOf<false>();
};
