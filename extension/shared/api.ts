// The Greenlens API base the extension resolves sightings against. The service
// worker reads it; the options page writes it. Kept free of build-time globals
// so it's importable from both and unit-testable on its own.

/** chrome.storage.local key holding the user-set API base. */
export const API_BASE_KEY = 'greenlens.apiBase';

/** Default base when the user hasn't set one — the local dev server. */
export const DEFAULT_API_BASE = 'http://localhost:3000';

/**
 * Normalize a user-entered API base: trim whitespace, strip trailing slashes so
 * we can append `/api/resolve` cleanly. Blank input falls back to the default.
 */
export function normalizeApiBase(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_API_BASE;
}
