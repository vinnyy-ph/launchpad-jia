"use client"
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { buildLegacyDigitalCVFromStructuredCV } from "@/lib/utils/digitalCVLegacy";

type CvSection = {
  name?: string;
  content?: string;
};

type InlineToken = {
  type: 'text' | 'bold';
  value: string;
};

type ListItem = {
  text: string;
  level: number;
  ordered: boolean;
};

type MarkdownBlock =
  | { type: 'heading'; text: string; level: number }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: ListItem[] };

const DEFAULT_AVATAR_SRC = "/user-profile.png";

const LEFT_COLUMN_SECTIONS = [
  { name: "Current Position", fallback: "No current position provided in CV" },
  { name: "Experience", fallback: "No experience provided in CV" },
  { name: "Education", fallback: "No education provided in CV" },
  { name: "Skills", fallback: "No skills added for this candidate" },
];

const RIGHT_COLUMN_SECTIONS = [
  { name: "Contact Info", label: "Contact Information", fallback: "No contact information provided in CV" },
  { name: "Certifications", fallback: "No certifications provided in CV" },
  { name: "Projects", fallback: "No projects provided in CV" },
  { name: "Awards", fallback: "No awards provided in CV" },
];

const PREFER_KEEP_TOGETHER = new Set([
  "Current Position",
  "Education",
  "Skills",
  "Contact Info",
  "Certifications",
  "Awards",
]);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripLinksToLabel = (value: string) =>
  value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, url: string) => {
    if (url.startsWith("mailto:")) return label;
    return label;
  });

const PLACEHOLDER_VALUE_PATTERNS = [
  /^none listed\.?$/i,
  /^not listed\.?$/i,
  /^none available\.?$/i,
  /^not available\.?$/i,
  /^not provided\.?$/i,
  /^no .+ provided in cv\.?$/i,
  /^no .+ added for this candidate\.?$/i,
];

const normalizePlaceholderCandidate = (value: string) =>
  stripLinksToLabel(value)
    .replace(/\*\*/g, "")
    .replace(/^[-*+\d.)\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const isPlaceholderValue = (value: string) => {
  const normalized = normalizePlaceholderCandidate(value);
  if (!normalized) return true;
  return PLACEHOLDER_VALUE_PATTERNS.some((pattern) => pattern.test(normalized));
};

const removePlaceholderLines = (value: string) => {
  const lines = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;

      const withoutMarker = trimmed.replace(/^[-*+\d.)\s]+/, "").trim();
      const labelMatch =
        withoutMarker.match(/^\*\*([^*]+):\*\*\s*(.+)$/) ||
        withoutMarker.match(/^([^:]{1,32}):\s*(.+)$/);

      if (labelMatch) {
        return !isPlaceholderValue(labelMatch[2]);
      }

      return !isPlaceholderValue(withoutMarker);
    });

  return lines.join("\n").trim();
};

const cleanSectionMarkdown = (value: unknown, sectionName: string) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter((item) => item && !isPlaceholderValue(item))
      .map((item) => `- ${item}`)
      .join("\n");
  }
  if (typeof value !== "string") return "";

  const escapedName = escapeRegExp(sectionName);
  let cleaned = value.replace(/\r\n/g, "\n").replace(/<br\s*\/?>/gi, "\n").trim();

  cleaned = cleaned
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  cleaned = cleaned
    .replace(new RegExp(`^\\s*#{1,6}\\s*${escapedName}\\s*$\\n?`, "i"), "")
    .replace(new RegExp(`^\\s*\\*\\*\\s*${escapedName}\\s*\\*\\*\\s*:?\\s*\\n?`, "i"), "")
    .trim();

  if (isPlaceholderValue(cleaned)) return "";

  return removePlaceholderLines(cleaned);
};

const parseInlineTokens = (line: string): InlineToken[] => {
  const withoutLinks = stripLinksToLabel(line);
  const tokens: InlineToken[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null = pattern.exec(withoutLinks);

  while (match) {
    if (match.index > cursor) {
      tokens.push({ type: "text", value: withoutLinks.slice(cursor, match.index) });
    }
    tokens.push({ type: "bold", value: match[1] });
    cursor = match.index + match[0].length;
    match = pattern.exec(withoutLinks);
  }

  if (cursor < withoutLinks.length) {
    tokens.push({ type: "text", value: withoutLinks.slice(cursor) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value: withoutLinks }];
};

const parseMarkdownBlocks = (markdown: string): MarkdownBlock[] => {
  if (!markdown.trim()) return [];

  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split("\n");
  let paragraphLines: string[] = [];
  let listItems: ListItem[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  lines.forEach((rawLine) => {
    const normalizedRawLine = rawLine.replace(/\t/g, "  ");
    const trimmedLine = normalizedRawLine.trim();
    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      return;
    }

    const boldHeadingMatch = trimmedLine.match(/^\*\*([^*]+)\*\*\s*:?$/);
    if (boldHeadingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: 3,
        text: boldHeadingMatch[1].trim(),
      });
      return;
    }

    const listMatch = normalizedRawLine.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const indentation = listMatch[1].length;
      const level = Math.min(4, Math.floor(indentation / 2));
      const marker = listMatch[2];
      const text = listMatch[3].trim();
      listItems.push({
        text,
        level,
        ordered: /^\d+\.$/.test(marker),
      });
      return;
    }

    if (listItems.length > 0) {
      const lastListItem = listItems[listItems.length - 1];
      const leadingWhitespace = (normalizedRawLine.match(/^\s*/) || [""])[0].length;
      const continuationText = trimmedLine.replace(/^>\s?/, "");
      if (continuationText && leadingWhitespace > 0) {
        lastListItem.text = `${lastListItem.text} ${continuationText}`.replace(/\s+/g, " ").trim();
        return;
      }
    }

    const labeledLine = /^\*\*[^*]+:\*\*\s+/.test(trimmedLine) || /^[A-Za-z][^:]{0,32}:\s+/.test(trimmedLine);
    if (labeledLine) {
      flushParagraph();
      flushList();
      blocks.push({ type: "paragraph", text: trimmedLine });
      return;
    }

    flushList();
    paragraphLines.push(trimmedLine.replace(/^>\s?/, ""));
  });

  flushParagraph();
  flushList();
  return blocks;
};

const shouldKeepSectionTogether = (sectionName: string, content: string) => {
  if (!content.trim()) return true;
  if (PREFER_KEEP_TOGETHER.has(sectionName)) return true;

  // Keep concise sections together; let long sections flow naturally across pages.
  const normalized = content.replace(/\s+/g, " ").trim();
  const lineCount = content.split("\n").filter((line) => line.trim().length > 0).length;
  return normalized.length <= 520 && lineCount <= 14;
};

const resolvePdfImageSrc = (value?: string): string | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();

  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  if (typeof window !== "undefined") {
    try {
      return new URL(trimmed, window.location.origin).toString();
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

const normalizeSkillToken = (token: string) => {
  const normalized = stripLinksToLabel(token)
    .replace(/\*\*/g, "")
    .replace(/^[-*+\d.)\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized;
};

const normalizeSkillsList = (rawSkills: string[]): string[] => {
  const seen = new Set<string>();
  const uniqueSkills: string[] = [];
  rawSkills.forEach((rawSkill) => {
    const clean = normalizeSkillToken(rawSkill);
    const key = clean.toLowerCase();
    if (!clean || clean.length > 60 || seen.has(key)) return;
    seen.add(key);
    uniqueSkills.push(clean);
  });

  return uniqueSkills;
};

const extractSkillsFromSectionMarkdown = (markdown: string): string[] => {
  if (!markdown || !markdown.trim()) return [];

  const parsed: string[] = [];
  const normalized = markdown
    .replace(/\r/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_~`]/g, "");

  normalized.split("\n").forEach((line) => {
    const cleaned = line
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/^\s*\d+\.\s+/, "")
      .trim();
    if (!cleaned) return;

    cleaned.split(/[,;|]/).forEach((token) => {
      const value = normalizeSkillToken(token);
      if (value) parsed.push(value);
    });
  });

  return normalizeSkillsList(parsed);
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingRight: 28,
    paddingBottom: 30,
    paddingLeft: 28,
    fontSize: 10.5,
    lineHeight: 1.4,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    color: "#181D27",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E9EAEB",
    padding: 14,
    backgroundColor: "#FFFFFF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarStack: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#E4E7EC",
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    position: "absolute",
    top: 5,
    left: 5,
    objectFit: "contain",
  },
  avatarOverlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: "absolute",
    top: 0,
    left: 0,
    objectFit: "cover",
  },
  name: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 2,
    lineHeight: 1.15,
  },
  email: {
    fontSize: 10,
    color: "#535862",
    lineHeight: 1.25,
  },
  jobFitCol: {
    flexDirection: "column",
    alignItems: "flex-end",
    maxWidth: "38%",
  },
  jobFitText: {
    fontSize: 9.5,
    color: "#414651",
    marginBottom: 3,
    textAlign: "right",
  },
  jobTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    textAlign: "right",
  },
  introSection: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F2F4F7",
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    padding: 11,
  },
  sectionRow: {
    flexDirection: "row",
  },
  leftCol: {
    width: "60%",
    borderRightWidth: 1,
    borderRightColor: "#E9EAEB",
    paddingRight: 14,
    marginRight: 14,
  },
  rightCol: {
    width: "40%",
    paddingLeft: 0,
  },
  section: {
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 10.2,
    fontWeight: 700,
    letterSpacing: 0.7,
    color: "#344054",
    marginBottom: 5,
  },
  paragraph: {
    fontSize: 10.2,
    color: "#101828",
    lineHeight: 1.45,
    marginBottom: 4,
  },
  paragraphCompact: {
    marginBottom: 2,
  },
  listItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  nestedListItemRow: {
    marginTop: 1,
  },
  listBullet: {
    width: 12,
    fontSize: 10,
    color: "#344054",
    lineHeight: 1.45,
  },
  listText: {
    flex: 1,
    fontSize: 10.1,
    color: "#101828",
    lineHeight: 1.45,
  },
  skillsBadgeCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 1,
  },
  skillsBadge: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  skillsBadgeText: {
    fontSize: 9.3,
    lineHeight: 1.2,
    color: "#344054",
    fontWeight: 500,
  },
  markdownH1: {
    fontSize: 12.8,
    fontWeight: 700,
    marginBottom: 4,
    marginTop: 2,
  },
  markdownH2: {
    fontSize: 11.8,
    fontWeight: 700,
    marginBottom: 4,
    marginTop: 2,
  },
  markdownH3: {
    fontSize: 10.8,
    fontWeight: 700,
    marginBottom: 3,
    marginTop: 1,
  },
  boldText: {
    fontWeight: 700,
  },
  noContent: {
    color: "#98A2B3",
    fontSize: 9.8,
    fontStyle: "italic",
  },
});

const MarkdownText = ({ text, style, compact }: { text: string; style?: any; compact?: boolean }) => {
  const tokens = parseInlineTokens(text);
  return (
    <Text style={[styles.paragraph, compact ? styles.paragraphCompact : {}, style || {}]}>
      {tokens.map((token, index) => (
        <Text key={`${token.type}-${index}`} style={token.type === "bold" ? styles.boldText : {}}>
          {token.value}
        </Text>
      ))}
    </Text>
  );
};

const SectionContent = ({ content, fallback }: { content: string; fallback: string }) => {
  const blocks = parseMarkdownBlocks(content);

  if (!blocks.length) return <Text style={styles.noContent}>{fallback}</Text>;

  return (
    <View>
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          const headingStyle =
            block.level <= 1 ? styles.markdownH1 : block.level === 2 ? styles.markdownH2 : styles.markdownH3;
          return <MarkdownText key={`heading-${blockIndex}`} text={block.text} style={headingStyle} />;
        }

        if (block.type === "paragraph") {
          return <MarkdownText key={`paragraph-${blockIndex}`} text={block.text} compact />;
        }

        const orderedCounters: Record<number, number> = {};
        return (
          <View key={`list-${blockIndex}`} style={{ marginBottom: 2 }}>
            {block.items.map((item, index) => {
              if (item.ordered) {
                orderedCounters[item.level] = (orderedCounters[item.level] || 0) + 1;
              } else {
                orderedCounters[item.level] = 0;
              }
              Object.keys(orderedCounters).forEach((counterLevel) => {
                if (Number(counterLevel) > item.level) {
                  delete orderedCounters[Number(counterLevel)];
                }
              });

              const marker = item.ordered
                ? `${orderedCounters[item.level]}.`
                : item.level === 0
                  ? "•"
                  : "-";

              return (
              <View
                key={`item-${index}`}
                style={[
                  styles.listItemRow,
                  styles.nestedListItemRow,
                  { marginLeft: item.level * 11 },
                ]}
              >
                <Text style={styles.listBullet}>{marker}</Text>
                <MarkdownText text={item.text} style={styles.listText} compact />
              </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

const SkillsBadgeCloud = ({ skills, fallback }: { skills: string[]; fallback: string }) => {
  if (!skills.length) return <Text style={styles.noContent}>{fallback}</Text>;

  return (
    <View style={styles.skillsBadgeCloud}>
      {skills.map((skill, index) => (
        <View key={`${skill}-${index}`} style={styles.skillsBadge}>
          <Text style={styles.skillsBadgeText}>{skill}</Text>
        </View>
      ))}
    </View>
  );
};

const CVSection = ({ title, content, fallback, useSkillsBadge = false, skills = [] }: { title: string; content: string; fallback: string; useSkillsBadge?: boolean; skills?: string[] }) => (
  <View style={styles.section}>
    <Text style={styles.sectionHeader}>{title}</Text>
    {useSkillsBadge ? <SkillsBadgeCloud skills={skills} fallback={fallback} /> : <SectionContent content={content} fallback={fallback} />}
  </View>
);

export const CandidateCVDocument = ({ candidate, cvData, includeCVAnalysis = true, candidateSkills = [] }: any) => {
  const sections: CvSection[] = (() => {
    if (cvData?.structuredCV && typeof cvData.structuredCV === "object") {
      return buildLegacyDigitalCVFromStructuredCV(cvData.structuredCV);
    }

    if (Array.isArray(cvData)) return cvData;
    if (Array.isArray(cvData?.digitalCV)) return cvData.digitalCV;
    return [];
  })();
  const directCandidateSkills = normalizeSkillsList(
    Array.isArray(candidateSkills)
      ? candidateSkills
      : Array.isArray(candidate?.skills)
        ? candidate.skills
        : [],
  );
  const skillsSectionContent = (() => {
    const section = sections.find((item) => String(item?.name || "").trim().toLowerCase() === "skills");
    return cleanSectionMarkdown(section?.content, "Skills");
  })();
  const normalizedCandidateSkills =
    directCandidateSkills.length > 0
      ? directCandidateSkills
      : extractSkillsFromSectionMarkdown(skillsSectionContent);

  const getSectionMarkdown = (name: string) => {
    const section = sections.find((item) => String(item?.name || "").trim().toLowerCase() === name.toLowerCase());
    return cleanSectionMarkdown(section?.content, name);
  };

  const introContent = getSectionMarkdown("Introduction");
  const candidateName = candidate?.name || "Unknown Candidate";
  const candidateEmail = candidate?.email || "No email provided";
  const candidateProfileImage = resolvePdfImageSrc(candidate?.image);
  const defaultAvatarSrc = resolvePdfImageSrc(DEFAULT_AVATAR_SRC);
  const leftColumnSections = LEFT_COLUMN_SECTIONS
    .map((section) => {
      const content = getSectionMarkdown(section.name);
      const skills = section.name === "Skills" ? normalizedCandidateSkills : [];
      const hasVisibleContent = section.name === "Skills" ? skills.length > 0 : Boolean(content.trim());
      return { ...section, content, skills, hasVisibleContent };
    })
    .filter((section) => section.hasVisibleContent);
  const rightColumnSections = RIGHT_COLUMN_SECTIONS
    .map((section) => {
      const content = getSectionMarkdown(section.name);
      return { ...section, content, hasVisibleContent: Boolean(content.trim()) };
    })
    .filter((section) => section.hasVisibleContent);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarStack}>
              {defaultAvatarSrc ? (
                <Image src={defaultAvatarSrc} style={styles.avatarFallback} />
              ) : null}
              {candidateProfileImage ? (
                <Image src={candidateProfileImage} style={styles.avatarOverlay} />
              ) : null}
            </View>
            <View>
              <Text style={styles.name}>{candidateName}</Text>
              <Text style={styles.email}>{candidateEmail}</Text>
            </View>
          </View>
          {includeCVAnalysis && (
            <View style={styles.jobFitCol}>
              <Text style={styles.jobFitText}>
                JIA assessment:{" "}
                {candidate?.currentStep === "CV Screening"
                  ? `CV ${candidate?.cvStatus || "N/A"}`
                  : `AI Interview ${candidate?.jobFit || "N/A"}`}
              </Text>
              <Text style={styles.jobTitle}>{candidate?.jobTitle || "No job title provided"}</Text>
            </View>
          )}
        </View>

        {introContent ? (
          <View style={styles.introSection}>
            <Text style={styles.sectionHeader}>Introduction</Text>
            <SectionContent content={introContent} fallback="No introduction provided in CV" />
          </View>
        ) : null}

        <View style={styles.sectionRow}>
          <View style={styles.leftCol}>
            {leftColumnSections.map((section) => {
              const keepTogether = shouldKeepSectionTogether(section.name, section.content);
              return (
              <View key={section.name} wrap={!keepTogether}>
                <CVSection
                  title={section.name.toUpperCase()}
                  content={section.content}
                  fallback={section.fallback}
                  useSkillsBadge={section.name === "Skills"}
                  skills={section.skills}
                />
              </View>
              );
            })}
          </View>

          <View style={styles.rightCol}>
            {rightColumnSections.map((section) => {
              const keepTogether = shouldKeepSectionTogether(section.name, section.content);
              return (
              <View key={section.name} wrap={!keepTogether}>
                <CVSection
                  title={(section.label || section.name).toUpperCase()}
                  content={section.content}
                  fallback={section.fallback}
                />
              </View>
              );
            })}
          </View>
        </View>
      </Page>
    </Document>
  );
};
