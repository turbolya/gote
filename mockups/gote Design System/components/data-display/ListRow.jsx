import React from 'react';

const ACCENTS = {
  green: 'var(--accent-green-fg)',
  blue: 'var(--accent-blue-fg)',
  violet: 'var(--accent-violet-fg)',
  amber: 'var(--accent-amber-fg)',
  teal: 'var(--accent-teal-fg)',
  indigo: 'var(--accent-indigo-fg)',
  rose: 'var(--accent-rose-fg)',
  slate: 'var(--accent-slate-fg)',
};

/**
 * gote ListRow — the menu/list row: an accent-tinted Ionicons glyph, a title
 * with a quiet subtitle, and a trailing chevron. Rows sit in a group divided
 * by hairlines (set `divider` on every row after the first).
 */
export function ListRow({
  icon,
  accent = 'green',
  title,
  sub,
  trailing,
  divider = false,
  onClick,
  style,
  ...rest
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '15px 0',
        cursor: onClick ? 'pointer' : 'default',
        borderTop: divider ? '1px solid var(--border)' : 'none',
        fontFamily: 'var(--font-system)',
        ...style,
      }}
      {...rest}
    >
      {icon && (
        <ion-icon
          name={icon}
          style={{ fontSize: 24, width: 28, textAlign: 'center', color: ACCENTS[accent] || accent }}
        ></ion-icon>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-row)', fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize: 'var(--text-sub)', color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      {trailing !== undefined ? trailing : (
        <ion-icon name="chevron-forward" style={{ fontSize: 20, color: 'var(--muted)' }}></ion-icon>
      )}
    </div>
  );
}
