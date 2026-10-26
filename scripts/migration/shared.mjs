import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const lines = bytes => bytes.toString().trim().split('\n').filter(Boolean);

export function invariant(condition, code, detail) {
  if (!condition) {
    const error = new Error(`${code}: ${detail}`);
    error.code = code;
    throw error;
  }
}

export function equal(actual, expected, code, detail) {
  invariant(JSON.stringify(actual) === JSON.stringify(expected), code, detail);
}

export function unique(records, key, code) {
  const seen = new Set();
  for (const row of records) {
    invariant(!seen.has(row[key]), code, row[key]);
    seen.add(row[key]);
  }
}

export async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return false;
  }
}
