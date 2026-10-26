#!/usr/bin/env node
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyCheckpoint, verifyHistory } from './migration/history.mjs';
import { validateManifest } from './migration/manifest.mjs';
import { verifyDeletionGate, verifyHosting, verifyRelease } from './migration/operations.mjs';
import { hash, invariant } from './migration/shared.mjs';
import { verifyStandalone } from './migration/standalone.mjs';

export { git, readObjects } from './migration/git.mjs';
export { verifyCheckpoint, verifyHistory } from './migration/history.mjs';
export { mappedRef, validateManifest } from './migration/manifest.mjs';
export { verifyDeletionGate, verifyHosting, verifyRelease } from './migration/operations.mjs';
export { verifyStandalone } from './migration/standalone.mjs';

async function main(args) {
  const mode = args.shift() ?? 'all';
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    invariant(['--repo', '--manifest', '--input', '--evidence', '--manifest-stdin'].includes(args[index]) && args[index + 1], 'CLI_ARGUMENT', args[index]);
    invariant(!(args[index] in options), 'CLI_ARGUMENT', `duplicate ${args[index]}`);
    options[args[index]] = args[index + 1];
  }
  if (['release', 'hosting', 'deletion-gate'].includes(mode)) {
    invariant(options['--input'], 'CLI_ARGUMENT', '--input required');
    const input = JSON.parse(await readFile(options['--input'], 'utf8'));
    const result = mode === 'release' ? verifyRelease(input) : mode === 'hosting' ? verifyHosting(input) : await verifyDeletionGate(input, options['--evidence'] ?? process.cwd());
    process.stdout.write(`${JSON.stringify({ status: 'pass', ...result })}\n`);
    return;
  }
  invariant(['history', 'checkpoint', 'standalone', 'all'].includes(mode), 'CLI_MODE', mode);
  const repo = path.resolve(options['--repo'] ?? process.cwd());
  let bytes;
  if (options['--manifest-stdin'] === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
  } else {
    invariant(!options['--manifest-stdin'], 'CLI_ARGUMENT', '--manifest-stdin must be -');
    bytes = await readFile(path.join(repo, '.migration/source-manifest.json'));
  }
  const manifest = validateManifest(JSON.parse(bytes));
  if (options['--manifest']) {
    const cutover = JSON.parse(await readFile(options['--manifest'], 'utf8'));
    invariant(cutover.source_remote_main === manifest.source.cut && cutover.sources?.['ilokesto/ilokesto']?.source_package_trees?.[manifest.package] === manifest.source.tree, 'CUTOVER_BASELINE_CHANGED', manifest.package);
  }
  const results = [];
  if (mode === 'all' || mode === 'history') {
    results.push(await verifyHistory(repo, manifest));
  }
  if (mode === 'all' || mode === 'checkpoint') {
    results.push(await verifyCheckpoint(repo, manifest));
  }
  if (mode === 'all' || mode === 'standalone') {
    results.push(await verifyStandalone(repo, manifest));
  }
  process.stdout.write(`${JSON.stringify({ status: 'pass', manifestSha256: hash(bytes), results })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${JSON.stringify({ status: 'fail', code: error.code ?? 'INVALID_INPUT', message: error.message })}\n`);
    process.exitCode = 1;
  });
}
