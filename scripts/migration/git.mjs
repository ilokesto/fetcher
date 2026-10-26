import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { exists, hash, invariant } from './shared.mjs';

export async function git(repo, args, input = '') {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (key.startsWith('GIT_')) {
      delete environment[key];
    }
  }
  Object.assign(environment, {
    GIT_MASTER: '1', GIT_PAGER: 'cat', PAGER: 'cat', LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1',
    GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: 'file',
  });
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['--no-pager', '-C', repo, ...args], {
      env: environment, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => stderr.push(chunk));
    child.on('error', reject);
    child.stdin.on('error', error => {
      if (error.code !== 'EPIPE') {
        reject(error);
      }
    });
    child.on('close', code => {
      const out = Buffer.concat(stdout);
      const err = Buffer.concat(stderr);
      if (code !== 0) {
        const error = new Error(`GIT_FAILED: git ${args.join(' ')} exited ${code}: ${err.toString().trim()}`);
        error.code = 'GIT_FAILED';
        reject(error);
        return;
      }
      resolve(out);
    });
    child.stdin.end(input);
  });
}

export async function text(repo, args, input) {
  return (await git(repo, args, input)).toString().trim();
}

export async function repositoryBoundary(repo) {
  const root = await realpath(repo);
  const common = await realpath(await text(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  invariant(common === path.join(root, '.git'), 'EXTERNAL_OBJECT_STORE', common);
  for (const file of ['objects/info/alternates', 'objects/info/http-alternates', 'shallow', 'info/grafts']) {
    invariant(!await exists(path.join(common, file)), 'EXTERNAL_OBJECT_STORE', file);
  }
  invariant((await text(repo, ['rev-parse', '--is-shallow-repository'])) === 'false', 'SHALLOW_REPOSITORY', repo);
  const config = await text(repo, ['config', '--local', '--list']);
  invariant(!/(?:partialclone|promisor|alternaterefscommand)=/i.test(config), 'EXTERNAL_OBJECT_STORE', 'partial/promisor configuration');
  invariant((await text(repo, ['for-each-ref', '--format=%(refname)', 'refs/replace'])).length === 0, 'REPLACE_REFS', repo);
}

export async function readObjects(repo, queries) {
  if (queries.length === 0) {
    return [];
  }
  invariant(queries.every(query => typeof query === 'string' && !/[\r\n\0]/.test(query)), 'INVALID_OBJECT_QUERY', 'newline');
  const output = await git(repo, ['cat-file', '--batch'], `${queries.join('\n')}\n`);
  const objects = [];
  let cursor = 0;
  for (const query of queries) {
    const newline = output.indexOf(10, cursor);
    invariant(newline !== -1, 'MISSING_OBJECT', query);
    const header = output.subarray(cursor, newline).toString();
    const match = /^([0-9a-f]{40}) (blob|tree|commit|tag) (\d+)$/.exec(header);
    invariant(match, 'MISSING_OBJECT', `${query}: ${header}`);
    const [, oid, type, sizeText] = match;
    const size = Number(sizeText);
    cursor = newline + 1;
    const body = output.subarray(cursor, cursor + size);
    invariant(body.length === size && output[cursor + size] === 10, 'TRUNCATED_OBJECT', query);
    const actualOid = createHash('sha1').update(`${type} ${size}\0`).update(body).digest('hex');
    invariant(actualOid === oid, 'CORRUPT_OBJECT', oid);
    objects.push({ oid, type, size, sha256: hash(body), body });
    cursor += size + 1;
  }
  invariant(cursor === output.length, 'OBJECT_STREAM_LENGTH', 'unexpected trailing data');
  return objects;
}
