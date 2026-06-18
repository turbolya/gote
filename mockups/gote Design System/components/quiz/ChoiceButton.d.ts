export interface ChoiceButtonProps {
  /** Answer state: default (unanswered), correct, or wrong. */
  state?: 'default' | 'correct' | 'wrong';
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

/**
 * Multiple-choice answer chip used over the quiz photo.
 */
export function ChoiceButton(props: ChoiceButtonProps): JSX.Element;
