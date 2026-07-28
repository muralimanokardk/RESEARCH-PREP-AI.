import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api } from '@/src/api';

export default function ProjectsList() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const list = await api.listProjects();
      setItems(list);
    } catch (e) {}
    finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title} testID="projects-title">Projects</Text>
          <Pressable testID="new-project-fab" onPress={() => router.push('/new-project')} style={styles.fab}>
            <Ionicons name="add" color={colors.white} size={22} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="folder-open-outline" size={40} color={colors.brand} />
            </View>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptyDesc}>Kick off your first research project — we&apos;ll generate topics, gaps and a proposal for you.</Text>
            <Pressable testID="empty-new-project-btn" style={styles.primaryBtn} onPress={() => router.push('/new-project')}>
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.primaryLabel}>Create Project</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
            renderItem={({ item }) => (
              <Pressable testID={`project-card-${item.id}`} onPress={() => router.push(`/workspace/${item.id}`)}>
                <GlassCard style={styles.projectCard} radius={24}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.domainChip}>
                        <Text style={styles.domainText}>{item.domain}</Text>
                      </View>
                      <Text style={styles.projectTitle} numberOfLines={2}>{item.title}</Text>
                      {item.description ? <Text style={styles.projectDesc} numberOfLines={2}>{item.description}</Text> : null}
                      <Text style={styles.projectMeta}>Updated {new Date(item.updated_at).toLocaleDateString()}</Text>
                    </View>
                    <Ionicons name="chevron-forward" color={colors.slate} size={22} />
                  </View>
                </GlassCard>
              </Pressable>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontFamily: font.family, fontSize: 28, color: colors.ink, fontWeight: font.weights.medium },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  emptyIcon: { width: 92, height: 92, borderRadius: 30, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: font.family, fontSize: font.sizes.xl, color: colors.ink, fontWeight: font.weights.medium },
  emptyDesc: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.slate, textAlign: 'center' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, backgroundColor: colors.brand, paddingHorizontal: spacing.xl, height: 50, borderRadius: radius.pill },
  primaryLabel: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  projectCard: { padding: spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  domainChip: { alignSelf: 'flex-start', backgroundColor: colors.brandTertiaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginBottom: 6 },
  domainText: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.brandTertiary, fontWeight: font.weights.medium },
  projectTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium },
  projectDesc: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginTop: 4 },
  projectMeta: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, marginTop: 8 },
});
