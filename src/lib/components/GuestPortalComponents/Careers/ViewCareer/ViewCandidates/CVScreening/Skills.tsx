import Container from "../../../../Container";
import Label from "@/lib/components/GuestPortalComponents/label";
import type { CVSection } from "./useCVScreeningData";

type Props = {
  digitalCV: CVSection[] | null;
};

const parseSkillsFromMarkdown = (markdownContent: string): string[] => {
  if (!markdownContent) return [];

  const cleaned = markdownContent
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[#*_~`]/g, "")
    .replace(/^>\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const skills = cleaned
    .split(/[\n,]/)
    .map((skill) => skill.trim())
    .filter((skill) => {
      if (skill.length < 2) return false;
      if (/^[^a-zA-Z0-9]+$/.test(skill)) return false;
      return true;
    });

  return [...new Set(skills)];
};

const getSkillsContent = (cvData: CVSection[] | null): string => {
  if (!cvData || !Array.isArray(cvData)) return "";
  const section = cvData.find((s) => s.name === "Skills");
  return section?.content || "";
};

export default function Skills({ digitalCV, fillHeight = false }: Props & { fillHeight?: boolean }) {
  const skillsContent = getSkillsContent(digitalCV);
  const skills = parseSkillsFromMarkdown(skillsContent);

  const hasSkills = skills.length > 0;

  return (
    <Container
      title={
        <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
          Skills
        </span>
      }
      fillHeight={fillHeight}
    >
      {hasSkills ? (
        <div style={{ display: "flex", flexDirection: "column", ...(fillHeight && { flex: 1, minHeight: 0 }) }}>
          <div 
            style={{ 
              display: "flex", 
              flexWrap: "wrap", 
              gap: 8, 
              marginBottom: 16,
              ...(fillHeight && { flex: 1, overflowY: "auto" }),
            }}
          >
            {skills.map((skill, index) => (
              <Label
                key={index}
                textColor="#344054"
                bgColor="#F9FAFB"
                strokeColor="#EAECF0"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: 16,
                }}
              >
                {skill}
              </Label>
            ))}
          </div>
          <div style={{ fontSize: 12, lineHeight: "18px", color: "#667085" }}>
            Jia automatically extracts skill tags from uploaded CVs.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>
          No skills found.
        </div>
      )}
    </Container>
  );
}
