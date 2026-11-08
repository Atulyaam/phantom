import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    include: [
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'tests/integration/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', '.output/**', '.wxt/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.output/**',
        '.wxt/**',
        'dist/**',
        'scripts/**',
        'tests/**',
        '**/*.d.ts',
      ],
    },
  },
});
