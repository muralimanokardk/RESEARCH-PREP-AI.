import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api } from '@/src/api';

export default function ManageSubscription() {
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    try { setStatus(await api.billingStatus()); }
    catch (e: any) { setError(e.message); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const cancel = async (atPeriodEnd: boolean) => {
    setBusy(true); setError(null);
    try {
      await api.cancelSubscription(atPeriodEnd);
      setSuccess(atPeriodEnd
        ? 'Your subscription will end at the current period.'
        : 'Subscription cancelled.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const tierName = status?.tier === 'pro' ? 'Research Pro' : status?.tier === 'student' ? 'Student' : 'Free';
  const isPaid = status?.tier && status.tier !== 'free';

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable testID="manage-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle} testID="manage-title">Manage Subscription</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <GlassCard style={styles.planCard} radius={26}>
            <View style={styles.planTop}>
              <View style={styles.crown}><Ionicons name={isPaid ? 'diamond' : 'leaf-outline'} size={22} color={colors.brand} /></View>
              <View>
                <Text style={styles.planLabel}>Current plan</Text>
                <Text style={styles.planTier} testID="manage-tier">{tierName}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Row label="Status" value={status?.status || '—'} testID="row-status" />
            <Row label="Next billing" value={status?.next_billing_at ? new Date(Number(status.next_billing_at) * 1000).toLocaleDateString() : '—'} testID="row-next-billing" />
            <Row label="Subscription ID" value={status?.subscription_id || '—'} testID="row-sub-id" mono />
            <Row label="Cancels at period end" value={status?.cancel_at_period_end ? 'Yes' : 'No'} testID="row-cancel-flag" />
          </GlassCard>

          {success ? (
            <GlassCard style={styles.okCard} radius={16}>
              <Ionicons name="checkmark-circle" size={18} color={colors.brandTertiary} />
              <Text style={styles.okText} testID="manage-success">{success}</Text>
            </GlassCard>
          ) : null}
          {error ? (
            <GlassCard style={styles.errCard} radius={16}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errText} testID="manage-error">{error}</Text>
            </GlassCard>
          ) : null}

          {!isPaid ? (
            <Pressable testID="upgrade-btn" onPress={() => router.replace('/paywall')} style={styles.primaryBtn}>
              <Ionicons name="sparkles" size={18} color={colors.white} />
              <Text style={styles.primaryLabel}>Upgrade now</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                testID="cancel-period-end-btn"
                onPress={() => cancel(true)}
                disabled={busy}
                style={styles.secondaryBtn}
              >
                {busy ? <ActivityIndicator color={colors.brand} /> : (
                  <>
                    <Ionicons name="time-outline" size={18} color={colors.brand} />
                    <Text style={styles.secondaryLabel}>Cancel at period end</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                testID="cancel-now-btn"
                onPress={() => setConfirming(true)}
                disabled={busy}
                style={styles.dangerBtn}
              >
                <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                <Text style={styles.dangerLabel}>Cancel immediately</Text>
              </Pressable>
            </>
          )}

          <Text style={styles.footNote}>
            Billed monthly via Razorpay. Prices shown in INR.
          </Text>
        </ScrollView>

        {/* Confirmation modal */}
        <Modal transparent visible={confirming} animationType="fade" onRequestClose={() => setConfirming(false)}>
          <View style={styles.modalBackdrop}>
            <GlassCard style={styles.modalCard} radius={24}>
              <Text style={styles.modalTitle}>Cancel immediately?</Text>
              <Text style={styles.modalDesc}>You&apos;ll lose access to premium features right away. Are you sure?</Text>
              <View style={styles.modalActions}>
                <Pressable testID="modal-keep-btn" onPress={() => setConfirming(false)} style={[styles.modalBtn, { backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={styles.modalBtnText}>Keep plan</Text>
                </Pressable>
                <Pressable testID="modal-confirm-cancel-btn" onPress={() => cancel(false)} style={[styles.modalBtn, { backgroundColor: colors.error }]}>
                  <Text style={[styles.modalBtnText, { color: colors.white }]}>Cancel now</Text>
                </Pressable>
              </View>
            </GlassCard>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function Row({ label, value, testID, mono }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && { fontVariant: ['tabular-nums'] as any }]} testID={testID} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.glassBorder },
  headerTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium },
  scroll: { padding: spacing.lg, gap: spacing.md },
  planCard: { padding: spacing.lg },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  crown: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  planLabel: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate },
  planTier: { fontFamily: font.family, fontSize: font.sizes.xl, color: colors.ink, fontWeight: font.weights.medium, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate },
  rowValue: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.ink, fontWeight: font.weights.medium, maxWidth: '55%' },
  primaryBtn: { height: 50, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  primaryLabel: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  secondaryBtn: { height: 50, backgroundColor: colors.brandLight, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  secondaryLabel: { color: colors.brand, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  dangerBtn: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, backgroundColor: '#FEE2E2' },
  dangerLabel: { color: colors.error, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  okCard: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.brandTertiaryLight },
  okText: { color: colors.brandTertiary, fontFamily: font.family, fontSize: font.sizes.sm, flex: 1 },
  errCard: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: '#FEE2E2' },
  errText: { color: colors.error, fontFamily: font.family, fontSize: font.sizes.sm, flex: 1 },
  footNote: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, textAlign: 'center', marginTop: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 360, padding: spacing.lg },
  modalTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium },
  modalDesc: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalBtn: { flex: 1, height: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium, color: colors.ink },
});
