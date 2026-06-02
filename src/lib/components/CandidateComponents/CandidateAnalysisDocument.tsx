import { Document, Page, Text, View, StyleSheet, Image, Svg, Stop, LinearGradient, Defs, Rect, Circle, Path, Link } from '@react-pdf/renderer';
import moment from 'moment';
import { getCVSection } from '@/lib/Utils';
import { getSkills } from '@/lib/utils/candidateHelpers';
import { useEffect, useState } from 'react';
import { api } from '@/lib/utils/apiClient';
import ReactMarkdown from 'react-markdown';

// Parse markdown summary into sections for PDF (plain text). Supports # or ## headers.
function parseSummarySections(summary: string | null | undefined) {
  if (!summary || typeof summary !== 'string') {
    return { main: '', assessment: '', strongPoints: [] as string[], weakPoints: [] as string[] };
  }
  const strongMatch = summary.match(/\n#+\s*Strong Points\s*\n/i);
  const weakMatch = summary.match(/\n#+\s*Weak Points\s*\n/i);
  const assessmentMatch = summary.match(/\n#+\s*Assessment of the applicant\s*\n/i);
  const mainEnd = assessmentMatch ? assessmentMatch.index! : (strongMatch ? strongMatch.index! : -1);
  const main = mainEnd >= 0
    ? summary.slice(0, mainEnd).replace(/#+\s*Summary of the interview\s*/i, '').trim().replace(/\*\*/g, '')
    : summary.replace(/\*\*/g, '');
  const assessmentEnd = strongMatch ? strongMatch.index! : summary.length;
  const assessment =
    assessmentMatch && strongMatch
      ? summary
          .slice(assessmentMatch.index! + assessmentMatch[0].length, assessmentEnd)
          .trim()
          .replace(/\*\*/g, '')
      : '';
  const strongStart = strongMatch ? strongMatch.index! + strongMatch[0].length : summary.length;
  const weakStart = weakMatch ? weakMatch.index! : -1;
  const strongBlock = weakStart >= 0 ? summary.slice(strongStart, weakStart).trim() : summary.slice(strongStart).trim();
  const weakBlockStart = weakMatch ? weakMatch.index! + weakMatch[0].length : summary.length;
  const finalMatch = summary.match(/\n#+\s*Final Assessment?\s*(?:of the applicant)?\s*\n/i);
  const finalIdx = finalMatch ? finalMatch.index! : -1;
  const weakBlock = finalIdx >= 0 ? summary.slice(weakBlockStart, finalIdx).trim() : summary.slice(weakBlockStart).trim();
  const toBullets = (text: string) => text.split(/\n/).map((s) => s.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
  return { main, assessment, strongPoints: toBullets(strongBlock), weakPoints: toBullets(weakBlock) };
}

/** Parse cvScreeningReason HTML (headers + ul/li) into sections with titles and bullet points for PDF */
function parseCvScreeningReason(html: string | null | undefined): { sections: { title: string; bullets: string[] }[]; raw: string | null } {
  if (!html || typeof html !== 'string') return { sections: [], raw: null };
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/g, (c) => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' }[c] ?? c)).trim();
  const hasStrong = /strong\s*points?/i.test(html) || /good/i.test(html);
  const hasWeak = /weak\s*points?/i.test(html) || /bad/i.test(html);
  if (!hasStrong && !hasWeak) return { sections: [], raw: html };
  const sections: { title: string; bullets: string[] }[] = [];
  const extractBullets = (block: string) =>
    block
      .split(/<li>|<\/li>|<br\s*\/?>|\n|•/)
      .map((p) => stripTags(p).trim())
      .filter((p) => p.length > 0);
  if (hasStrong) {
    const strongMatch = html.match(/strong\s*points?[:\s]*([\s\S]*?)(?=weak\s*points?|$)/i);
    if (strongMatch?.[1]) {
      const bullets = extractBullets(strongMatch[1]).filter((p) => p.length > 2);
      if (bullets.length) sections.push({ title: 'Strong Points', bullets });
    }
    const goodMatch = html.match(/good[:\s]*([\s\S]*?)(?=bad|$)/i);
    if (goodMatch?.[1]) {
      const bullets = extractBullets(goodMatch[1]).filter((p) => p.length > 2);
      if (bullets.length) sections.push({ title: 'Good', bullets });
    }
  }
  if (hasWeak) {
    const weakMatch = html.match(/weak\s*points?[:\s]*([\s\S]*)$/i);
    if (weakMatch?.[1]) {
      const bullets = extractBullets(weakMatch[1]).filter((p) => p.length > 2);
      if (bullets.length) sections.push({ title: 'Weak Points', bullets });
    }
    const badMatch = html.match(/bad[:\s]*([\s\S]*)$/i);
    if (badMatch?.[1]) {
      const bullets = extractBullets(badMatch[1]).filter((p) => p.length > 2);
      if (bullets.length) sections.push({ title: 'Bad', bullets });
    }
  }
  return { sections, raw: sections.length ? null : html };
}

function stripHtmlForPdf(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/g, (c) => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' }[c] ?? c))
    .trim();
}

export default function CandidateAnalysisDocument({ candidate, evaluations, analysis: analysisProp, summary: summaryProp, feedback: feedbackProp, transcripts: transcriptsProp, comments: commentsProp }: any) {
  const preScreeningQuestions = candidate?.preScreeningQuestions || [];
  const analysis = analysisProp ?? candidate?.analysis;
  const summary = summaryProp ?? candidate?.summary;
  const feedback = feedbackProp ?? candidate?.feedback;
  const [cvData, setCvData] = useState<any[]>([]);
  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [cvUploadedAt, setCvUploadedAt] = useState<string | null>(null);
  const summarySections = parseSummarySections(summary);

  useEffect(() => {
    const fetchCVData = async () => {
      const response = await api.post("/api/load-user-cv", { email: candidate?.email });
      if (response?.data?.digitalCV) {
          setCvData(response?.data?.digitalCV);
          setCvUploadedAt(response?.data?.updatedAt);
          const candidateWithCv = { ...candidate, cvData: response?.data?.digitalCV };
          const skills = getSkills(candidateWithCv);
          setSkillsList(skills);
      }
    }
    if (candidate) {
      fetchCVData();
    }
  }, [candidate]);

    const styles = StyleSheet.create({
        page: { padding: 24, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#fff' },
        headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderRadius: 8, borderWidth: 1, borderColor: '#E9EAEB', padding: 16, backgroundColor: '#fff' },
        avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
        avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: '#E0E0E0' },
        name: { fontWeight: 700, fontSize: 24, marginBottom: 2, color: "#181D27" },
        applicationTags: { fontWeight: 500, fontSize: 14, marginBottom: 2, color: "#181D27" },
        jobFitCol: { flexDirection: 'column', alignItems: 'flex-end' },
        jobFitText: { fontSize: 12, marginBottom: 2 },
        jobTitle: { fontWeight: 500, fontSize: 13 },
        sectionRow: { flexDirection: 'row', gap: 8 },
        leftCol: { flexDirection: 'column', borderRightWidth: 1, borderRightColor: '#E9EAEB', padding: 24, backgroundColor: "#FFFFFF", borderRadius: 8 },
        rightCol: { flexDirection: 'column', paddingLeft: 6, gap: 12 },
        section: { marginBottom: 16 },
        sectionHeader: { fontSize: 14, fontWeight: 500, marginBottom: 6, color: '#181D27' },
        divider: { height: 1, backgroundColor: '#E9EAEB', marginVertical: 12 },
        introSection: { marginBottom: 18 },
        noContent: { color: '#B0B0B0', fontStyle: 'italic', fontSize: 12 },
        date: { fontSize: 14, color: '#717680', fontWeight: 500 },
        cvSectionContainer: { marginBottom: 24, borderRadius: 8, borderWidth: 1, borderColor: '#E9EAEB', padding: 8, backgroundColor: '#FAFAFA' },
        cvHeader: { fontSize: 12, color: '#717680', marginBottom: 12 },
        cvBodyText: { fontSize: 12, color: '#181D27', marginBottom: 4, lineHeight: 1.4 },
        rightCard: { borderRadius: 8, borderWidth: 1, borderColor: '#E9EAEB', padding: 12, backgroundColor: '#fff', marginBottom: 12 },
        rightCardLast: { borderRadius: 8, borderWidth: 1, borderColor: '#E9EAEB', padding: 12, backgroundColor: '#fff', marginBottom: 0 },
        labelText: { fontSize: 11, color: '#475467', marginBottom: 2 },
        valueText: { fontSize: 11, color: '#181D27', marginBottom: 6 },
        linkText: { fontSize: 11, color: '#2563EB', marginBottom: 6 },
        answerBold: { fontWeight: 'bold', color: '#181D27' },
        questionTitle: { fontSize: 11, fontWeight: 'bold', color: '#475467', marginBottom: 2 },
        questionText: { fontSize: 11, color: '#475467', marginBottom: 4 },
        skillTag: { fontSize: 10, color: '#363F72', backgroundColor: '#F8F9FC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: '#D5D9EB' },
        skillTagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
        skillsNote: { fontSize: 10, color: '#717680', lineHeight: 1.3 },
        // AI Interview section
        aiCardContainer: {  marginBottom: 24, borderRadius: 8, borderWidth: 1, borderColor: '#E9EAEB', padding: 8, backgroundColor: '#FAFAFA' },
        aiCard: { borderRadius: 8, borderWidth: 1, borderColor: '#E9EAEB', padding: 16, backgroundColor: '#fff' },
        aiCardTitle: { fontSize: 16, fontWeight: 500, color: "#181D27", marginBottom: 12, marginLeft: 12 },
        aiInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
        aiInfoLeft: { flexDirection: 'column', flex: 1 },
        aiInfoLabel: { fontSize: 10, color: '#6B7280', marginBottom: 2 },
        aiInfoValue: { fontSize: 11, color: '#181D27' },
        aiQualityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
        aiQualityLabel: { fontSize: 11, fontWeight: 'bold', color: '#414651', width: '25%' },
        aiQualityBarBg: { flex: 1, height: 8, backgroundColor: '#E9EAEB', borderRadius: 4, marginHorizontal: 8 },
        aiQualityBarFill: { height: 8, borderRadius: 4 },
        aiQualityScore: { fontSize: 11, color: '#181D27', width: 28 },
        aiQualityRationale: { fontSize: 10, color: '#414651', marginBottom: 12, lineHeight: 1.4 },
        aiFeedbackStars: { flexDirection: 'row', gap: 4, marginBottom: 8 },
        aiFeedbackQuote: { fontSize: 11, color: '#181D27', fontStyle: 'italic', lineHeight: 1.4 },
        aiSummarySubhead: { fontSize: 11, fontWeight: 'bold', color: '#181D27', marginTop: 8, marginBottom: 4 },
        aiBullet: { fontSize: 10, color: '#414651', marginLeft: 8, marginBottom: 2, lineHeight: 1.3 },
        // Transcript
        transcriptRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
        transcriptSpeaker: { fontSize: 11, fontWeight: 'bold', color: '#181D27', marginRight: 8 },
        transcriptTime: { fontSize: 9, color: '#717680', marginRight: 8 },
        transcriptDivider: { width: 1, height: 14, backgroundColor: '#E9EAEB', marginHorizontal: 5 },
        transcriptDuration: { fontSize: 9, color: '#717680' },
        transcriptBubbleUser: { flexDirection: 'row', backgroundColor: '#F8F9FC', borderRadius: 8, borderWidth: 1, borderColor: '#E9EAEB', padding: 8, paddingHorizontal: 16, marginTop: 4, marginBottom: 12, flexShrink: 1, flexGrow: 0 },
        transcriptBubbleJia: { flexDirection: 'row', backgroundColor: '#EFF8FF', borderRadius: 8, borderWidth: 1, borderColor: '#E9EAEB', padding: 8, paddingHorizontal: 16, marginTop: 4, marginBottom: 12, flexShrink: 1, flexGrow: 0 },
        transcriptContent: { fontSize: 11, color: '#181D27', lineHeight: 1.4 },
        // Comments
        commentsSection: { marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E9EAEB', padding: 16, backgroundColor: '#fff' },
        commentsTitle: { fontSize: 16, fontWeight: 500, color: '#181D27', marginBottom: 12 },
        commentBlock: { marginBottom: 16 },
        commentHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
        commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: '#E5E7EB' },
        commentAuthor: { fontSize: 11, fontWeight: 'bold', color: '#181D27', marginRight: 6 },
        commentMeta: { fontSize: 10, color: '#717680' },
        commentDivider: { height: 1, backgroundColor: '#E9EAEB', marginVertical: 12 },
        commentBody: { fontSize: 11, color: '#181D27', lineHeight: 1.4, marginTop: 4 },
        commentMention: { fontSize: 11, color: '#2563EB', fontWeight: 'bold' },
        replyWrapper: { marginLeft: 24, marginTop: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#E5E7EB' },
        replyArrow: { fontSize: 12, color: '#9CA3AF', marginRight: 6 },

        recruiterEvaluationCard: { borderRadius: 8, borderWidth: 1, borderColor: '#FFFAEB', padding: 8, backgroundColor: '#FFFCF5', marginBottom: 16 },
        recruiterEvaluationAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: "4px 12px", marginBottom: 10 },
        recruiterEvaluatorName: { fontSize: 16, fontWeight: 500, color: '#181D27' },
        recruiterAvatar: { width: 32, height: 32, borderRadius: 24, backgroundColor: '#E0E0E0' },
      });

    const getSection = (name: string) => (cvData && getCVSection(cvData, name)) || '';

    // Build comment threads: parents (no parentId) and replies by parent
    const commentList = (commentsProp ?? []).filter((c: any) => !c.deleted && !c.deletedAt);
    const parents = commentList.filter((c: any) => !c.parentId && !c.parent_id);
    const repliesByParent: Record<string, any[]> = {};
    commentList.forEach((c: any) => {
      const pid = c.parentId || c.parent_id;
      if (pid) {
        const key = String(pid);
        if (!repliesByParent[key]) repliesByParent[key] = [];
        repliesByParent[key].push(c);
      }
    });
    const commentTime = (date: string | undefined) => date ? moment(date).format('MMM D, h:mm A') : '';
    const commentRole = (c: any) => (c.createdBy?.role || 'Contributor').replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase());
    const commentText = (c: any) => c.text || c.comment || c.feedback || '';

    // Render comment body with @[Display](id) as blue bold (for PDF: array of Text nodes)
    const renderCommentBody = (raw: string) => {
      if (!raw) return <Text style={styles.commentBody} />;
      const regex = /@\[(.+?)\]\((.+?)\)/g;
      const parts: Array<{ type: 'text' | 'mention'; value: string }> = [];
      let lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(raw))) {
        if (m.index > lastIndex) parts.push({ type: 'text', value: raw.slice(lastIndex, m.index) });
        parts.push({ type: 'mention', value: `@${m[1]}` });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < raw.length) parts.push({ type: 'text', value: raw.slice(lastIndex) });
      return (
        <Text style={styles.commentBody}>
          {parts.map((p, i) =>
            p.type === 'mention' ? (
              <Text key={i} style={styles.commentMention}>{p.value}</Text>
            ) : (
              <Text key={i}>{p.value}</Text>
            )
          )}
        </Text>
      );
    };

    const formatPrescreeningAnswer = (q: any) => {
        const answers = q?.selectedAnswers;
        if (!answers || !Array.isArray(answers) || answers.length === 0) return 'N/A';
        return answers.map((a: any) => (typeof a === 'object' && a?.value != null ? String(a.value) : String(a))).join(', ');
    };

    const renderers = {
      // Headers: # → h1, ## → h2, ### → h3 (e.g. "# Summary of the interview", "# Strong Points")
      h1: ({ children }) => <Text style={[styles.sectionHeader, { fontSize: 16, marginTop: 12, marginBottom: 6 }]}>{children}</Text>,
      h2: ({ children }) => <Text style={[styles.sectionHeader, { marginTop: 10, marginBottom: 6 }]}>{children}</Text>,
      h3: ({ children }) => <Text style={styles.sectionHeader}>{children}</Text>,
      p: ({ children }) => <Text style={[styles.cvBodyText, { marginBottom: 8 }]}>{children}</Text>,
      ul: ({ children }) => <View style={{ marginBottom: 8 }}>{children}</View>,
      li: ({ children }) => <Text style={[styles.cvBodyText, { marginLeft: 4, marginBottom: 4 }]}>• {children}</Text>,
      a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
        <Link src={href} style={styles.linkText}>{children}</Link>
      ),
      strong: ({ children }) => <Text style={[styles.cvBodyText, { fontWeight: 700 }]}>{children}</Text>,
      em: ({ children }) => <Text style={[styles.cvBodyText, { fontStyle: 'italic' }]}>{children}</Text>,
      text: ({ children }: { children?: string }) => <Text style={styles.cvBodyText}>{children}</Text>,
    }

    const getRecruiterEvaluationCard = (stageId: string) => {
      const recruiterEvaluation = evaluations?.find((evaluation: any) => evaluation.stageId === stageId)?.evaluation;
      return (
        recruiterEvaluation && (
        <View style={styles.recruiterEvaluationCard}>
          <View style={styles.recruiterEvaluationAvatarRow}>
          {recruiterEvaluation.createdBy.image && <Image src={recruiterEvaluation.createdBy.image} style={styles.recruiterAvatar} />}
          <Text style={styles.recruiterEvaluatorName}>Evaluation by {recruiterEvaluation.createdBy.name}</Text>
          <CareerFitBadge fit={recruiterEvaluation.matchFit || 'N/A'} size="small" />
        </View>
          <View style={styles.aiCard}>
          <Text style={styles.cvBodyText}>{recruiterEvaluation.evaluationNotes}</Text>
          </View>
        </View>
      )
      )
    }

    return (
    <Document>
        <Page size={{ width: 1440, height: 1738 }} style={{ padding: 24 }}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.avatarRow}>
              {candidate?.image && (
                <Image src={candidate.image} style={styles.avatar} />
              )}
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={styles.name}>{candidate?.name}</Text>
                  <View style={{ backgroundColor: "#F8F9FC", borderRadius: 4, padding: 4 }}>
                  <Text style={styles.applicationTags}>Application Details</Text>
                  </View>
                  <View style={{ backgroundColor: "#F8F9FC", borderRadius: 4, padding: 4 }}>
                  <Text style={styles.applicationTags}>{candidate?.stage}</Text>
                  </View>
                </View>
                <Text style={styles.jobTitle}>For <Text style={{ color: "#444CE7" }}>{candidate?.jobTitle}</Text></Text>
              </View>
            </View>
            <Text style={styles.date}>{`Last Updated: ${moment().format("h:mm A dddd, MMMM D YYYY")}`}</Text>
          </View>

          {/* CV Screening */}
          <StageSection stageName="CV Screening" fit={candidate?.cvStatus || 'N/A'} />
          {getRecruiterEvaluationCard("1")}
          {/* Evaluation by Jia */}
          <View style={styles.aiCardContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Text style={[styles.aiCardTitle, { marginBottom: 0 }]}>Evaluation by Jia</Text>
              <CareerFitBadge fit={candidate?.cvStatus || 'N/A'} size="small" />
            </View>
           <View style={styles.aiCard}>
            {(() => {
              const { sections, raw } = parseCvScreeningReason(candidate?.cvScreeningReason);
              if (sections.length > 0) {
                return (
                  <>
                    {sections.map((sec, i) => (
                      <View key={i} style={{ marginBottom: i < sections.length - 1 ? 12 : 0 }}>
                        <Text style={styles.aiSummarySubhead}>{sec.title}</Text>
                        {sec.bullets.map((point, j) => (
                          <Text key={j} style={styles.aiBullet}>• {point}</Text>
                        ))}
                      </View>
                    ))}
                  </>
                );
              }
              if (raw) return <Text style={styles.cvBodyText}>{stripHtmlForPdf(raw)}</Text>;
              return <Text style={styles.noContent}>No evaluation available.</Text>;
            })()}
           </View>
          </View>

          {/* CV Section - two columns: CV content left, Contact / Pre-screening / Skills right */}
          <View style={styles.sectionRow}>
            <View style={[styles.cvSectionContainer, { width: '58%' }]}>
              <Text style={styles.cvHeader}>
                <Text style={{ color: "#181D27" }}>Candidate CV</Text>{cvUploadedAt ? ` (Uploaded: ${moment(cvUploadedAt).format('MMM D, YYYY')})` : ''}
              </Text>
              {/* Left column: Experience, Education, Certifications, Projects, Awards */}
              <View style={styles.leftCol}>
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Experience</Text>
                  {getSection('Experience') ? (
                    <Text style={styles.cvBodyText}>{getSection('Experience')}</Text>
                  ) : (
                    <Text style={styles.noContent}>No experience provided in CV</Text>
                  )}
                </View>
                <View style={styles.divider} />
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Education</Text>
                  {getSection('Education') ? (
                    <Text style={styles.cvBodyText}>{getSection('Education')}</Text>
                  ) : (
                    <Text style={styles.noContent}>No education provided in CV</Text>
                  )}
                </View>
                <View style={styles.divider} />
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Certifications</Text>
                  {getSection('Certifications') ? (
                    <Text style={styles.cvBodyText}>{getSection('Certifications')}</Text>
                  ) : (
                    <Text style={styles.noContent}>No certifications provided in CV</Text>
                  )}
                </View>
                <View style={styles.divider} />
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Projects</Text>
                  {getSection('Projects') ? (
                    <Text style={styles.cvBodyText}>{getSection('Projects')}</Text>
                  ) : (
                    <Text style={styles.noContent}>No projects listed.</Text>
                  )}
                </View>
                <View style={styles.divider} />
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Awards</Text>
                  {getSection('Awards') ? (
                    <Text style={styles.cvBodyText}>{getSection('Awards')}</Text>
                  ) : (
                    <Text style={styles.noContent}>No awards provided in CV</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Right column: Contact Information, Pre-screening, Skills (card-style) */}
            <View style={{ width: '42%' }}>
            <View style={styles.rightCol}>
                <View style={styles.cvSectionContainer}>
                <Text style={styles.sectionHeader}>Contact Information</Text>
                <View style={styles.rightCard}>
                  {getSection('Contact Info') ? (
                    <ReactMarkdown components={renderers}>{getSection('Contact Info')}</ReactMarkdown>
                  ) : (
                    <Text style={styles.noContent}>No contact information provided in CV</Text>
                  )}
                </View>
                </View>
                <View style={styles.cvSectionContainer}>
                <Text style={styles.sectionHeader}>Pre-screening Question Answers</Text>
                <View style={styles.rightCard}>
                  {preScreeningQuestions.length > 0 ? (
                    preScreeningQuestions.map((q: any, idx: number) => (
                      <View key={q.id || idx} style={{ marginBottom: idx < preScreeningQuestions.length - 1 ? 10 : 0 }}>
                        {q.questionType && (
                          <Text style={styles.questionTitle}>{q.questionType}</Text>
                        )}
                        {q.question && (
                          <Text style={styles.questionText}>{q.question}</Text>
                        )}
                        <Text style={styles.questionText}>
                          Answer: <Text style={styles.answerBold}>{formatPrescreeningAnswer(q)}</Text>
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noContent}>No pre-screening answers.</Text>
                  )}
                </View>
                </View>
                <View style={styles.cvSectionContainer}>
                <Text style={styles.sectionHeader}>Skills</Text>
                <View style={[styles.rightCard, styles.rightCardLast]}>
                  {skillsList.length > 0 ? (
                    <>
                      <View style={styles.skillTagRow}>
                        {skillsList.map((skill: string, idx: number) => (
                          <View key={idx} style={styles.skillTag}>
                            <Text>{skill}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.skillsNote}>
                        Jia automatically extracts skill tags from uploaded CVs. You may add more skills to improve candidate search.
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.noContent}>No skills provided in CV</Text>
                  )}
                </View>
                </View>
              </View>
            </View>
          </View>

          {/* AI Interview */}
          <StageSection stageName="AI Interview" fit={candidate?.jobFit || analysis?.final_assessment || 'N/A'} />
          {getRecruiterEvaluationCard("2")}

          {/* Interview Information + Feedback row */}
          <View style={styles.sectionRow} wrap={false}>
            <View style={[styles.aiCardContainer, { flex: 1 }]}>
            <Text style={styles.aiCardTitle}>Interview Information</Text>
            <View style={styles.aiCard}>
              <View style={styles.aiInfoRow}>
                {candidate?.image && <Image src={candidate.image} style={[styles.avatar, { width: 40, height: 40, borderRadius: 20 }]} />}
                <View style={styles.aiInfoLeft}>
                  <Text style={[styles.name, { marginBottom: 2, fontSize: 14 }]}>{candidate?.name}</Text>
                  <Text style={styles.aiInfoValue}>{candidate?.email}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 24 }}>
                <View>
                  <Text style={styles.aiInfoLabel}>Interview taken on</Text>
                  <Text style={styles.aiInfoValue}>{candidate?.completedAt ? moment(candidate?.completedAt).format('MMM D, YYYY') : 'N/A'}</Text>
                </View>
                <View>
                  <Text style={styles.aiInfoLabel}>Joined on</Text>
                  <Text style={styles.aiInfoValue}>{candidate?.createdAt ? moment(candidate?.createdAt).format('MMM D, YYYY') : 'N/A'}</Text>
                </View>
              </View>
            </View>
            </View>
            <View style={[styles.aiCardContainer, { flex: 1 }]}>
            <Text style={styles.aiCardTitle}>Feedback</Text>
            <View style={styles.aiCard}>
              {feedback ? (
                <>
                  <View style={styles.aiFeedbackStars}>
                    {[1, 2, 3, 4, 5].map((i) => {
                      const filled = i <= (feedback.rating || 0);
                      const fillColor = filled ? '#FFD600' : '#E5E7EB';
                      return (
                        <View key={i} style={{ width: 14, height: 14 }}>
                          <Svg width={14} height={14} viewBox="0 0 24 24">
                            <Path d="M12 2 L15 9 L22 9 L17 14 L19 21 L12 17 L5 21 L7 14 L2 9 L9 9 Z" fill={fillColor} />
                          </Svg>
                        </View>
                      );
                    })}
                  </View>
                  {feedback.feedback && (
                    <Text style={styles.aiFeedbackQuote}>"{feedback.feedback}"</Text>
                  )}
                </>
              ) : (
                <Text style={styles.noContent}>No feedback provided.</Text>
              )}
            </View>
            </View>
          </View>

          {/* Evaluation by Jia */}
          <View style={styles.aiCardContainer} wrap={false}>
          <Text style={styles.aiCardTitle}>Evaluation by Jia</Text>
          <View style={styles.aiCard}>
            {analysis ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <CircularProgress percentage={analysis.overall_score || 0} />
                  <View style={{ flex: 1 }}>
                    {(analysis.final_assessment || candidate?.jobFit) && (
                      <CareerFitBadge fit={analysis.final_assessment || candidate?.jobFit} size="small" />
                    )}
                    {analysis.assessment_reason && (
                      <Text style={[styles.cvBodyText, { marginTop: 4 }]}>{String(analysis.assessment_reason).replace(/\*\*/g, '')}</Text>
                    )}
                  </View>
                </View>
                {analysis.breakdown && analysis.breakdown.length > 0 && (
                  <>
                    <Text style={[styles.sectionHeader, { marginTop: 8, marginBottom: 8 }]}>Applicant Qualities Breakdown</Text>
                    {analysis.breakdown.map((item: any, idx: number) => {
                      const colors = ['#9FCAED', '#CEB6DA', '#EBACC9', '#FCCEC0'];
                      const fillColor = colors[idx % colors.length];
                      return (
                        <View key={idx}>
                          <View style={styles.aiQualityRow}>
                            <Text style={styles.aiQualityLabel}>{item?.key || '—'}</Text>
                            <View style={styles.aiQualityBarBg}>
                              <View style={[styles.aiQualityBarFill, { width: `${Math.min(100, item?.data ?? 0)}%`, backgroundColor: fillColor }]} />
                            </View>
                            <Text style={styles.aiQualityScore}>{item?.data != null ? `${Math.round(item.data)}%` : '—'}</Text>
                          </View>
                          {item?.rationale && (
                            <Text style={styles.aiQualityRationale}>{String(item.rationale).replace(/\*\*/g, '')}</Text>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}
              </>
            ) : (
              <Text style={styles.noContent}>No analysis available.</Text>
            )}
          </View>
          </View>
          {/* Interview Summary */}
          <View style={styles.aiCardContainer} wrap={false}>
          <Text style={styles.aiCardTitle}>Interview Summary</Text>
          <View style={styles.aiCard}>
            {summary ? (
              <>
                {summarySections.main && (
                  <>
                    <Text style={styles.aiSummarySubhead}>Summary of the interview</Text>
                    <Text style={[styles.cvBodyText, { marginBottom: 8 }]}>{summarySections.main}</Text>
                  </>
                )}
                {summarySections.assessment && (
                  <>
                    <Text style={styles.aiSummarySubhead}>Assessment of the applicant</Text>
                    <Text style={[styles.cvBodyText, { marginBottom: 8 }]}>{summarySections.assessment}</Text>
                  </>
                )}
                {summarySections.strongPoints.length > 0 && (
                  <>
                    <Text style={styles.aiSummarySubhead}>Strong Points</Text>
                    {summarySections.strongPoints.map((line: string, i: number) => (
                      <Text key={i} style={styles.aiBullet}>• {line}</Text>
                    ))}
                  </>
                )}
                {summarySections.weakPoints.length > 0 && (
                  <>
                    <Text style={styles.aiSummarySubhead}>Weak Points</Text>
                    {summarySections.weakPoints.map((line: string, i: number) => (
                      <Text key={i} style={styles.aiBullet}>• {line}</Text>
                    ))}
                  </>
                )}
                {!summarySections.main && !summarySections.assessment && summarySections.strongPoints.length === 0 && summarySections.weakPoints.length === 0 && (
                  <Text style={styles.cvBodyText}>{String(summary).replace(/#+\s*/g, '').replace(/\*\*/g, '')}</Text>
                )}
              </>
            ) : (
              <Text style={styles.noContent}>No summary available.</Text>
            )}
          </View>
          </View>

          {/* Interview recording — PDF cannot play video; show link to open recording */}
          <View style={styles.aiCardContainer} wrap={false}>
            <Text style={styles.aiCardTitle}>Interview Recording</Text>
            <View style={styles.aiCard}>
              {candidate?.interviewRecording?.filename ? (
                <Link
                  src={`https://cdn.hellojia.ai/${candidate?.interviewRecording.filename}`}
                  style={styles.linkText}
                >
                  {candidate?.interviewRecording?.filetype?.includes('audio')
                    ? 'View audio recording'
                    : 'View video recording'}
                </Link>
              ) : (
                <Text style={styles.noContent}>No recording available.</Text>
              )}
            </View>
          </View>

            {/* Transcripts */}
          <View style={styles.aiCardContainer}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <Text style={[styles.aiCardTitle, { marginBottom: 0 }]}>Interview Transcript</Text>
          {transcriptsProp.length > 0 && (
            <View style={{ backgroundColor: "#F8F9FC", border: "1px solid #D5D9EB", borderRadius: 8, padding: "2px 4px" }}>
              <Text style={{ fontSize: 12, color: "#363F72" }}>
              {(() => {
              const startTime = new Date(transcriptsProp[0].time);
              const endTime = new Date(
                transcriptsProp[transcriptsProp.length - 1].time
              );
              const durationMs =
                endTime.getTime() - startTime.getTime();
              const minutes = Math.floor(durationMs / 60000);
              const seconds = Math.floor(
                (durationMs % 60000) / 1000
              );
              return `${minutes}m ${seconds}s`;
            })()}
            </Text>
            </View>
          )}
          </View>
            <View style={styles.aiCard}>
              {(transcriptsProp?.length ?? 0) > 0 ? (
                <>
                  {(transcriptsProp ?? []).map((msg: any, idx: number) => {
                    const prevTime = (transcriptsProp ?? [])[idx - 1]?.time;
                    const durationSeconds = idx > 0 && prevTime
                      ? moment(msg.time).diff(moment(prevTime), 'seconds', true)
                      : 0;
                    const secs = durationSeconds ?? 0;
                    const durationStr = secs >= 60
                      ? `${Math.floor(secs / 60)}m ${(secs % 60).toFixed(1)}s`
                      : `${secs.toFixed(1)}s`;
                    const speaker = msg.type === 'user' ? (candidate?.name || 'Applicant') : 'Jia';
                    const bubbleStyle = msg.type === 'user' ? styles.transcriptBubbleUser : styles.transcriptBubbleJia;
                    return (
                      <View key={idx} wrap={false}>
                        <View style={styles.transcriptRow}>
                          <Text style={styles.transcriptSpeaker}>{speaker}</Text>
                          <Text style={styles.transcriptTime}>{moment(msg.time).format('hh:mm A')}</Text>
                          <View style={styles.transcriptDivider} />
                          <Text style={styles.transcriptDuration}>
                            {idx > 0 ? durationStr : '0.0s'}
                          </Text>
                        </View>
                        <View style={bubbleStyle}>
                          <Text style={styles.transcriptContent}>{msg.content || ''}</Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text style={styles.noContent}>No transcripts available.</Text>
              )}
            </View>
          </View>

          {/* Non-AI stages */}
          {evaluations.filter((evaluation: any) => evaluation.stageId && !['1', '2'].includes(evaluation.stageId)).map((evaluation: any) => (
            <View key={evaluation.stageId}>
            <StageSection stageName={evaluation.label} fit={evaluation.evaluation?.matchFit || ""} />
            
            {evaluation?.evaluation && 
            <View style={styles.recruiterEvaluationCard}>
              <View style={styles.recruiterEvaluationAvatarRow}>
                {evaluation?.evaluation.createdBy.image && <Image src={evaluation?.evaluation.createdBy.image} style={styles.recruiterAvatar} />}
                <Text style={styles.recruiterEvaluatorName}>Evaluation by {evaluation?.evaluation.createdBy.name}</Text>
                <CareerFitBadge fit={evaluation?.evaluation.matchFit || 'N/A'} size="small" />
              </View>
                <View style={styles.aiCard}>
                <Text style={styles.cvBodyText}>{evaluation?.evaluation.evaluationNotes}</Text>
              </View>
          </View>}
            </View>
          ))}

          {/* Comments */}
          {(commentsProp?.length ?? 0) > 0 && (
            <View style={styles.aiCardContainer}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <View style={styles.commentsSection}>
              {parents.map((parent: any, idx: number) => {
                const parentKey = String(parent._id ?? idx);
                const children = repliesByParent[String(parent._id)] || [];
                const isParentDeleted = parent.deleted === true || parent.deleted === 'true' || !!parent.deletedAt;
                return (
                  <View key={parentKey} wrap={false}>
                    {/* Top-level comment */}
                    <View style={styles.commentBlock}>
                      <View style={styles.commentHeaderRow}>
                        {parent.createdBy?.image ? (
                          <Image src={parent.createdBy.image} style={styles.commentAvatar} />
                        ) : (
                          <View style={styles.commentAvatar} />
                        )}
                        <Text style={styles.commentAuthor}>{isParentDeleted ? 'Deleted user' : (parent.createdBy?.name || 'Contributor')}</Text>
                        <Text style={styles.commentMeta}>
                          {commentRole(parent)} | {commentTime(parent.createdAt)}
                        </Text>
                      </View>
                      {!isParentDeleted && (
                        <View style={{ marginLeft: 42 }}>
                          {renderCommentBody(commentText(parent))}
                        </View>
                      )}
                      {isParentDeleted && (
                        <View style={{ marginLeft: 42 }}>
                          <Text style={styles.noContent}>Comment deleted by its author</Text>
                        </View>
                      )}
                    </View>
                    {/* Replies */}
                    {children.map((reply: any, childIdx: number) => {
                      const replyKey = String(reply._id ?? childIdx);
                      const isReplyDeleted = reply.deleted === true || reply.deleted === 'true' || !!reply.deletedAt;
                      return (
                        <View key={replyKey} style={styles.replyWrapper} wrap={false}>
                          <View style={styles.commentHeaderRow}>
                            <Text style={styles.replyArrow}>↩</Text>
                            {reply.createdBy?.image ? (
                              <Image src={reply.createdBy.image} style={[styles.commentAvatar, { width: 28, height: 28, borderRadius: 14 }]} />
                            ) : (
                              <View style={[styles.commentAvatar, { width: 28, height: 28, borderRadius: 14 }]} />
                            )}
                            <Text style={styles.commentAuthor}>{isReplyDeleted ? 'Deleted user' : (reply.createdBy?.name || 'Contributor')}</Text>
                            <Text style={styles.commentMeta}>
                              {commentRole(reply)} | {commentTime(reply.createdAt)}
                            </Text>
                          </View>
                          {!isReplyDeleted ? (
                            <View style={{ marginLeft: 38 }}>
                              {renderCommentBody(commentText(reply))}
                            </View>
                          ) : (
                            <View style={{ marginLeft: 38 }}>
                              <Text style={styles.noContent}>Comment deleted by its author</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {idx < parents.length - 1 && <View style={styles.commentDivider} />}
                  </View>
                );
              })}
            </View>
            </View>
          )}
        </Page>
    </Document>)
}

function CircularProgress({ percentage }: { percentage: number }) {
  const size = 160;
  const styles = StyleSheet.create({
    circularProgress: {
      width: size,
      height: size,
      position: 'relative',
    },
    circularProgressSvg: {
      transform: 'rotate(-90deg)',
    },
    circularProgressOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: size,
      height: size,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
    },
    aiScoreLabel: { fontSize: 12, color: '#535862', fontWeight: 500 },
    aiScoreValue: { fontSize: 24, color: '#181D27', fontWeight: 700 },
  });
  const strokeWidth = 10;
  const cx = size / 2;
  const cy = size / 2;
  // Circle stroke is centered on rOuter, so visible ring is [rOuter - strokeWidth/2, rOuter + strokeWidth/2]
  const rOuter = (size - strokeWidth) / 2;
  const rRingInner = rOuter - strokeWidth / 2;
  const rRingOuter = rOuter + strokeWidth / 2;
  const progress = Math.min(Math.max(percentage, 0), 100);

  // Build path for progress arc (same ring as background stroke so they overlap 100%)
  const getProgressPathD = () => {
    if (progress <= 0) return '';
    const angleRad = (progress / 100) * 2 * Math.PI;
    const largeArc = progress > 50 ? 1 : 0;
    const endOuterX = cx + rRingOuter * Math.cos(angleRad);
    const endOuterY = cy + rRingOuter * Math.sin(angleRad);
    const endInnerX = cx + rRingInner * Math.cos(angleRad);
    const endInnerY = cy + rRingInner * Math.sin(angleRad);
    const startInnerX = cx + rRingInner;
    const startOuterX = cx + rRingOuter;
    if (progress >= 99.99) {
      return `M ${startInnerX} ${cy} L ${startOuterX} ${cy} A ${rRingOuter} ${rRingOuter} 0 0 1 ${cx - rRingOuter} ${cy} A ${rRingOuter} ${rRingOuter} 0 0 1 ${startOuterX} ${cy} L ${startInnerX} ${cy} A ${rRingInner} ${rRingInner} 0 0 0 ${cx - rRingInner} ${cy} A ${rRingInner} ${rRingInner} 0 0 0 ${startInnerX} ${cy} Z`;
    }
    return `M ${startInnerX} ${cy} L ${startOuterX} ${cy} A ${rRingOuter} ${rRingOuter} 0 ${largeArc} 1 ${endOuterX} ${endOuterY} L ${endInnerX} ${endInnerY} A ${rRingInner} ${rRingInner} 0 ${largeArc} 0 ${startInnerX} ${cy} Z`;
  };

  const pathD = getProgressPathD();

  return (
    <View style={styles.circularProgress}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} style={styles.circularProgressSvg} preserveAspectRatio="xMidYMid meet">
        <Defs>
          <LinearGradient id="progressGradientCircle">
            <Stop offset="0%" stopColor="#9FCAED" />
            <Stop offset="33%" stopColor="#CEB6DA" />
            <Stop offset="66%" stopColor="#EBACC9" />
            <Stop offset="100%" stopColor="#FCCEC0" />
          </LinearGradient>
        </Defs>
        {/* Background circle (gray ring) */}
        <Circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="#F5F5F5" strokeWidth={strokeWidth} />
        {/* Progress arc as filled path so gradient works in react-pdf */}
        {pathD ? (
          <Path d={pathD} fill="url(#progressGradientCircle)" />
        ) : null}
      </Svg>
      <View style={styles.circularProgressOverlay}>
        <Text style={styles.aiScoreLabel}>Overall Score</Text>
        <Text style={styles.aiScoreValue}>{percentage}%</Text>
      </View>
    </View>
  );
}

function CareerFitBadge({ fit, size = "regular" }: { fit: string, size?: "small" | "regular" }) {

  const styles = StyleSheet.create({
    aiFitBadge: {
      alignSelf: "center",
      paddingHorizontal: size === "small" ? 6 : 10,
      paddingVertical: size === "small" ? 2 : 4,
      borderRadius: 6,
    },
    aiFitText: { fontSize: size === "small" ? 12 : 14, fontWeight: 500 },
  });

  const fitColor = {
    "Strong Fit": {
      backgroundColor: '#ECFDF3',
      color: '#067647',
      border: '1px solid #ABEFC6',
    },
    "Good Fit": {
      backgroundColor: '#EFF8FF',
      color: '#175CD3',
      border: '1px solid #B2DDFF',
    },
    "Maybe Fit": {
      backgroundColor: '#FFFAEB',
      color: '#B54708',
      border: '1px solid #FEDF89',
    },
    "Bad Fit": {
      backgroundColor: '#FEF3F2',
      color: '#B42318',
      border: '1px solid #FECDCA',
    },
    "N/A": {
      backgroundColor: '#FEF3F2',
      color: '#B42318',
      border: '1px solid #FECDCA',
    },
  }

  return (
    <View style={[styles.aiFitBadge, fitColor[fit || "N/A"]]}>
      <Text style={styles.aiFitText}>{fit}</Text>
    </View>
  )
}

function StageSection({ stageName, fit }: { stageName: string, fit: string }) {
  const styles = StyleSheet.create({
    stageSection: {
      position: 'relative',
      width: '100%',
      marginBottom: 24,
      minHeight: 56,
      borderRadius: 8,
    },
    stageSectionSvg: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    stageSectionContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      position: 'relative',
      backgroundColor: '#fff',
      borderRadius: 8,
      margin: 2,
    },
    stageName: { fontSize: 18, color: '#181D27', fontWeight: 700 },
    fit: { fontSize: 14, color: '#717680', fontWeight: 500 },
  });

  return (
    <View style={styles.stageSection}>
      <Svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        style={styles.stageSectionSvg}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="stageGradient">
            <Stop offset="0%" stopColor="#A5C0EE" />
            <Stop offset="100%" stopColor="#FBC5EC" />
          </LinearGradient>
        </Defs>
        {/* Outer rect: gradient fill (border) */}
        <Rect x="0" y="0" width="100" height="100" rx="0" ry="0" fill="url(#stageGradient)" />
        {/* Inner rect: white fill so gradient shows as border only */}
        {/* <Rect
          x={borderWidth * 0.05}
          y={borderWidth}
          width={100 - (borderWidth * 0.1)}
          height={100 - borderWidth * 2}
          rx="6"
          ry="6"
          fill="#fff"
        /> */}
      </Svg>
      <View style={styles.stageSectionContent}>
        <Text style={styles.stageName}>{stageName}</Text>
        {fit && <CareerFitBadge fit={fit} size="small" />}
      </View>
    </View>
  );
}
