import styles from "./template.module.scss";

interface TemplateProps {
  subject: string;
  message: string;
  previewWithSample?: boolean;
}

const sampleTokenMapping: Record<string, string> = {
  "Candidate First Name": "Alex",
  "Candidate Last Name": "Tan",
  "Candidate Full Name": "Alex Tan",
  "Candidate Email Address": "alex.tan@example.com",
  "Candidate CV Screening Reasoning":
    "Strong alignment with the role based on experience and skills.",
  "Organization Name": "Whitecloak",
  "Organization Description": "A digital health and AI solutions company.",
  "Organization Location": "Singapore",
  "Job Title": "Software Engineer - Java",
  "Job Description": "Build reliable backend services and candidate workflows.",
  "AI Interview Date": "March 17, 2026",
};

function replaceSampleTokens(html: string) {
  if (!html) return "";

  return html.replace(
    /<span([^>]*data-token="([^"]+)"[^>]*)>(.*?)<\/span>/g,
    (match, attributes, tokenKey, originalText) => {
      const normalizedKey = tokenKey.includes("-")
        ? tokenKey.split("-").slice(1).join("-")
        : tokenKey;
      const replacement = sampleTokenMapping[normalizedKey] || originalText;

      return `<span${attributes}>${replacement}</span>`;
    },
  );
}

export default ({ subject, message, previewWithSample = false }: TemplateProps) => {
  const subjectContent = previewWithSample ? replaceSampleTokens(subject) : subject;
  const bodyContent = previewWithSample ? replaceSampleTokens(message) : message;

  return (
    <div
      className={`${styles.template} ${
        previewWithSample ? styles.previewState : styles.placeholderState
      }`}
    >
      <div className={styles.contentGroup}>
        <span className={styles.label}>Subject</span>
        <div
          className={`${styles.contentValue} ${styles.subjectValue}`}
          dangerouslySetInnerHTML={{ __html: subjectContent || "<p>N/A</p>" }}
        />
      </div>

      <hr className={styles.divider} />

      <div className={`${styles.contentGroup} ${styles.bodyGroup}`}>
        <span className={styles.label}>Body</span>
        <div
          className={`${styles.contentValue} ${styles.bodyValue}`}
          dangerouslySetInnerHTML={{ __html: bodyContent || "<p>N/A</p>" }}
        />
      </div>
    </div>
  );
};
