import type { ReactNode } from 'react';

/**
 * Visual iPhone 15 mockup. Pure server component, no interactivity.
 *
 * Dimensions: iPhone 15 logical viewport is 393 × 852 pt. Outer frame adds
 * ~12pt of bezel on each side. Status bar (top) and home indicator (bottom)
 * are overlaid on the inner viewport; the scrollable page content sits
 * inside a safe area between them, so pages don't need their own top/bottom
 * safe-area padding.
 */
const VIEWPORT_W = 393;
const VIEWPORT_H = 852;
const BEZEL = 12;
const STATUS_BAR = 54; // top safe area incl. dynamic island
const HOME_INDICATOR = 34; // bottom safe area

export function DeviceFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center overflow-auto p-6"
      style={{ backgroundColor: '#1F1B16' }}
    >
      <div
        className="relative shrink-0 rounded-[60px] shadow-2xl"
        style={{
          width: VIEWPORT_W + BEZEL * 2,
          height: VIEWPORT_H + BEZEL * 2,
          background:
            'linear-gradient(135deg, #2A2723 0%, #16140F 40%, #0E0C09 60%, #2A2723 100%)',
          padding: BEZEL,
        }}
      >
        <SideButtons />

        <div
          className="relative overflow-hidden rounded-[48px] bg-bg"
          style={{ width: VIEWPORT_W, height: VIEWPORT_H }}
        >
          <DynamicIsland />
          <StatusBar />

          <div
            className="absolute inset-0 overflow-y-auto"
            style={{ paddingTop: STATUS_BAR, paddingBottom: HOME_INDICATOR }}
          >
            {children}
          </div>

          <HomeIndicator />
        </div>
      </div>
    </div>
  );
}

function DynamicIsland() {
  return (
    <div
      className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-black"
      style={{ top: 11, width: 126, height: 37 }}
      aria-hidden
    />
  );
}

function StatusBar() {
  return (
    <div
      className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-7 text-[15px] font-semibold text-ink"
      style={{ height: STATUS_BAR, paddingTop: 18 }}
    >
      <span className="tabular">9:41</span>
      <span className="flex items-center gap-[6px]">
        <SignalIcon />
        <WifiIcon />
        <BatteryIcon />
      </span>
    </div>
  );
}

function HomeIndicator() {
  return (
    <div
      className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink"
      style={{ bottom: 8, width: 134, height: 5 }}
      aria-hidden
    />
  );
}

function SideButtons() {
  // Subtle side hardware — silencer switch + volume up/down on the left,
  // power on the right. Purely decorative.
  return (
    <>
      <span
        className="absolute rounded-l"
        style={{ left: -2, top: 130, width: 3, height: 30, background: '#1A1815' }}
        aria-hidden
      />
      <span
        className="absolute rounded-l"
        style={{ left: -2, top: 188, width: 3, height: 56, background: '#1A1815' }}
        aria-hidden
      />
      <span
        className="absolute rounded-l"
        style={{ left: -2, top: 256, width: 3, height: 56, background: '#1A1815' }}
        aria-hidden
      />
      <span
        className="absolute rounded-r"
        style={{ right: -2, top: 198, width: 3, height: 92, background: '#1A1815' }}
        aria-hidden
      />
    </>
  );
}

function SignalIcon() {
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" aria-hidden fill="currentColor">
      <rect x="0" y="7" width="3" height="4" rx="1" />
      <rect x="5" y="5" width="3" height="6" rx="1" />
      <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
      <rect x="15" y="0" width="3" height="11" rx="1" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 4.2 A11 11 0 0 1 15 4.2" />
      <path d="M3.4 6.6 A7 7 0 0 1 12.6 6.6" />
      <path d="M5.8 9 A3 3 0 0 1 10.2 9" />
      <circle cx="8" cy="10.4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <span className="ml-1 inline-flex items-center">
      <span
        className="relative inline-block rounded-[3px]"
        style={{
          width: 24,
          height: 11,
          border: '1px solid currentColor',
          opacity: 0.95,
        }}
      >
        <span
          className="absolute left-[1px] top-[1px] bottom-[1px] rounded-[1.5px] bg-current"
          style={{ width: 18 }}
        />
      </span>
      <span
        className="ml-[1px] inline-block rounded-r"
        style={{ width: 1.5, height: 4, background: 'currentColor', opacity: 0.6 }}
      />
    </span>
  );
}
