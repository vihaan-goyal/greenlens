import { amazonAdapter } from './amazon';
import type { SiteAdapter } from './types';

/** Order matters: first match wins. Cheap matches() gates come first. */
export const ADAPTERS: readonly SiteAdapter[] = [amazonAdapter];

export function pickAdapter(url: string): SiteAdapter | null {
  for (const a of ADAPTERS) if (a.matches(url)) return a;
  return null;
}
