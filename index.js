// React Native's URL implementation is incomplete, and supabase-js needs a
// working one. Applied here, at the entry point, rather than inside the sync
// layer: this is a runtime polyfill for the app, and keeping it out of
// src/sync/client.js is what lets that module load in a plain Node test.
import 'react-native-url-polyfill/auto';

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and sets up the environment for both Expo Go and native builds.
registerRootComponent(App);
