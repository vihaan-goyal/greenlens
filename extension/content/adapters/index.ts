import { amazonAdapter } from './amazon';
import { sephoraAdapter } from './sephora';
import type { SiteAdapter } from './types';

/** Order matters: first match wins. Hosts don't overlap, so order is cosmetic;
 *  cheap matches() gates come first regardless. */
export const ADAPTERS: readonly SiteAdapter[] = [amazonAdapter, sephoraAdapter];

export function pickAdapter(url: string): SiteAdapter | null {
  for (const a of ADAPTERS) if (a.matches(url)) return a;
  return null;
}
