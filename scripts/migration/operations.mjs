import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HEX, SHA256, SLUGS } from './manifest.mjs';
import { equal, hash, invariant } from './shared.mjs';

const DELETION_TARGETS = ['ilokesto/caro-kann', 'ilokesto/sicilian', 'ilokesto/grunfeld', 'ilokesto/ilokesto'];

export function verifyRelease(input) {
  invariant(input?.schemaVersion === 1 && HEX.test(input.requestedSha), 'RELEASE_INPUT', 'requested SHA');
  invariant(input.package?.private !== true && input.package?.name !== '@ilokesto/queryable', 'PRIVATE_RELEASE', input.package?.name);
  invariant(input.requestedSha === input.currentMain && input.requestedSha === input.workflowSha, 'RELEASE_SHA_CHANGED', input.requestedSha);
  invariant(input.verify?.headSha === input.requestedSha && input.verify.repository === input.repository && input.verify.name === 'verify' && input.verify.conclusion === 'success' && Number.isSafeInteger(input.verify.runId), 'UNVERIFIED_RELEASE_SHA', input.requestedSha);
  invariant(SHA256.test(input.packSha256) && input.packSha256 === input.verify.artifactSha256, 'RELEASE_ARTIFACT_CHANGED', input.packSha256);
  invariant(input.registry?.name === input.package.name && input.registry.version === input.package.version, 'REGISTRY_IDENTITY', input.package.name);
  invariant(input.registry.published === true || input.registry.published === false, 'REGISTRY_STATUS', 'missing observation');
  return { mode: 'release', sha: input.requestedSha, status: input.registry.published ? 'already-published-no-publish' : 'eligible-unpublished', publishPerformed: false };
}

export function verifyHosting(input) {
  invariant(input?.schemaVersion === 1 && input.before && input.after, 'HOSTING_INPUT', 'before/after');
  for (const key of ['teamId', 'projectId', 'deploymentId']) {
    invariant(typeof input.before[key] === 'string' && input.before[key].length > 0 && input.before[key] === input.after[key], 'HOSTING_ID_CHANGED', key);
  }
  equal(input.after.domains, input.before.domains, 'HOSTING_DOMAINS_CHANGED', 'domains');
  invariant(input.after.gitConnection === null && input.createdDeployments?.length === 0, 'HOSTING_MUTATION', 'Git connection/deployment');
  invariant(Array.isArray(input.before.routes) && input.before.routes.length > 0, 'HOSTING_ROUTES', 'empty baseline');
  equal(input.after.routes, input.before.routes, 'HOSTING_ROUTES_CHANGED', 'full route inventory');
  invariant(input.after.routes.every(route => route.status === 200), 'HOSTING_ROUTE_FAILED', 'first-party routes');
  return { mode: 'hosting', deploymentId: input.after.deploymentId, routes: input.after.routes.length };
}

export async function verifyDeletionGate(input, evidenceRoot) {
  invariant(input?.schemaVersion === 1 && input.stage === 'remote' && input.remoteReleaseReady === true, 'REMOTE_AUTHORITY_REQUIRED', 'local approval is insufficient');
  equal(input.targets, DELETION_TARGETS, 'UNEXPECTED_DELETION_TARGET', 'exact ordered four-name allowlist');
  invariant(input.sources?.length === 4, 'SOURCE_INVENTORY_REQUIRED', 'four sources');
  equal(input.sources.map(source => source.name).sort(), [...DELETION_TARGETS].sort(), 'SOURCE_INVENTORY_REQUIRED', 'names');
  for (const source of input.sources) {
    invariant(source.frozenRefs?.length > 0, 'SOURCE_INVENTORY_REQUIRED', source.name);
    equal(source.currentRefs, source.frozenRefs, 'SOURCE_REFS_MOVED', source.name);
  }
  equal(input.proofs?.map(proof => proof.task).sort((a, b) => a - b), [14, 15, 16, 17], 'MISSING_REQUIRED_PROOF', 'tasks 14-17');
  for (const proof of input.proofs) {
    invariant(typeof proof.path === 'string' && !path.isAbsolute(proof.path) && !proof.path.split('/').includes('..') && SHA256.test(proof.sha256), 'PROOF_PATH', proof.path);
    const bytes = await readFile(path.join(evidenceRoot, proof.path));
    invariant(hash(bytes) === proof.sha256, 'PROOF_DIGEST_CHANGED', proof.path);
    const receipt = JSON.parse(bytes);
    invariant(receipt.status === 'complete' && receipt.task === proof.task && receipt.scope === 'remote' && receipt.verdict === 'confirmed', 'UNCONFIRMED_PROOF', proof.path);
    equal(receipt.sourceInventories, input.sources.map(source => ({ name: source.name, refs: source.frozenRefs })), 'PROOF_SOURCE_BINDING', proof.path);
    equal(receipt.destinations, input.destinations, 'PROOF_DESTINATION_BINDING', proof.path);
  }
  equal(input.destinations?.map(destination => destination.slug).sort(), [...SLUGS].sort(), 'DESTINATION_INVENTORY', 'all nine');
  invariant(input.destinations.every(destination => HEX.test(destination.sha)), 'DESTINATION_SHA', 'full SHAs');
  return { mode: 'deletion-gate', targets: input.targets, proofDigests: input.proofs.map(proof => proof.sha256), deletionPerformed: false };
}
