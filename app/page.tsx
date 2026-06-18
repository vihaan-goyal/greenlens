import Link from 'next/link';
import { headers } from 'next/headers';
import { Sonion } from '@/components/Sonion';
import { VERDICT_VAR } from '@/lib/domain/verdict';

/**
 * Marketing landing — the front door for both platforms. Frameless and
 * responsive (it renders outside the `(app)` phone-mockup group).
 *
 * The website is the product; this page just hands each platform the right
 * doorway into it:
 *   • Desktop → install the browser extension (overlays a verdict while you
 *     shop, click-through to the site).
 *   • Phone → no extension (Chrome Android has none, iOS Safari is painful), so
 *     the doorway is searching/browsing the catalog directly.
 *
 * We detect the platform server-side to choose the *primary* call to action,
 * but BOTH are always rendered — detection only reorders/emphasizes, it never
 * hides an option, so a wrong guess still leaves everything reachable.
 */
const MOBILE_RE = /Android|iPhone|iPad|iPod|Mobile|BlackBerry|IEMobile|Opera Mini/i;

export default async function LandingPage() {
  const ua = (await headers()).get('user-agent') ?? '';
  const isMobile = MOBILE_RE.test(ua);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Atmospheric corner washes — same warm botanical bloom as the app. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full anim-shimmer"
        style={{ background: 'radial-gradient(closest-side, var(--halo-leaf), transparent 70%)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-40 top-80 h-[28rem] w-[28rem] rounded-full"
        style={{ background: 'radial-gradient(closest-side, var(--halo-amber), transparent 70%)' }}
      />

      <main className="relative mx-auto w-full max-w-5xl px-6 py-14 md:py-20">
        {/* ─── HERO ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col items-center text-center anim-rise">
          <Sonion mood="happy" size={96} idle />
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--accent-deep)' }}>
            Greenlens
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[34px] font-semibold leading-[1.08] text-ink md:text-[52px]">
            Every rating source on one cosmetic —{' '}
            <span className="mark-leaf">and where they disagree.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-2 md:text-[16.5px]">
            Is this safe for <em>you</em>? Greenlens shows what every public rater
            says, names who funds each opinion, and gives you one score whose
            weighting <span className="u-bold font-semibold">you</span> control —
            never a single blended number that hides the conflict.
          </p>
        </header>

        {/* ─── PLATFORM DOORWAYS ────────────────────────────────────────── */}
        <section className="mt-12 grid gap-5 md:mt-16 md:grid-cols-2">
          {isMobile ? (
            <>
              <PhoneCard primary />
              <ComputerCard />
            </>
          ) : (
            <>
              <ComputerCard primary />
              <PhoneCard />
            </>
          )}
        </section>

        {/* ─── WHY IT'S DIFFERENT ───────────────────────────────────────── */}
        <section className="mt-16 md:mt-24">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-3">
            What makes it honest
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <PointCard
              title="Disagreement stays visible"
              body="When EWG says “concern” and Yuka says “clean,” we show the spread and name both — we never average a conflict into silence."
            />
            <PointCard
              title="Who pays is always shown"
              body="Every rating carries its funding model — nonprofit, ad-supported, subscription — so you can weigh the source, not just the score."
            />
            <PointCard
              title="You own the weighting"
              body="Safety, environment, labor, packaging — slide them to what you care about. The composite is computed live and never stored."
            />
          </div>
        </section>

        {/* ─── INSTALL (extension) ──────────────────────────────────────── */}
        <section id="install" className="mt-16 scroll-mt-8 md:mt-24">
          <div
            className="overflow-hidden rounded-card p-6 md:p-8 halo-tr"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', ['--halo' as string]: 'var(--halo-leaf)' }}
          >
            <div className="halo-content">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--accent-deep)' }}>
                Desktop · Chrome
              </p>
              <h2 className="mt-1 font-display text-[22px] font-semibold text-ink md:text-[26px]">
                Add the extension
              </h2>
              <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-2">
                Not on the Chrome Web Store yet — it loads unpacked from a local
                build while we&apos;re in development:
              </p>
              <ol className="mt-4 grid gap-3 md:grid-cols-3">
                <InstallStep n={1} mono="npm run ext:build">
                  Build the extension into <code className="text-ink">dist/extension</code>.
                </InstallStep>
                <InstallStep n={2} mono="chrome://extensions">
                  Open it and turn on <span className="text-ink">Developer mode</span> (top right).
                </InstallStep>
                <InstallStep n={3} mono="Load unpacked">
                  Select the <code className="text-ink">dist/extension</code> folder. Open an Amazon product page.
                </InstallStep>
              </ol>
            </div>
          </div>
        </section>

        <footer className="mt-16 flex flex-col items-center gap-1 text-center md:mt-20">
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink-3">Cosmetics only · lead with safety</p>
          <p className="text-[12px] text-ink-2">
            Built around one rule: never hide a disagreement behind a single number.
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ─── Desktop doorway: the extension ─────────────────────────────────────── */
function ComputerCard({ primary = false }: { primary?: boolean }) {
  return (
    <PlatformCard
      primary={primary}
      kicker="On your computer"
      title="A verdict while you shop"
      body="The browser extension drops a small Sonion card onto product pages. Tap it for the spread; open it for the full breakdown on the site."
    >
      <OverlayPreview />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href="#install"
          className="inline-flex items-center gap-2 rounded-pill px-5 py-2.5 text-[13px] font-semibold shadow-card"
          style={{ background: 'var(--accent-deep)', color: 'var(--card)' }}
        >
          Add to Chrome
        </a>
        <Link href="/browse" className="text-[12.5px] font-semibold text-ink-2 underline-offset-4 hover:underline">
          or browse the catalog →
        </Link>
      </div>
    </PlatformCard>
  );
}

/* ─── Phone doorway: search / browse ─────────────────────────────────────── */
function PhoneCard({ primary = false }: { primary?: boolean }) {
  return (
    <PlatformCard
      primary={primary}
      kicker="On your phone"
      title="Look it up in seconds"
      body="No extension needed — phones don't really do those. Search a brand, product, or barcode and get the same side-by-side verdict."
    >
      <form method="get" action="/browse" className="mt-1">
        <div
          className="flex items-center gap-2 rounded-pill bg-card pl-4 pr-2 py-2 shadow-card"
          style={{ border: '1px solid var(--line)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <circle cx="7" cy="7" r="4.5" stroke="var(--ink-2)" strokeWidth="1.6" fill="none" />
            <path d="M10.5 10.5 L 14 14" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            name="q"
            type="text"
            placeholder="Search a brand, product, or barcode"
            aria-label="Search products"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
          <button
            type="submit"
            className="rounded-pill bg-espresso px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-card"
          >
            Look up
          </button>
        </div>
      </form>
      <div className="mt-4">
        <Link href="/browse" className="text-[12.5px] font-semibold text-ink-2 underline-offset-4 hover:underline">
          Browse the shelf →
        </Link>
      </div>
    </PlatformCard>
  );
}

function PlatformCard({
  primary,
  kicker,
  title,
  body,
  children,
}: {
  primary: boolean;
  kicker: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative flex flex-col rounded-card p-6 transition md:p-7"
      style={{
        background: 'var(--card)',
        border: primary ? '1.5px solid var(--accent-deep)' : '1px solid var(--line)',
        boxShadow: primary ? 'var(--shadow-lift, 0 18px 40px -24px rgba(46,42,34,0.5))' : 'none',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--accent-deep)' }}>
          {kicker}
        </p>
        {primary && (
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
            style={{ background: 'var(--accent-deep)', color: 'var(--card)' }}
          >
            You&apos;re here
          </span>
        )}
      </div>
      <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight text-ink md:text-[25px]">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{body}</p>
      <div className="mt-auto pt-5">{children}</div>
    </section>
  );
}

/* A miniature of the in-page extension card, so desktop users see what lands. */
function OverlayPreview() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4"
      style={{ background: 'var(--card-2)', border: '1px dashed var(--line)' }}
      aria-hidden
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-3">On a product page</p>
      <div className="mt-3 flex items-center justify-end">
        <div
          className="flex items-center gap-2.5 rounded-2xl px-3 py-2 shadow-card"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <Sonion mood="concerned" size={34} idle />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[20px] font-semibold tabular" style={{ color: VERDICT_VAR.poor }}>
              50
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: VERDICT_VAR.poor }}>
              Poor
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function PointCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card p-5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

function InstallStep({ n, mono, children }: { n: number; mono: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl p-3.5" style={{ background: 'var(--card-2)', border: '1px solid var(--line-soft)' }}>
      <div className="flex items-center gap-2">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold tabular"
          style={{ background: 'var(--card)', color: 'var(--accent-deep)', border: '1px solid var(--line)' }}
        >
          {n}
        </span>
        <code className="text-[11.5px] font-semibold text-ink">{mono}</code>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-ink-2">{children}</p>
    </li>
  );
}
