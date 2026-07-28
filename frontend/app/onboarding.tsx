import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { Ionicons } from '@expo/vector-icons';

export default function Onboarding() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <View style={styles.logoWrap} testID="stella-mascot">
            <Ionicons name="sparkles" size={54} color={colors.brand} />
          </View>
          <Text style={styles.tag} testID="app-tag">Research Prep AI</Text>
          <Text style={styles.title} testID="onboarding-title">From an idea to a{"\n"}complete research project.</Text>
          <Text style={styles.subtitle} testID="onboarding-subtitle">
            Discover topics, review literature, build proposals, and generate presentations with Claude Sonnet 4.5.
          </Text>
        </View>

        <View style={styles.features}>
          {[
            { icon: 'bulb-outline', label: 'Topic Discovery with novelty scoring' },
            { icon: 'document-text-outline', label: 'PDF literature review & comparison' },
            { icon: 'analytics-outline', label: 'Research gap finder' },
            { icon: 'easel-outline', label: 'Proposal & 10-slide PPT generator' },
          ].map((f) => (
            <GlassCard key={f.label} style={styles.featureCard} radius={20}>
              <View style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon as any} size={20} color={colors.brand} />
                </View>
                <Text style={styles.featureText}>{f.label}</Text>
              </View>
            </GlassCard>
          ))}
        </View>

        <View style={styles.bottom}>
          <Pressable
            testID="get-started-btn"
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.primaryLabel}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </Pressable>
          <Pressable testID="have-account-btn" style={styles.linkBtn} onPress={() => router.push('/login')}>
            <Text style={styles.linkText}>I already have an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  top: { alignItems: 'flex-start', marginTop: spacing.xl },
  logoWrap: {
    width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)', marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  tag: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.brand, fontWeight: font.weights.medium, marginBottom: 6 },
  title: { fontFamily: font.family, fontSize: 30, lineHeight: 36, color: colors.ink, fontWeight: font.weights.medium },
  subtitle: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.slate, marginTop: spacing.md, lineHeight: 22 },
  features: { gap: spacing.md },
  featureCard: { },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandLight },
  featureText: { flex: 1, fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink, fontWeight: font.weights.medium },
  bottom: { gap: spacing.md, paddingBottom: spacing.md },
  primaryBtn: {
    height: 54, backgroundColor: colors.brand, borderRadius: radius.pill,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  primaryLabel: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.lg, fontWeight: font.weights.medium },
  linkBtn: { alignItems: 'center', padding: spacing.sm },
  linkText: { color: colors.brand, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
});
