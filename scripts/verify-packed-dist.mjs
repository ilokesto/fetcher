import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));

export const verifyPackedDist = () => {
  const consumerDirectory = mkdtempSync(join(tmpdir(), 'ilokesto-fetcher-dist-'));

  try {
    execFileSync('pnpm', ['pack', '--pack-destination', consumerDirectory], {
      cwd: packageDirectory,
      stdio: 'pipe',
    });

    const archiveName = readdirSync(consumerDirectory).find((name) => name.endsWith('.tgz'));
    assert.ok(archiveName, 'pnpm pack must produce a package archive');

    const consumerNodeModules = join(consumerDirectory, 'node_modules');
    const packedPackageDirectory = join(consumerNodeModules, '@ilokesto/fetcher');
    mkdirSync(packedPackageDirectory, { recursive: true });
    execFileSync(
      'tar',
      ['-xzf', join(consumerDirectory, archiveName), '-C', packedPackageDirectory, '--strip-components=1'],
      {
        cwd: consumerDirectory,
        stdio: 'pipe',
      },
    );
    symlinkSync(join(packageDirectory, 'node_modules/ky'), join(consumerNodeModules, 'ky'), 'dir');
    writeFileSync(join(consumerDirectory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));

    execFileSync(process.execPath, ['-e', "import('@ilokesto/fetcher')"], {
      cwd: consumerDirectory,
      stdio: 'pipe',
    });

    writeFileSync(
      join(consumerDirectory, 'contract.ts'),
      `import { createFetcher, type Fetcher, type OpenApiRequest } from '@ilokesto/fetcher';
import type { Options } from 'ky';

export type Paths = {
  readonly '/resources/{resourceId}': {
    readonly head: {
      readonly parameters: {
        readonly path: { readonly resourceId: string };
        readonly query: { readonly revision: number };
        readonly header: { readonly 'x-tenant-id': string };
        readonly cookie: { readonly session: string };
      };
      readonly responses: {
        readonly 200: {
          readonly content: {
            readonly 'application/json': { readonly revision: string };
          };
        };
      };
    };
  };
  readonly '/capabilities/{resourceId}': {
    readonly options: {
      readonly parameters: {
        readonly path: { readonly resourceId: string };
        readonly query: { readonly verbose: boolean };
        readonly header: { readonly 'x-capability-token': string };
        readonly cookie: { readonly session: string };
      };
      readonly responses: {
        readonly 200: {
          readonly content: {
            readonly 'application/json': { readonly methods: readonly string[] };
          };
        };
      };
    };
  };
};

type ExpectFalse<Value extends false> = Value;
type MissingPath = {
  readonly params: {
    readonly query: { readonly revision: number };
    readonly cookie: { readonly session: string };
  };
  readonly headers: { readonly 'x-tenant-id': string };
};
type HeadRequest = OpenApiRequest<Paths, '/resources/{resourceId}', 'head'>;

const api = createFetcher<Paths>();
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

const headBody: Promise<{ readonly revision: string }> = headResponse.json();
const optionsBody: Promise<{ readonly methods: readonly string[] }> = optionsResponse.json();
const missingPathRejected: ExpectFalse<MissingPath extends HeadRequest ? true : false> = false;
const noOptionsShortcut: ExpectFalse<'options' extends keyof Fetcher<Paths> ? true : false> = false;
const noSafeHead: ExpectFalse<'head' extends keyof Fetcher<Paths>['safe'] ? true : false> = false;

api.head('/health', {
  headers: { authorization: 'Bearer token' },
  searchParams: { probe: 'ready' },
} satisfies Options);

void [headBody, optionsBody, missingPathRejected, noOptionsShortcut, noSafeHead];
`,
    );

    const typecheckArguments = (fileName) => [
      join(packageDirectory, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--target',
      'ESNext',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--skipLibCheck',
      join(consumerDirectory, fileName),
    ];
    const runTypecheck = (fileName) =>
      execFileSync(process.execPath, typecheckArguments(fileName), {
        cwd: consumerDirectory,
        stdio: fileName === 'contract.ts' ? 'inherit' : 'pipe',
      });
    const assertTypecheckFails = (fileName) => {
      const result = spawnSync(process.execPath, typecheckArguments(fileName), {
        cwd: consumerDirectory,
        encoding: 'utf8',
      });

      assert.notEqual(result.status, 0, `${fileName} must fail typechecking`);
      assert.match(
        `${result.stdout}${result.stderr}`,
        /No overload matches this call[\s\S]*NonStringInput/,
        `${fileName} must fail without reaching the raw string fallback`,
      );
    };

    runTypecheck('contract.ts');

    writeFileSync(
      join(consumerDirectory, 'missing-options-path.ts'),
      `import { createFetcher } from '@ilokesto/fetcher';
import type { Paths } from './contract.js';

const api = createFetcher<Paths>();
api('/capabilities/{resourceId}', {
  method: 'OPTIONS',
  searchParams: { verbose: true },
  headers: { 'x-capability-token': 'capability-token' },
  cookie: { session: 'session-1' },
});
`,
    );
    writeFileSync(
      join(consumerDirectory, 'missing-options-query.ts'),
      `import { createFetcher } from '@ilokesto/fetcher';
import type { Paths } from './contract.js';

const api = createFetcher<Paths>();
api('/capabilities/{resourceId}', {
  method: 'OPTIONS',
  path: { resourceId: 'resource-1' },
  headers: { 'x-capability-token': 'capability-token' },
  cookie: { session: 'session-1' },
});
`,
    );

    assertTypecheckFails('missing-options-path.ts');
    assertTypecheckFails('missing-options-query.ts');

    writeFileSync(
      join(consumerDirectory, 'runtime.mjs'),
      `import assert from 'node:assert/strict';
import { createFetcher } from '@ilokesto/fetcher';

const seenRequests = [];
const seenContexts = [];
const api = createFetcher({
  prefixUrl: 'https://example.com/api',
  hooks: {
    beforeRequest: [(_request, options) => seenContexts.push(options.context.openapi)],
  },
  fetch: async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    seenRequests.push({ method: request.method, url: request.url });
    return new Response(null, { status: 204 });
  },
});

const response = await api.head('/resources/{resourceId}', {
  params: {
    path: { resourceId: 'resource-1' },
    query: { revision: 7 },
    cookie: { session: 'session-1' },
  },
  headers: { 'x-tenant-id': 'tenant-1' },
});

assert.equal(response.status, 204);
assert.equal(response.bodyUsed, false);
assert.deepEqual(seenRequests, [
  { method: 'HEAD', url: 'https://example.com/api/resources/resource-1?revision=7' },
]);
assert.deepEqual(seenContexts, [
  { method: 'head', pathTemplate: '/resources/{resourceId}' },
]);
assert.equal('options' in api, false);
assert.equal('head' in api.safe, false);
`,
    );
    execFileSync(process.execPath, [join(consumerDirectory, 'runtime.mjs')], {
      cwd: consumerDirectory,
      stdio: 'pipe',
    });
  } finally {
    rmSync(consumerDirectory, { recursive: true, force: true });
  }
};
