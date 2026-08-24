import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

export default function EditorScreen({ route }: Readonly<Props>) {
  return (
    <View>
      <Text>Editor Screen for doc: {route.params.documentId}</Text>
    </View>
  );
}
