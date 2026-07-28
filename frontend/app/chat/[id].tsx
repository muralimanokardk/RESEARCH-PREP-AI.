import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api } from '@/src/api';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: "Hi, I'm Stella. Ask me anything about your uploaded papers — I'll use them as context." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await api.chat(id, q);
      setMessages((prev) => [...prev, { role: 'ai', text: res.answer || '(no answer)' }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'ai', text: `Error: ${e.message}` }]);
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable testID="chat-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} testID="chat-title">Ask Stella</Text>
            <Text style={styles.subtitle}>RAG over your papers</Text>
          </View>
          <View style={styles.dot} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {messages.map((m, i) => (
              <View key={i} style={[styles.msgRow, m.role === 'user' ? styles.msgRight : styles.msgLeft]}>
                <GlassCard
                  style={{ padding: spacing.md, maxWidth: '85%', backgroundColor: m.role === 'user' ? colors.brand : undefined }}
                  radius={20}
                >
                  <Text style={m.role === 'user' ? styles.userText : styles.aiText} testID={`msg-${i}`}>{m.text}</Text>
                </GlassCard>
              </View>
            ))}
            {busy && (
              <View style={styles.msgLeft}>
                <GlassCard style={{ padding: spacing.md }} radius={20}>
                  <ActivityIndicator color={colors.brand} />
                </GlassCard>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              testID="chat-input"
              value={input}
              onChangeText={setInput}
              placeholder="Ask about your papers…"
              placeholderTextColor={colors.slate}
              style={styles.input}
              onSubmitEditing={send}
            />
            <Pressable testID="chat-send-btn" onPress={send} disabled={busy || !input.trim()} style={[styles.sendBtn, (busy || !input.trim()) && { opacity: 0.5 }]}>
              <Ionicons name="arrow-up" size={20} color={colors.white} />
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.glassBorder },
  title: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium },
  subtitle: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandTertiary },
  scroll: { padding: spacing.lg, gap: spacing.md },
  msgRow: { flexDirection: 'row' },
  msgLeft: { justifyContent: 'flex-start' },
  msgRight: { justifyContent: 'flex-end' },
  userText: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.base, lineHeight: 22 },
  aiText: { color: colors.ink, fontFamily: font.family, fontSize: font.sizes.base, lineHeight: 22 },
  inputBar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.7)', borderTopWidth: 1, borderTopColor: colors.glassBorder },
  input: { flex: 1, height: 46, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: spacing.lg, fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
});
