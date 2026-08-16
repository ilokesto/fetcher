import { describe, it } from 'vitest';
import type { Fetcher } from './openapi';
import { assertTypedHeadAndCallableOptions, type HeadPaths } from './test-fixtures/head';
import {
  assertBarrelImportContinuity,
  assertUntypedHeadKeepsKyTyping,
  assertMergePathsTyping,
  assertNoTypedOptionsShortcut,
  assertReadmeQuickStartSnippet,
  assertSafeSurfaceTyping,
  assertTypedShortcutUrlOptionFoundations,
  assertUnknownShortcutUrlOptionFallback,
  type ApiPaths,
} from './test-fixtures/createFetcher';

describe('createFetcher type contracts', () => {
  it('preserves OpenAPI helper, shortcut, safe, barrel, and README compile-time contracts', () => {
    if (process.env.VITEST_TYPE_CONTRACTS === 'true') {
      const api = undefined as unknown as Fetcher<ApiPaths>;

      assertMergePathsTyping();
      assertTypedShortcutUrlOptionFoundations(api);
      assertUnknownShortcutUrlOptionFallback(api);
      assertNoTypedOptionsShortcut(api);
      assertUntypedHeadKeepsKyTyping(api);
      assertBarrelImportContinuity();
      assertReadmeQuickStartSnippet();
      assertSafeSurfaceTyping(api);

      const headApi = undefined as unknown as Fetcher<HeadPaths>;
      assertTypedHeadAndCallableOptions(headApi);
    }
  });
});
