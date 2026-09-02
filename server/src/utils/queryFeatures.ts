import type { FilterQuery, Model } from 'mongoose';
import type { Paginated } from '@mla/shared';

export interface ParsedListParams {
  page: number;
  pageSize: number;
  sort: Record<string, 1 | -1>;
  search?: string;
}

const MAX_PAGE_SIZE = 200;

/** Normalises ?page=&pageSize=&sort= query strings. */
export function parseListParams(q: Record<string, unknown>): ParsedListParams {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(q.pageSize) || 25));
  const sort: Record<string, 1 | -1> = {};
  const raw = typeof q.sort === 'string' && q.sort ? q.sort : '-createdAt';
  for (const part of raw.split(',')) {
    const key = part.trim();
    if (!key) continue;
    if (key.startsWith('-')) sort[key.slice(1)] = -1;
    else sort[key] = 1;
  }
  const search = typeof q.search === 'string' && q.search.trim() ? q.search.trim() : undefined;
  return { page, pageSize, sort, search };
}

/** Runs a paginated find + count and returns the standard envelope. */
export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  params: ParsedListParams,
  opts: { populate?: string | string[]; select?: string } = {},
): Promise<Paginated<T>> {
  const { page, pageSize, sort } = params;
  let query = model
    .find(filter)
    .sort(sort)
    .skip((page - 1) * pageSize)
    .limit(pageSize);
  if (opts.populate) query = query.populate(opts.populate as string);
  if (opts.select) query = query.select(opts.select);

  const [data, total] = await Promise.all([
    query.lean<T[]>().exec(),
    model.countDocuments(filter).exec(),
  ]);

  return {
    data: (data as unknown[]).map(withId) as T[],
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Escapes user input before using it in a RegExp. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * Lean documents keep `_id` (and drop the `id` virtual); the client expects
 * `id`. This walks plain objects/arrays (leaving Date, Buffer, ObjectId, etc.
 * untouched), adds a string `id` next to every `_id`, and drops `__v` — so
 * list/detail payloads match the shape of create/update responses.
 */
export function withId<T>(input: T): T {
  if (Array.isArray(input)) return input.map((x) => withId(x)) as unknown as T;
  if (!isPlainObject(input)) return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === '__v') continue;
    out[k] = isPlainObject(v) || Array.isArray(v) ? withId(v) : v;
  }
  if (input._id != null && out.id === undefined) out.id = String(input._id);
  return out as T;
}
