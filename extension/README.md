# Greenlens browser extension

Scaffolded shell for the Chrome / Edge extension. The Next.js app under
`/app` still works and is untouched.

## Layout

```
extension/
  manifest.json                Manifest V3 entry
  background/
    sw.ts                      service worker: classifier → matcher → repo
    classifier.ts              "is this a cosmetic?" gate
  content/
    index.ts                   per-page bootstrap; SPA-nav aware
    adapters/
      types.ts                 SiteAdapter contract
      amazon.ts                /dp/ and /gp/product/ scraper
      __fixtures__/*.html      saved page snapshots — fail-the-test-first
    card/
      mount.tsx                shadow-DOM root, tokens.css adopted inside
      Card.tsx                 compact in-page card
      card.css                 styles scoped to the shadow root
  shared/
    sighting.ts                RawProductSighting type
    messages.ts                discriminated unions for both directions
  popup/                       toolbar popup (weight controls)
  options/                     full options page (stub)
```

Shared domain code is imported from `@/lib/domain/*` — those modules stay
pure and serve both the Next.js app and the extension.

## Required dependencies (not yet installed)

CLAUDE.md asks for confirmation before adding deps. To make this scaffold
build and run, we need:

| dep                       | why                                          |
| ------------------------- | -------------------------------------------- |
| `vite`                    | bundler for the extension                    |
| `@crxjs/vite-plugin`      | MV3 manifest + content-script HMR            |
| `@vitejs/plugin-react`    | JSX for popup, options, card                 |
| `@types/chrome`           | typed `chrome.runtime`/`chrome.storage` APIs |
| `jsdom`                   | DOM for vitest adapter tests                 |
| `zod`                     | already in the stack list; validate API payloads later |

`react` and `react-dom` are already installed.

## Build commands (to add to package.json once deps land)

```
"ext:dev":   "vite --config extension/vite.config.ts",
"ext:build": "vite build --config extension/vite.config.ts",
```

`ext:dev` watches and outputs an unpacked extension to `dist/extension/`;
load that folder via `chrome://extensions → Load unpacked`.

## Adapter testing

```
npm test               # runs domain + extension tests
```

Adapter tests run under `jsdom` (configured in `vitest.config.ts`). Each
adapter has at least one fixture under `__fixtures__/`. When Amazon ships a
new DOM, add a *new* fixture next to the existing one and watch it fail
before touching selectors — that's how we keep the adapter honest.

## What is intentionally NOT here yet

- `/lib/matcher` (blocking → features → clustering). The SW currently calls
  `mockRepository.searchProducts(rawName)` as a stand-in.
- Backend API (`/api/resolve`, `/api/product/[id]`).
- `api-repository.ts` impl of `ProductRepository`.
- FB Marketplace adapter + fixture.
- Sonion idle/talk animations within the shadow root (the SVG renders; the
  Framer Motion driver still needs to be wired).
- Full popup (recent sightings list, per-source funding panel).
