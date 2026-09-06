import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { signRawUrl } from './rawUrl.js';
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
    return signRawUrl(key, opts ?? {});
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
}
