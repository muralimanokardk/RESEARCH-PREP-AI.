import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api, getUser, type User } from '@/src/api';

export default function Home() {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const u = await getUser();
      setUserState(u);
      const s = await api.dashboardStats();
      setStats(s);
    } catch (e) {
      /* handled by empty state */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const activity = stats?.activity || [];

  // Build simple smooth SVG line paths
  const CHART_W = 300;
  const CHART_H = 160;
  const values = (key: 'sources' | 'summaries') => activity.map((a: any) => a[key]);
  const buildPath = (vals: number[]) => {
    if (!vals.length) return '';
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const range = Math.max(1, max - min);
    const step = CHART_W / Math.max(1, vals.length - 1);
    const pts = vals.map((v, i) => ({ x: i * step, y: CHART_H - 10 - ((v - min) / range) * (CHART_H - 30) }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return { d, pts };
  };
  const sourcesPath = buildPath(values('sources'));
  const summariesPath = buildPath(values('summaries'));

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello} testID="home-greeting">Good day{user ? `, ${user.name.split(' ')[0]}` : ''}</Text>
            <Text style={styles.tagline}>Research Prep AI</Text>
          </View>
          <Pressable testID="home-profile-btn" onPress={() => router.push('/(tabs)/profile')} style={styles.avatar}>
            <Text style={styles.avatarInitial}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
        >
          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Activity chart */}
              <GlassCard style={styles.chartCard} radius={28}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.cardTitle} testID="activity-chart-title">Research Activity</Text>
                    <Text style={styles.cardSubtitle}>Sources vs AI summaries</Text>
                  </View>
                  <View style={styles.legendCol}>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.brandSecondary }]} /><Text style={styles.legendLabel}>Sources</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.brand }]} /><Text style={styles.legendLabel}>Summaries</Text></View>
                  </View>
                </View>
                <View style={{ height: 180, marginTop: spacing.md, alignItems: 'center' }}>
                  {activity.length > 0 && sourcesPath && summariesPath ? (
                    <Svg width={CHART_W} height={CHART_H}>
                      <Path d={typeof sourcesPath === 'object' ? sourcesPath.d : ''} stroke={colors.brandSecondary} strokeWidth={3} fill="none" />
                      <Path d={typeof summariesPath === 'object' ? summariesPath.d : ''} stroke={colors.brand} strokeWidth={3} fill="none" />
                      {(typeof sourcesPath === 'object' ? sourcesPath.pts : []).map((p: any, i: number) => (
                        <SvgCircle key={`s${i}`} cx={p.x} cy={p.y} r={4} fill={colors.brandSecondary} />
                      ))}
                      {(typeof summariesPath === 'object' ? summariesPath.pts : []).map((p: any, i: number) => (
                        <SvgCircle key={`u${i}`} cx={p.x} cy={p.y} r={4} fill={colors.brand} />
                      ))}
                    </Svg>
                  ) : null}
                </View>
              </GlassCard>

              {/* KPI grid */}
              <View style={styles.kpiGrid}>
                <KpiCard testID="kpi-projects" icon="folder-outline" iconBg={colors.brandLight} iconColor={colors.brand} value={stats?.projects ?? 0} label="Projects" />
                <KpiCard testID="kpi-papers" icon="document-text-outline" iconBg={colors.brandSecondaryLight} iconColor={colors.brandSecondary} value={stats?.papers ?? 0} label="Papers" />
                <KpiCard testID="kpi-topics" icon="bulb-outline" iconBg={colors.brandTertiaryLight} iconColor={colors.brandTertiary} value={stats?.topics ?? 0} label="Topics" />
                <KpiCard testID="kpi-proposals" icon="easel-outline" iconBg={colors.brandLight} iconColor={colors.brand} value={stats?.proposals ?? 0} label="Proposals" />
              </View>

              {/* Quick actions */}
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <ActionTile testID="action-new-project" icon="add-circle" color={colors.brand} label="New Research" desc="Discover topics" onPress={() => router.push('/new-project')} />
                <ActionTile testID="action-my-projects" icon="folder-open" color={colors.brandSecondary} label="My Projects" desc="Browse & continue" onPress={() => router.push('/(tabs)/projects')} />
                <ActionTile testID="action-library" icon="library" color={colors.brandTertiary} label="Library" desc="Papers & reviews" onPress={() => router.push('/(tabs)/library')} />
                <ActionTile testID="action-ask-stella" icon="sparkles" color={colors.brand} label="Ask Stella" desc="AI research tutor" onPress={() => router.push('/(tabs)/projects')} />
              </View>

              {/* Mastery */}
              <Text style={styles.sectionTitle}>Topic Mastery</Text>
              <GlassCard style={{ padding: spacing.lg }} radius={28}>
                {(stats?.mastery || []).map((m: any) => (
                  <View key={m.label} style={styles.masteryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.masteryLabel}>{m.label}</Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressBar, { width: `${m.value}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.masteryValue}>{m.value}%</Text>
                  </View>
                ))}
              </GlassCard>

              <View style={{ height: 100 }} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function KpiCard({ testID, icon, iconBg, iconColor, value, label }: any) {
  return (
    <GlassCard style={styles.kpiCard} radius={22}>
      <View style={[styles.kpiIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.kpiValue} testID={testID}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </GlassCard>
  );
}

function ActionTile({ testID, icon, color, label, desc, onPress }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={{ width: '48%' }}>
      <GlassCard style={styles.actionTile} radius={22}>
        <View style={[styles.actionIcon, { backgroundColor: color + '22' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionDesc}>{desc}</Text>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  hello: { fontFamily: font.family, fontSize: font.sizes.xl, color: colors.ink, fontWeight: font.weights.medium },
  tagline: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.white, fontFamily: font.family, fontSize: 18, fontWeight: font.weights.medium },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  chartCard: { padding: spacing.lg },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium },
  cardSubtitle: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginTop: 2 },
  legendCol: { gap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kpiCard: { padding: spacing.md, width: '47.5%', gap: 6 },
  kpiIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontFamily: font.family, fontSize: 24, color: colors.ink, fontWeight: font.weights.medium, marginTop: 4 },
  kpiLabel: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate },
  sectionTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium, marginTop: spacing.sm },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionTile: { padding: spacing.md, gap: 6 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink, fontWeight: font.weights.medium, marginTop: 4 },
  actionDesc: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  masteryLabel: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.ink, fontWeight: font.weights.medium, marginBottom: 6 },
  progressTrack: { height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, overflow: 'hidden' },
  progressBar: { height: 8, backgroundColor: colors.brand, borderRadius: radius.pill },
  masteryValue: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.brand, fontWeight: font.weights.medium, width: 42, textAlign: 'right' },
});
