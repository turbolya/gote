export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ionicons glyph name (e.g. "chevron-back", "close"). */
  icon: string;
  /** faint = round button on sunken fill (back/close); photo = bare white chrome over photos; brand = green. */
  variant?: 'faint' | 'photo' | 'brand';
  /** Diameter in px. Default 40. */
  size?: number;
  /** Glyph size in px. Defaults to ~52% of size. */
  iconSize?: number;
  /** Override glyph color. */
  color?: string;
  disabled?: boolean;
}

/** Round, icon-only control — the standard back/close button. */
export function IconButton(props: IconButtonProps): JSX.Element;
