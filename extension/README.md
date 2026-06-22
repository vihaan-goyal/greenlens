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
      dom.ts                   generic text/attr/clean/splitIngredients helpers
      amazon.ts                /dp/ and /gp/product/ scraper
      sephora.ts               /product/ scraper (data-at hooks + ld+json gtin)
      __fixtures__/*.html      saved page snapshots — fail-the-test-first
    card/
      mount.tsx                shadow-DOM root, tokens.css adopted inside
      Card.tsx                 compact in-page card
      card.css                 styles scoped to the shadow root
  shared/
    sighting.ts                RawProductSighting type
    messages.ts                discriminated unions for both directions
  popup/                       toolbar popup (weight controls)
  options/                     full options page (weights · API endpoint · raters)
```

Shared domain code is imported from `@/lib/domain/*` — those modules stay
pure and serve both the Next.js app and the extension.

## Dependencies (installed)

The build deps are in `package.json`: `vite`, `@crxjs/vite-plugin`,
`@vitejs/plugin-react`, `@types/chrome`, `jsdom` (vitest adapter tests), and
`zod`. `react`/`react-dom` come from the web app.

## Build commands

```
npm run ext:dev      # vite watch → unpacked extension in dist/extension/
npm run ext:build    # production MV3 build
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

## Wired up (no longer pending)

- The full `/lib/matcher` pipeline (blocking → features → clustering) runs in
  the SW.
- `/api/resolve` resolves sightings against the full Prisma catalog; the SW
  hits it first and falls back to the bundled seed only when it's unreachable.
- Both site adapters (Amazon, Sephora) with fixtures + tests.
- Options page (per-axis weights, configurable API endpoint, rater funding
  reference).
- Sonion idle animation inside the shadow root — driven by CSS keyframes in
  `content/card/card.css` (not Framer Motion), with a `prefers-reduced-motion`
  guard.

## What is intentionally NOT here yet

- FB Marketplace adapter + fixture (the open adapter slot; weak cosmetics
  signal — used listings rarely carry ingredients or a GTIN).
- Sonion talk/nod animation inside the in-page card (the popup/web app have it).
- Recent-sightings history in the popup.
