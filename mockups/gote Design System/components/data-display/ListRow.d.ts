export interface ListRowProps {
  /** Ionicons glyph name shown at the leading edge, tinted by `accent`. */
  icon?: string;
  /** Which accent color tints the glyph. */
  accent?: 'green' | 'blue' | 'violet' | 'amber' | 'teal' | 'indigo' | 'rose' | 'slate';
  /** Row title (700 weight). */
  title: React.ReactNode;
  /** Quiet subtitle below the title. */
  sub?: React.ReactNode;
  /** Replace the trailing chevron with custom content (e.g. a flag button). */
  trailing?: React.ReactNode;
  /** Draw a hairline divider on top — set on every row after the first in a group. */
  divider?: boolean;
  onClick?: () => void;
}

/**
 * The standard tappable list/menu row: accent glyph, title + subtitle, chevron.
 */
export function ListRow(props: ListRowProps): JSX.Element;
