// Links from the extension surfaces back to the Greenlens web app. The base
// URL is stamped at build time (see vite.config.ts `__GL_SITE_URL__`).
//
// Content scripts can't call `chrome.tabs.create`, and popups close the moment
// focus leaves them, so every surface just renders a plain `<a target="_blank">`
// — accessible, no extra permissions, and it works identically everywhere.

/** Web app base URL, trailing slash stripped so we can append paths cleanly. */
export const SITE_URL = __GL_SITE_URL__.replace(/\/+$/, '');

/** Deep link to a canonical product's full breakdown on the web app. */
export function productUrl(productId: string): string {
  return `${SITE_URL}/product/${encodeURIComponent(productId)}`;
}
