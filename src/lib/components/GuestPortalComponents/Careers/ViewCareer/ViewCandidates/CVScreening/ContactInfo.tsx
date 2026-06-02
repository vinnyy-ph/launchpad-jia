import Markdown from "react-markdown";
import Container from "../../../../Container";
import { getCVSection } from "@/lib/Utils";
import type { CVSection } from "./useCVScreeningData";

type Props = {
  digitalCV: CVSection[] | null;
};

type ContactField = {
  label: string;
  value: string | null;
  isLink?: boolean;
  linkPrefix?: string;
};

const parseContactInfo = (contactContent: string): ContactField[] => {
  if (!contactContent) return [];

  const fields: ContactField[] = [];

  const patterns: { label: string; regex: RegExp; isLink?: boolean; linkPrefix?: string }[] = [
    { label: "Email", regex: /\*?\*?Email\*?\*?[:\s]*([^\n]+)/i, isLink: true, linkPrefix: "mailto:" },
    { label: "Phone", regex: /\*?\*?(?:Phone|Mobile|Tel)\*?\*?[:\s]*([^\n]+)/i, isLink: true, linkPrefix: "tel:" },
    { label: "Address", regex: /\*?\*?Address\*?\*?[:\s]*([^\n]+)/i },
    { label: "LinkedIn", regex: /\*?\*?LinkedIn\*?\*?[:\s]*([^\n]+)/i, isLink: true },
    { label: "GitHub", regex: /\*?\*?GitHub\*?\*?[:\s]*([^\n]+)/i, isLink: true },
    { label: "Website / Portfolio", regex: /\*?\*?(?:Website|Portfolio)\*?\*?[:\s]*([^\n]+)/i, isLink: true },
  ];

  for (const pattern of patterns) {
    const match = contactContent.match(pattern.regex);
    if (match && match[1]) {
      const value = match[1].replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
      if (value && value !== "-" && value.toLowerCase() !== "n/a") {
        fields.push({
          label: pattern.label,
          value,
          isLink: pattern.isLink,
          linkPrefix: pattern.linkPrefix,
        });
      }
    }
  }

  return fields;
};

export default function ContactInfo({ digitalCV }: Props) {
  const cvArray = Array.isArray(digitalCV) ? digitalCV : [];
  const contactContent = getCVSection(cvArray, "Contact Info");
  const fields = parseContactInfo(contactContent);

  const hasStructuredFields = fields.length > 0;
  const hasRawContent = contactContent && contactContent.trim().length > 0;

  return (
    <Container
      title={
        <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
          Contact Information
        </span>
      }
    >
      {hasStructuredFields ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {fields.map((field, index) => (
            <div key={index}>
              <div style={{ fontSize: 14, color: "#98A2B3", marginBottom: 4 }}>{field.label}</div>
              {field.isLink && field.value ? (
                <a
                  href={field.linkPrefix ? `${field.linkPrefix}${field.value.replace(/\s/g, "")}` : field.value}
                  target={field.linkPrefix?.startsWith("mailto") || field.linkPrefix?.startsWith("tel") ? undefined : "_blank"}
                  rel="noreferrer"
                  style={{ fontSize: 14, fontWeight: 600, color: "#1570EF", textDecoration: "none", wordBreak: "break-all" }}
                >
                  {field.value}
                </a>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 600, color: "#475467", lineHeight: "20px" }}>
                  {field.value || "N/A"}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : hasRawContent ? (
        // Fallback to raw Markdown rendering if structured parsing fails
        <div style={{ fontSize: 14, color: "#475467", lineHeight: "20px" }}>
          <Markdown>{contactContent}</Markdown>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>
          Contact information not provided.
        </div>
      )}
    </Container>
  );
}
