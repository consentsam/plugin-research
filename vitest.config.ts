import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/research-e2e.test.ts',
      '**/tests/real-world-e2e.test.ts'
    ]
  },
}); 