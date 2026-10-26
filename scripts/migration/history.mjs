import { git, readObjects, repositoryBoundary, text } from './git.mjs';
import { validateManifest } from './manifest.mjs';
import { equal, invariant, lines } from './shared.mjs';

async function refInventory(repo) {
  const output = await git(repo, ['for-each-ref', '--format=%(refname)%09%(objectname)%09%(objecttype)%09%(*objectname)%09%(*objecttype)%09%(symref)']);
  return new Map(lines(output).map(line => {
    const [ref, oid, type, peeled, peeledType, symbolic] = line.split('\t');
    return [ref, { oid, type, peeled: peeled || null, peeledType: peeledType || null, symbolic: symbolic || null }];
  }));
}

function resolveArchiveRef(refs, expected) {
  const names = [expected.destination];
  if (expected.destination.startsWith('refs/heads/')) {
    names.push(expected.destination.replace('refs/heads/', 'refs/remotes/origin/'));
  }
  const present = names.filter(name => refs.has(name));
  invariant(present.length > 0, 'MISSING_ARCHIVE_REF', expected.destination);
  for (const name of present) {
    const actual = refs.get(name);
    invariant(actual.oid === expected.oid, 'ARCHIVE_REF_CHANGED', name);
    invariant(actual.type === expected.type && actual.peeled === (expected.peeled ?? null) && actual.peeledType === (expected.peeledType ?? null) && actual.symbolic === null, 'ARCHIVE_TAG_OR_TYPE_CHANGED', name);
  }
  return present[0];
}

export async function verifyHistory(repo, manifest) {
  validateManifest(manifest);
  await repositoryBoundary(repo);
  const refs = await refInventory(repo);
  const union = new Set();
  const summaries = [];
  const expectedObjects = new Map();
  for (const source of manifest.archives) {
    const mapped = source.refs.map(ref => resolveArchiveRef(refs, ref));
    const closure = lines(await git(repo, ['rev-list', '--objects', '--no-object-names', '--stdin'], `${mapped.join('\n')}\n`)).sort();
    const expected = source.objects.map(object => object.oid).sort();
    const actualSet = new Set(closure);
    for (const oid of expected) {
      invariant(actualSet.has(oid), 'UNREACHABLE_ARCHIVE_OBJECT', `${source.id} ${oid}`);
      union.add(oid);
    }
    equal(closure, expected, 'ARCHIVE_CLOSURE_CHANGED', source.id);
    for (const object of source.objects) {
      const previous = expectedObjects.get(object.oid);
      if (previous) {
        equal(object, previous, 'CONTRADICTORY_OBJECT', object.oid);
      }
      expectedObjects.set(object.oid, object);
    }
    for (const symbolic of source.symbolicRefs) {
      const target = source.refs.find(ref => ref.ref === symbolic.target);
      invariant(target && target.oid === symbolic.oid, 'SYMBOLIC_RELATION_CHANGED', symbolic.name);
    }
    summaries.push({ source: source.id, refs: mapped.length, reachableObjects: closure.length });
  }
  const objects = await readObjects(repo, [...expectedObjects.keys()].sort());
  const byOid = new Map(objects.map(object => [object.oid, object]));
  for (const object of objects) {
    const { body, ...identity } = object;
    equal(identity, expectedObjects.get(object.oid), 'OBJECT_BYTES_CHANGED', object.oid);
  }
  const monorepo = manifest.archives.find(source => source.id === 'ilokesto');
  invariant(monorepo.refs.some(ref => ref.ref === 'refs/heads/main' && ref.oid === manifest.source.cut), 'SOURCE_CUT_CHANGED', manifest.source.cut);
  const lookups = manifest.provenance.lookups;
  const resolved = await readObjects(repo, lookups.map(lookup => `${lookup.commit}:${lookup.path}`));
  for (let index = 0; index < lookups.length; index++) {
    const lookup = lookups[index];
    const object = resolved[index];
    invariant(union.has(lookup.commit) && union.has(object.oid), 'UNREACHABLE_PROVENANCE', `${lookup.commit}:${lookup.path}`);
    invariant(object.oid === lookup.oid && object.type === lookup.type && object.sha256 === lookup.sha256, 'PROVENANCE_CHANGED', `${lookup.commit}:${lookup.path}`);
  }
  for (const receipt of manifest.provenance.receipts) {
    const bytes = byOid.get(receipt.blob);
    invariant(bytes?.type === 'blob' && bytes.sha256 === receipt.sha256, 'RECEIPT_CHANGED', receipt.path);
    const parsed = JSON.parse(bytes.body);
    if (receipt.package) {
      invariant(parsed.package?.name === receipt.package && [1, 2].includes(parsed.schemaVersion), 'RECEIPT_IDENTITY', receipt.path);
      const originalTag = monorepo.refs.find(ref => ref.ref === `refs/tags/${parsed.provenance.tag}`);
      invariant(originalTag?.type === 'tag' && originalTag.peeled === parsed.provenance.tagTarget, 'RECEIPT_TAG_CHANGED', receipt.path);
      await git(repo, ['merge-base', '--is-ancestor', parsed.releaseSource.commit, parsed.docsRevision.commit]);
    }
  }
  await git(repo, ['fsck', '--full', '--no-reflogs']);
  return { mode: 'history', package: manifest.package, archives: summaries, objectBytesVerified: objects.length, provenanceLookups: lookups.length, receipts: manifest.provenance.receipts.length };
}

export async function verifyCheckpoint(repo, manifest) {
  validateManifest(manifest);
  await repositoryBoundary(repo);
  const { source, projection, checkpoint } = manifest;
  for (const [ref, expected] of [
    ['refs/tags/migration/projection-v1', projection.commit],
    ['refs/tags/migration/checkpoint-v1', checkpoint.commit],
  ]) {
    invariant(await text(repo, ['rev-parse', '--verify', ref]) === expected, 'CHECKPOINT_REF_CHANGED', ref);
  }
  const trees = await readObjects(repo, [`${source.cut}:${source.prefix}`, `${projection.commit}^{tree}`, `${checkpoint.commit}^{tree}`]);
  invariant(trees.every(tree => tree.type === 'tree' && tree.oid === source.tree), 'CHECKPOINT_TREE_CHANGED', source.prefix);
  equal(await text(repo, ['rev-list', '--parents', '-n', '1', checkpoint.commit]), `${checkpoint.commit} ${projection.commit}`, 'CHECKPOINT_PARENT_CHANGED', checkpoint.commit);
  await git(repo, ['merge-base', '--is-ancestor', checkpoint.commit, 'HEAD']);
  const projectedCommits = new Set(lines(await git(repo, ['rev-list', projection.commit])));
  const changes = lines(await git(repo, ['rev-list', '--full-history', source.cut, '--', source.prefix])).sort();
  equal(projection.correspondence.map(row => row.source).sort(), changes, 'INCOMPLETE_CORRESPONDENCE', source.prefix);
  const queries = projection.correspondence.flatMap(row => [`${row.source}:${source.prefix}`, `${row.projected}^{tree}`]);
  const correspondingTrees = await readObjects(repo, queries);
  for (let index = 0; index < projection.correspondence.length; index++) {
    const row = projection.correspondence[index];
    const original = correspondingTrees[index * 2];
    const projected = correspondingTrees[index * 2 + 1];
    invariant(projectedCommits.has(row.projected), 'UNREACHABLE_PROJECTION', row.projected);
    invariant(original.type === 'tree' && projected.type === 'tree' && original.oid === row.tree && projected.oid === row.tree, 'CORRESPONDENCE_TREE_CHANGED', row.source);
  }
  const importLog = await text(repo, ['log', source.cut, `--grep=^git-subtree-dir: ${source.prefix}/*$`, '--format=%H']);
  equal(lines(importLog).sort(), manifest.imports.map(item => item.join).sort(), 'IMPORT_METADATA_CHANGED', source.prefix);
  invariant(manifest.package === 'queryable' ? manifest.imports.length === 0 : manifest.imports.length === 1, 'MISSING_IMPORT_METADATA', source.prefix);
  let importedCommits = 0;
  for (const item of manifest.imports) {
    const [join] = await readObjects(repo, [item.join]);
    const message = join.body.toString();
    invariant(message.includes(`\ngit-subtree-dir: ${source.prefix}\n`) && message.includes(`\ngit-subtree-mainline: ${item.mainline}\n`) && message.includes(`\ngit-subtree-split: ${item.split}\n`), 'IMPORT_METADATA_CHANGED', item.join);
    const parents = lines(await git(repo, ['rev-list', '--parents', '-n', '1', item.join]))[0].split(' ').slice(1);
    equal(parents, [item.mainline, item.split], 'IMPORT_PARENTS_CHANGED', item.join);
    const importTrees = await readObjects(repo, [`${item.join}:${source.prefix}`, `${item.split}^{tree}`]);
    equal(importTrees[0].oid, importTrees[1].oid, 'IMPORT_TREE_CHANGED', item.join);
    const ancestors = lines(await git(repo, ['rev-list', item.split])).sort();
    equal(item.ancestors, ancestors, 'IMPORT_ANCESTRY_CHANGED', item.split);
    for (const oid of ancestors) {
      invariant(projectedCommits.has(oid), 'LOST_PREIMPORT_ANCESTOR', oid);
    }
    importedCommits += ancestors.length;
  }
  return { mode: 'checkpoint', package: manifest.package, sourceCut: source.cut, sourceTree: source.tree, projection: projection.commit, checkpoint: checkpoint.commit, correspondence: changes.length, importedCommits };
}
