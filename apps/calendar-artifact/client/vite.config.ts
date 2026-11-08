import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// Builds ONE self-contained index.html (scripts, styles and fonts inlined),
// which is what gets published as the Claude artifact.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@cal/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  build: { assetsInlineLimit: 100_000_000, cssCodeSplit: false },
  test: { environment: 'node' },
} as never);
