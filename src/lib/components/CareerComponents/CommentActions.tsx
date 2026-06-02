import React from "react";

interface CommentActionsProps {
  commentId: string;
  isOwnComment: boolean;
  isReplying: boolean;
  onToggleReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isSavingReply: boolean;
}

const CommentActions: React.FC<CommentActionsProps> = ({
  commentId,
  isOwnComment,
  isReplying,
  onToggleReply,
  onEdit,
  onDelete,
  isDeleting,
  isSavingReply,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      <button
        type="button"
        aria-label={isReplying ? "Close reply" : "Reply"}
        onClick={onToggleReply}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "1px solid #E4E7EC",
          backgroundColor: isReplying ? "#EEF2FF" : "#FFFFFF",
          color: isReplying ? "#4B48EC" : "#4B4E6D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isSavingReply ? "not-allowed" : "pointer",
          opacity: isSavingReply ? 0.6 : 1,
        }}
        disabled={isSavingReply}
      >
        <i
          className={isReplying ? "la la-times" : "la la-reply"}
          style={{ fontSize: 16 }}
        ></i>
      </button>
      {isOwnComment && (
        <>
          <button
            type="button"
            aria-label="Edit comment"
            onClick={onEdit}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid #E4E7EC",
              backgroundColor: "#FFFFFF",
              color: "#475467",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <i className="la la-pen" style={{ fontSize: 16 }}></i>
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onDelete}
            aria-label="Delete comment"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid #E4E7EC",
              backgroundColor: "#FFFFFF",
              color: "#B42318",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isDeleting ? "not-allowed" : "pointer",
            }}
          >
            {isDeleting ? (
              <i
                className="la la-spinner la-spin"
                style={{ fontSize: 16 }}
              ></i>
            ) : (
              <i className="la la-trash" style={{ fontSize: 16 }}></i>
            )}
          </button>
        </>
      )}
    </div>
  );
};

export default CommentActions;
