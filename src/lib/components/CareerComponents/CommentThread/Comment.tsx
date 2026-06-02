"use client";

import styles from "@/lib/styles/components/CommentThreads.module.scss";

export type CommentDetails = {
  _id?: string;
  deletedAt?: string;
  editedAt?: string;
  createdAt?: string;
  createdBy?: {
    name?: string;
    image?: string;
    role?: string;
  };
}
type CommentProps = {
  mode: "deleted" | "active";
  details: CommentDetails;
  canEdit?: boolean;
  openDeleteModal?: (idx: number) => void;
  startEditComment?: (comment: CommentDetails, idx: number) => void;
  startReply?: (parentId: string) => void;
  resolvedIdx?: number;
  currentRole?: string;
}

function getEditedTime(editedAt: string) {
  const editedDate = new Date(editedAt);
  const time = (Date.now() - editedDate.getTime()) / 1000;
  let label = 'Edited';
  if (time <= 60) { label = 'Edited just now'; }
  else if (time < 3600) { label = `Edited ${Math.floor(time / 60)}m ago`; }
  return label;
}

function parsePostTime(date: string | undefined) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
}

export function Comment({ mode = "active", details, canEdit, openDeleteModal, startEditComment, startReply, resolvedIdx, currentRole }: CommentProps) {
  if (mode === "deleted") {
    return (
      <>
        <div className={`${styles.deletedComment} ${styles.title}`}>Comment deleted by its author</div>
        <div className={`${styles.deletedComment} ${styles.date}`}>
          {parsePostTime(details.deletedAt)}
        </div>
      </>
    );
  }

  return (
    <div className={styles.commentWrapper}>
      <div>
        <p className={styles.commentAuthor}>{details.createdBy?.name || 'Contributor'}</p>
        <div className={styles.commentInfo}>
          <span style={{ textTransform: 'capitalize' }}>{(currentRole || details.createdBy?.role || 'Contributor')?.replace('_', ' ')}</span> | {parsePostTime(details.createdAt)}
          {details.editedAt && <span> | {getEditedTime(details.editedAt)}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <i
          className="la la-reply text-lg"
          title="Reply"
          style={{ cursor: 'pointer', color: '#6B7280' }}
          onClick={() => startReply(details._id)}
        />
        {canEdit && (
          <>
            <i
              className="la la-trash text-lg"
              title="Delete comment"
              style={{ cursor: 'pointer', color: '#6B7280' }}
              onClick={() => openDeleteModal(resolvedIdx)}
            />
            <i
              className="las la-pencil-alt text-lg"
              title="Edit comment"
              style={{ cursor: 'pointer', color: '#6B7280' }}
              onClick={() => startEditComment(details, resolvedIdx)}
            />
          </>
        )}
      </div>
    </div>
  );
}