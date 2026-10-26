import type { Fetcher } from './openapi';
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
  type ApiPaths,
} from './test-fixtures/createFetcher';

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
