import ky from 'ky';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createFetcher as createFetcherFromRoot } from '.';
import { createFetcher as createFetcherFromCore } from './core';
import { createFetcher } from './openapi';
import type { Fetcher } from './openapi';
import type { ApiPaths } from './test-fixtures/createFetcher';

describe('createFetcher barrel and ky surface parity', () => {
  it('keeps extend typed and preserves inherited ky defaults', async () => {
    const authorizationValues: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        const authorization = request.headers.get('authorization');

        if (authorization) {
          authorizationValues.push(authorization);
        }

        return new Response(JSON.stringify({ total: 12000, currency: 'KRW', discountApplied: true }), {
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
      .post('/bff/checkout/quote', {
        json: {
          cartId: 'cart_123',
          couponCode: 'WELCOME10',
        },
      })
      .json();

    expect(payload).toEqual({ total: 12000, currency: 'KRW', discountApplied: true });
    expect(authorizationValues).toEqual(['Bearer token']);
    expectTypeOf(authed).toEqualTypeOf<Fetcher<ApiPaths>>();
  });

  it('keeps create typed and returns a usable derived client', async () => {
    const seenUrls: string[] = [];
    const seenHeaders: string[] = [];

    const api = createFetcher<ApiPaths>({
      prefixUrl: 'https://example.com/api',
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);

        seenUrls.push(request.url);
        seenHeaders.push(request.headers.get('x-created') ?? '');

        return new Response(JSON.stringify({ total: 9000, currency: 'KRW', discountApplied: true }), {
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

        return new Response(JSON.stringify({ total: 9000, currency: 'KRW', discountApplied: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      },
    });

    const payload = await derived
      .post('/bff/checkout/quote', {
        json: {
          cartId: 'cart_123',
          couponCode: 'WELCOME10',
        },
      })
      .json();

    expect(payload).toEqual({ total: 9000, currency: 'KRW', discountApplied: true });
    expect(seenUrls).toEqual(['https://example.com/api/bff/checkout/quote']);
    expect(seenHeaders).toEqual(['yes']);
    expectTypeOf(derived).toEqualTypeOf<Fetcher<ApiPaths>>();
  });

  it('supports direct callable usage with inferred method typing', async () => {
    const api = createFetcher<ApiPaths>({
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

    const api = createFetcher<ApiPaths>({
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

    const api = createFetcher<ApiPaths>(instance);
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

  it('keeps the root, core, and openapi barrels aligned', () => {
    expect(createFetcherFromCore).toBe(createFetcher);
    expect(createFetcherFromRoot).toBe(createFetcher);
  });

  it('exposes inferred json types for shortcut and callable forms', () => {
    const api = createFetcher<ApiPaths>({
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
    const quoteResponse = api.post('/bff/checkout/quote', {
      json: {
        cartId: 'cart_123',
        couponCode: 'WELCOME10',
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
    expectTypeOf(quoteResponse.json()).toEqualTypeOf<
      Promise<{
        total: number;
        currency: 'KRW' | 'USD';
        discountApplied: boolean;
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
});
