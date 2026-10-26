import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifyHistory } from '../../scripts/verify-migration.mjs';

const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
Object.assign(environment, {
  GIT_MASTER: '1', GIT_PAGER: 'cat', PAGER: 'cat', LC_ALL: 'C',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
});
const git = (root, args, input) => execFileSync('git', ['--no-pager', '-C', root, ...args], {
  env: environment, input, stdio: 'pipe',
});
const text = (root, args, input) => git(root, args, input).toString().trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fetcher-history-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, ['init', '--quiet', '--initial-branch=main', '--object-format=sha1']);
  await mkdir(path.join(root, 'packages/fetcher'), { recursive: true });
  await writeFile(path.join(root, 'packages/fetcher/package.json'), JSON.stringify({
    name: '@ilokesto/fetcher', version: '1.0.0',
  }));
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'Release source']);
  const release = text(root, ['rev-parse', 'HEAD']);
  const tagName = '@ilokesto/fetcher@1.0.0';
  git(root, ['-c', 'tag.gpgSign=false', 'tag', '-a', tagName, '-m', 'Release 1.0.0']);
  const tag = text(root, ['rev-parse', `refs/tags/${tagName}`]);
  const receiptPath = 'docs-publication/receipt.json';
  await mkdir(path.join(root, 'docs-publication'));
  await writeFile(path.join(root, receiptPath), JSON.stringify({
    schemaVersion: 2,
    package: { name: '@ilokesto/fetcher' },
    provenance: { tag: tagName, tagTarget: release },
    releaseSource: { commit: release },
    docsRevision: { commit: release },
  }));
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'Capture release receipt']);
  const cut = text(root, ['rev-parse', 'HEAD']);
  const tree = text(root, ['rev-parse', 'HEAD:packages/fetcher']);
  const projection = text(root, ['commit-tree', tree], 'Project package\n');
  const checkpoint = text(root, ['commit-tree', tree, '-p', projection], 'Migration checkpoint\n');
  const destination = 'refs/heads/legacy/ilokesto/heads/main';
  git(root, ['update-ref', destination, cut]);
  const objects = text(root, ['rev-list', '--objects', '--no-object-names', destination, `refs/tags/${tagName}`])
    .split('\n').sort().map(oid => {
      const type = text(root, ['cat-file', '-t', oid]);
      const bytes = git(root, ['cat-file', type, oid]);
      return { oid, type, size: bytes.length, sha256: sha256(bytes) };
    });
  const lookups = ['packages/fetcher/package.json', receiptPath].map(file => {
    const oid = text(root, ['rev-parse', `${cut}:${file}`]);
    const object = objects.find(object => object.oid === oid);
    return { commit: cut, path: file, oid, type: object.type, sha256: object.sha256 };
  });
  const manifest = {
    schemaVersion: 1,
    package: 'fetcher',
    source: { cut, prefix: 'packages/fetcher', tree },
    projection: {
      commit: projection,
      correspondence: [{ source: release, projected: projection, tree }],
    },
    checkpoint: { commit: checkpoint },
    archives: [{
      id: 'ilokesto',
      refs: [
        { ref: 'refs/heads/main', oid: cut, type: 'commit', destination },
        { ref: `refs/tags/${tagName}`, oid: tag, type: 'tag', peeled: release,
          peeledType: 'commit', destination: `refs/tags/${tagName}` },
      ],
      objects,
      symbolicRefs: [{ name: 'HEAD', target: 'refs/heads/main', oid: cut }],
    }],
    imports: [],
    provenance: {
      lookups,
      receipts: [{ path: receiptPath, blob: lookups[1].oid, sha256: lookups[1].sha256,
        package: '@ilokesto/fetcher' }],
    },
  };
  return { root, manifest, release };
}

test('verifyHistory: intact archive, annotated tag and receipt -> verifies all recorded bytes', async t => {
  const { root, manifest } = await fixture(t);

  const result = await verifyHistory(root, manifest);

  assert.deepEqual(result, {
    mode: 'history', package: 'fetcher',
    archives: [{ source: 'ilokesto', refs: 2, reachableObjects: manifest.archives[0].objects.length }],
    objectBytesVerified: manifest.archives[0].objects.length,
    provenanceLookups: 2, receipts: 1,
  });
});

test('verifyHistory: archive branch moved to older commit -> ARCHIVE_REF_CHANGED', async t => {
  const { root, manifest, release } = await fixture(t);
  git(root, ['update-ref', manifest.archives[0].refs[0].destination, release]);

  await assert.rejects(verifyHistory(root, manifest), { code: 'ARCHIVE_REF_CHANGED' });
});

test('verifyHistory: annotated tag peel changed in manifest -> ARCHIVE_TAG_OR_TYPE_CHANGED', async t => {
  const { root, manifest } = await fixture(t);
  manifest.archives[0].refs[1].peeled = manifest.source.cut;

  await assert.rejects(verifyHistory(root, manifest), { code: 'ARCHIVE_TAG_OR_TYPE_CHANGED' });
});

test('verifyHistory: reachable object omitted from archive inventory -> ARCHIVE_CLOSURE_CHANGED', async t => {
  const { root, manifest } = await fixture(t);
  manifest.archives[0].objects.pop();

  await assert.rejects(verifyHistory(root, manifest), { code: 'ARCHIVE_CLOSURE_CHANGED' });
});

for (const field of ['type', 'size', 'sha256']) {
  test(`verifyHistory: archived object ${field} tampered -> OBJECT_BYTES_CHANGED`, async t => {
    const { root, manifest } = await fixture(t);
    const object = manifest.archives[0].objects.find(object => object.type === 'blob');
    object[field] = { type: 'tree', size: object.size + 1, sha256: '0'.repeat(64) }[field];

    await assert.rejects(verifyHistory(root, manifest), { code: 'OBJECT_BYTES_CHANGED' });
  });
}

for (const field of ['oid', 'type', 'sha256']) {
  test(`verifyHistory: provenance lookup ${field} tampered -> PROVENANCE_CHANGED`, async t => {
    const { root, manifest } = await fixture(t);
    manifest.provenance.lookups[0][field] = {
      oid: manifest.provenance.lookups[1].oid, type: 'tree', sha256: '0'.repeat(64),
    }[field];

    await assert.rejects(verifyHistory(root, manifest), { code: 'PROVENANCE_CHANGED' });
  });
}

test('verifyHistory: receipt digest tampered -> RECEIPT_CHANGED', async t => {
  const { root, manifest } = await fixture(t);
  manifest.provenance.receipts[0].sha256 = '0'.repeat(64);

  await assert.rejects(verifyHistory(root, manifest), { code: 'RECEIPT_CHANGED' });
});

test('verifyHistory: receipt package identity tampered -> RECEIPT_IDENTITY', async t => {
  const { root, manifest } = await fixture(t);
  manifest.provenance.receipts[0].package = '@ilokesto/store';

  await assert.rejects(verifyHistory(root, manifest), { code: 'RECEIPT_IDENTITY' });
});
