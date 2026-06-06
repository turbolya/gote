// Runs before each E2E spec file. With Detox synchronization disabled (required
// on the iOS 26 simulator), a spec can occasionally flake on first-render/keyboard
// timing — retry once before counting it as a failure.
jest.retryTimes(1, { logErrorsBeforeRetry: true });
