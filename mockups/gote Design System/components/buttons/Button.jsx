import React from 'react';

/**
 * gote Button — the app's primary action control.
 * Heavy 800-weight label, 16px radius, ~50px tall, full-width by default
 * (gote stacks buttons in a column). Renders an optional Ionicons glyph on
 * either side via <ion-icon> (load the ionicons CDN on the page).
 */
export function Button({
  variant = 'primary',
  tone = 'primary',
  icon,
  iconRight,
  fullWidth = true,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: fullWidth ? '100%' : 'auto',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-system)',
    fontSize: 'var(--text-body)',
    fontWeight: 800,
    lineHeight: 1,
    padding: '15px 22px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid transparent',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'opacity 120ms ease, transform 120ms ease',
    WebkitTapHighlightColor: 'transparent',
  };

  const tintPrimary = {
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    borderColor: '#b7dde8',
  };
  const tintOrange = {
    background: 'var(--action-orange-bg)',
    color: 'var(--action-orange-fg)',
    borderColor: '#f6d2b3',
  };

  const variants = {
    primary: {
      background: 'var(--primary)',
      color: 'var(--on-dark)',
      fontWeight: 900,
      boxShadow: 'var(--shadow-primary)',
    },
    success: { background: 'var(--correct)', color: 'var(--on-dark)' },
    danger: { background: 'var(--wrong)', color: 'var(--on-dark)' },
    tinted: tone === 'orange' ? tintOrange : tintPrimary,
    outline: {
      background: 'transparent',
      color: 'var(--on-dark)',
      border: '2px solid var(--on-dark)',
      fontWeight: 800,
    },
  };

  const sz = 19;
  return (
    <button
      type="button"
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      {...rest}
    >
      {icon && <ion-icon name={icon} style={{ fontSize: sz }}></ion-icon>}
      <span>{children}</span>
      {iconRight && <ion-icon name={iconRight} style={{ fontSize: sz }}></ion-icon>}
    </button>
  );
}
