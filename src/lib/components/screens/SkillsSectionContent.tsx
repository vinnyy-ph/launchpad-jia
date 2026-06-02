import styles from "@/lib/styles/screens/manageCV.module.scss";
import { SkillTag } from "../CandidateComponents/SkillTag";

type SkillsSectionContentProps = {
  buildingCV: boolean;
  loading: boolean;
  skills: string[];
};

export default function SkillsSectionContent({
  buildingCV,
  loading,
  skills,
}: SkillsSectionContentProps) {
  return (
    <div className={`${styles.sectionDetails} ${skills.length > 0 ? styles.withDetails : ""}`}>
      {buildingCV || loading ? (
        <>
          <div className={styles.loading} />
          <div className={styles.loading} />
        </>
      ) : skills.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {skills.map((skill, idx) => (
            <SkillTag key={idx} label={skill} />
          ))}
        </div>
      ) : (
        "Upload your CV to auto-fill this section."
      )}
    </div>
  );
}
