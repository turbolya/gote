import React from 'react';

/**
 * gote SectionLabel — the small uppercase heading that introduces a group of
 * rows ("PLAY", "LEARN", "SETTINGS"). Heavy, tracked-out, in the dark-green
 * section color.
 */
export function SectionLabel({ children, style, ...rest }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-system)',
        fontSize: 'var(--text-label)',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-label)',
        color: 'var(--section-label)',
        margin: '22px 0 4px 2px',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
