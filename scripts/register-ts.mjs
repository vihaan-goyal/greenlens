// Registers the `.ts` extension resolution hook on the main thread, so it's
// active for the whole import graph of a script run with
// `node --import ./scripts/register-ts.mjs ...`. See ts-extension-hook.mjs.
import { register } from 'node:module';

register('./ts-extension-hook.mjs', import.meta.url);
