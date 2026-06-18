export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. primary = green CTA, success/danger = solid quiz grades,
   *  tinted = soft result actions, outline = white border for use over photos. */
  variant?: 'primary' | 'success' | 'danger' | 'tinted' | 'outline';
  /** Tint color for variant="tinted". primary = "Play again" (brand teal), orange = "Revisit missed". */
  tone?: 'primary' | 'orange';
  /** Ionicons glyph name shown before the label (e.g. "play", "home"). */
  icon?: string;
  /** Ionicons glyph name shown after the label (e.g. "arrow-forward"). */
  iconRight?: string;
  /** Stretch to fill the container width. Defaults to true. */
  fullWidth?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Primary action control for gote — heavy label, rounded, full-width by default.
 */
export function Button(props: ButtonProps): JSX.Element;
