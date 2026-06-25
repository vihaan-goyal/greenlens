import type { CSSProperties } from 'react';

export function Skel({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skel rounded-lg ${className ?? ''}`} style={style} aria-hidden />;
}
