import { createHmac } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import type { PutObjectInput, StorageProvider, StoredObjectRef } from './types.js';

/**
 * Development storage: writes to a local directory. "Signed URLs" are HMAC
 * tokens verified by the /api/documents/raw endpoint, so the browser still
 * never touches the filesystem directly and links expire.
 */
export class LocalProvider implements StorageProvider {
  readonly name = 'local' as const;
  private root = path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR);

  private full(key: string) {
    return path.join(this.root, key);
  }

  async put(input: PutObjectInput): Promise<StoredObjectRef> {
    const dest = this.full(input.key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, input.body);
    return { key: input.key, size: input.body.length, contentType: input.contentType };
  }

  async getSignedUrl(key: string, opts?: { download?: boolean; filename?: string }): Promise<string> {
    const exp = Date.now() + env.S3_SIGNED_URL_TTL * 1000;
    const sig = LocalProvider.sign(key, exp);
    const u = new URL('/api/documents/raw', env.BACKEND_URL);
    u.searchParams.set('key', key);
    u.searchParams.set('exp', String(exp));
    u.searchParams.set('sig', sig);
    if (opts?.download) u.searchParams.set('download', '1');
    if (opts?.filename) u.searchParams.set('filename', opts.filename);
    return u.toString();
  }

  async getBuffer(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.full(key));
      return true;
    } catch {
      return false;
    }
  }

  static sign(key: string, exp: number): string {
    return createHmac('sha256', env.JWT_SECRET).update(`${key}:${exp}`).digest('hex');
  }

  static verify(key: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    return LocalProvider.sign(key, exp) === sig;
  }
}
