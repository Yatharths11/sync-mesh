import { View, Text, Button } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'DocumentList'>;

export default function DocumentListScreen({ navigation }: Props) {
  return (
    <View>
      <Text>Document List (placeholder)</Text>
      <Button
        title="Open fake doc"
        onPress={() => navigation.navigate('Editor', { documentId: 'test-doc-1' })}
      />
    </View>
  );
}