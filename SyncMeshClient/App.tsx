import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import DocumentListScreen from './src/screens/document-list/document-list.screen';
import EditorScreen from './src/screens/document-editor/document-editor.screen';
import LoginScreen from './src/screens/login/login.screen';
import { initDb } from './src/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore, useDeviceId } from './src/store/store';
import { refresh } from './src/apis/auth.api';
import Keychain from 'react-native-keychain';
import { SplashScreen } from './src/screens/splash/splash.screen';
import { useTheme } from './src/theme';
import {
  loadPersistedThemeMode,
  useThemeModeStore,
} from './src/store/theme-mode.store';

export type RootStackParamList = {
  DocumentList: undefined;
  Editor: { documentId: string };
  Login: undefined;
  SplashScreen: undefined
};

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { setAccessToken, accessToken } = useAuthStore();
  const { setDeviceId } = useDeviceId();
  const [isLoading, setIsLoading] = useState(true);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const hydrateApp = async () => {
      const persistedMode = loadPersistedThemeMode();
      if (persistedMode) {
        useThemeModeStore.setState({ mode: persistedMode });
      }

      const credentials = await Keychain.getGenericPassword({
        service: 'refreshToken',
      });

      if (!credentials) {
        setIsLoading(false);
        return;
      }

      const deviceId = credentials.username;
      setDeviceId(deviceId);

      try {
        const data = await refresh(deviceId, credentials.password);
        setAccessToken(data.accessToken);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateApp();
  }, [setAccessToken, setDeviceId]);

  initDb();

  const screenOptions = {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        {isLoading ? (
          <Stack.Navigator initialRouteName={"SplashScreen"} screenOptions={screenOptions}>
            <Stack.Screen name="SplashScreen" component={SplashScreen} />
          </Stack.Navigator>
        ) : accessToken ? (
          <Stack.Navigator initialRouteName="DocumentList" screenOptions={screenOptions}>
            <Stack.Screen name="DocumentList" component={DocumentListScreen} />
            <Stack.Screen name="Editor" component={EditorScreen} />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator initialRouteName="Login" screenOptions={screenOptions}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </QueryClientProvider>
  );
}
