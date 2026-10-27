import type { Fetcher } from '../../src/openapi';
import type { ApiPaths } from '../fixtures/createFetcher';
import { assertTypedHeadAndCallableOptions, type HeadPaths } from '../fixtures/head';
import {
  assertBarrelImportContinuity,
  assertInterfacePathsSatisfyPathsLike,
  assertUntypedHeadKeepsKyTyping,
  assertMergePathsTyping,
  assertNoTypedOptionsShortcut,
  assertReadmeQuickStartSnippet,
  assertSafeSurfaceTyping,
  assertTypedShortcutUrlOptionFoundations,
  assertUnknownShortcutUrlOptionFallback,
} from '../fixtures/createFetcher.type-contracts';

// Compile-only: TypeScript checks these calls without executing HTTP requests.
export function assertTypeContracts(api: Fetcher<ApiPaths>, headApi: Fetcher<HeadPaths>): void {
  assertMergePathsTyping();
  assertTypedShortcutUrlOptionFoundations(api);
  assertUnknownShortcutUrlOptionFallback(api);
  assertNoTypedOptionsShortcut(api);
  assertUntypedHeadKeepsKyTyping(api);
  assertBarrelImportContinuity();
  assertReadmeQuickStartSnippet();
  assertSafeSurfaceTyping(api);
  assertInterfacePathsSatisfyPathsLike();
  assertTypedHeadAndCallableOptions(headApi);
}
