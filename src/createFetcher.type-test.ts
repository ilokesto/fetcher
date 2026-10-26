import type { Fetcher } from './openapi';
import type { ApiPaths } from './test-fixtures/createFetcher';
import { assertTypedHeadAndCallableOptions, type HeadPaths } from './test-fixtures/head';
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
} from './test-fixtures/createFetcher.type-contracts';

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
