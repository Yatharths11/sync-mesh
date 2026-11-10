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
import { useTheme } from '../../theme';

// UI-ONLY SCREEN. No auth logic lives here.
// Yatharth: implement handleSubmit yourself — this is where you'll:
//   1. Call your backend's /auth/login endpoint with { email, password }
//   2. Get back { accessToken, refreshToken }
//   3. Store refreshToken in Keychain, accessToken in memory (context/state)
//   4. Navigate to the main app screen on success
//   5. On failure, setError(...) with a user-facing message

export default function LoginScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = createStyles(colors, spacing, radius, typography);
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
        await Keychain.setGenericPassword(data.deviceId, data.refreshToken, {
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
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!loginMutation.isPending}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.placeholder}
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
          <ActivityIndicator color={colors.accentText} />
        ) : (
          <Text style={styles.buttonText}>Log In</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  spacing: ReturnType<typeof useTheme>['spacing'],
  radius: ReturnType<typeof useTheme>['radius'],
  typography: ReturnType<typeof useTheme>['typography'],
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.background,
    },
    title: {
      ...typography.title,
      textAlign: 'center',
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: typography.body.fontSize,
      marginBottom: spacing.sm + 6,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: radius.sm,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      ...typography.body,
      color: colors.accentText,
      fontWeight: '600',
    },
  });
}
