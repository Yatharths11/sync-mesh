import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DocumentListScreen from './src/screens/document-list/document-list.screen';
import EditorScreen from './src/screens/document-editor/document-editor.screen';
import { initDb } from './src/db';

export type RootStackParamList = {
  DocumentList: undefined;
  Editor: { documentId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {

  initDb();

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="DocumentList">
        <Stack.Screen name="DocumentList" component={DocumentListScreen} />
        <Stack.Screen name="Editor" component={EditorScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}