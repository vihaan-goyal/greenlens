// Stamped at build time by vite.config.ts via `define`. Same string in
// every entry point of the extension, so a mismatched log line means a
// surface is still running an older bundle (typically a content script
// in an already-open tab that hasn't been refreshed since reload).
declare const __GL_BUILD__: string;
