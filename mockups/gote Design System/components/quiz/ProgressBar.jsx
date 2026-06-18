import React from 'react';

/**
 * gote ProgressBar — the thin pill track that shows quiz progress. `onPhoto`
 * is the white-on-translucent treatment used over the fullscreen photo; the
 * default is brand green on the sunken fill.
 */
export function ProgressBar({ value = 0, onPhoto = false, style, ...rest }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      style={{
        height: 6,
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
        background: onPhoto ? 'rgba(255,255,255,0.3)' : 'var(--faint)',
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 'var(--radius-pill)',
          background: onPhoto ? 'var(--on-dark)' : 'var(--primary)',
          transition: 'width 240ms ease',
        }}
      />
    </div>
  );
}
