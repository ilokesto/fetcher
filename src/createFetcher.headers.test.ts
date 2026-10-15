import ky, { type Options } from 'ky';
import { describe, expect, it } from 'vitest';
import { createFetcher } from './openapi';

describe('createFetcher header deletion', () => {
  const deletionHeaders: Array<NonNullable<Options['headers']>> = [
    { 'X-Token': undefined },
    new Headers({ 'X-Token': 'undefined' }),
    [['X-Token', 'undefined']],
  ];

  it.each(deletionHeaders)('preserves explicit header deletion for %j', async (headers) => {
    const seenHeaders: Headers[] = [];
    const instance = ky.create({
      headers: { 'x-token': 'default-token', 'x-keep': 'default-kept' },
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenHeaders.push(request.headers);
        return Response.json({ ok: true });
      },
    });
    const api = createFetcher(instance);

    await api.get('https://example.com', {
      headers: { 'x-token': 'grouped-token', 'x-request': 'request-kept' },
    }, { headers });

    expect(seenHeaders[0]?.has('x-token')).toBe(false);
    expect(seenHeaders[0]?.get('x-keep')).toBe('default-kept');
    expect(seenHeaders[0]?.get('x-request')).toBe('request-kept');
  });

  it('preserves grouped deletion and later explicit replacement on safe shortcuts', async () => {
    const seenHeaders: Headers[] = [];
    const api = createFetcher({
      headers: { 'x-token': 'default-token', 'x-remove': 'default-remove' },
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        seenHeaders.push(request.headers);
        return Response.json({ ok: true });
      },
    });

    const result = await api.safe.get('https://example.com', {
      headers: { 'X-Token': undefined, 'X-Remove': undefined },
    }, { headers: { 'x-token': 'explicit-token' } });

    expect(result.ok).toBe(true);
    expect(seenHeaders[0]?.get('x-token')).toBe('explicit-token');
    expect(seenHeaders[0]?.has('x-remove')).toBe(false);
  });
});
