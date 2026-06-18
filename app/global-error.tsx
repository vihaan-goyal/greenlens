'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, so it
 * must supply its own <html>/<body>. No DeviceFrame, no shared chrome — just a
 * legible fallback with a full reload, since at this point the layout is gone.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Greenlens fatal error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: 'var(--bg, #ECE5D8)',
          color: 'var(--ink, #2E2A22)',
          fontFamily: "'Manrope', ui-rounded, system-ui, sans-serif",
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, margin: 0 }}>
          Greenlens hit a snag.
        </h1>
        <p style={{ maxWidth: 320, fontSize: 14, color: 'var(--ink-2, #6E675A)', margin: 0 }}>
          Something failed before the page could load. Reloading usually clears it.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--accent-deep, #5E6B47)',
            color: 'var(--card, #FBF9F4)',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
