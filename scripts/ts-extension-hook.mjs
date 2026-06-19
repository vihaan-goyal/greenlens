// ESM resolution hook: let extensionless relative imports resolve to `.ts`.
//
// The app's modules import each other without file extensions (Next/Vite/Vitest
// add them at build time). Node's own ESM loader doesn't, so a plain
// `node --experimental-strip-types` run of any script that pulls in the matcher
// or ingestion graph fails with ERR_MODULE_NOT_FOUND. This hook retries an
// unextended relative specifier as `.ts` before falling back to default
// resolution. No dependency — pure Node customization hooks.

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
  const hasExt = /\.(c|m)?[jt]sx?$|\.json$/.test(specifier);
  if (isRelative && !hasExt) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch {
      // Fall through: directory/index, .js, or genuinely missing — let the
      // default resolver produce the real error.
    }
  }
  return nextResolve(specifier, context);
}
