import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { signRawUrl } from './rawUrl.js';
import type { PutObjectInput, StorageProvider, StoredObjectRef } from './types.js';

/** Production storage: private S3 bucket, temporary presigned URLs only. */
export class S3Provider implements StorageProvider {
  readonly name = 's3' as const;
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor() {
    if (!env.AWS_S3_BUCKET) throw new Error('AWS_S3_BUCKET is required when STORAGE_PROVIDER=s3');
    this.bucket = env.AWS_S3_BUCKET;
    this.prefix = env.AWS_S3_KEY_PREFIX ? env.AWS_S3_KEY_PREFIX.replace(/^\/+|\/+$/g, '') + '/' : '';
    this.client = new S3Client({
      region: env.AWS_REGION,
      endpoint: env.AWS_S3_ENDPOINT, // undefined = real AWS S3
      forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE || !!env.AWS_S3_ENDPOINT,
      credentials:
        env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
          ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
          : undefined, // fall back to instance role / shared config
    });
  }

  /** Actual S3 object key for a logical `key` - namespaced by env when AWS_S3_KEY_PREFIX is set. */
  private objectKey(key: string): string {
    return this.prefix + key;
  }

  async put(input: PutObjectInput): Promise<StoredObjectRef> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(input.key),
        Body: input.body,
        ContentType: input.contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
    // The logical key (no env prefix) is what gets stored in Mongo and signed later.
    return { key: input.key, size: input.body.length, contentType: input.contentType };
  }

  /**
   * Returns a same-origin `/api/documents/raw?...` URL (not a direct S3
   * presigned URL) so document previews/downloads work under a strict CSP and
   * the bucket URL is never exposed to the browser. `/raw` streams via
   * getBuffer().
   */
  async getSignedUrl(key: string, opts?: { download?: boolean; filename?: string }): Promise<string> {
    return signRawUrl(key, opts ?? {});
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }));
      return true;
    } catch {
      return false;
    }
  }
}
