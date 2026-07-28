import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api, getUser, clearAuth, type User } from '@/src/api';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const u = await getUser();
      setUser(u);
      const s = await api.dashboardStats();
      setStats(s);
    } finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const logout = async () => {
    await clearAuth();
    router.replace('/onboarding');
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title} testID="profile-title">Profile</Text>

          <GlassCard style={styles.profileCard} radius={28}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} testID="profile-name">{user?.name || '—'}</Text>
                <Text style={styles.email} testID="profile-email">{user?.email || '—'}</Text>
                <View style={styles.roleChip}>
                  <Text style={styles.roleText}>{user?.role || 'student'}</Text>
                </View>
              </View>
            </View>
          </GlassCard>

          <Text style={styles.section}>At a glance</Text>
          <View style={styles.statsRow}>
            <GlassCard style={styles.statCard} radius={20}><Text style={styles.statVal}>{stats?.projects ?? 0}</Text><Text style={styles.statLabel}>Projects</Text></GlassCard>
            <GlassCard style={styles.statCard} radius={20}><Text style={styles.statVal}>{stats?.papers ?? 0}</Text><Text style={styles.statLabel}>Papers</Text></GlassCard>
            <GlassCard style={styles.statCard} radius={20}><Text style={styles.statVal}>{stats?.proposals ?? 0}</Text><Text style={styles.statLabel}>Proposals</Text></GlassCard>
          </View>

          <Text style={styles.section}>Settings</Text>
          <GlassCard style={{ padding: 0 }} radius={22}>
            <SettingRow icon="notifications-outline" label="Notifications" hint="Coming soon" />
            <SettingRow icon="shield-checkmark-outline" label="Privacy" hint="Coming soon" />
            <SettingRow icon="help-circle-outline" label="Help & Support" hint="Documentation" last />
          </GlassCard>

          <Pressable testID="logout-btn" onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>

          <Text style={styles.footer}>Powered by Claude Sonnet 4.5 · Research Prep AI v1</Text>
          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SettingRow({ icon, label, hint, last }: any) {
  return (
    <View style={[styles.settingRow, !last && styles.settingRowDivider]}>
      <View style={styles.settingIcon}><Ionicons name={icon} size={20} color={colors.brand} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.slate} size={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1 },
  scroll: { padding: spacing.lg },
  title: { fontFamily: font.family, fontSize: 28, color: colors.ink, fontWeight: font.weights.medium, marginBottom: spacing.md },
  profileCard: { padding: spacing.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.white, fontSize: 26, fontFamily: font.family, fontWeight: font.weights.medium },
  name: { fontFamily: font.family, fontSize: font.sizes.xl, color: colors.ink, fontWeight: font.weights.medium },
  email: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginTop: 2 },
  roleChip: { alignSelf: 'flex-start', backgroundColor: colors.brandLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, marginTop: 8 },
  roleText: { fontFamily: font.family, color: colors.brand, fontSize: font.sizes.xs, fontWeight: font.weights.medium },
  section: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium, marginTop: spacing.xl, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, alignItems: 'center', padding: spacing.md },
  statVal: { fontFamily: font.family, fontSize: 22, color: colors.brand, fontWeight: font.weights.medium },
  statLabel: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, marginTop: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  settingRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  settingIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink, fontWeight: font.weights.medium },
  settingHint: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xl, height: 50, borderRadius: radius.pill, backgroundColor: '#FEE2E2' },
  logoutText: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.error, fontWeight: font.weights.medium },
  footer: { textAlign: 'center', color: colors.slate, marginTop: spacing.xl, fontFamily: font.family, fontSize: font.sizes.xs },
});
