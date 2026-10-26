import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { git } from './git.mjs';
import { SLUGS, validateManifest } from './manifest.mjs';
import { exists, invariant } from './shared.mjs';

export async function verifyStandalone(repo, manifest) {
  validateManifest(manifest);
  repo = await realpath(repo);
  const withinRepo = target => {
    const relative = path.relative(repo, target);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  const localTarget = async (file, range, code = 'EXTERNAL_DEPENDENCY_PATH') => {
    // Match pnpm's local resolver: normalize protocol slashes, not URI escapes.
    const spec = range.replace(/\\/g, '/').replace(/^(?:file|link|workspace):\/*([A-Z]:)/i, '$1')
      .replace(/^(?:file|link|workspace):(?:\/*([~./]))?/, '$1');
    const target = path.resolve(path.dirname(path.join(repo, file)), spec);
    invariant(!/^(?:\/|[A-Z]:|~\/)/i.test(spec) && withinRepo(target), code, `${file} ${range}`);
    const resolved = await realpath(target);
    invariant(withinRepo(resolved), code, `${file} ${range}`);
    return resolved;
  };
  invariant(withinRepo(await realpath(path.join(repo, 'package.json'))), 'EXTERNAL_REPOSITORY_PATH', 'package.json');
  const root = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'));
  invariant(root.name === `@ilokesto/${manifest.package}`, 'PACKAGE_IDENTITY', root.name);
  if (manifest.package === 'queryable') {
    invariant(root.private === true, 'PRIVATE_PACKAGE_EXPOSED', root.name);
  }
  const files = (await git(repo, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])).toString().split('\0').filter(Boolean);
  const generated = new Set(['node_modules', 'dist', '.next', '.source', '.generated']);
  const manifests = new Map();
  for (const file of new Set(['package.json', ...files])) {
    if (file.startsWith('docs-publication/releases/') || file.startsWith('.migration/')
      || file.split('/').some(part => generated.has(part))) {
      continue;
    }
    const location = path.join(repo, file);
    if (!await exists(location)) {
      continue;
    }
    invariant(withinRepo(await realpath(location)), 'EXTERNAL_REPOSITORY_PATH', file);
    if (file === 'package.json' || file.endsWith('/package.json')) {
      manifests.set(file, file === 'package.json' ? root : JSON.parse(await readFile(location, 'utf8')));
    }
  }
  const localPackages = new Map();
  for (const [file, current] of manifests) {
    invariant(current.name === root.name || !SLUGS.some(slug => current.name === `@ilokesto/${slug}`),
      'SIBLING_DEPENDENCY', `${file} ${current.name}`);
    if (file === 'package.json' || current.private === true) {
      invariant(!localPackages.has(current.name), 'DUPLICATE_WORKSPACE_NAME', current.name);
      localPackages.set(current.name, {
        private: current.private === true,
        directory: path.dirname(await realpath(path.join(repo, file))),
      });
    }
  }
  for (const [file, current] of manifests) {
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(current[section] ?? {})) {
        invariant(typeof range === 'string', 'INVALID_DEPENDENCY', `${file} ${name}`);
        invariant(root.name === '@ilokesto/queryable'
          || (name !== '@ilokesto/queryable' && !/^npm:@ilokesto\/queryable@/.test(range)),
        'PRIVATE_PACKAGE_DEPENDENCY', `${file} ${name}`);
        if (range.startsWith('workspace:')) {
          const [, alias, requested] = /^workspace:(?:([^._/][^@]*)@)?(.*)$/.exec(range);
          let targetName = alias ?? name;
          let local = localPackages.get(targetName);
          if (range.startsWith('workspace:.')) {
            const target = await localTarget(file, range, 'SIBLING_DEPENDENCY');
            [targetName, local] = [...localPackages].find(([, candidate]) => candidate.directory === target) ?? [];
          } else {
            invariant(!/[\\/:@]/.test(requested), 'SIBLING_DEPENDENCY', `${file} ${name} ${range}`);
          }
          invariant(file !== 'package.json' && current.private === true && local
            && (targetName === root.name || (local.private && !SLUGS.includes(targetName.slice('@ilokesto/'.length)))),
          'SIBLING_DEPENDENCY', `${file} ${name} ${range}`);
        }
        if (/^(?:file|link):/.test(range)) {
          await localTarget(file, range);
          invariant(!SLUGS.some(slug => name === `@ilokesto/${slug}` && name !== root.name),
            'SIBLING_DEPENDENCY', `${file} ${name} ${range}`);
        }
      }
    }
    const scripts = JSON.stringify(current.scripts ?? {});
    invariant(!/\.\.\/(?:\.\.\/)*(?:packages|store|state|form|overlay|modal|toast|fetcher|utilinent|queryable)(?:\/|\b)|\/Users\/[^"]+\/ilokesto(?:\/|")/.test(scripts), 'SIBLING_SCRIPT', file);
    for (const script of Object.values(current.scripts ?? {})) {
      for (const match of script.matchAll(/(?:--filter|-F)(?:=|\s+)['"]?(@ilokesto\/[a-z-]+)/g)) {
        invariant(match[1] === root.name || !SLUGS.includes(match[1].slice('@ilokesto/'.length)), 'SIBLING_SCRIPT', `${file} ${match[1]}`);
      }
    }
  }
  if (manifest.package === 'queryable') {
    const workflows = files.filter(file => /^\.github\/workflows\/.*\.ya?ml$/.test(file));
    for (const file of workflows) {
      invariant(!/\b(?:npm|pnpm)\s+publish\b|changesets\/action/.test(await readFile(path.join(repo, file), 'utf8')), 'PRIVATE_PUBLISH_WORKFLOW', file);
    }
  }
  return { mode: 'standalone', package: root.name, manifests: manifests.size };
}
