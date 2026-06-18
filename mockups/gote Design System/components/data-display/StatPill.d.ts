export interface StatPillProps {
  /** Leading Ionicons glyph name. */
  icon?: string;
  children: React.ReactNode;
  /** Use the translucent-white treatment for the green hero banner. */
  onBrand?: boolean;
}
/** Compact rounded stat pill with a leading glyph. */
export function StatPill(props: StatPillProps): JSX.Element;
