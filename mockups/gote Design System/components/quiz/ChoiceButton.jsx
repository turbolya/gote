import React from 'react';

/**
 * gote ChoiceButton — a multiple-choice answer chip on the quiz screen. It
 * lives over a darkened photo, so the default state is translucent-dark with a
 * white border and white label; once answered it turns solid green (correct)
 * or red (wrong).
 */
export function ChoiceButton({
  state = 'default',
  disabled = false,
  children,
  onClick,
  style,
  ...rest
}) {
  const states = {
    default: {
      background: 'rgba(0,0,0,0.4)',
      borderColor: 'rgba(255,255,255,0.5)',
      color: 'var(--on-dark)',
    },
    correct: { background: 'var(--correct)', borderColor: 'var(--correct)', color: 'var(--on-dark)' },
    wrong: { background: 'var(--wrong)', borderColor: 'var(--wrong)', color: 'var(--on-dark)' },
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'center',
        fontFamily: 'var(--font-system)',
        fontSize: 'var(--text-body)',
        fontWeight: 700,
        padding: '11px 14px',
        borderRadius: 'var(--radius-md)',
        borderWidth: 1.5,
        borderStyle: 'solid',
        cursor: disabled ? 'default' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
        ...states[state],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
