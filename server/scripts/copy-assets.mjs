// tsc only emits .js from .ts - static files under src/assets need a manual
// copy into dist/ so they ship in the Docker image (dist/ is all Dockerfile
// COPYs into the runtime stage). No-op if src/assets doesn't exist yet.
import { existsSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, '..', 'src', 'assets');
const dest = path.join(root, '..', 'dist', 'assets');

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
  console.log('server: copied src/assets -> dist/assets');
} else {
  console.log('server: no src/assets directory - skipping asset copy');
}
