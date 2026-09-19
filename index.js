import { registerRootComponent } from 'expo';
import App from './App';

// IMPORTANT: the background location task must be registered as the app JS loads,
// (not only inside a component) so Android can call it even when the UI is killed.
import './locationTask';

registerRootComponent(App);
