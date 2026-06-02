"use client";

import styles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";
import Markdown from "react-markdown";

interface CVSectionCardProps {
  title: string;
  content: string;
  isEditing: boolean;
  onToggleEdit(): void;
  onContentChange(newContent: string): void;
  embedded?: boolean;
}

export function CVSectionCard({
  title,
  content,
  isEditing,
  onToggleEdit,
  onContentChange,
  embedded = false,
}: CVSectionCardProps) {
  const sectionContent = isEditing ? (
    <textarea
      className={embedded ? styles.embeddedMarkdownTextarea : undefined}
      id={title}
      placeholder="Enter your details"
      value={content}
      onBlur={(e) => {
        e.target.placeholder = "Enter your details";
      }}
      onChange={(e) => {
        onContentChange(e.target.value);
      }}
      onFocus={(e) => {
        e.target.placeholder = "";
      }}
    />
  ) : (
    <span
      className={`${styles.sectionDetails} ${
        content && content.trim() ? styles.withDetails : ""
      }`}
    >
      <Markdown>{content && content.trim() ? content.trim() : "N/A"}</Markdown>
    </span>
  );

  if (embedded) {
    return <div className={styles.embeddedDetailsContainer}>{sectionContent}</div>;
  }

  return (
    <div className={styles.gradient}>
      <div className={styles.cvDetailsCard}>
        <span className={styles.sectionTitle}>
          {title}

          <div
            className={styles.editIcon}
            onClick={onToggleEdit}
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              alt=""
              src={isEditing ? "/iconsV3/save.svg" : "/iconsV3/edit.svg"}
            />
          </div>
        </span>

        <div className={styles.detailsContainer}>{sectionContent}</div>
      </div>
    </div>
  );
}
