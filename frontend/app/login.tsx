import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api, setToken, setUser } from '@/src/api';
import { Ionicons } from '@expo/vector-icons';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('elena@test.com');
  const [password, setPassword] = useState('pass1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      await setToken(res.token);
      await setUser(res.user);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </Pressable>

            <Text style={styles.title} testID="login-title">Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your research journey.</Text>

            <GlassCard style={styles.card} radius={28}>
              {error ? (
                <View style={styles.errorBanner} testID="login-error"><Text style={styles.errorText}>{error}</Text></View>
              ) : null}
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="login-email-input"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                placeholder="you@school.edu"
                placeholderTextColor={colors.slate}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.slate}
              />
              <Pressable
                testID="login-submit-button"
                onPress={submit}
                disabled={loading}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryLabel}>Sign In</Text>}
              </Pressable>
            </GlassCard>

            <Pressable testID="go-register-btn" onPress={() => router.replace('/register')} style={styles.link}>
              <Text style={styles.linkText}>New here? <Text style={{ color: colors.brand }}>Create account</Text></Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, flexGrow: 1 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.glassBorder, marginBottom: spacing.lg,
  },
  title: { fontFamily: font.family, fontSize: 28, color: colors.ink, fontWeight: font.weights.medium },
  subtitle: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.slate, marginTop: 6, marginBottom: spacing.xl },
  card: { padding: spacing.lg },
  label: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginBottom: 6, marginTop: spacing.md, fontWeight: font.weights.medium },
  input: {
    height: 50, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md,
    fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink,
  },
  primaryBtn: {
    height: 54, backgroundColor: colors.brand, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg,
  },
  primaryLabel: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.lg, fontWeight: font.weights.medium },
  link: { alignItems: 'center', marginTop: spacing.lg },
  linkText: { color: colors.slate, fontFamily: font.family, fontSize: font.sizes.base },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  errorText: { color: colors.error, fontFamily: font.family, fontSize: font.sizes.sm },
});
