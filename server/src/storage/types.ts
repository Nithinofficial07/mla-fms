/** Storage provider contract. Add providers by implementing this interface. */
export interface StoredObjectRef {
  /** Provider-specific key, e.g. "documents/2026/health/REQ-.../doc.pdf". */
  key: string;
  size: number;
  contentType: string;
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageProvider {
  readonly name: 'local' | 's3';
  put(input: PutObjectInput): Promise<StoredObjectRef>;
  /** Short-lived URL for authorized viewing/download. Never a permanent public URL. */
  getSignedUrl(key: string, opts?: { download?: boolean; filename?: string }): Promise<string>;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
