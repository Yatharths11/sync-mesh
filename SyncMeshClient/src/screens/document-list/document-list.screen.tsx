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
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DocumentList'>;

type DocumentSummary = { id: string; name: string };

export default function DocumentListScreen({ navigation }: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = createStyles(colors, spacing, radius, typography);
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
          placeholderTextColor={colors.placeholder}
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity
          style={[
            styles.button,
            (!name || createMutation.isPending) && styles.buttonDisabled,
          ]}
          disabled={!name || createMutation.isPending}
          onPress={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={styles.buttonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : (
        <FlatList
          data={documents as DocumentSummary[] | undefined}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No documents yet — create one to get started
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('Editor', { documentId: item.id })
              }
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
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
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    form: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: typography.body.fontSize,
      marginRight: spacing.sm,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      ...typography.body,
      color: colors.accentText,
      fontWeight: '600',
    },
    loading: {
      marginTop: spacing.xl,
    },
    listContent: {
      flexGrow: 1,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
    },
    cardTitle: {
      ...typography.body,
      color: colors.textPrimary,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
  });
}
