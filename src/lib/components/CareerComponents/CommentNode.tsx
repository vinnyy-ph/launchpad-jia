import React from "react";
import moment from "moment";
import CommentActions from "./CommentActions";
import { CommentComposer } from "./InterviewComments";

export type InterviewComment = {
  id: string;
  message: string;
  createdAt: string;
  parentId?: string | null;
  updatedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  author: {
    name?: string;
    email?: string;
    image?: string;
  };
};

export interface CommentNode extends InterviewComment {
  replies: CommentNode[];
}

type UserInfo =
  | {
      name?: string;
      email?: string;
      image?: string;
    }
  | null;

const MAX_VISIBLE_INDENT_LEVEL = 1;
const REPLY_INDENT_PX = 40;

const getAuthorInitial = (
  name?: string,
  email?: string,
  fallback?: string
) => (name || email || fallback || "R").charAt(0).toUpperCase();

const MENTION_TERMINATOR = "\u00a0";

const createMentionRegex = () =>
  new RegExp(`@([^${MENTION_TERMINATOR}]+)${MENTION_TERMINATOR}`, "g");

const mentionTokenStyles: React.CSSProperties = {
  display: "inline",
  backgroundColor: "#C7D2FE",
  color: "#4F46E5",
  borderRadius: 4,
  padding: "0 4px",
  fontWeight: 600,
};

const renderMentionSegment = (segment: string) => {
  const regex = createMentionRegex();
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(segment))) {
    if (match.index > lastIndex) {
      nodes.push(segment.slice(lastIndex, match.index));
    }

    const label = match[1];
    nodes.push(
      <span
        key={`mention-${match.index}-${label}`}
        style={mentionTokenStyles}
      >
        @{label}
      </span>
    );
    nodes.push("\u00a0");
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < segment.length) {
    nodes.push(segment.slice(lastIndex));
  }

  return nodes;
};

const renderMessageWithMentions = (message: string) => {
  if (!message) {
    return null;
  }

  const segments = message.split("\n");

  return segments.map((segment, segmentIndex) => (
    <React.Fragment key={`segment-${segmentIndex}`}>
      {segmentIndex > 0 && <br />}
      {renderMentionSegment(segment)}
    </React.Fragment>
  ));
};

interface CommentNodeComponentProps {
  commentNode: CommentNode;
  depth: number;
  isLastSibling: boolean;
  user: UserInfo;
  orgId?: string | null;
  editingCommentId: string | null;
  editingDraft: string;
  setEditingDraft: (value: string) => void;
  replyingToCommentId: string | null;
  replyDraft: string;
  setReplyDraft: (value: string) => void;
  commentBeingDeleted: string | null;
  commentBeingUpdated: string | null;
  replyParentBeingSaved: string | null;
  threadVisibility: Record<string, "collapsed" | "expanded">;
  isCurrentUsersComment: (comment: InterviewComment) => boolean;
  handleStartEditing: (comment: InterviewComment) => void;
  handleCancelEditing: () => void;
  handleSaveEdit: () => Promise<void>;
  handleToggleReply: (commentId: string) => void;
  handleSubmitReply: () => Promise<void>;
  onDeleteComment: (commentId: string) => void;
  determineThreadState: (
    commentId: string,
    depth: number,
    hasReplies: boolean
  ) => "collapsed" | "expanded";
  toggleThreadState: (
    commentId: string,
    depth: number,
    hasReplies: boolean
  ) => void;
  CommentComposer: React.ComponentType<any>;
  comments: InterviewComment[];
}

const CommentNodeComponent: React.FC<CommentNodeComponentProps> = ({
  commentNode,
  depth,
  isLastSibling,
  user,
  orgId,
  editingCommentId,
  editingDraft,
  setEditingDraft,
  replyingToCommentId,
  replyDraft,
  setReplyDraft,
  commentBeingDeleted,
  commentBeingUpdated,
  replyParentBeingSaved,
  threadVisibility,
  isCurrentUsersComment,
  handleStartEditing,
  handleCancelEditing,
  handleSaveEdit,
  handleToggleReply,
  handleSubmitReply,
  onDeleteComment,
  determineThreadState,
  toggleThreadState,
  CommentComposer,
  comments,
}) => {
  const avatarSize = depth === 0 ? 44 : 36;
  const indentOffset =
    Math.min(depth, MAX_VISIBLE_INDENT_LEVEL) * REPLY_INDENT_PX;
  const hasReplies = commentNode.replies.length > 0;
  const repliesState = determineThreadState(
    commentNode.id,
    depth,
    hasReplies
  );
  const areRepliesCollapsed = repliesState === "collapsed";
  const isOwnComment = isCurrentUsersComment(commentNode);
  const isEditing = editingCommentId === commentNode.id;
  const isReplyingHere = replyingToCommentId === commentNode.id;
  const isSavingEdit = commentBeingUpdated === commentNode.id;
  const isSavingReply = replyParentBeingSaved === commentNode.id;

  return (
    <div
      key={commentNode.id}
      style={{
        marginLeft: indentOffset,
        paddingBottom: depth === 0 ? 24 : 16,
        borderBottom:
          depth === 0 && !isLastSibling ? "1px solid #F2F4F7" : "none",
        marginTop: depth === 0 ? 0 : 12,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: depth > 0 ? 12 : 16,
          position: "relative",
        }}
      >
        {depth > 0 && (
          <div
            style={{
              width: 18,
              display: "flex",
              alignItems: "flex-start",
              paddingTop: 4,
            }}
          >
            <i
              className="la la-reply"
              style={{
                fontSize: 16,
                color: "#98A2B3",
                transform: "scaleX(-1)",
              }}
            ></i>
          </div>
        )}
        {commentNode.isDeleted ? (
          <div
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: "50%",
              backgroundColor: "#F2F4F7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              color: "#98A2B3",
            }}
          >
            <i className="la la-user" style={{ fontSize: depth === 0 ? 20 : 16 }}></i>
          </div>
        ) : commentNode.author?.image ? (
          <img
            src={commentNode.author.image}
            alt={commentNode.author?.name || "Comment author"}
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: "50%",
              backgroundColor: "#F2F4F7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              color: "#414651",
            }}
          >
            {getAuthorInitial(
              commentNode.author?.name,
              commentNode.author?.email,
              "R"
            )}
          </div>
        )}
        <div
          style={{
            flex: 1,
          }}
        >
          {commentNode.isDeleted ? (
            <div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#98A2B3",
                  fontStyle: "italic",
                }}
              >
                Comment deleted by its author
              </span>
              <div
                style={{
                  fontSize: 12,
                  color: "#98A2B3",
                  marginTop: 4,
                }}
              >
                {moment(commentNode.deletedAt || commentNode.createdAt).format(
                  "MMM DD, YYYY · hh:mm A"
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#101828",
                    }}
                  >
                    {commentNode.author?.name ||
                      commentNode.author?.email ||
                      "Recruiter"}
                  </span>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#717680",
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>
                      {(commentNode.author?.email || "Team member") +
                        " · " +
                        moment(commentNode.createdAt).format(
                          "MMM DD, YYYY · hh:mm A"
                        )}
                    </span>
                    {commentNode.updatedAt && 
                      commentNode.updatedAt !== commentNode.createdAt && (
                      <span 
                        style={{ color: "#475467", fontSize: 11, fontStyle: "italic" }}
                        title={moment(commentNode.updatedAt).format("MMM DD, YYYY · hh:mm A")}
                      >
                        · Edited {moment(commentNode.updatedAt).fromNow()}
                      </span>
                    )}
                  </div>
                </div>
                <CommentActions
                  commentId={commentNode.id}
                  isOwnComment={isOwnComment}
                  isReplying={isReplyingHere}
                  onToggleReply={() => handleToggleReply(commentNode.id)}
                  onEdit={() => handleStartEditing(commentNode)}
                  onDelete={() => onDeleteComment(commentNode.id)}
                  isDeleting={commentBeingDeleted === commentNode.id}
                  isSavingReply={isSavingReply}
                />
              </div>

              {isEditing ? (
                <div style={{ marginTop: 12 }}>
                  <CommentComposer
                    user={user}
                    orgId={orgId}
                    value={editingDraft}
                    onChange={setEditingDraft}
                    onSubmit={handleSaveEdit}
                    isSubmitting={isSavingEdit}
                    placeholder="Edit your comment..."
                    submitLabel="Save"
                    submittingLabel="Saving..."
                    onCancel={handleCancelEditing}
                    showCancelButton={true}
                  />
                </div>
              ) : (
                <p
                  style={{
                    fontSize: 14,
                    color: "#101828",
                    marginTop: 12,
                    whiteSpace: "pre-line",
                  }}
                >
                  {renderMessageWithMentions(commentNode.message)}
                </p>
              )}

              {isReplyingHere && !isEditing && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                  fontSize: 12,
                  color: "#717680",
                }}
              >
                <i
                  className="la la-reply"
                  style={{
                    fontSize: 14,
                    transform: "scaleX(-1)",
                  }}
                ></i>
                <span>
                  Replying to{" "}
                  <span style={{ fontWeight: 600, color: "#4B48EC" }}>
                    {commentNode.author?.name ||
                      commentNode.author?.email ||
                      "someone"}
                  </span>
                </span>
              </div>
              <CommentComposer
                user={user}
                orgId={orgId}
                value={replyDraft}
                onChange={setReplyDraft}
                onSubmit={handleSubmitReply}
                isSubmitting={isSavingReply}
                placeholder="Write a reply..."
                submitLabel="Save"
                submittingLabel="Saving..."
                onCancel={() => handleToggleReply(commentNode.id)}
                showCancelButton={true}
              />
            </div>
              )}

              {hasReplies && (
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() =>
                      toggleThreadState(commentNode.id, depth, hasReplies)
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      border: "none",
                      background: "transparent",
                      color: "#4B48EC",
                      cursor: "pointer",
                    }}
                  >
                    <i
                      className={`la ${
                        areRepliesCollapsed ? "la-plus" : "la-minus"
                      }`}
                      style={{ fontSize: 14 }}
                    ></i>
                    {areRepliesCollapsed
                      ? `Show ${commentNode.replies.length} repl${
                          commentNode.replies.length === 1 ? "y" : "ies"
                        }`
                      : "Hide replies"}
                  </button>
                  {!areRepliesCollapsed && (
                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {commentNode.replies.map((child, index) => (
                        <CommentNodeComponent
                          key={child.id}
                          commentNode={child}
                          depth={depth + 1}
                          isLastSibling={index === commentNode.replies.length - 1}
                          user={user}
                          orgId={orgId}
                          editingCommentId={editingCommentId}
                          editingDraft={editingDraft}
                          setEditingDraft={setEditingDraft}
                          replyingToCommentId={replyingToCommentId}
                          replyDraft={replyDraft}
                          setReplyDraft={setReplyDraft}
                          commentBeingDeleted={commentBeingDeleted}
                          commentBeingUpdated={commentBeingUpdated}
                          replyParentBeingSaved={replyParentBeingSaved}
                          threadVisibility={threadVisibility}
                          isCurrentUsersComment={isCurrentUsersComment}
                          handleStartEditing={handleStartEditing}
                          handleCancelEditing={handleCancelEditing}
                          handleSaveEdit={handleSaveEdit}
                          handleToggleReply={handleToggleReply}
                          handleSubmitReply={handleSubmitReply}
                          onDeleteComment={onDeleteComment}
                          determineThreadState={determineThreadState}
                          toggleThreadState={toggleThreadState}
                          CommentComposer={CommentComposer}
                          comments={comments}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentNodeComponent;
