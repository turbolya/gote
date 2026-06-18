One-line: a multiple-choice answer chip for the quiz — translucent over the photo by default, turning solid green/red once graded.

```jsx
<ChoiceButton onClick={...}>Eastern Newt</ChoiceButton>
<ChoiceButton state="correct">Eastern Newt</ChoiceButton>
<ChoiceButton state="wrong">Red Eft</ChoiceButton>
```

Notes: stack several with ~8px gaps inside the centered answer panel. `disabled` them once an answer is locked in.
