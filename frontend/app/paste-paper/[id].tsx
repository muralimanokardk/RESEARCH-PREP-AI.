import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api } from '@/src/api';

export default function PastePaper() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!title.trim() || text.length < 40) {
      setError('Title and at least 40 characters of text are required');
      return;
    }
    setBusy(true);
    try {
      await api.addPaperText({
        project_id: id,
        title: title.trim(),
        authors: authors.trim(),
        year: year.trim() ? Number(year.trim()) : null,
        text_content: text,
      });
      router.back();
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="paste-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
            <Text style={styles.headerTitle}>Paste Paper</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <GlassCard style={{ padding: spacing.lg }} radius={24}>
              {error ? (
                <View style={styles.err}><Text style={styles.errText}>{error}</Text></View>
              ) : null}
              <Text style={styles.label}>Title</Text>
              <TextInput testID="paste-title" value={title} onChangeText={setTitle} style={styles.input} />
              <Text style={styles.label}>Authors</Text>
              <TextInput testID="paste-authors" value={authors} onChangeText={setAuthors} style={styles.input} placeholder="Smith et al." placeholderTextColor={colors.slate} />
              <Text style={styles.label}>Year</Text>
              <TextInput testID="paste-year" value={year} onChangeText={setYear} keyboardType="number-pad" style={styles.input} placeholder="2024" placeholderTextColor={colors.slate} />
              <Text style={styles.label}>Paper text (abstract or full text)</Text>
              <TextInput
                testID="paste-text"
                value={text}
                onChangeText={setText}
                style={[styles.input, styles.textarea]}
                multiline
                placeholder="Paste abstract or excerpt here…"
                placeholderTextColor={colors.slate}
              />
            </GlassCard>
          </ScrollView>
          <View style={styles.bottom}>
            <Pressable
              testID="paste-submit-btn"
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
            >
              {busy ? <ActivityIndicator color={colors.white} /> : (
                <>
                  <Ionicons name="sparkles" size={18} color={colors.white} />
                  <Text style={styles.primaryLabel}>Analyze with Claude</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.glassBorder },
  headerTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium },
  scroll: { padding: spacing.lg },
  label: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginBottom: 6, marginTop: spacing.md, fontWeight: font.weights.medium },
  input: { minHeight: 50, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink },
  textarea: { minHeight: 180, textAlignVertical: 'top' },
  bottom: { padding: spacing.lg, backgroundColor: 'rgba(255,255,255,0.6)', borderTopWidth: 1, borderTopColor: colors.glassBorder },
  primaryBtn: { height: 54, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  primaryLabel: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.lg, fontWeight: font.weights.medium },
  err: { backgroundColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  errText: { color: colors.error, fontFamily: font.family, fontSize: font.sizes.sm },
});
