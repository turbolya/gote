import React from 'react';

/**
 * gote IconButton — a round, icon-only control. The faint variant is the
 * standard back/close button (40px circle on the sunken fill); the photo
 * variant is bare white chrome used over fullscreen photos.
 */
export function IconButton({
  icon,
  variant = 'faint',
  size = 40,
  iconSize,
  color,
  disabled = false,
  style,
  ...rest
}) {
  const variants = {
    faint: { background: 'var(--faint)', color: color || 'var(--text)' },
    photo: { background: 'transparent', color: color || 'var(--on-dark)' },
    brand: { background: 'var(--primary)', color: color || 'var(--on-dark)' },
  };
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-pill)',
        border: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        WebkitTapHighlightColor: 'transparent',
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      <ion-icon name={icon} style={{ fontSize: iconSize || Math.round(size * 0.52) }}></ion-icon>
    </button>
  );
}
