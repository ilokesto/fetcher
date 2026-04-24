import { describe, it } from 'vitest';
import type { Fetcher } from './openapi';
import {
  assertBarrelImportContinuity,
  assertHeadStaysOnPlainKyTyping,
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
      assertHeadStaysOnPlainKyTyping(api);
      assertBarrelImportContinuity();
      assertReadmeQuickStartSnippet();
      assertSafeSurfaceTyping(api);
    }
  });
});
