export interface ProgressBarProps {
  /** Progress from 0 to 1. */
  value?: number;
  /** White-on-translucent treatment for use over a photo. */
  onPhoto?: boolean;
}
/** Thin pill progress track. */
export function ProgressBar(props: ProgressBarProps): JSX.Element;
