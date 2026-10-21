import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

const packageDocs = (dir: string) =>
  defineDocs({
    dir,
    docs: {
      schema: pageSchema,
      postprocess: {
        includeProcessedMarkdown: true,
      },
    },
    meta: {
      schema: metaSchema,
    },
  });

export const fetcher = packageDocs('../docs');

export const fetcherReleased = packageDocs('../docs-publication/.generated/fetcher/docs');

export default defineConfig();
