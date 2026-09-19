/**
 * Location permission flow, in the order Android requires:
 *   1) foreground ("while using the app")
 *   2) background ("allow all the time")  -> needed for tracking with screen off
 *
 * Also checks that the device's location services (GPS) are switched on.
 */

import * as Location from 'expo-location';

export async function getPermissionStatus() {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  const servicesOn = await Location.hasServicesEnabledAsync();
  return {
    foreground: fg.status, // 'granted' | 'denied' | 'undetermined'
    background: bg.status,
    servicesOn,
  };
}

export async function requestPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return { ok: false, stage: 'foreground', status: fg.status };
  }
  // Background must be requested separately; on Android 11+ the user is sent to
  // Settings to choose "Allow all the time".
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    // Foreground-only still works while the app is open; warn the caller.
    return { ok: true, stage: 'foreground-only', status: bg.status };
  }
  return { ok: true, stage: 'background', status: 'granted' };
}
