import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking, AppState,
} from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';

import { colors } from './theme';
import { getPermissionStatus, requestPermissions } from './permissions';
import { startTracking, stopTracking, isTracking } from './locationTask';
import { flush, toPoint } from './sync';
import { getQueue, getLastPoint, clearSession } from './storage';

function Row({ label, value, valueColor }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function Dot({ color }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

// Row variant for the dark debug panel (light text).
function DRow({ label, value, valueColor }) {
  return (
    <View style={styles.drow}>
      <Text style={styles.drowLabel}>{label}</Text>
      <Text style={[styles.drowValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export default function TrackingScreen({ session, onLoggedOut }) {
  const { driver, bus } = session;
  const [perms, setPerms] = useState({ foreground: 'undetermined', background: 'undetermined', servicesOn: true });
  const [tracking, setTracking] = useState(false);
  const [current, setCurrent] = useState(null); // {lat,lng,accuracy,speed,heading}
  const [lastFixAt, setLastFixAt] = useState(null); // when the phone last produced a GPS fix
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [lastPoint, setLastPointState] = useState(null);
  const [busy, setBusy] = useState(false);

  const watchRef = useRef(null);

  const refreshStatus = useCallback(async () => {
    setPerms(await getPermissionStatus());
    setTracking(await isTracking());
    setQueued((await getQueue()).length);
    setLastPointState(await getLastPoint());
  }, []);

  // Foreground-only location watch, purely to display live GPS status.
  // Uploading is done by the background task, so this never sends data.
  const startDisplayWatch = useCallback(async () => {
    if (watchRef.current) return;
    const { foreground } = await getPermissionStatus();
    if (foreground !== 'granted') return;
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
      (loc) => { setCurrent(loc.coords); setLastFixAt(Date.now()); },
    );
  }, []);

  useEffect(() => {
    refreshStatus();
    startDisplayWatch();

    const netSub = NetInfo.addEventListener((state) => {
      const isUp = !!state.isConnected && state.isInternetReachable !== false;
      setOnline(isUp);
      if (isUp) flush([]).then(() => getQueue().then((q) => setQueued(q.length))); // drain queue on reconnect
    });

    const poll = setInterval(refreshStatus, 2500);

    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshStatus();
    });

    return () => {
      netSub && netSub();
      clearInterval(poll);
      appSub && appSub.remove();
      if (watchRef.current) { watchRef.current.remove(); watchRef.current = null; }
    };
  }, [refreshStatus, startDisplayWatch]);

  async function ensurePermissions() {
    const status = await getPermissionStatus();
    if (status.foreground === 'granted') return status;
    const res = await requestPermissions();
    const updated = await getPermissionStatus();
    setPerms(updated);
    if (!res.ok) {
      Alert.alert(
        'Location permission needed',
        'Tracking cannot start without location permission. Please allow location for Sansthan Driver.',
        [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'OK' }],
      );
    } else if (res.stage === 'foreground-only') {
      Alert.alert(
        'Allow all the time (recommended)',
        'For tracking to continue with the screen off, set location to "Allow all the time" in Settings. Tracking will still work while the app is open.',
        [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'Continue' }],
      );
    }
    return updated;
  }

  async function handleStart() {
    setBusy(true);
    try {
      const status = await ensurePermissions();
      if (status.foreground !== 'granted') return;
      if (!status.servicesOn) {
        Alert.alert('Turn on GPS', 'Your phone\'s location (GPS) is switched off. Please turn it on and try again.');
        return;
      }
      await startDisplayWatch();
      await startTracking();
      setTracking(true);
    } catch (e) {
      Alert.alert('Could not start tracking', e.message || String(e));
    } finally {
      setBusy(false);
      refreshStatus();
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      await stopTracking();
      // Send one final "stopped" point so the Control Room shows the trip ended.
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const p = toPoint(loc, 'stopped');
        if (p) await flush([p]);
      } catch (_) { /* ignore */ }
      setTracking(false);
    } catch (e) {
      Alert.alert('Could not stop tracking', e.message || String(e));
    } finally {
      setBusy(false);
      refreshStatus();
    }
  }

  function handleLogout() {
    Alert.alert('Log out', 'Stop tracking and log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          try { await stopTracking(); } catch (_) {}
          await clearSession();
          onLoggedOut();
        },
      },
    ]);
  }

  // ---- derived display values ----
  const accuracy = current?.accuracy;
  const gpsColor = !perms.servicesOn ? colors.danger
    : accuracy == null ? colors.warn
      : accuracy <= 20 ? colors.ok : accuracy <= 50 ? colors.warn : colors.danger;
  const gpsText = !perms.servicesOn ? 'GPS OFF'
    : accuracy == null ? 'Acquiring...'
      : `±${Math.round(accuracy)} m`;
  const speedKmh = current?.speed != null && current.speed >= 0 ? (current.speed * 3.6).toFixed(0) : '0';
  const lastUpdateText = lastPoint?.timestamp
    ? new Date(lastPoint.timestamp).toLocaleTimeString()
    : '—';
  const lastGpsFixText = lastFixAt ? new Date(lastFixAt).toLocaleTimeString() : '—';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Driver</Text>
          <Text style={styles.driverName}>{driver?.name}</Text>
          <Text style={styles.driverCode}>{driver?.driverCode}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Assigned bus */}
      <View style={styles.busCard}>
        <Text style={styles.busCardLabel}>YOUR ASSIGNED BUS</Text>
        <Text style={styles.busCode}>{bus?.busCode}</Text>
        {!!bus?.label && <Text style={styles.busLabel}>{bus.label}</Text>}
      </View>

      {/* Live status */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Dot color={tracking ? colors.live : colors.muted} />
          <Text style={styles.statusTitle}>{tracking ? 'TRACKING ACTIVE' : 'NOT TRACKING'}</Text>
        </View>

        <Row label="GPS accuracy" value={gpsText} valueColor={gpsColor} />
        <Row label="Speed" value={`${speedKmh} km/h`} />
        <Row label="Internet" value={online ? 'Connected' : 'Offline'} valueColor={online ? colors.ok : colors.danger} />
        <Row label="Last GPS sent" value={lastUpdateText} />
        <Row label="Queued (offline)" value={String(queued)} valueColor={queued > 0 ? colors.warn : colors.muted} />
        <Row
          label="Background permission"
          value={perms.background === 'granted' ? 'Allow all the time' : 'Limited'}
          valueColor={perms.background === 'granted' ? colors.ok : colors.warn}
        />
        {current && (
          <Text style={styles.coords}>
            {current.latitude.toFixed(5)}, {current.longitude.toFixed(5)}
          </Text>
        )}
      </View>

      {/* GPS DEBUG panel (for testing real phone GPS) */}
      <View style={styles.debugCard}>
        <Text style={styles.debugTitle}>GPS DEBUG (testing)</Text>
        <DRow label="Latitude" value={current ? current.latitude.toFixed(6) : '—'} />
        <DRow label="Longitude" value={current ? current.longitude.toFixed(6) : '—'} />
        <DRow label="Speed" value={current?.speed != null && current.speed >= 0 ? `${(current.speed * 3.6).toFixed(1)} km/h (${current.speed.toFixed(1)} m/s)` : '—'} />
        <DRow label="Direction" value={current?.heading != null && current.heading >= 0 ? `${Math.round(current.heading)}°` : '—'} />
        <DRow label="Accuracy" value={accuracy != null ? `±${accuracy.toFixed(1)} m` : '—'} valueColor={gpsColor} />
        <DRow label="Last GPS update" value={lastGpsFixText} />
        <DRow label="Last sent to server" value={lastUpdateText} />
        <DRow label="Tracking status" value={tracking ? 'ON' : 'OFF'} valueColor={tracking ? colors.ok : colors.muted} />
        <DRow label="Internet status" value={online ? 'ONLINE' : 'OFFLINE'} valueColor={online ? colors.ok : colors.danger} />
        <DRow label="Queued offline" value={String(queued)} valueColor={queued > 0 ? colors.warn : colors.muted} />
      </View>

      {/* Permission prompt if needed */}
      {perms.foreground !== 'granted' && (
        <TouchableOpacity style={styles.permBtn} onPress={ensurePermissions}>
          <Text style={styles.permBtnText}>Grant location permission</Text>
        </TouchableOpacity>
      )}

      {/* Start / Stop */}
      {!tracking ? (
        <TouchableOpacity
          style={[styles.bigBtn, styles.startBtn, busy && styles.btnDisabled]}
          onPress={handleStart} disabled={busy} activeOpacity={0.85}
        >
          <Text style={styles.bigBtnText}>{busy ? 'STARTING…' : 'START TRIP'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.bigBtn, styles.stopBtn, busy && styles.btnDisabled]}
          onPress={handleStop} disabled={busy} activeOpacity={0.85}
        >
          <Text style={styles.bigBtnText}>{busy ? 'STOPPING…' : 'STOP TRACKING'}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.footNote}>
        Keep this app installed and location set to "Allow all the time" for
        reliable tracking during the trip. A notification will show while your
        location is being shared.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 },
  hello: { color: colors.muted, fontSize: 12 },
  driverName: { fontSize: 22, fontWeight: '800', color: colors.text },
  driverCode: { color: colors.muted, fontSize: 13, marginTop: 2 },
  logout: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  logoutText: { color: colors.danger, fontWeight: '700' },

  busCard: { backgroundColor: colors.primary, borderRadius: 16, padding: 20, marginTop: 18 },
  busCardLabel: { color: '#CDE8E0', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  busCode: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 6 },
  busLabel: { color: '#DAF0EA', fontSize: 15, marginTop: 2 },

  statusCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 18, marginTop: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusTitle: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { color: colors.muted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  coords: { color: colors.muted, fontSize: 12, marginTop: 10, textAlign: 'center' },

  debugCard: {
    backgroundColor: '#0E1B17', borderRadius: 16, padding: 16, marginTop: 16,
  },
  debugTitle: { color: '#7FE0C4', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  drow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#1E3229' },
  drowLabel: { color: '#8FB3A8', fontSize: 13 },
  drowValue: { color: '#EAF6F1', fontSize: 13, fontWeight: '700' },

  permBtn: { backgroundColor: colors.warn, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  permBtnText: { color: '#fff', fontWeight: '800' },

  bigBtn: { borderRadius: 16, paddingVertical: 20, alignItems: 'center', marginTop: 18 },
  startBtn: { backgroundColor: colors.ok },
  stopBtn: { backgroundColor: colors.danger },
  btnDisabled: { opacity: 0.6 },
  bigBtnText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },

  footNote: { color: colors.muted, fontSize: 12.5, lineHeight: 19, textAlign: 'center', marginTop: 18 },
});
