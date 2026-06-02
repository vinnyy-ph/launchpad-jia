'use client';

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  TableBorders,
  BorderStyle,
  WidthType,
  ShadingType,
  AlignmentType,
  TableLayoutType,
  convertInchesToTwip,
  ExternalHyperlink,
} from 'docx';
import moment from 'moment';
import { api } from '@/lib/utils/apiClient';
import { getSkills } from '@/lib/utils/candidateHelpers';
import { getCVSection } from '@/lib/Utils';

// --- Parsing helpers (aligned with CandidateAnalysisDocument / CandidateAnalysisHtmlTemplate) ---
function parseSummarySections(summary: string | null | undefined) {
  if (!summary || typeof summary !== 'string') {
    return { main: '', assessment: '', strongPoints: [] as string[], weakPoints: [] as string[] };
  }
  const strongMatch = summary.match(/\n#+\s*Strong Points\s*\n/i);
  const weakMatch = summary.match(/\n#+\s*Weak Points\s*\n/i);
  const assessmentMatch = summary.match(/\n#+\s*Assessment of the applicant\s*\n/i);
  const mainEnd = assessmentMatch ? assessmentMatch.index! : (strongMatch ? strongMatch.index! : -1);
  const main =
    mainEnd >= 0
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
  const toBullets = (text: string) =>
    text
      .split(/\n/)
      .map((s) => s.replace(/^\s*[-*•]\s*/, '').trim())
      .filter(Boolean);
  return { main, assessment, strongPoints: toBullets(strongBlock), weakPoints: toBullets(weakBlock) };
}

function parseCvScreeningReason(html: string | null | undefined): {
  sections: { title: string; bullets: string[] }[];
  raw: string | null;
} {
  if (!html || typeof html !== 'string') return { sections: [], raw: null };
  const stripTags = (s: string) =>
    s
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/g, (c) =>
        ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' }[c] ?? c)
      )
      .trim();
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
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/g, (c) =>
      ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' }[c] ?? c)
    )
    .trim();
}

function formatPrescreeningAnswer(q: any): string {
  const answers = q?.selectedAnswers;
  if (!answers || !Array.isArray(answers) || answers.length === 0) return 'N/A';
  return answers
    .map((a: any) => (typeof a === 'object' && a?.value != null ? String(a.value) : String(a)))
    .join(', ');
}

// Table/cell widths: docx defaults columnWidths to 100 twips per column if omitted, causing a narrow strip.
// Use explicit width in DXA (twips) and columnWidths in twips so tables span full content width.
const CONTENT_WIDTH_TWIPS = convertInchesToTwip(6.5); // 6.5" between 1" margins

// Docx uses hex without # for colors (e.g. '181D27')
const FIT_STYLES: Record<string, { bg: string; color: string }> = {
  'Strong Fit': { bg: 'ECFDF3', color: '067647' },
  'Good Fit': { bg: 'EFF8FF', color: '175CD3' },
  'Maybe Fit': { bg: 'FFFAEB', color: 'B54708' },
  'Bad Fit': { bg: 'FEF3F2', color: 'B42318' },
  'N/A': { bg: 'FEF3F2', color: 'B42318' },
};

const BORDER_SINGLE = { style: BorderStyle.SINGLE, color: 'E9EAEB', size: 1 };
const BORDER_NONE = { style: BorderStyle.NONE };

function cellBorder() {
  return {
    top: BORDER_SINGLE,
    bottom: BORDER_SINGLE,
    left: BORDER_SINGLE,
    right: BORDER_SINGLE,
  };
}

function cardWrapper(children: Paragraph[], options?: { shadingFill?: string }) {
  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH_TWIPS],
    layout: TableLayoutType.FIXED,
    borders: { top: BORDER_SINGLE, bottom: BORDER_SINGLE, left: BORDER_SINGLE, right: BORDER_SINGLE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children,
            shading: options?.shadingFill
              ? { fill: options.shadingFill, type: ShadingType.CLEAR }
              : { fill: 'FFFFFF', type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            borders: cellBorder(),
          }),
        ],
      }),
    ],
  });
}

function sectionCard(title: string, body: Paragraph[], options?: { outerShading?: string, tableCellType?: "single" | "multi" }) {
  const { tableCellType = "single" } = options || {};
  const titleP = new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 28, color: '181D27' })],
    spacing: { after: 120 },
  });
  // Map two paragraphs at a time in one cell
  const multiBodyRows = [];
  for (let i = 0; i < body.length; i += 2) {
    multiBodyRows.push(new TableRow({
      cantSplit: false,
      children: [
        new TableCell({
          children: [body[i], body?.[i + 1] ? body?.[i + 1] : new Paragraph({ text: '' })],
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 240, bottom: 240, left: 240, right: 240 },
          borders: cellBorder(),
        }),
      ],
    }));
  }
  const inner = new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH_TWIPS],
    layout: TableLayoutType.FIXED,
    borders: { top: BORDER_SINGLE, bottom: BORDER_SINGLE, left: BORDER_SINGLE, right: BORDER_SINGLE },
    rows: 
      tableCellType === "single" ? [new TableRow({
        cantSplit: false,
        children: [
          new TableCell({
            children: [titleP, ...body],
            shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
            margins: { top: 240, bottom: 240, left: 240, right: 240 },
            borders: cellBorder(),
          })
        ]
      })] : [
        new TableRow({
          cantSplit: false,
          children: [
            new TableCell({
              children: [titleP],
              shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
              margins: { top: 240, bottom: 240, left: 240, right: 240 },
              borders: cellBorder(),
            }),
          ],
        }),
        ...multiBodyRows,
      ],
  });
  if (tableCellType === "multi") {
    return inner;
  }
  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH_TWIPS],
    layout: TableLayoutType.FIXED,
    borders: { top: BORDER_SINGLE, bottom: BORDER_SINGLE, left: BORDER_SINGLE, right: BORDER_SINGLE },
    rows: [
      new TableRow({
        cantSplit: false,
        children: [
          new TableCell({
            children: [inner],
            shading: options?.outerShading ? { fill: options.outerShading, type: ShadingType.CLEAR } : { fill: 'FAFAFA', type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 160, right: 160 },
            borders: cellBorder(),
          }),
        ],
      }),
    ],
  });
}

function stageSection(stageName: string, fit: string) {
  const fitStyle = FIT_STYLES[fit] || FIT_STYLES['N/A'];
  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH_TWIPS],
    layout: TableLayoutType.FIXED,
    borders: { top: { style: BorderStyle.SINGLE, color: 'A5C0EE', size: 2 }, bottom: { style: BorderStyle.SINGLE, color: 'FBC5EC', size: 2 }, left: BORDER_SINGLE, right: BORDER_SINGLE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: stageName, bold: true, size: 36, color: '181D27' }),
                  new TextRun({ text: '   ' }),
                  new TextRun({
                    text: fit,
                    bold: true,
                    size: 28,
                    color: fitStyle.color,
                    shading: { fill: fitStyle.bg, type: ShadingType.CLEAR },
                  }),
                ],
                alignment: AlignmentType.JUSTIFIED,
              }),
            ],
            shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
            margins: { top: 320, bottom: 320, left: 320, right: 320 },
            borders: { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE },
          }),
        ],
      }),
    ],
  });
}

function buildCandidateAnalysisDocx(props: {
  candidate: any;
  evaluations?: any[];
  analysis?: any;
  summary?: any;
  feedback?: any;
  transcripts?: any[];
  comments?: any[];
  cvData?: any[];
  skillsList?: string[];
  cvUploadedAt?: string | null;
}): Document {
  const {
    candidate,
    evaluations = [],
    analysis: analysisProp,
    summary: summaryProp,
    feedback: feedbackProp,
    transcripts: transcriptsProp = [],
    comments: commentsProp = [],
    cvData = [],
    skillsList = [],
    cvUploadedAt = null,
  } = props;

  const preScreeningQuestions = candidate?.preScreeningQuestions || [];
  const analysis = analysisProp ?? candidate?.analysis;
  const summary = summaryProp ?? candidate?.summary;
  const feedback = feedbackProp ?? candidate?.feedback;
  const summarySections = parseSummarySections(summary);
  const getSection = (name: string) => (cvData?.length ? getCVSection(cvData, name) : '') || '';

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
  const commentTime = (date: string | undefined) => (date ? moment(date).format('MMM D, h:mm A') : '');
  const commentRole = (c: any) =>
    (c.createdBy?.role || 'Contributor')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch: string) => ch.toUpperCase());
  const commentText = (c: any) => c.text || c.comment || c.feedback || '';

  const children: (Paragraph | Table)[] = [];

  // Header
  children.push(
    cardWrapper([
      new Paragraph({
        children: [
          new TextRun({ text: candidate?.name ?? '', bold: true, size: 48, color: '181D27' }),
          new TextRun({ text: '   ' }),
          new TextRun({ text: 'Application Details', size: 28, color: '181D27' }),
          new TextRun({ text: '   ' }),
          new TextRun({ text: candidate?.stage ?? '', size: 28, color: '181D27' }),
        ],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'For ', size: 26, color: '181D27' }),
          new TextRun({ text: candidate?.jobTitle ?? '', size: 26, color: '444CE7' }),
        ],
        spacing: { after: 0 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Last Updated: ${moment().format('h:mm A dddd, MMMM D YYYY')}`, size: 28, color: '717680' })],
        alignment: AlignmentType.END,
      }),
    ])
  );

  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // CV Screening stage
  children.push(stageSection('CV Screening', candidate?.cvStatus || 'N/A'));
  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // Recruiter Evaluation
  const recruiterEvaluation = evaluations?.find((evaluation: any) => evaluation.stageId === "1")?.evaluation;
  if (recruiterEvaluation) {
    const evParas: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({ text: `Evaluation by ${recruiterEvaluation.createdBy?.name ?? ''}`, size: 26, color: '181D27' }),
          new TextRun({ text: '  ' }),
          new TextRun({
            text: recruiterEvaluation.matchFit ?? 'N/A',
            bold: true,
            size: 28,
            color: (FIT_STYLES[recruiterEvaluation.matchFit || 'N/A'] || FIT_STYLES['N/A']).color,
          }),
        ],
        spacing: { after: 160 },
      }),
      new Paragraph({
        children: [new TextRun({ text: (recruiterEvaluation.evaluationNotes || '').replace(/\*\*/g, ''), size: 24, color: '181D27' })],
        spacing: { after: 0 },
      }),
    ];
    children.push(cardWrapper(evParas, { shadingFill: 'FFFCF5' }));
    children.push(new Paragraph({ text: '', spacing: { after: 240 } }));
  }

  // Evaluation by Jia (CV)
  const cvScreeningSections = parseCvScreeningReason(candidate?.cvScreeningReason);
  const cvScreeningParas: Paragraph[] = [];
  if (cvScreeningSections.sections.length > 0) {
    cvScreeningSections.sections.forEach((sec) => {
      cvScreeningParas.push(new Paragraph({ children: [new TextRun({ text: sec.title, bold: true, size: 22, color: '181D27' })], spacing: { after: 80 } }));
      sec.bullets.forEach((b) => {
        cvScreeningParas.push(new Paragraph({ children: [new TextRun({ text: `• ${b}`, size: 20, color: '414651' })], spacing: { after: 40 }, indent: { left: 400 } }));
      });
    });
  } else if (cvScreeningSections.raw) {
    cvScreeningParas.push(new Paragraph({ children: [new TextRun({ text: stripHtmlForPdf(cvScreeningSections.raw), size: 24, color: '181D27' })], spacing: { after: 120 } }));
  } else {
    cvScreeningParas.push(new Paragraph({ children: [new TextRun({ text: 'No evaluation available.', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 120 } }));
  }
  children.push(
    sectionCard('Evaluation by Jia', [
      new Paragraph({
        children: [new TextRun({ text: candidate?.cvStatus ?? 'N/A', bold: true, size: 28, color: (FIT_STYLES[candidate?.cvStatus || 'N/A'] || FIT_STYLES['N/A']).color })],
        spacing: { after: 160 },
      }),
      ...cvScreeningParas,
    ], { tableCellType: 'multi' })
  );
  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // Two columns: CV left, Contact/Pre-screening/Skills right
  const cvSections = ['Experience', 'Education', 'Certifications', 'Projects', 'Awards'] as const;
  const cvParagraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: `Candidate CV${cvUploadedAt ? ` (Uploaded: ${moment(cvUploadedAt).format('MMM D, YYYY')})` : ''}`, size: 24, color: '181D27' })],
      spacing: { after: 240 },
    }),
  ];
  cvSections.forEach((name) => {
    const content = getSection(name);
    cvParagraphs.push(
      new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 28, color: '181D27' })], spacing: { after: 120 } }),
      new Paragraph({
        children: [
          new TextRun({
            text: content || (name === 'Projects' ? 'No projects listed.' : `No ${name.toLowerCase()} provided in CV`),
            size: 24,
            color: content ? '181D27' : 'B0B0B0',
            italics: !content,
          }),
        ],
        spacing: { after: 320 },
      })
    );
  });

  const contactContent = getSection('Contact Info');
  const formattedContactContent = contactContent ? contactContent.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") : 'No contact information provided in CV';
  cvParagraphs.push(
    new Paragraph({ children: [new TextRun({ text: 'Contact Information', bold: true, size: 28, color: '181D27' })], spacing: { after: 120 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: formattedContactContent,
          size: 24,
          color: formattedContactContent ? '181D27' : 'B0B0B0',
          italics: !formattedContactContent,
        }),
      ],
      spacing: { after: 240 },
    }),
    new Paragraph({ children: [new TextRun({ text: 'Pre-screening Question Answers', bold: true, size: 28, color: '181D27' })], spacing: { after: 120 } }),
  );
  if (preScreeningQuestions.length > 0) {
    preScreeningQuestions.forEach((q: any, idx: number) => {
      if (q.questionType) cvParagraphs.push(new Paragraph({ children: [new TextRun({ text: q.questionType, bold: true, size: 22, color: '475467' })], spacing: { after: 40 } }));
      if (q.question) cvParagraphs.push(new Paragraph({ children: [new TextRun({ text: q.question, size: 22, color: '475467' })], spacing: { after: 80 } }));
      cvParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Answer: ', size: 22, color: '475467' }),
            new TextRun({ text: formatPrescreeningAnswer(q), bold: true, size: 22, color: '181D27' }),
          ],
          spacing: { after: idx < preScreeningQuestions.length - 1 ? 200 : 0 },
        })
      );
    });
  } else {
    cvParagraphs.push(new Paragraph({ children: [new TextRun({ text: 'No pre-screening answers.', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 240 } }));
  }
  cvParagraphs.push(new Paragraph({ children: [new TextRun({ text: 'Skills', bold: true, size: 28, color: '181D27' })], spacing: { after: 120 } }));
  if (skillsList.length > 0) {
    cvParagraphs.push(
      new Paragraph({
        children: skillsList.map((s) => new TextRun({ text: ` ${s} `, size: 20, color: '1E40AF' })),
        spacing: { after: 160 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Jia automatically extracts skill tags from uploaded CVs. You may add more skills to improve candidate search.',
            size: 20,
            color: '717680',
          }),
        ],
        spacing: { after: 0 },
      })
    );
  } else {
    cvParagraphs.push(new Paragraph({ children: [new TextRun({ text: 'No skills provided in CV', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 0 } }));
  }

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
      columnWidths: [CONTENT_WIDTH_TWIPS],
      layout: TableLayoutType.FIXED,
      borders: TableBorders.NONE,
      rows: 
        cvParagraphs.map((p) => new TableRow({
          cantSplit: false,
          children: [
            new TableCell({
              children: [p],
              margins: { top: 160, bottom: 160, left: 160, right: 160 },
              borders: cellBorder(),
            }),
          ]
        }))
    })
  );
  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // AI Interview stage
  children.push(stageSection('AI Interview', analysis?.final_assessment || candidate?.jobFit || 'N/A'));
  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // Recruiter Evaluation
  const aiInterviewEvaluation = evaluations?.find((evaluation: any) => evaluation.stageId === "2")?.evaluation;
  if (aiInterviewEvaluation) {
    const evParas: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({ text: `Evaluation by ${aiInterviewEvaluation.createdBy?.name ?? ''}`, size: 26, color: '181D27' }),
          new TextRun({ text: '  ' }),
          new TextRun({
            text: aiInterviewEvaluation.matchFit ?? 'N/A',
            bold: true,
            size: 28,
            color: (FIT_STYLES[aiInterviewEvaluation.matchFit || 'N/A'] || FIT_STYLES['N/A']).color,
          }),
        ],
        spacing: { after: 160 },
      }),
      new Paragraph({
        children: [new TextRun({ text: (aiInterviewEvaluation.evaluationNotes || '').replace(/\*\*/g, ''), size: 24, color: '181D27' })],
        spacing: { after: 0 },
      }),
    ];
    children.push(cardWrapper(evParas, { shadingFill: 'FFFCF5' }));
    children.push(new Paragraph({ text: '', spacing: { after: 240 } }));
  }

  // Interview Information + Feedback (two columns)
  const infoParas: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: candidate?.name ?? '', bold: true, size: 28, color: '181D27' }),
        new TextRun({ text: '\n' }),
        new TextRun({ text: candidate?.email ?? '', size: 22, color: '181D27' }),
      ],
      spacing: { after: 240 },
    }),
    new Paragraph({ children: [new TextRun({ text: 'Interview taken on', size: 20, color: '6B7280' })], spacing: { after: 40 } }),
    new Paragraph({
      children: [new TextRun({ text: candidate?.completedAt ? moment(candidate.completedAt).format('MMM D, YYYY') : 'N/A', size: 22, color: '181D27' })],
      spacing: { after: 240 },
    }),
    new Paragraph({ children: [new TextRun({ text: 'Joined on', size: 20, color: '6B7280' })], spacing: { after: 40 } }),
    new Paragraph({
      children: [new TextRun({ text: candidate?.createdAt ? moment(candidate.createdAt).format('MMM D, YYYY') : 'N/A', size: 22, color: '181D27' })],
      spacing: { after: 0 },
    }),
  ];
  const feedbackParas: Paragraph[] = [];
  if (feedback) {
    const stars = [1, 2, 3, 4, 5].map((i) => new TextRun({ text: i <= (feedback.rating || 0) ? '★' : '☆', size: 28, color: i <= (feedback.rating || 0) ? 'FFD600' : 'E5E7EB' }));
    feedbackParas.push(new Paragraph({ children: stars, spacing: { after: 160 } }));
    if (feedback.feedback) feedbackParas.push(new Paragraph({ children: [new TextRun({ text: `"${feedback.feedback}"`, italics: true, size: 22, color: '181D27' })], spacing: { after: 0 } }));
  } else {
    feedbackParas.push(new Paragraph({ children: [new TextRun({ text: 'No feedback provided.', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 0 } }));
  }

  const col50 = Math.floor(0.5 * CONTENT_WIDTH_TWIPS);
  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
      columnWidths: [col50, CONTENT_WIDTH_TWIPS - col50],
      layout: TableLayoutType.FIXED,
      borders: TableBorders.NONE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Interview Information', bold: true, size: 32, color: '181D27' })], spacing: { after: 240 } }), ...infoParas],
              shading: { fill: 'FAFAFA', type: ShadingType.CLEAR },
              margins: { top: 160, bottom: 160, left: 160, right: 160 },
              borders: cellBorder(),
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Feedback', bold: true, size: 32, color: '181D27' })], spacing: { after: 240 } }), ...feedbackParas],
              shading: { fill: 'FAFAFA', type: ShadingType.CLEAR },
              margins: { top: 160, bottom: 160, left: 160, right: 160 },
              borders: cellBorder(),
            }),
          ],
        }),
      ],
    })
  );
  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // Evaluation by Jia (Interview)
  const evalParas: Paragraph[] = [];
  if (analysis) {
    evalParas.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Overall Score ', size: 24, color: '535862' }),
          new TextRun({ text: `${analysis.overall_score ?? 0}%`, bold: true, size: 28, color: '181D27' }),
        ],
        spacing: { after: 160 },
      }),
      new Paragraph({
        children: [new TextRun({ text: analysis.final_assessment || candidate?.jobFit || 'N/A', bold: true, size: 28, color: (FIT_STYLES[analysis.final_assessment || candidate?.jobFit || 'N/A'] || FIT_STYLES['N/A']).color })],
        spacing: { after: 80 },
      })
    );
    if (analysis.assessment_reason) {
      evalParas.push(new Paragraph({ children: [new TextRun({ text: String(analysis.assessment_reason).replace(/\*\*/g, ''), size: 24, color: '181D27' })], spacing: { after: 240 } }));
    }
    if (analysis.breakdown?.length) {
      evalParas.push(new Paragraph({ children: [new TextRun({ text: 'Applicant Qualities Breakdown', bold: true, size: 28, color: '181D27' })], spacing: { after: 160 } }));
      const colors = ['9FCAED', 'CEB6DA', 'EBACC9', 'FCCEC0'];
      analysis.breakdown.forEach((item: any, idx: number) => {
        const fillColor = colors[idx % colors.length];
        evalParas.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${item?.key ?? '—'}  `, bold: true, size: 22, color: '414651' }),
              new TextRun({ text: `${item?.data != null ? `${Math.round(item.data)}%` : '—'}`, size: 22, color: '181D27' }),
            ],
            spacing: { after: 80 },
          })
        );
        if (item?.rationale) {
          evalParas.push(new Paragraph({ children: [new TextRun({ text: String(item.rationale).replace(/\*\*/g, ''), size: 20, color: '414651' })], spacing: { after: 240 } }));
        }
      });
    }
  } else {
    evalParas.push(new Paragraph({ children: [new TextRun({ text: 'No analysis available.', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 0 } }));
  }
  children.push(sectionCard('Evaluation by Jia', evalParas, { tableCellType: 'multi' }));
  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // Interview Summary
  const summaryParas: Paragraph[] = [];
  if (summary) {
    if (summarySections.main) {
      summaryParas.push(new Paragraph({ children: [new TextRun({ text: 'Summary of the interview', bold: true, size: 22, color: '181D27' })], spacing: { after: 80 } }));
      summaryParas.push(new Paragraph({ children: [new TextRun({ text: summarySections.main, size: 24, color: '181D27' })], spacing: { after: 160 } }));
    }
    if (summarySections.assessment) {
      summaryParas.push(new Paragraph({ children: [new TextRun({ text: 'Assessment of the applicant', bold: true, size: 22, color: '181D27' })], spacing: { after: 80 } }));
      summaryParas.push(new Paragraph({ children: [new TextRun({ text: summarySections.assessment, size: 24, color: '181D27' })], spacing: { after: 160 } }));
    }
    summarySections.strongPoints.forEach((line) => {
      summaryParas.push(new Paragraph({ children: [new TextRun({ text: `• ${line}`, size: 20, color: '414651' })], spacing: { after: 40 }, indent: { left: 400 } }));
    });
    summarySections.weakPoints.forEach((line) => {
      summaryParas.push(new Paragraph({ children: [new TextRun({ text: `• ${line}`, size: 20, color: '414651' })], spacing: { after: 40 }, indent: { left: 400 } }));
    });
    if (!summarySections.main && !summarySections.assessment && summarySections.strongPoints.length === 0 && summarySections.weakPoints.length === 0) {
      summaryParas.push(new Paragraph({ children: [new TextRun({ text: String(summary).replace(/#+\s*/g, '').replace(/\*\*/g, ''), size: 24, color: '181D27' })], spacing: { after: 0 } }));
    }
  } else {
    summaryParas.push(new Paragraph({ children: [new TextRun({ text: 'No summary available.', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 0 } }));
  }
  children.push(sectionCard('Interview Summary', summaryParas, { tableCellType: 'multi' }));
  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // Interview Recording
  const recordingParas: Paragraph[] = [];
  if (candidate?.interviewRecording?.filename) {
    recordingParas.push(
      new Paragraph({
        children: [
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: candidate?.interviewRecording?.filetype?.includes('audio') ? 'View audio recording' : 'View video recording',
                size: 22,
                color: '2563EB',
                underline: {},
                style: "Hyperlink"
              }),
            ],
            link: "https://cdn.hellojia.ai/" + candidate?.interviewRecording?.filename,
          })
        ],
        spacing: { after: 0 },
      })
    );
  } else {
    recordingParas.push(new Paragraph({ children: [new TextRun({ text: 'No recording available.', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 0 } }));
  }
  children.push(sectionCard('Interview Recording', recordingParas));
  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // Transcript
  const transcriptParas: Paragraph[] = [];
  if ((transcriptsProp?.length ?? 0) > 0) {
    const duration =
      transcriptsProp.length > 0
        ? (() => {
            const start = new Date(transcriptsProp[0].time);
            const end = new Date(transcriptsProp[transcriptsProp.length - 1].time);
            const ms = end.getTime() - start.getTime();
            return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
          })()
        : '';
    transcriptParas.push(
      new Paragraph({
        children: [new TextRun({ text: `Interview Transcript${duration ? `  Duration: ${duration}` : ''}`, bold: true, size: 32, color: '181D27' })],
        spacing: { after: 240 },
      })
    );
    (transcriptsProp ?? []).forEach((msg: any, idx: number) => {
      const speaker = msg.type === 'user' ? (candidate?.name || 'Applicant') : 'Jia';
      const prevTime = (transcriptsProp ?? [])[idx - 1]?.time;
      const durationStr =
        idx > 0 && prevTime
          ? (() => {
              const secs = moment(msg.time).diff(moment(prevTime), 'seconds', true);
              return secs >= 60 ? `${Math.floor(secs / 60)}m ${(secs % 60).toFixed(1)}s` : `${secs.toFixed(1)}s`;
            })()
          : '0.0s';
      transcriptParas.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${speaker}  `, bold: true, size: 22, color: '181D27' }),
            new TextRun({ text: moment(msg.time).format('hh:mm A'), size: 18, color: '717680' }),
            new TextRun({ text: `  ${durationStr}`, size: 18, color: '717680' }),
          ],
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: msg.content || '', size: 22, color: '181D27' })],
          spacing: { after: 240 },
          indent: { left: 400 },
        })
      );
    });
  } else {
    transcriptParas.push(new Paragraph({ children: [new TextRun({ text: 'No transcripts available.', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 0 } }));
  }
  children.push(sectionCard('Interview Transcript', transcriptParas, { tableCellType: 'multi' }));
  children.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  // Non-AI stages
  evaluations
    .filter((e: any) => e.stageId && !['1', '2'].includes(e.stageId))
    .forEach((evaluation: any) => {
      children.push(stageSection(evaluation.label, evaluation.evaluation?.matchFit || ''));
      if (evaluation?.evaluation) {
        const evParas: Paragraph[] = [
          new Paragraph({
            children: [
              new TextRun({ text: `Evaluation by ${evaluation.evaluation.createdBy?.name ?? ''}`, size: 26, color: '181D27' }),
              new TextRun({ text: '  ' }),
              new TextRun({
                text: evaluation.evaluation?.matchFit ?? 'N/A',
                bold: true,
                size: 28,
                color: (FIT_STYLES[evaluation.evaluation?.matchFit || 'N/A'] || FIT_STYLES['N/A']).color,
              }),
            ],
            spacing: { after: 160 },
          }),
          new Paragraph({
            children: [new TextRun({ text: (evaluation.evaluation.evaluationNotes || '').replace(/\*\*/g, ''), size: 24, color: '181D27' })],
            spacing: { after: 0 },
          }),
        ];
        children.push(cardWrapper(evParas, { shadingFill: 'FFFCF5' }));
      }
      children.push(new Paragraph({ text: '', spacing: { after: 240 } }));
    });

  // Comments
  if (parents.length > 0) {
    const commentParas: Paragraph[] = [];
    parents.forEach((parent: any, idx: number) => {
      const childrenReplies = repliesByParent[String(parent._id)] || [];
      const isParentDeleted = parent.deleted === true || parent.deleted === 'true' || !!parent.deletedAt;
      commentParas.push(
        new Paragraph({
          children: [
            new TextRun({ text: isParentDeleted ? 'Deleted user' : (parent.createdBy?.name || 'Contributor'), bold: true, size: 22, color: '181D27' }),
            new TextRun({ text: `  ${commentRole(parent)} | ${commentTime(parent.createdAt)}`, size: 20, color: '717680' }),
          ],
          spacing: { after: 120 },
        })
      );
      if (!isParentDeleted) {
        commentParas.push(new Paragraph({ children: [new TextRun({ text: commentText(parent), size: 22, color: '181D27' })], spacing: { after: 240 } }));
      } else {
        commentParas.push(new Paragraph({ children: [new TextRun({ text: 'Comment deleted by its author', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 240 } }));
      }
      childrenReplies.forEach((reply: any) => {
        const isReplyDeleted = reply.deleted === true || reply.deleted === 'true' || !!reply.deletedAt;
        commentParas.push(
          new Paragraph({
            children: [
              new TextRun({ text: '↩ ', size: 24, color: '9CA3AF' }),
              new TextRun({ text: isReplyDeleted ? 'Deleted user' : (reply.createdBy?.name || 'Contributor'), bold: true, size: 22, color: '181D27' }),
              new TextRun({ text: `  ${commentRole(reply)} | ${commentTime(reply.createdAt)}`, size: 20, color: '717680' }),
            ],
            spacing: { after: 120 },
            indent: { left: 480 },
          })
        );
        if (!isReplyDeleted) {
          commentParas.push(new Paragraph({ children: [new TextRun({ text: commentText(reply), size: 22, color: '181D27' })], spacing: { after: 240 }, indent: { left: 480 } }));
        } else {
          commentParas.push(new Paragraph({ children: [new TextRun({ text: 'Comment deleted by its author', italics: true, size: 24, color: 'B0B0B0' })], spacing: { after: 240 }, indent: { left: 480 } }));
        }
      });
      if (idx < parents.length - 1) commentParas.push(new Paragraph({ text: '—', spacing: { after: 240 } }));
    });
    children.push(sectionCard('Comments', commentParas, { tableCellType: 'multi' }));
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.5),
              height: convertInchesToTwip(11),
            },
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });
}

/**
 * Fetches CV data for the candidate, builds the analysis DOCX using the same
 * format as CandidateAnalysisDocument / CandidateAnalysisHtmlTemplate (positioning,
 * colors, borders, sections), and triggers a file download.
 */
export async function downloadCandidateAnalysisDocx(props: any, fileName?: string): Promise<void> {
  const { candidate, evaluations = [], analysis, summary, feedback, transcripts = [], comments = [] } = props;
  let cvData: any[] = [];
  let skillsList: string[] = [];
  let cvUploadedAt: string | null = null;

  if (candidate?.email) {
    try {
      const response = await api.post('/api/load-user-cv', { email: candidate.email });
      if (response?.data?.digitalCV) {
        cvData = response.data.digitalCV;
        cvUploadedAt = response.data.updatedAt ?? null;
        const candidateWithCv = { ...candidate, cvData };
        skillsList = getSkills(candidateWithCv);
      }
    } catch {
      // Proceed with empty CV data
    }
  }

  const doc = buildCandidateAnalysisDocx({
    candidate,
    evaluations,
    analysis,
    summary,
    feedback,
    transcripts,
    comments,
    cvData,
    skillsList,
    cvUploadedAt,
  });

  const blob = await Packer.toBlob(doc);
  const name = fileName ?? `${candidate?.name ?? 'Candidate'}-analysis.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
