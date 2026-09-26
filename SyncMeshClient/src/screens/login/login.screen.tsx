import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { login } from '../../apis/auth.api';
import * as Keychain from 'react-native-keychain';
import { useAuthStore } from '../../store/store';

// UI-ONLY SCREEN. No auth logic lives here.
// Yatharth: implement handleSubmit yourself — this is where you'll:
//   1. Call your backend's /auth/login endpoint with { email, password }
//   2. Get back { accessToken, refreshToken }
//   3. Store refreshToken in Keychain, accessToken in memory (context/state)
//   4. Navigate to the main app screen on success
//   5. On failure, setError(...) with a user-facing message

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const setAccessToken = useAuthStore(state => state.setAccessToken);
  const loginMutation = useMutation({
    mutationFn: async (deviceName: string) =>
      login(email, password, deviceName),
    mutationKey: ['login'],
    onSuccess: async data => {
      try {
        await Keychain.setGenericPassword('refreshToken', data.refreshToken, {
          service: 'refreshToken',
        });
        setAccessToken(data.accessToken);
      } catch {
        setError('somthing went wrong');
      }
    },
    onError: e => setError(e.message),
  });

  const handleSubmit = async () => {
    const deviceName = (await DeviceInfo.getDeviceId()).toString();
    setError('');
    loginMutation.mutate(deviceName);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>SyncMesh</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#8A8A8E"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!loginMutation.isPending}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#8A8A8E"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loginMutation.isPending}
      />

      <TouchableOpacity
        style={[
          styles.button,
          loginMutation.isPending && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Log In</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B70',
    textAlign: 'center',
    marginBottom: 32,
  },
  errorText: {
    color: '#D92D20',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D9D9DE',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  button: {
    backgroundColor: '#1A1A1E',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
