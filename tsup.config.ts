import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core/index.ts',
    openapi: 'src/openapi/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'esnext',
  outDir: 'dist',
})
