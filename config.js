/**
 * App configuration.
 *
 * >>> CHANGE THIS ONE LINE before you build the APK. <<<
 *
 * Set API_BASE_URL to the PUBLIC https URL where you deployed the server
 * (see docs/DEPLOYMENT.md). It must NOT be localhost/127.0.0.1, because the
 * driver's phone (mobile data) and the Control Room (office Wi-Fi) are on
 * different networks and both talk to this same public URL.
 *
 * Examples:
 *   https://sansthan-tracking.onrender.com
 *   https://track.yourdomain.org
 *
 * For quick testing on the same Wi-Fi you may use your computer's LAN IP,
 * e.g. http://192.168.1.20:4000  (still not "localhost").
 */
export const API_BASE_URL = 'https://REPLACE-WITH-YOUR-SERVER-URL';

// How often to read GPS while tracking.
export const TRACKING = {
  timeIntervalMs: 5000,      // send at most every 5 seconds
  distanceIntervalM: 10,     // ...or every 10 metres, whichever comes first
  // Ignore fixes worse than this many metres (client-side pre-filter; server checks too)
  maxAccuracyM: 100,
  // Don't send a new point unless the bus moved at least this far (avoids spamming while parked)
  minMoveM: 5,
};

// Key used to name the Android background location task.
export const LOCATION_TASK_NAME = 'sansthan-background-location';
