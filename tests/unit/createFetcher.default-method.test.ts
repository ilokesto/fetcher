import ky, { type Options } from 'ky';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createFetcher } from '../../src/openapi';
import type { DefaultMethodPaths, ReadResult, WriteResult } from '../fixtures/default-method';

describe('createFetcher callable method contract', () => {
  it.each([
    ['defaults', 'POST'],
    ['wrapped', 'POST'],
    ['extend', 'PUT'],
    ['callback', 'PATCH'],
    ['create', 'POST'],
    ['mutated', 'DELETE'],
    ['cleared', 'GET'],
    ['fresh-create', 'GET'],
  ] as const)('%s: defaults and explicit methods -> preserve ky dispatch and operation data', async (source, inheritedMethod) => {
    const seen: Array<{ method: string; metadata: unknown }> = [];
    const options: Options = {
      prefixUrl: 'https://example.com',
      hooks: {
        beforeRequest: [(request, normalized) => {
          seen.push({ method: request.method, metadata: normalized.context.openapi });
        }],
      },
      fetch: async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        if (request.method === 'GET') {
          return Response.json({ kind: 'read' });
        }
        const body = await request.json() as { value: string };
        return Response.json({ kind: 'write', value: body.value });
      },
    };
    const parent = createFetcher<DefaultMethodPaths>({ ...options, method: 'POST' });
    const instance = ky.create({ ...options, method: 'POST' });
    const mutated = createFetcher<DefaultMethodPaths>(instance);
    instance.extend((defaults) => {
      defaults.method = 'DELETE';
      return {};
    });
    const clients = {
      defaults: parent,
      wrapped: createFetcher<DefaultMethodPaths>(ky.create({ ...options, method: 'POST' })),
      extend: parent.extend({ method: 'PUT' }),
      callback: parent.extend(() => ({ method: 'PATCH' })),
      create: parent.create({ ...options, method: 'POST' }),
      mutated,
      cleared: parent.extend({ method: undefined }),
      'fresh-create': parent.create(options),
    };
    const api = clients[source];
    const rawUrl: string = '/resources';
    const inheritedOptions = inheritedMethod === 'GET' ? undefined : { json: { value: 'inherited' } };

    const inherited = await api(rawUrl, inheritedOptions).json();
    const inheritedSafe = await api.safe(rawUrl, inheritedOptions);
    const read = await api('/resources', { method: 'GET' }).json();
    const safeRead = await api.safe('/resources', { method: 'get' });
    const write = await api('/resources', { method: 'POST', json: { value: 'explicit' } }).json();
    const safeWrite = await api.safe('/resources', { method: 'post', json: { value: 'explicit' } });
    const shortcut = await api.get('/resources', {}).json();

    const expectedInherited = inheritedMethod === 'GET'
      ? { kind: 'read' }
      : { kind: 'write', value: 'inherited' };
    expect(inherited).toEqual(expectedInherited);
    expect(inheritedSafe).toMatchObject({ ok: true, data: expectedInherited });
    expect(read).toEqual({ kind: 'read' });
    expect(safeRead).toMatchObject({ ok: true, data: { kind: 'read' } });
    expect(write).toEqual({ kind: 'write', value: 'explicit' });
    expect(safeWrite).toMatchObject({ ok: true, data: { kind: 'write', value: 'explicit' } });
    expect(shortcut).toEqual(read);
    expectTypeOf(read).toEqualTypeOf<ReadResult>();
    expectTypeOf(write).toEqualTypeOf<WriteResult>();
    expect(seen.map(({ method }) => method)).toEqual([
      inheritedMethod, inheritedMethod, 'GET', 'GET', 'POST', 'POST', 'GET',
    ]);
    expect(seen.every(({ method, metadata }) =>
      (metadata as { method: string }).method === method.toLowerCase(),
    )).toBe(true);
  });
});
