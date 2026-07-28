import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api } from '@/src/api';

export default function Paywall() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [status, setStatus] = useState<any>({ tier: 'free', status: 'free' });
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([api.billingPlans(), api.billingStatus()]);
      setPlans(p.plans || []);
      setStatus(s);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const subscribe = async (tier: 'student' | 'pro') => {
    setLoadingTier(tier); setError(null);
    try {
      const res = await api.createSubscription(tier);
      if (!res.short_url) throw new Error('Missing checkout URL');
      const result = await WebBrowser.openBrowserAsync(res.short_url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.brand,
        controlsColor: colors.white,
      });
      setRefreshing(true);
      await load();
    } catch (e: any) {
      const msg = String(e.message || e);
      if (msg.includes('not configured')) {
        setError('Razorpay is not configured yet. Ask the admin to add API keys.');
      } else {
        setError(msg);
      }
    } finally {
      setLoadingTier(null);
      setRefreshing(false);
    }
  };

  const openDashboard = () => Linking.openURL('https://dashboard.razorpay.com');

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable testID="paywall-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle} testID="paywall-title">Upgrade Plan</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroWrap}>
            <View style={styles.heroIcon}><Ionicons name="sparkles" size={26} color={colors.brand} /></View>
            <Text style={styles.heroTitle}>Unlock the full research toolkit</Text>
            <Text style={styles.heroDesc}>Higher AI quotas, unlimited papers, and one-tap PPT export.</Text>
          </View>

          {status?.tier && status.tier !== 'free' ? (
            <GlassCard style={styles.currentCard} radius={22}>
              <Ionicons name="checkmark-circle" size={22} color={colors.brandTertiary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.currentLabel} testID="current-tier">
                  You are on {status.tier === 'student' ? 'Student' : 'Research Pro'}
                </Text>
                <Text style={styles.currentSub}>Status: {status.status}{status.cancel_at_period_end ? ' · cancels at period end' : ''}</Text>
              </View>
              <Pressable testID="manage-btn" onPress={() => router.push('/manage-subscription')}>
                <Text style={styles.manageLink}>Manage</Text>
              </Pressable>
            </GlassCard>
          ) : null}

          {error ? (
            <GlassCard style={styles.errCard} radius={16}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errText} testID="paywall-error">{error}</Text>
            </GlassCard>
          ) : null}

          {plans.map((p) => {
            const isCurrent = status?.tier === p.tier;
            const isPaid = p.tier !== 'free';
            const accent = p.tier === 'pro' ? colors.brand : p.tier === 'student' ? colors.brandSecondary : colors.slate;
            return (
              <GlassCard key={p.tier} style={[styles.planCard, isCurrent && { borderColor: accent, borderWidth: 2 }]} radius={26}>
                <View style={styles.planHeader}>
                  <View style={[styles.planBadge, { backgroundColor: accent + '22' }]}>
                    <Text style={[styles.planBadgeText, { color: accent }]}>{p.name}</Text>
                  </View>
                  {p.tier === 'pro' && <View style={styles.popularBadge}><Text style={styles.popularText}>MOST POPULAR</Text></View>}
                </View>
                <Text style={styles.priceText} testID={`plan-${p.tier}-price`}>
                  {p.amount_display}<Text style={styles.priceUnit}>{isPaid ? ' / month' : ''}</Text>
                </Text>
                <View style={styles.features}>
                  {(p.features || []).map((f: string, i: number) => (
                    <View key={i} style={styles.featureRow}>
                      <Ionicons name="checkmark" size={16} color={accent} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                {isCurrent ? (
                  <View style={[styles.ctaBtn, styles.ctaDisabled]}>
                    <Text style={styles.ctaDisabledText}>Current plan</Text>
                  </View>
                ) : isPaid ? (
                  <Pressable
                    testID={`subscribe-${p.tier}-btn`}
                    onPress={() => subscribe(p.tier)}
                    disabled={loadingTier !== null}
                    style={({ pressed }) => [styles.ctaBtn, { backgroundColor: accent }, pressed && { opacity: 0.9 }]}
                  >
                    {loadingTier === p.tier ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <>
                        <Ionicons name="rocket-outline" size={18} color={colors.white} />
                        <Text style={styles.ctaText}>Subscribe {p.amount_display}</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <View style={[styles.ctaBtn, styles.ctaGhost]}>
                    <Text style={styles.ctaGhostText}>Default tier</Text>
                  </View>
                )}
              </GlassCard>
            );
          })}

          <Text style={styles.footNote}>
            Payments are processed securely by Razorpay. Cancel anytime from Manage Subscription.
          </Text>
          <View style={{ height: 60 }} />
        </ScrollView>
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
  scroll: { padding: spacing.lg, gap: spacing.lg },
  heroWrap: { alignItems: 'center', gap: 8, paddingHorizontal: spacing.md },
  heroIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: font.family, fontSize: font.sizes.xl, color: colors.ink, fontWeight: font.weights.medium, textAlign: 'center' },
  heroDesc: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, textAlign: 'center' },
  currentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  currentLabel: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink, fontWeight: font.weights.medium },
  currentSub: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, marginTop: 2 },
  manageLink: { color: colors.brand, fontFamily: font.family, fontSize: font.sizes.sm, fontWeight: font.weights.medium },
  errCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: '#FEE2E2' },
  errText: { flex: 1, color: colors.error, fontFamily: font.family, fontSize: font.sizes.sm },
  planCard: { padding: spacing.lg, gap: spacing.md },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  planBadgeText: { fontFamily: font.family, fontSize: font.sizes.sm, fontWeight: font.weights.medium },
  popularBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.ink },
  popularText: { fontFamily: font.family, fontSize: 9, color: colors.white, fontWeight: font.weights.medium },
  priceText: { fontFamily: font.family, fontSize: 30, color: colors.ink, fontWeight: font.weights.medium },
  priceUnit: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.slate, fontWeight: font.weights.regular },
  features: { gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.onSurfaceTertiary, flex: 1 },
  ctaBtn: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  ctaText: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  ctaDisabled: { backgroundColor: colors.surfaceTertiary },
  ctaDisabledText: { color: colors.slate, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
  ctaGhostText: { color: colors.slate, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  footNote: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, textAlign: 'center', marginTop: spacing.md },
});
