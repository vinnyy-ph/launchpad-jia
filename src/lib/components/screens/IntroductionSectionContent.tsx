import styles from "@/lib/styles/screens/manageCV.module.scss";

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
  return (
    <div
      className={styles.sectionDetails}
      style={{ color: "#475467", fontSize: "14px", lineHeight: "1.5" }}
    >
      {buildingCV || loading ? (
        <div className={styles.loading} />
      ) : (
        <span style={{ whiteSpace: "pre-wrap" }}>
          {value && value.trim()
            ? value.trim()
            : "Upload your CV to auto-fill this section."}
        </span>
      )}
    </div>
  );
}
