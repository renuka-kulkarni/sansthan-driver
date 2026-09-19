/**
 * Android background location: the reliable, Play-Store-compliant approach.
 *
 * We register a TaskManager task and start expo-location's
 * startLocationUpdatesAsync with a FOREGROUND SERVICE. Android keeps a
 * persistent notification ("Sharing live location...") while tracking, which
 * is exactly what Android requires for continuous background GPS and is what
 * lets tracking keep running when the screen is off or the app is backgrounded.
 *
 * The task hands each batch of fixes to flush(), which uploads them (or queues
 * them offline). Because the task can run with the UI killed, it reads the
 * session/token from AsyncStorage itself.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { LOCATION_TASK_NAME, TRACKING } from './config';
import { toPoint, flush } from './sync';
import { setTrackingActive } from './storage';

// ---- the background task ----
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.log('[bg-location] error', error.message);
    return;
  }
  const locations = (data && data.locations) || [];
  if (!locations.length) return;
  const points = locations.map((l) => toPoint(l, 'tracking')).filter(Boolean);
  if (!points.length) return;
  try {
    await flush(points);
  } catch (e) {
    console.log('[bg-location] flush failed', e.message);
  }
});

/** Start continuous tracking with a foreground service. Assumes permissions granted. */
export async function startTracking() {
  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (already) {
    await setTrackingActive(true);
    return;
  }
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: TRACKING.timeIntervalMs,
    distanceInterval: TRACKING.distanceIntervalM,
    pausesUpdatesAutomatically: false,
    // Keep delivering while the app is backgrounded (Android batches otherwise).
    deferredUpdatesInterval: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Sansthan Driver - trip active',
      notificationBody: 'Sharing your bus location with the Control Room.',
      notificationColor: '#0B5E4F',
      killServiceOnDestroy: false,
    },
  });
  await setTrackingActive(true);
}

/** Stop tracking and remove the foreground notification. */
export async function stopTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  await setTrackingActive(false);
}

export async function isTracking() {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
}
