import React from 'react';

/**
 * gote StatPill — a compact rounded pill with a leading Ionicons glyph and a
 * stat label. `onBrand` is the translucent-white treatment used on the green
 * hero; the default sits on the sunken fill.
 */
export function StatPill({ icon, children, onBrand = false, style, ...rest }) {
  const skin = onBrand
    ? { background: 'rgba(255,255,255,0.16)', color: 'var(--on-dark)' }
    : { background: 'var(--faint)', color: 'var(--text)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 14px',
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-system)',
        fontSize: 'var(--text-sub)',
        fontWeight: 700,
        ...skin,
        ...style,
      }}
      {...rest}
    >
      {icon && <ion-icon name={icon} style={{ fontSize: 15 }}></ion-icon>}
      {children}
    </span>
  );
}
