"use client"

import { useState } from "react";
import styles from "@/lib/styles/shareable-assessment.module.scss";
import type { ShareableAssessmentRecord } from "@/lib/hooks/useShareAssessmentModal";
import moment from "moment";

type Props = {
  generatedLinks?: ShareableAssessmentRecord[];
  pipelineStages?: any[];
  onToggleActive?(assessmentId: string, newActive: boolean): void;
  onDelete?(assessmentId: string): void;
};

export default function GeneratedLinksTable({ generatedLinks, pipelineStages, onToggleActive, onDelete }: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (assessmentId: string) => {
    setPendingDeleteId(assessmentId);
  };

  const handleCancelDelete = () => {
    setPendingDeleteId(null);
  };

  const handleConfirmDelete = async (assessmentId: string) => {
    if (!onDelete) {
      setPendingDeleteId(null);
      return;
    }

    await onDelete(assessmentId);
    setPendingDeleteId(null);
  };

  // Get stage columns ordered by pipeline stages
  const stageColumns = pipelineStages && pipelineStages.length > 0
    ? pipelineStages.filter(s => s.id !== "4").map(s => s.id)
    : generatedLinks && generatedLinks.length > 0
    ? Object.keys(generatedLinks[0].viewableStages || {}).sort()
    : [];

  return (
    <div className={styles.linksTable}>
      <table>
        <thead>
          <tr>
            <td>Created At</td>
            <td>Name Visibility</td>
            {stageColumns.map(stageId => {
              const stage = pipelineStages?.find(s => s.id === stageId);
              const stageName = stage?.alias || stage?.name || generatedLinks?.[0]?.viewableStages[stageId]?.stageName || `Stage ${stageId}`;
              const truncated = stageName.length > 10 ? `${stageName.substring(0, 10)}...` : stageName;
              return <td key={stageId} title={stageName}>{truncated}</td>;
            })}
            <td>Contact</td>
            <td>Link</td>
            <td>Password</td>
            <td>Views</td>
            <td>Active</td>
            <td style={{ width: "120px" }}></td>
          </tr>
        </thead>

        <tbody>
          {generatedLinks && generatedLinks.length > 0 ? (
            generatedLinks.map((assessment) => {
              return (
                <tr key={assessment._id}>
                  <td>{moment(assessment.dateGenerated).format("MM/DD/YY hh:mm A")}</td>
                  <td>{assessment.nameVisibility}</td>

                  {stageColumns.map(stageId => (
                    <td key={stageId} className={styles.centered}>
                      {assessment.viewableStages[stageId]?.viewable && (
                        <img src="/iconsV3/checkV7.svg" alt="Check icon" />
                      )}
                    </td>
                  ))}
                  <td className={styles.centered}>
                    {assessment.isContactVisible && (
                      <img src="/iconsV3/checkV7.svg" alt="Check icon" />
                    )}
                  </td>

                  <td>
                    <a
                      href={assessment.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {assessment.profileId.slice(0, 8)}...
                    </a>
                  </td>
                  <td className={styles.centered}>{assessment.password}</td>
                  <td className={styles.centered}>{assessment.views}</td>

                  <td style={{ paddingTop: "20px" }}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={assessment.active}
                        onChange={() => onToggleActive && onToggleActive(assessment._id, !assessment.active)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </td>
                  <td className={styles.centered} style={{ width: "120px" }}>
                    {pendingDeleteId === assessment._id ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                          type="button"
                          aria-label="Confirm delete"
                          onClick={() => handleConfirmDelete(assessment._id)}
                          className={styles.confirmDeleteBtn}
                        >
                          <i className="la la-check" style={{ fontSize: 16, color: "#0F8B28" }} />
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel delete"
                          onClick={handleCancelDelete}
                          className={styles.cancelDeleteBtn}
                        >
                          <i className="la la-times" style={{ fontSize: 16, color: "#C12D2D" }} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label="Delete shareable link"
                        onClick={() => handleDeleteClick(assessment._id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 0
                        }}
                      >
                        <img src="/iconsV3/trash.svg" alt="Delete" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={11} style={{ textAlign: 'center', padding: '20px' }}>
                No shareable links generated yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
