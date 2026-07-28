import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api, setToken, setUser } from '@/src/api';
import { Ionicons } from '@expo/vector-icons';

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'phd' | 'faculty'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('Please fill all fields (password 6+ chars)');
      return;
    }
    setLoading(true);
    try {
      const res = await api.register(name.trim(), email.trim(), password, role);
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </Pressable>
            <Text style={styles.title} testID="register-title">Create your account</Text>
            <Text style={styles.subtitle}>Join thousands of researchers accelerating their work.</Text>

            <GlassCard style={{ padding: spacing.lg }} radius={28}>
              {error ? (
                <View style={styles.errorBanner} testID="register-error"><Text style={styles.errorText}>{error}</Text></View>
              ) : null}
              <Text style={styles.label}>Full Name</Text>
              <TextInput testID="register-name-input" value={name} onChangeText={setName} style={styles.input} placeholder="Alex Rivera" placeholderTextColor={colors.slate} />
              <Text style={styles.label}>Email</Text>
              <TextInput testID="register-email-input" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholder="you@school.edu" placeholderTextColor={colors.slate} />
              <Text style={styles.label}>Password</Text>
              <TextInput testID="register-password-input" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="At least 6 characters" placeholderTextColor={colors.slate} />
              <Text style={styles.label}>Role</Text>
              <View style={styles.rolesRow}>
                {(['student', 'phd', 'faculty'] as const).map((r) => (
                  <Pressable
                    key={r}
                    testID={`role-${r}-chip`}
                    onPress={() => setRole(r)}
                    style={[styles.roleChip, role === r && styles.roleChipActive]}
                  >
                    <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                      {r === 'student' ? 'Student' : r === 'phd' ? 'PhD' : 'Faculty'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                testID="register-submit-button"
                onPress={submit}
                disabled={loading}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryLabel}>Create Account</Text>}
              </Pressable>
            </GlassCard>

            <Pressable testID="go-login-btn" onPress={() => router.replace('/login')} style={styles.link}>
              <Text style={styles.linkText}>Already registered? <Text style={{ color: colors.brand }}>Sign in</Text></Text>
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
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.glassBorder, marginBottom: spacing.lg,
  },
  title: { fontFamily: font.family, fontSize: 28, color: colors.ink, fontWeight: font.weights.medium },
  subtitle: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.slate, marginTop: 6, marginBottom: spacing.xl },
  label: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, marginBottom: 6, marginTop: spacing.md, fontWeight: font.weights.medium },
  input: {
    height: 50, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md,
    fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink,
  },
  rolesRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  roleChip: { flex: 1, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTertiary },
  roleChipActive: { backgroundColor: colors.brandLight, borderWidth: 1, borderColor: colors.brand },
  roleText: { fontFamily: font.family, color: colors.slate, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  roleTextActive: { color: colors.brand },
  primaryBtn: { height: 54, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  primaryLabel: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.lg, fontWeight: font.weights.medium },
  link: { alignItems: 'center', marginTop: spacing.lg },
  linkText: { color: colors.slate, fontFamily: font.family, fontSize: font.sizes.base },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  errorText: { color: colors.error, fontFamily: font.family, fontSize: font.sizes.sm },
});
