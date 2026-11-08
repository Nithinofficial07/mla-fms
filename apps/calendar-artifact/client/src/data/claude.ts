/**
 * Thin typed wrapper over the Claude artifact runtime (`window.claude.use`).
 * Only the bits this app uses are typed. Every capability may be `null`
 * (signed out, opened outside claude.ai, local preview) - callers must cope.
 */

export interface DbError { code: string; message: string }
export interface DocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined; metadata: { fromCache: boolean; hasPendingWrites: boolean } }
export interface QuerySnap { docs: DocSnap[]; metadata: { fromCache: boolean; hasPendingWrites: boolean } }
export interface DocRef {
  id: string;
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
export interface CollectionRef {
  doc(id?: string): DocRef;
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: DbError) => void): () => void;
}
export interface Db { collection(path: string): CollectionRef; doc(path: string): DocRef }
export interface UserCap {
  id(): Promise<string | null>;
  isOwner(): Promise<boolean> | boolean;
  can(name: string): Promise<boolean | null> | boolean | null;
  profiles(ids: string[]): Promise<Record<string, { name?: string }>>;
}
export interface DownloadsCap { save(file: { filename: string; data: string | Blob }): Promise<unknown> }

declare global {
  interface Window { claude?: { use(name: string): Promise<unknown> } }
}

/** Resolves a capability, or null if the runtime is missing or doesn't answer within 12 s. */
export async function useCapability<T>(name: string): Promise<T | null> {
  // The runtime may attach window.claude a moment after our script starts.
  for (let i = 0; i < 40 && !window.claude?.use; i++) await new Promise((r) => setTimeout(r, 50));
  if (!window.claude?.use) return null;
  try {
    return ((await Promise.race([
      window.claude.use(name),
      new Promise((r) => setTimeout(() => r(null), 12_000)),
    ])) ?? null) as T | null;
  } catch {
    return null;
  }
}
