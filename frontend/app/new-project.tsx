import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api } from '@/src/api';

const SUGGESTED_DOMAINS = [
  'AI in Healthcare', 'Sustainable Energy', 'Quantum Computing', 'FinTech',
  'Climate Science', 'Blockchain', 'Cybersecurity', 'Robotics', 'NLP',
];

export default function NewProject() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [keywords, setKeywords] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!title.trim() || !domain.trim()) {
      setError('Title and domain are required');
      return;
    }
    setLoading(true);
    try {
      const proj = await api.createProject({ title: title.trim(), domain: domain.trim(), keywords, description });
      router.replace(`/workspace/${proj.id}?generate=1`);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="close-btn" onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
            <Text style={styles.headerTitle} testID="new-project-title">New Research Project</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <GlassCard style={{ padding: spacing.lg }} radius={28}>
              {error ? (
                <View style={styles.errBanner} testID="new-project-error"><Text style={styles.errText}>{error}</Text></View>
              ) : null}
              <Text style={styles.label}>Project Title</Text>
              <TextInput
                testID="project-title-input"
                value={title}
                onChangeText={setTitle}
                style={styles.input}
                placeholder="e.g., Early Detection of Parkinson's via Speech"
                placeholderTextColor={colors.slate}
              />
              <Text style={styles.label}>Domain</Text>
              <TextInput
                testID="project-domain-input"
                value={domain}
                onChangeText={setDomain}
                style={styles.input}
                placeholder="e.g., AI in Healthcare"
                placeholderTextColor={colors.slate}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {SUGGESTED_DOMAINS.map((d) => (
                  <Pressable key={d} testID={`domain-chip-${d}`} onPress={() => setDomain(d)} style={[styles.chip, domain === d && styles.chipActive]}>
                    <Text style={[styles.chipText, domain === d && styles.chipTextActive]}>{d}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>Keywords (comma-separated)</Text>
              <TextInput
                testID="project-keywords-input"
                value={keywords}
                onChangeText={setKeywords}
                style={styles.input}
                placeholder="speech analysis, deep learning, biomarkers"
                placeholderTextColor={colors.slate}
              />
              <Text style={styles.label}>Research interest / notes</Text>
              <TextInput
                testID="project-description-input"
                value={description}
                onChangeText={setDescription}
                style={[styles.input, styles.textarea]}
                multiline
                placeholder="What angle interests you most?"
                placeholderTextColor={colors.slate}
              />
            </GlassCard>
          </ScrollView>

          <View style={styles.bottomBar}>
            <Pressable
              testID="create-generate-btn"
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
            >
              {loading ? <ActivityIndicator color={colors.white} /> : (
                <>
                  <Ionicons name="sparkles" size={18} color={colors.white} />
                  <Text style={styles.primaryLabel}>Create & Generate Topics</Text>
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
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.glassBorder },
  headerTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  label: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginBottom: 6, marginTop: spacing.md, fontWeight: font.weights.medium },
  input: { height: 50, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink },
  textarea: { height: 100, paddingVertical: spacing.md, textAlignVertical: 'top' },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandLight, borderWidth: 1, borderColor: colors.brand },
  chipText: { fontFamily: font.family, color: colors.slate, fontSize: font.sizes.sm },
  chipTextActive: { color: colors.brand, fontWeight: font.weights.medium },
  bottomBar: { padding: spacing.lg, backgroundColor: 'rgba(255,255,255,0.6)', borderTopWidth: 1, borderTopColor: colors.glassBorder },
  primaryBtn: { height: 54, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  primaryLabel: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.lg, fontWeight: font.weights.medium },
  errBanner: { backgroundColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  errText: { color: colors.error, fontFamily: font.family, fontSize: font.sizes.sm },
});
