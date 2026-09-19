import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, SafeAreaView, StatusBar, Platform } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import LoginScreen from './LoginScreen';
import TrackingScreen from './TrackingScreen';
import { getSession } from './storage';
import { fetchMe } from './api';
import { colors } from './theme';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    (async () => {
      const saved = await getSession();
      if (saved?.token) {
        // Refresh assigned bus in case the Control Room reassigned it.
        try {
          const me = await fetchMe(saved.token);
          setSession({ token: saved.token, driver: me.driver, bus: me.bus });
        } catch (e) {
          // Offline or token still valid locally -> keep the saved session so the
          // driver can still track; a 401 means the token expired -> log out.
          if (e.status === 401) setSession(null);
          else setSession(saved);
        }
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="dark" />
      {Platform.OS === 'android' && <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />}
      {session
        ? <TrackingScreen session={session} onLoggedOut={() => setSession(null)} />
        : <LoginScreen onLoggedIn={setSession} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
});
