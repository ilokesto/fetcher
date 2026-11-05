import ky from 'ky';
import { expectTypeOf } from 'vitest';
import { createFetcher } from '../../src/openapi';
import type { SafeResult } from '../../src/openapi';
import type { DefaultMethodPaths, ReadResult, WriteResult } from '../fixtures/default-method';

// Compile-only: mutable ky defaults cannot prove an operation's request or response type.
export function assertDefaultMethodContracts(): void {
  const instance = ky.create({ method: 'POST' });
  const api = createFetcher<DefaultMethodPaths>({ method: 'POST', json: { value: 'default' } });
  const wrapped = createFetcher<DefaultMethodPaths>(instance);
  const clients = [
    api,
    wrapped,
    createFetcher<DefaultMethodPaths>(),
    createFetcher<DefaultMethodPaths>({ method: 'GET' }),
    api.extend({}),
    api.extend({ method: 'POST' }),
    api.extend((defaults) => ({ method: defaults.method })),
    api.extend({ method: undefined }),
    api.create({ method: 'POST' }),
    api.create(),
  ];
  instance.extend((defaults) => {
    defaults.method = 'PATCH';
    return {};
  });

  for (const client of clients) {
    // @ts-expect-error omitted method cannot prove GET when defaults can change
    client('/resources');
    // @ts-expect-error an empty options object cannot prove GET either
    client('/resources', {});
    // @ts-expect-error safe calls must not infer a GET response from unknown defaults
    client.safe('/resources');
    // @ts-expect-error safe options must also select an operation
    client.safe('/resources', {});

    const missingBody = { method: 'POST' as const };
    // @ts-expect-error a non-literal options object must not bypass the required POST body
    client('/resources', missingBody);
    // @ts-expect-error safe requests require the body even when defaults contain JSON
    client.safe('/resources', missingBody);
    // @ts-expect-error explicit POST still requires its operation's JSON body
    client('/resources', { method: 'POST' });
    // @ts-expect-error an invalid body must not fall back to a GET overload
    client.safe('/resources', { method: 'post', json: { value: 42 } });
    // @ts-expect-error another route's payload cannot widen the selected path
    client('/resources', { method: 'POST', json: { other: true } });
    // @ts-expect-error a registered path cannot fall back to an unsupported method
    client.safe('/resources', { method: 'DELETE' });

    const uncertainMethod = Math.random() < 0.5 ? 'GET' : 'POST';
    // @ts-expect-error a union method without its correlated POST body is unsafe
    client('/resources', { method: uncertainMethod });
    // @ts-expect-error safe requests also require a correlated method/body pair
    client.safe('/resources', { method: uncertainMethod });

    expectTypeOf(client('/resources', { method: 'GET' }).json()).toEqualTypeOf<Promise<ReadResult>>();
    expectTypeOf(client('/resources', {
      method: 'post', json: { value: 'request' },
    }).json()).toEqualTypeOf<Promise<WriteResult>>();
    expectTypeOf(client.safe('/resources', {
      method: 'get',
    })).toEqualTypeOf<Promise<SafeResult<ReadResult>>>();
    expectTypeOf(client.safe('/resources', {
      method: 'POST', json: { value: 'request' },
    })).toEqualTypeOf<Promise<SafeResult<WriteResult>>>();
    expectTypeOf(client.get('/resources', {}).json()).toEqualTypeOf<Promise<ReadResult>>();
    expectTypeOf(client.safe.post('/resources', {
      json: { value: 'request' },
    })).toEqualTypeOf<Promise<SafeResult<WriteResult>>>();

    const readOptions = { method: 'GET' as const };
    const writeOptions = { method: 'post' as const, json: { value: 'variable' } };
    expectTypeOf(client('/resources', readOptions).json()).toEqualTypeOf<Promise<ReadResult>>();
    expectTypeOf(client('/resources', writeOptions).json()).toEqualTypeOf<Promise<WriteResult>>();
    const correlatedOptions = Math.random() < 0.5 ? readOptions : writeOptions;
    expectTypeOf(client('/resources', correlatedOptions).json()).toEqualTypeOf<
      Promise<ReadResult | WriteResult>
    >();

    const wideUrl: string = '/resources';
    expectTypeOf(client(wideUrl).json()).toEqualTypeOf<Promise<unknown>>();
    expectTypeOf(client.safe(wideUrl)).toEqualTypeOf<Promise<SafeResult<unknown>>>();
    expectTypeOf(client('/unregistered').json()).toEqualTypeOf<Promise<unknown>>();
    expectTypeOf(client.safe('/unregistered')).toEqualTypeOf<Promise<SafeResult<unknown>>>();
    client(new URL('https://example.com/resources'));
    client.safe(new Request('https://example.com/resources', { method: 'POST' }));
  }
}
