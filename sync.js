/**
 * Turns raw GPS fixes into clean points and gets them to the server reliably.
 *
 *  - filters out invalid / too-inaccurate / not-moved fixes  (no duplicate/junk data)
 *  - always tries to drain the offline queue first, oldest-first
 *  - if the network is down, points are kept in the queue and retried later
 *
 * Both the foreground UI and the Android background task call flush().
 */

import { sendLocations } from './api';
import {
  getSession, getQueue, setQueue, enqueuePoints, getLastPoint, setLastPoint,
} from './storage';
import { TRACKING } from './config';

function haversineMeters(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Convert an expo-location object to our wire format, or null if it should be dropped. */
export function toPoint(loc, tripStatus = 'tracking') {
  const c = loc && loc.coords;
  if (!c) return null;
  const { latitude, longitude, speed, heading, accuracy } = c;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  if (TRACKING.maxAccuracyM > 0 && accuracy != null && accuracy > TRACKING.maxAccuracyM) return null;
  return {
    lat: latitude,
    lng: longitude,
    speed: speed != null && speed >= 0 ? speed : null, // m/s
    heading: heading != null && heading >= 0 ? heading : null, // degrees
    accuracy: accuracy != null ? accuracy : null,
    tripStatus,
    timestamp: new Date(loc.timestamp || Date.now()).toISOString(),
  };
}

/**
 * Accept new points (already in wire format), drop ones that haven't moved,
 * then push everything (queue + new) to the server. Anything not accepted by
 * the server stays queued.
 *
 * @returns {Promise<{sent:number, queued:number, online:boolean, error?:string}>}
 */
export async function flush(newPoints = []) {
  const session = await getSession();
  if (!session || !session.token) return { sent: 0, queued: 0, online: false, error: 'not-logged-in' };

  // min-move de-dup against the last point we actually accepted
  let last = await getLastPoint();
  const kept = [];
  for (const p of newPoints) {
    if (last && haversineMeters(last, p) < TRACKING.minMoveM && p.tripStatus !== 'stopped') {
      continue; // parked / GPS jitter -> skip
    }
    kept.push(p);
    last = p;
  }
  if (kept.length) await setLastPoint(last);

  // build the outgoing batch: queued points first (oldest), then the new ones
  const queue = await getQueue();
  const batch = queue.concat(kept);
  if (batch.length === 0) return { sent: 0, queued: 0, online: true };

  try {
    await sendLocations(session.token, batch);
    await setQueue([]); // everything delivered
    return { sent: batch.length, queued: 0, online: true };
  } catch (e) {
    // Network/server problem: keep the new points for the next attempt.
    if (kept.length) await enqueuePoints(kept);
    const q = await getQueue();
    return { sent: 0, queued: q.length, online: false, error: e.message };
  }
}
