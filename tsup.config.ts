import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  shims: true,
  splitting: false,
  sourcemap: true,
  external: ['@elizaos/core', 'uuid'],
});
