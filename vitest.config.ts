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
    ],
    // Run tests in a single thread to avoid serialization issues with axios
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
}); 