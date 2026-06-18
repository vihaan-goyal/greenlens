/**
 * Shell for the app screens (catalog + product). Full-width and responsive:
 * each page owns its own width, so the catalog can spread into a multi-column
 * grid on desktop while the detail pages center at a comfortable reading width.
 *
 *   • real phones (narrow): full-bleed, edge to edge — the device is the frame.
 *   • desktop (wide): the page fills the screen on a warm canvas with soft
 *     ambient washes, like a real web app rather than a centered phone column.
 *
 * The document scrolls natively. URLs are unchanged — this only restyles chrome.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Ambient botanical washes — desktop only, so wide screens stay warm. */}
      <span
        aria-hidden
        className="pointer-events-none fixed -right-40 -top-40 hidden h-[36rem] w-[36rem] rounded-full anim-shimmer md:block"
        style={{ background: 'radial-gradient(closest-side, var(--halo-leaf), transparent 70%)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none fixed -left-48 bottom-0 hidden h-[32rem] w-[32rem] rounded-full md:block"
        style={{ background: 'radial-gradient(closest-side, var(--halo-amber), transparent 70%)' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
