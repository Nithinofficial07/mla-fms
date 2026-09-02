import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import type { PutObjectInput, StorageProvider, StoredObjectRef } from './types.js';

/** Production storage: private S3 bucket, temporary presigned URLs only. */
export class S3Provider implements StorageProvider {
  readonly name = 's3' as const;
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!env.AWS_S3_BUCKET) throw new Error('AWS_S3_BUCKET is required when STORAGE_PROVIDER=s3');
    this.bucket = env.AWS_S3_BUCKET;
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

  async put(input: PutObjectInput): Promise<StoredObjectRef> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
    return { key: input.key, size: input.body.length, contentType: input.contentType };
  }

  async getSignedUrl(key: string, opts?: { download?: boolean; filename?: string }): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: opts?.download
        ? `attachment; filename="${opts.filename ?? key.split('/').pop()}"`
        : undefined,
    });
    return presign(this.client, cmd, { expiresIn: env.S3_SIGNED_URL_TTL });
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
