import { registerRootComponent } from 'expo';
import App from './App';
import { initMonitoring, wrapApp } from './src/monitoring';

// Start crash/error reporting before anything renders (no-op without a DSN).
initMonitoring();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and sets up the environment for both Expo Go and native builds.
// wrapApp adds Sentry's error boundary when monitoring is enabled.
registerRootComponent(wrapApp(App));
