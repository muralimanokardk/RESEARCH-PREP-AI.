import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api } from '@/src/api';

export default function Library() {
  const [projects, setProjects] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const p = await api.listProjects();
      setProjects(p);
      const allPapers: any[] = [];
      for (const proj of p) {
        try {
          const paps = await api.listPapers(proj.id);
          for (const pp of paps) allPapers.push({ ...pp, project_title: proj.title });
        } catch {}
      }
      setPapers(allPapers);
    } finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title} testID="library-title">Library</Text>
          <Text style={styles.subtitle}>{papers.length} paper{papers.length === 1 ? '' : 's'} across {projects.length} project{projects.length === 1 ? '' : 's'}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : papers.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="library-outline" size={40} color={colors.brandSecondary} /></View>
            <Text style={styles.emptyTitle}>Your library is empty</Text>
            <Text style={styles.emptyDesc}>Upload PDFs inside a project to see them here with summaries.</Text>
          </View>
        ) : (
          <FlatList
            data={papers}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}
            renderItem={({ item }) => (
              <GlassCard style={styles.paperCard} radius={22}>
                <View style={styles.rowStart}>
                  <View style={styles.paperIcon}><Ionicons name="document-text" size={20} color={colors.brandSecondary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paperTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.paperMeta} numberOfLines={1}>
                      {item.authors || 'Unknown authors'}{item.year ? ` · ${item.year}` : ''} · {item.project_title}
                    </Text>
                    {item.summary ? <Text style={styles.paperSummary} numberOfLines={3}>{item.summary}</Text> : null}
                  </View>
                </View>
              </GlassCard>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontFamily: font.family, fontSize: 28, color: colors.ink, fontWeight: font.weights.medium },
  subtitle: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: { width: 92, height: 92, borderRadius: 30, backgroundColor: colors.brandSecondaryLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: font.family, fontSize: font.sizes.xl, color: colors.ink, fontWeight: font.weights.medium },
  emptyDesc: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.slate, textAlign: 'center' },
  paperCard: { padding: spacing.md },
  rowStart: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  paperIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSecondaryLight, alignItems: 'center', justifyContent: 'center' },
  paperTitle: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink, fontWeight: font.weights.medium },
  paperMeta: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, marginTop: 2 },
  paperSummary: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.onSurfaceTertiary, marginTop: 6, lineHeight: 20 },
});
