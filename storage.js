/**
 * Thin wrapper around AsyncStorage for the few things we persist:
 *   - session (token + driver + assigned bus)  -> so the driver stays logged in
 *   - the offline queue of GPS points not yet uploaded
 *   - the last point we sent (for min-distance de-duplication)
 *
 * The background task and the UI both read/write here, so it is the single
 * source of truth shared between the two JS contexts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const K = {
  session: 'sansthan.session',
  queue: 'sansthan.queue',
  lastPoint: 'sansthan.lastPoint',
  tracking: 'sansthan.trackingActive',
};

export async function saveSession(session) {
  await AsyncStorage.setItem(K.session, JSON.stringify(session));
}
export async function getSession() {
  const raw = await AsyncStorage.getItem(K.session);
  return raw ? JSON.parse(raw) : null;
}
export async function clearSession() {
  await AsyncStorage.multiRemove([K.session, K.queue, K.lastPoint, K.tracking]);
}

export async function setTrackingActive(active) {
  await AsyncStorage.setItem(K.tracking, active ? '1' : '0');
}
export async function isTrackingActive() {
  return (await AsyncStorage.getItem(K.tracking)) === '1';
}

// ---- offline queue ----
export async function getQueue() {
  const raw = await AsyncStorage.getItem(K.queue);
  return raw ? JSON.parse(raw) : [];
}
export async function setQueue(points) {
  // Cap the queue so a very long outage cannot exhaust storage (keep newest 2000).
  const capped = points.slice(-2000);
  await AsyncStorage.setItem(K.queue, JSON.stringify(capped));
}
export async function enqueuePoints(points) {
  const existing = await getQueue();
  await setQueue(existing.concat(points));
}

// ---- last sent point (for de-dup / min move) ----
export async function getLastPoint() {
  const raw = await AsyncStorage.getItem(K.lastPoint);
  return raw ? JSON.parse(raw) : null;
}
export async function setLastPoint(p) {
  await AsyncStorage.setItem(K.lastPoint, JSON.stringify(p));
}
