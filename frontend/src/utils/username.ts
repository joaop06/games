/**
 * Normalize username input: remove all spaces, lowercase, keep only a-z and 0-9.
 * Same rule as backend for consistency.
 */
export function normalizeUsername(value: string): string {
  return value.replace(/\s/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
