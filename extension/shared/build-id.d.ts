// Stamped at build time by vite.config.ts via `define`. Same string in
// every entry point of the extension, so a mismatched log line means a
// surface is still running an older bundle (typically a content script
// in an already-open tab that hasn't been refreshed since reload).
declare const __GL_BUILD__: string;

// Base URL of the Greenlens web app, stamped at build time by vite.config.ts.
// The extension links out to it (deep links to /product/[id], home link from
// the popup wordmark). Defaults to the local dev server; override with
// `GL_SITE_URL` at build time.
declare const __GL_SITE_URL__: string;
