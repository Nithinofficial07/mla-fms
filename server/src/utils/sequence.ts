import { Counter } from '../models/Counter.js';

/**
 * Atomically returns the next integer in a named sequence.
 * Used for File ID / Request ID / Document ID generation so two concurrent
 * creates can never collide.
 */
export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc!.seq;
}

/** Sequence keys are scoped per calendar year so numbering restarts yearly. */
export function yearlyKey(base: string, date = new Date()): string {
  return `${base}:${date.getFullYear()}`;
}
