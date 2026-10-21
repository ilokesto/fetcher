import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveInstalledPackage } from '../../scripts/docs-runtime.mjs';
import { scopeDevelopmentLink, getDocsChannel, publishedPackages } from '../lib/publication.ts';
import { publicPackageNames, rewriteDocsLink, rewriteMarkdownLinks } from '../lib/docs-links.ts';

test('released Fetcher: pinned npm runtime -> real success and error results', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const installed = await resolveInstalledPackage('@ilokesto/released-fetcher', path.join(root, 'docs-publication/runtime'));
  assert.equal(installed.manifest.version, publishedPackages.fetcher.version);
  assert.ok(installed.directory.startsWith(path.join(root, 'node_modules')));
  const { createFetcher } = await import(pathToFileURL(path.join(installed.directory, 'dist/index.js')).href);
  const requests = [];
  const api = createFetcher({
    prefixUrl: 'https://example.test',
    retry: 0,
    fetch: async input => {
      const request = input instanceof Request ? input : new Request(input);
      requests.push(request.url);
      return Response.json({ id: '42' }, { status: request.url.endsWith('/error') ? 503 : 200 });
    },
  });

  const success = await api.safe.get('/users/{id}', { params: { path: { id: '42' } } });
  const failure = await api.safe.get('/error');

  assert.equal(success.ok, true);
  assert.deepEqual(success.data, { id: '42' });
  assert.equal(failure.ok, false);
  assert.equal(failure.response.status, 503);
  assert.deepEqual(requests, ['https://example.test/users/42', 'https://example.test/error']);
});

test('development links: complete public classification -> locale and channel preserved', () => {
  assert.equal(publicPackageNames.length, 8);
  for (const name of publicPackageNames) {
    const host = name === 'fetcher' ? '' : 'https://ilokesto.ayden94.com';
    assert.equal(scopeDevelopmentLink(`/en/${name}/quick-start#install`), `${host}/en/${name}/next/quick-start#install`);
    assert.equal(scopeDevelopmentLink(`/ko/${name}?x=1`), `${host}/ko/${name}/next?x=1`);
    assert.equal(scopeDevelopmentLink(`/en/${name}/next/quick-start`), `${host}/en/${name}/next/quick-start`);
    assert.equal(rewriteDocsLink(`/ko/${name}/next/core-concepts`, false, 'fetcher'), `${host}/ko/${name}/next/core-concepts`);
  }
  assert.equal(getDocsChannel(['fetcher']), 'released');
  assert.equal(getDocsChannel(['fetcher', 'next']), 'next');
  assert.equal(getDocsChannel(['modal', 'next']), undefined);
  assert.equal(scopeDevelopmentLink('https://example.com/en/store'), 'https://example.com/en/store');
  assert.equal(scopeDevelopmentLink('../reference/store'), '../reference/store');
  assert.equal(scopeDevelopmentLink('/en/queryable'), '/en/queryable');
  assert.equal(scopeDevelopmentLink('/en/unknown'), '/en/unknown');
});

test('Markdown links: prose versus code -> only real link destinations change', () => {
  const code = '```ts\nconst link = "[Overlay](/ko/overlay)";\n```\n';
  const inline = '`[Overlay](/ko/overlay)` and ``const x = `[/en/overlay](/en/overlay)`;``\n';
  const markdown = '[Overlay](/ko/overlay#provider) [Self](/en/modal/core-concepts)\n'
    + '[overlay]: /en/overlay/next/core-concepts\n' + code + inline;

  const output = rewriteMarkdownLinks(markdown, true, 'modal');

  assert.ok(output.includes('[Overlay](https://ilokesto.ayden94.com/ko/overlay/next#provider)'));
  assert.ok(output.includes('[Self](/en/modal/next/core-concepts)'));
  assert.ok(output.includes('[overlay]: https://ilokesto.ayden94.com/en/overlay/next/core-concepts'));
  assert.ok(output.endsWith(code + inline));
  const multiline = '`example\n[Overlay](/ko/overlay)\n`';
  assert.equal(rewriteMarkdownLinks(multiline, true, 'modal'), multiline);
  const fenced = '```md\n```typescript\n[Overlay](/ko/overlay)\n```\n';
  assert.equal(rewriteMarkdownLinks(fenced, true, 'modal'), fenced);
});

test('source links: current versus archived revision -> owning successor paths', () => {
  const old = 'https://github.com/ilokesto/ilokesto';
  assert.equal(rewriteDocsLink(`${old}/tree/main/packages/fetcher/src`, true, 'fetcher'),
    'https://github.com/ilokesto/fetcher/tree/main/src');
  const sha = 'e'.repeat(40);
  assert.equal(rewriteDocsLink(`${old}/blob/${sha}/packages/fetcher/src/core.ts`, false, 'fetcher'),
    `https://github.com/ilokesto/fetcher/blob/${sha}/packages/fetcher/src/core.ts`);
});
