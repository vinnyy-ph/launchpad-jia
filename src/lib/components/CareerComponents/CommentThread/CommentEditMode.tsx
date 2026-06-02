import styles from "@/lib/styles/components/CommentThreads.module.scss";
import MentionsTagInput from "@/lib/components/CareerComponents/MentionsTagInput";
import type { CommentDetails } from "./Comment";

type CommentEditModeProps = {
  details: CommentDetails;
  states: {
    editingText: string;
    setEditingText(text: string): void;
    setEditingMentions(mentions: any[]): void;
    effectiveOrgID: string | null;
    user: any;
    cancelEdit(): void;
    saveEditedComment(idx: number): void;
    resolvedIdx: number;
    teamMembers?: any[];
  }
}
export function CommentEditMode({ details, states }: CommentEditModeProps) {
  const { editingText, setEditingText, setEditingMentions, effectiveOrgID, user, cancelEdit, saveEditedComment, resolvedIdx, teamMembers } = states;

  return (
    <>
      {/* Editing a comment UI */}
      <div className={`${styles.editing} ${styles.info}`}>
        <strong>{details.createdBy?.name || 'Contributor'}</strong>
      </div>

      {/* Updated edit parent comment area */}
      <div style={{ flex: 1 }}>
        <div className="comment-composer" style={{ position: 'relative' }}>
          <MentionsTagInput
            value={editingText}
            onChange={setEditingText}
            onMentionsChange={setEditingMentions}
            placeholder="Edit comment..."
            orgId={effectiveOrgID as string}
            user={user}
            autoFocusEnd
            teamMembers={teamMembers}
          />
          <div className={`${styles.editing} ${styles.actions}`}>
            <button onClick={cancelEdit} className={`${styles.editing} ${styles.cancelBtn}`}>Cancel</button>
            <button
              disabled={!editingText.trim()}
              onClick={() => saveEditedComment(resolvedIdx)}
              className={`${styles.editing} ${styles.saveBtn}`}
              style={{
                background: !editingText.trim() ? '#E5E7EB' : '#181D27',
                cursor: !editingText.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}