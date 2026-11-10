import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../App';
import { listDocuments, createDocument } from '../../apis/documents.api';
import { useAuthStore } from '../../store/store';

type Props = NativeStackScreenProps<RootStackParamList, 'DocumentList'>;

type DocumentSummary = { id: string; name: string };

export default function DocumentListScreen({ navigation }: Props) {
  const accessToken = useAuthStore(state => state.accessToken)!;
  const [name, setName] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: 'Documents' });
  }, [navigation]);

  const {
    data: documents,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['documents'],
    queryFn: () => listDocuments(accessToken),
  });

  const createMutation = useMutation({
    mutationFn: () => createDocument(accessToken, name, ''),
    onSuccess: () => {
      setName('');
      void refetch();
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="New document name"
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity
          style={styles.button}
          disabled={!name || createMutation.isPending}
          onPress={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={documents as DocumentSummary[] | undefined}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <Text>No documents yet — create one to get started</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Editor', { documentId: item.id })
              }
            >
              <Text>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  form: { flexDirection: 'row', marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, marginRight: 8, padding: 8 },
  button: { backgroundColor: '#1A1A1E', padding: 8, justifyContent: 'center' },
  buttonText: { color: '#FFFFFF' },
  loading: { marginTop: 32 },
});
