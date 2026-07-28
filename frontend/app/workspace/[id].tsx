import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, radius, font } from '@/src/theme';
import { AuroraBackground, GlassCard } from '@/src/ui';
import { api } from '@/src/api';

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'topics', label: 'Topics', icon: 'bulb-outline' },
  { key: 'papers', label: 'Papers', icon: 'document-text-outline' },
  { key: 'review', label: 'Lit Review', icon: 'book-outline' },
  { key: 'gaps', label: 'Gaps', icon: 'search-outline' },
  { key: 'proposal', label: 'Proposal', icon: 'clipboard-outline' },
  { key: 'citations', label: 'Citations', icon: 'link-outline' },
  { key: 'ppt', label: 'PPT', icon: 'easel-outline' },
] as const;

export default function Workspace() {
  const { id, generate } = useLocalSearchParams<{ id: string; generate?: string }>();
  const router = useRouter();
  const [section, setSection] = useState<typeof SECTIONS[number]['key']>('overview');
  const [project, setProject] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [review, setReview] = useState<any>(null);
  const [gaps, setGaps] = useState<any>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [ppt, setPPT] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autogen = useRef(false);

  const load = async () => {
    try {
      const p = await api.getProject(id);
      setProject(p);
      const [t, papersList, rv, gp, prop, ppData] = await Promise.all([
        api.listTopics(id).catch(() => []),
        api.listPapers(id).catch(() => []),
        api.getLiteratureReview(id).catch(() => null),
        api.getResearchGap(id).catch(() => null),
        api.getProposal(id).catch(() => null),
        api.getPPT(id).catch(() => null),
      ]);
      setTopics(t);
      setPapers(papersList);
      setReview(rv);
      setGaps(gp);
      setProposal(prop);
      setPPT(ppData);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (generate === '1' && project && topics.length === 0 && !autogen.current) {
      autogen.current = true;
      genTopics();
    }
  }, [project, topics]);

  const withBusy = async (key: string, fn: () => Promise<any>) => {
    setBusy(key); setError(null);
    try { await fn(); } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  const genTopics = () => withBusy('topics', async () => {
    const t = await api.generateTopics(id);
    setTopics(t);
    setSection('topics');
  });

  const genReview = () => withBusy('review', async () => {
    const r = await api.literatureReview(id);
    setReview(r);
  });

  const genGaps = () => withBusy('gaps', async () => {
    const g = await api.researchGap(id);
    setGaps(g);
  });

  const genProposal = () => withBusy('proposal', async () => {
    const p = await api.generateProposal(id, project?.title);
    setProposal(p);
  });

  const genPPT = () => withBusy('ppt', async () => {
    const pp = await api.generatePPT(id);
    setPPT(pp);
  });

  const uploadPDF = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (res.canceled) return;
      const file = res.assets[0];
      setBusy('upload'); setError(null);
      const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const paper = await api.uploadPaper(id, file.name, b64);
      setPapers((prev) => [paper, ...prev]);
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(null); }
  };

  if (!project) {
    return (
      <View style={styles.root}><AuroraBackground />
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {error ? <Text style={{ color: colors.error }}>{error}</Text> : <ActivityIndicator color={colors.brand} />}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Sticky Header */}
        <View style={styles.header}>
          <Pressable testID="ws-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1, marginHorizontal: spacing.md }}>
            <Text style={styles.headerTitle} numberOfLines={1} testID="ws-title">{project.title}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{project.domain}</Text>
          </View>
          <Pressable testID="ws-chat-btn" onPress={() => router.push(`/chat/${id}`)} style={styles.iconBtn}>
            <Ionicons name="chatbubbles-outline" size={20} color={colors.brand} />
          </Pressable>
        </View>

        {/* Section pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
          {SECTIONS.map((s) => {
            const active = s.key === section;
            return (
              <Pressable
                key={s.key}
                testID={`section-${s.key}-chip`}
                onPress={() => setSection(s.key)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Ionicons name={s.icon as any} size={14} color={active ? colors.brand : colors.slate} />
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <View style={styles.errBanner} testID="ws-error"><Text style={styles.errText}>{error}</Text></View>
        ) : null}

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {section === 'overview' && (
            <>
              <GlassCard style={{ padding: spacing.lg }} radius={24}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.body}>{project.description || 'No description yet.'}</Text>
                {project.keywords ? <Text style={styles.metaLine}>Keywords: {project.keywords}</Text> : null}
              </GlassCard>
              <View style={styles.quickGrid}>
                <QuickTile testID="qt-topics" icon="bulb-outline" label="Topics" count={topics.length} onPress={() => setSection('topics')} />
                <QuickTile testID="qt-papers" icon="document-text-outline" label="Papers" count={papers.length} onPress={() => setSection('papers')} />
                <QuickTile testID="qt-proposal" icon="clipboard-outline" label="Proposal" count={proposal ? 1 : 0} onPress={() => setSection('proposal')} />
                <QuickTile testID="qt-ppt" icon="easel-outline" label="Slides" count={ppt?.slides?.length || 0} onPress={() => setSection('ppt')} />
              </View>
            </>
          )}

          {section === 'topics' && (
            <>
              <GenerateBar
                testID="gen-topics"
                label={topics.length > 0 ? 'Regenerate Topics' : 'Generate Topics with AI'}
                busy={busy === 'topics'}
                onPress={genTopics}
              />
              {topics.length === 0 && busy !== 'topics' && (
                <EmptyState icon="bulb-outline" title="No topics yet" desc="Let Claude generate 5 novel research directions with novelty & difficulty scores." />
              )}
              {topics.map((t) => (
                <GlassCard key={t.id} style={{ padding: spacing.lg }} radius={24}>
                  <Text style={styles.topicTitle} testID={`topic-${t.id}`}>{t.topic_name}</Text>
                  <Text style={styles.body}>{t.description}</Text>
                  <View style={styles.scoresRow}>
                    <ScorePill label="Novelty" value={t.novelty_score} color={colors.brandTertiary} />
                    <ScorePill label="Difficulty" value={t.difficulty_score} color={colors.brandSecondary} />
                  </View>
                  {t.datasets?.length ? (
                    <View style={styles.datasetWrap}>
                      <Text style={styles.datasetHeader}>Suggested datasets</Text>
                      {t.datasets.map((d: string, i: number) => (
                        <Text key={i} style={styles.datasetItem}>• {d}</Text>
                      ))}
                    </View>
                  ) : null}
                </GlassCard>
              ))}
            </>
          )}

          {section === 'papers' && (
            <>
              <Pressable
                testID="upload-pdf-btn"
                onPress={uploadPDF}
                disabled={busy === 'upload'}
                style={styles.uploadBtn}
              >
                {busy === 'upload' ? <ActivityIndicator color={colors.white} /> : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
                    <Text style={styles.primaryLabel}>Upload PDF</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                testID="paste-text-btn"
                onPress={() => router.push(`/paste-paper/${id}`)}
                style={styles.secondaryBtn}
              >
                <Ionicons name="clipboard-outline" size={18} color={colors.brand} />
                <Text style={styles.secondaryLabel}>Paste paper text</Text>
              </Pressable>
              {papers.length === 0 && busy !== 'upload' && (
                <EmptyState icon="document-text-outline" title="No papers yet" desc="Upload PDFs — Claude will summarize them and extract methodology & datasets." />
              )}
              {papers.map((p) => (
                <GlassCard key={p.id} style={{ padding: spacing.lg }} radius={24}>
                  <Text style={styles.paperTitle} testID={`paper-${p.id}`}>{p.title}</Text>
                  {p.authors ? <Text style={styles.paperMeta}>{p.authors}{p.year ? ` · ${p.year}` : ''}</Text> : null}
                  {p.summary ? (
                    <>
                      <Text style={styles.subHeader}>Summary</Text>
                      <Text style={styles.body}>{p.summary}</Text>
                    </>
                  ) : null}
                  {p.methodology ? (
                    <>
                      <Text style={styles.subHeader}>Methodology</Text>
                      <Text style={styles.body}>{p.methodology}</Text>
                    </>
                  ) : null}
                  {p.dataset_used ? (
                    <>
                      <Text style={styles.subHeader}>Dataset</Text>
                      <Text style={styles.body}>{p.dataset_used}</Text>
                    </>
                  ) : null}
                </GlassCard>
              ))}
            </>
          )}

          {section === 'review' && (
            <>
              <GenerateBar
                testID="gen-review"
                label={review?.synthesis ? 'Regenerate Review' : 'Generate Literature Review'}
                busy={busy === 'review'}
                disabled={papers.length === 0}
                onPress={genReview}
              />
              {papers.length === 0 && (
                <EmptyState icon="book-outline" title="Add papers first" desc="Upload PDFs in the Papers tab before generating a literature review." />
              )}
              {review?.synthesis ? (
                <GlassCard style={{ padding: spacing.lg }} radius={24}>
                  <Text style={styles.sectionTitle}>Synthesis</Text>
                  <Text style={styles.body}>{review.synthesis}</Text>
                </GlassCard>
              ) : null}
              {review?.matrix?.map((m: any, i: number) => (
                <GlassCard key={i} style={{ padding: spacing.lg }} radius={24}>
                  <Text style={styles.paperTitle}>{m.paper_title}</Text>
                  <Text style={styles.subHeader}>Methodology</Text><Text style={styles.body}>{m.methodology}</Text>
                  <Text style={styles.subHeader}>Dataset</Text><Text style={styles.body}>{m.dataset}</Text>
                  <Text style={styles.subHeader}>Key finding</Text><Text style={styles.body}>{m.key_finding}</Text>
                  <Text style={styles.subHeader}>Limitation</Text><Text style={styles.body}>{m.limitation}</Text>
                </GlassCard>
              ))}
            </>
          )}

          {section === 'gaps' && (
            <>
              <GenerateBar
                testID="gen-gaps"
                label={gaps?.gaps?.length ? 'Regenerate Gaps' : 'Find Research Gaps'}
                busy={busy === 'gaps'}
                onPress={genGaps}
              />
              {gaps?.existing_work_summary ? (
                <GlassCard style={{ padding: spacing.lg }} radius={24}>
                  <Text style={styles.sectionTitle}>Existing work</Text>
                  <Text style={styles.body}>{gaps.existing_work_summary}</Text>
                </GlassCard>
              ) : (
                busy !== 'gaps' && <EmptyState icon="search-outline" title="No gaps yet" desc="Tap generate to identify unexplored research gaps." />
              )}
              {gaps?.gaps?.map((g: any, i: number) => (
                <GlassCard key={i} style={{ padding: spacing.lg }} radius={24}>
                  <View style={styles.gapRow}>
                    <View style={[styles.priorityChip, priorityColor(g.priority)]}>
                      <Text style={styles.priorityText}>{(g.priority || 'medium').toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.body, { marginTop: 8 }]}>{g.description}</Text>
                </GlassCard>
              ))}
              {gaps?.future_scope?.length ? (
                <GlassCard style={{ padding: spacing.lg }} radius={24}>
                  <Text style={styles.sectionTitle}>Future scope</Text>
                  {gaps.future_scope.map((f: string, i: number) => (
                    <Text key={i} style={styles.datasetItem}>• {f}</Text>
                  ))}
                </GlassCard>
              ) : null}
            </>
          )}

          {section === 'proposal' && (
            <>
              <GenerateBar
                testID="gen-proposal"
                label={proposal ? 'Regenerate Proposal' : 'Generate Proposal'}
                busy={busy === 'proposal'}
                onPress={genProposal}
              />
              {!proposal && busy !== 'proposal' && (
                <EmptyState icon="clipboard-outline" title="No proposal yet" desc="Claude will draft Title, Abstract, Objectives, Scope, Methodology and Future Scope." />
              )}
              {proposal ? (
                <>
                  <ProposalCard label="Title" text={proposal.title} testID="prop-title" />
                  <ProposalCard label="Abstract" text={proposal.abstract} testID="prop-abstract" />
                  <ProposalCard label="Problem Statement" text={proposal.problem_statement} testID="prop-problem" />
                  <GlassCard style={{ padding: spacing.lg }} radius={24}>
                    <Text style={styles.sectionTitle}>Objectives</Text>
                    {(proposal.objectives || []).map((o: string, i: number) => (
                      <Text key={i} style={styles.datasetItem}>{i + 1}. {o}</Text>
                    ))}
                  </GlassCard>
                  <ProposalCard label="Scope" text={proposal.scope} testID="prop-scope" />
                  <ProposalCard label="Methodology" text={proposal.methodology} testID="prop-methodology" />
                  <ProposalCard label="Future Scope" text={proposal.future_scope} testID="prop-future" />
                </>
              ) : null}
            </>
          )}

          {section === 'citations' && (
            <CitationsPanel projectId={id} papers={papers} />
          )}

          {section === 'ppt' && (
            <>
              <GenerateBar
                testID="gen-ppt"
                label={ppt?.slides?.length ? 'Regenerate Slides' : 'Generate 10-Slide Deck'}
                busy={busy === 'ppt'}
                disabled={!proposal}
                onPress={genPPT}
              />
              {!proposal && (
                <EmptyState icon="easel-outline" title="Proposal required" desc="Generate a proposal first — Claude uses it as source material for the deck." />
              )}
              {ppt?.slides?.map((s: any) => (
                <GlassCard key={s.index} style={{ padding: spacing.lg }} radius={24}>
                  <View style={styles.slideHeader}>
                    <Text style={styles.slideBadge}>Slide {s.index}</Text>
                    <Text style={styles.slideTitle}>{s.title}</Text>
                  </View>
                  {(s.bullets || []).map((b: string, i: number) => (
                    <Text key={i} style={styles.datasetItem}>• {b}</Text>
                  ))}
                  {s.notes ? (
                    <>
                      <Text style={styles.subHeader}>Speaker notes</Text>
                      <Text style={styles.body}>{s.notes}</Text>
                    </>
                  ) : null}
                </GlassCard>
              ))}
            </>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ---------- Sub-components ---------- //
function QuickTile({ testID, icon, label, count, onPress }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={{ width: '48%' }}>
      <GlassCard style={{ padding: spacing.md, gap: 4 }} radius={20}>
        <Ionicons name={icon} size={22} color={colors.brand} />
        <Text style={styles.qtCount}>{count}</Text>
        <Text style={styles.qtLabel}>{label}</Text>
      </GlassCard>
    </Pressable>
  );
}
function ScorePill({ label, value, color }: any) {
  return (
    <View style={styles.scorePill}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreBarTrack}>
        <View style={[styles.scoreBar, { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.scoreVal, { color }]}>{value}</Text>
    </View>
  );
}
function GenerateBar({ testID, label, busy, disabled, onPress }: any) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [styles.genBtn, disabled && { opacity: 0.5 }, pressed && { opacity: 0.9 }]}
    >
      {busy ? <ActivityIndicator color={colors.white} /> : (
        <>
          <Ionicons name="sparkles" size={18} color={colors.white} />
          <Text style={styles.primaryLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
function EmptyState({ icon, title, desc }: any) {
  return (
    <GlassCard style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }} radius={24}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.brand} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
    </GlassCard>
  );
}
function ProposalCard({ label, text, testID }: any) {
  return (
    <GlassCard style={{ padding: spacing.lg }} radius={24}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={styles.body} testID={testID}>{text || '—'}</Text>
    </GlassCard>
  );
}
function priorityColor(p: string) {
  if (p === 'high') return { backgroundColor: '#FEE2E2' };
  if (p === 'low') return { backgroundColor: colors.brandTertiaryLight };
  return { backgroundColor: colors.brandSecondaryLight };
}

function CitationsPanel({ projectId, papers }: any) {
  const [style, setStyle] = useState<'IEEE' | 'APA' | 'MLA' | 'Chicago'>('IEEE');
  const [items, setItems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const gen = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api.citations(projectId, style);
      setItems(r.citations || []);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const copyAll = async () => {
    await Clipboard.setStringAsync(items.join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {(['IEEE', 'APA', 'MLA', 'Chicago'] as const).map((s) => (
          <Pressable
            key={s}
            testID={`cite-chip-${s}`}
            onPress={() => setStyle(s)}
            style={[styles.pill, style === s && styles.pillActive, { paddingHorizontal: spacing.lg }]}
          >
            <Text style={[styles.pillText, style === s && styles.pillTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <GenerateBar testID="gen-citations" label={items.length ? `Regenerate ${style}` : `Generate ${style} Citations`} busy={busy} disabled={papers.length === 0} onPress={gen} />
      {papers.length === 0 && (
        <EmptyState icon="link-outline" title="Add papers first" desc="Upload PDFs so we can format their citations." />
      )}
      {err ? <View style={styles.errBanner}><Text style={styles.errText}>{err}</Text></View> : null}
      {items.map((c, i) => (
        <GlassCard key={i} style={{ padding: spacing.md }} radius={20}>
          <Text style={styles.body} testID={`citation-${i}`}>{c}</Text>
        </GlassCard>
      ))}
      {items.length > 0 ? (
        <Pressable testID="copy-citations-btn" onPress={copyAll} style={styles.secondaryBtn}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.brand} />
          <Text style={styles.secondaryLabel}>{copied ? 'Copied!' : 'Copy all'}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.glassBorder },
  headerTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium },
  headerSub: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, marginTop: 2 },
  pillsRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md, paddingTop: spacing.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.glassBorder, flexShrink: 0 },
  pillActive: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  pillText: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate },
  pillTextActive: { color: colors.brand, fontWeight: font.weights.medium },
  content: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium, marginBottom: 6 },
  body: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.onSurfaceTertiary, lineHeight: 22 },
  subHeader: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.brand, fontWeight: font.weights.medium, marginTop: spacing.md, marginBottom: 4 },
  metaLine: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, marginTop: spacing.md },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  qtCount: { fontFamily: font.family, fontSize: 22, color: colors.ink, fontWeight: font.weights.medium, marginTop: 4 },
  qtLabel: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate },
  topicTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium, marginBottom: 6 },
  scoresRow: { marginTop: spacing.md, gap: spacing.sm },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreLabel: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, width: 70 },
  scoreBarTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: 'hidden' },
  scoreBar: { height: 8, borderRadius: radius.pill },
  scoreVal: { fontFamily: font.family, fontSize: font.sizes.sm, fontWeight: font.weights.medium, width: 32, textAlign: 'right' },
  datasetWrap: { marginTop: spacing.md },
  datasetHeader: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.brand, fontWeight: font.weights.medium, marginBottom: 6 },
  datasetItem: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.onSurfaceTertiary, marginTop: 4, lineHeight: 20 },
  genBtn: { height: 50, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  primaryLabel: { color: colors.white, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  uploadBtn: { height: 50, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  secondaryBtn: { height: 46, borderRadius: radius.pill, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  secondaryLabel: { color: colors.brand, fontFamily: font.family, fontSize: font.sizes.base, fontWeight: font.weights.medium },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: font.family, fontSize: font.sizes.lg, color: colors.ink, fontWeight: font.weights.medium },
  emptyDesc: { fontFamily: font.family, fontSize: font.sizes.sm, color: colors.slate, textAlign: 'center' },
  paperTitle: { fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink, fontWeight: font.weights.medium },
  paperMeta: { fontFamily: font.family, fontSize: font.sizes.xs, color: colors.slate, marginTop: 2 },
  gapRow: { flexDirection: 'row', alignItems: 'center' },
  priorityChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  priorityText: { fontFamily: font.family, fontSize: 10, color: colors.ink, fontWeight: font.weights.medium },
  slideHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 8 },
  slideBadge: { backgroundColor: colors.brandLight, color: colors.brand, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, fontSize: 10, fontFamily: font.family, fontWeight: font.weights.medium },
  slideTitle: { flex: 1, fontFamily: font.family, fontSize: font.sizes.base, color: colors.ink, fontWeight: font.weights.medium },
  errBanner: { backgroundColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  errText: { color: colors.error, fontFamily: font.family, fontSize: font.sizes.sm },
});
