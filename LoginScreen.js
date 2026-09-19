import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';

import { login as apiLogin } from './api';
import { saveSession } from './storage';
import { colors } from './theme';

export default function LoginScreen({ onLoggedIn }) {
  const [driverId, setDriverId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    if (!driverId.trim() || !password) {
      Alert.alert('Missing details', 'Please enter your Driver ID and password.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiLogin(driverId.trim(), password);
      const session = { token: res.token, driver: res.driver, bus: res.bus };
      await saveSession(session);
      onLoggedIn(session);
    } catch (e) {
      Alert.alert('Login failed', e.message || 'Could not sign in. Check your details and internet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>Sansthan Driver</Text>
          <Text style={styles.brandSub}>Bus Live Tracking</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Driver ID</Text>
          <TextInput
            style={styles.input}
            value={driverId}
            onChangeText={setDriverId}
            placeholder="e.g. DRV001"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            editable={!busy}
          />

          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>LOG IN</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Use the Driver ID and password given by the Control Room. You can only
          track the bus assigned to you.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  brand: { alignItems: 'center', marginBottom: 28 },
  brandTitle: { fontSize: 28, fontWeight: '800', color: colors.primary },
  brandSub: { fontSize: 15, color: colors.muted, marginTop: 4 },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 22,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 20, lineHeight: 19 },
});
