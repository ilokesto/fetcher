import { equal, invariant, unique } from './shared.mjs';

export const SLUGS = ['store', 'state', 'form', 'overlay', 'modal', 'toast', 'fetcher', 'utilinent', 'queryable'];
const LEGACY = { state: 'caro-kann', form: 'sicilian', overlay: 'grunfeld', modal: 'grunfeld', toast: 'grunfeld' };
export const HEX = /^[0-9a-f]{40}$/;
export const SHA256 = /^[0-9a-f]{64}$/;
const TYPES = new Set(['blob', 'tree', 'commit', 'tag']);

export function mappedRef(source, ref) {
  invariant(/^[a-z][a-z0-9-]*$/.test(source), 'INVALID_SOURCE', source);
  invariant(typeof ref.ref === 'string' && ref.ref.startsWith('refs/'), 'INVALID_REF', ref.ref);
  invariant(ref.type === 'commit' || (ref.type === 'tag' && ref.peeledType === 'commit' && HEX.test(ref.peeled)), 'UNSUPPORTED_REF_TYPE', ref.ref);
  if (source === 'ilokesto' && /^refs\/tags\/@ilokesto\/[^/]+@[^/]+$/.test(ref.ref)) {
    return ref.ref;
  }
  return `refs/${ref.type === 'tag' ? 'tags' : 'heads'}/legacy/${source}/${ref.ref.slice(5)}`;
}

export function validateManifest(manifest) {
  invariant(manifest?.schemaVersion === 1 && SLUGS.includes(manifest.package), 'INVALID_MANIFEST', 'schemaVersion/package');
  const expectedSources = ['ilokesto', ...(LEGACY[manifest.package] ? [LEGACY[manifest.package]] : [])].sort();
  invariant(Array.isArray(manifest.archives), 'INVALID_MANIFEST', 'archives');
  equal(manifest.archives.map(source => source.id).sort(), expectedSources, 'SOURCE_ASSIGNMENT', manifest.package);
  invariant(HEX.test(manifest.source?.cut) && manifest.source.prefix === `packages/${manifest.package}` && HEX.test(manifest.source.tree), 'INVALID_MANIFEST', 'source');
  invariant(HEX.test(manifest.projection?.commit) && HEX.test(manifest.checkpoint?.commit), 'INVALID_MANIFEST', 'projection/checkpoint');
  const destinations = [];
  for (const source of manifest.archives) {
    invariant(Array.isArray(source.refs) && source.refs.length > 0 && Array.isArray(source.objects) && source.objects.length > 0, 'INVALID_MANIFEST', source.id);
    unique(source.refs, 'ref', 'DUPLICATE_SOURCE_REF');
    unique(source.objects, 'oid', 'DUPLICATE_OBJECT');
    for (const ref of source.refs) {
      invariant(HEX.test(ref.oid), 'INVALID_OBJECT_ID', ref.ref);
      equal(ref.destination, mappedRef(source.id, ref), 'MAPPING_RULE', ref.ref);
      destinations.push(ref.destination);
    }
    for (const object of source.objects) {
      invariant(HEX.test(object.oid) && TYPES.has(object.type) && Number.isSafeInteger(object.size) && object.size >= 0 && SHA256.test(object.sha256), 'INVALID_OBJECT_RECORD', object.oid);
    }
  }
  destinations.sort();
  for (let index = 1; index < destinations.length; index++) {
    invariant(destinations[index] !== destinations[index - 1] && !destinations[index].startsWith(`${destinations[index - 1]}/`), 'MAPPING_COLLISION', destinations[index]);
  }
  invariant(Array.isArray(manifest.projection.correspondence) && manifest.projection.correspondence.length > 0, 'INVALID_MANIFEST', 'source correspondence');
  unique(manifest.projection.correspondence, 'source', 'DUPLICATE_CORRESPONDENCE');
  invariant(Array.isArray(manifest.imports), 'INVALID_MANIFEST', 'imports');
  invariant(Array.isArray(manifest.provenance?.lookups) && Array.isArray(manifest.provenance?.receipts), 'INVALID_MANIFEST', 'provenance');
  return manifest;
}
