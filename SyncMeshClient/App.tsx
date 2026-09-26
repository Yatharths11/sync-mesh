import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { getOrCreateDeviceId } from './src/functions';

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

  useEffect(() => {
    const hydrateApp = async () => {
      const deviceId = await getOrCreateDeviceId();
      const credentials = await Keychain.getGenericPassword({
        service: 'refreshToken',
      });

      if(deviceId) setDeviceId(deviceId)

      if (!credentials || !deviceId) {
        setIsLoading(false);
        return;
      }

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

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        {isLoading ? (
          <Stack.Navigator initialRouteName={"SplashScreen"}>
            <Stack.Screen name="SplashScreen" component={SplashScreen} />
          </Stack.Navigator>
        ) : accessToken ? (
          <Stack.Navigator initialRouteName="DocumentList">
            <Stack.Screen name="DocumentList" component={DocumentListScreen} />
            <Stack.Screen name="Editor" component={EditorScreen} />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </QueryClientProvider>
  );
}
