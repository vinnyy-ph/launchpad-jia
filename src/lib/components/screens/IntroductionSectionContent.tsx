import styles from "@/lib/styles/screens/manageCV.module.scss";
import RichText from "@/lib/components/ManualProfile/RichText";

type IntroductionSectionContentProps = {
  buildingCV: boolean;
  loading: boolean;
  value?: string;
};

export default function IntroductionSectionContent({
  buildingCV,
  loading,
  value,
}: IntroductionSectionContentProps) {
  const hasValue = Boolean(value && value.trim());

  return (
    <div
      className={styles.sectionDetails}
      style={{ color: "#475467", fontSize: "14px", lineHeight: "1.5" }}
    >
      {buildingCV || loading ? (
        <div className={styles.loading} />
      ) : hasValue ? (
        // Stored intro may be rich-text HTML (manual flow) or plain text (CV
        // upload). RichText sanitises both at the display boundary.
        <RichText html={value as string} />
      ) : (
        <span style={{ whiteSpace: "pre-wrap" }}>
          Upload your CV to auto-fill this section.
        </span>
      )}
    </div>
  );
}
