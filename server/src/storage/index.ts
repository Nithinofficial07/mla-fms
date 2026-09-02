import { env } from '../config/env.js';
import { LocalProvider } from './localProvider.js';
import { S3Provider } from './s3Provider.js';
import type { StorageProvider } from './types.js';

let provider: StorageProvider | null = null;

/** Lazily builds the configured storage provider (singleton). */
export function storage(): StorageProvider {
  if (!provider) {
    provider = env.STORAGE_PROVIDER === 's3' ? new S3Provider() : new LocalProvider();
  }
  return provider;
}

/**
 * Deterministic object key for a document.
 * documents/{year}/{deptCode}/{ownerRef}/{version}-{safeName}
 * ownerRef is e.g. "request-<id>" or "letter-<id>".
 */
export function buildDocumentKey(params: {
  year: number;
  deptCode: string;
  ownerRef: string;
  version: number;
  originalName: string;
}): string {
  const safe = params.originalName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
  const dept = params.deptCode.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'unassigned';
  const ref = params.ownerRef.replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `documents/${params.year}/${dept}/${ref}/v${params.version}-${safe}`;
}

export { LocalProvider };
export type { StorageProvider } from './types.js';
