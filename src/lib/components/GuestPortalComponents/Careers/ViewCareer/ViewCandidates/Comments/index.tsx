"use client";

import React, { useEffect, useMemo, useState } from "react";
import Container from "../../../../Container";
import CommentsSkeleton from "./CommentsSkeleton";
import { api } from "@/lib/utils/apiClient";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import MentionsTagInput, {
  type MentionSuggestion,
} from "@/lib/components/CareerComponents/MentionsTagInput";
import { errorToast, successToast } from "@/lib/Utils";

type Props = {
  interviewID: string;
  careerId?: string;
  candidateEmail?: string;
  isLoading?: boolean;
};

type GuestUser = {
  name?: string;
  email?: string;
  image?: string;
  role?: string;
};

type NormalizedCreatedBy = {
  name: string;
  email: string;
  image?: string;
  role?: string;
};

function safeParseJson(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type MemberMap = Record<string, { name?: string; image?: string; role?: string }>;

/**
 * Normalize createdBy into a consistent object shape.
 * Handles legacy string values and missing fields.
 * Enriches from membersByEmail if comment doesn't have image/name/role.
 */
function resolveCreatedBy(
  comment: any,
  membersByEmail: MemberMap = {}
): NormalizedCreatedBy {
  const cb = comment?.createdBy;
  let base: NormalizedCreatedBy;
  if (!cb) {
    base = { name: "Unknown", email: "", image: undefined, role: undefined };
  } else if (typeof cb === "string") {
    // Legacy: createdBy stored as a string (email or name)
    base = { name: cb, email: cb.includes("@") ? cb : "", image: undefined, role: undefined };
  } else {
    base = {
      name: cb.name || cb.displayName || "Unknown",
      email: cb.email || "",
      image: cb.image || cb.picture || cb.photoURL || cb.avatar || undefined,
      role: cb.role || undefined,
    };
  }

  // Enrich from member map if missing image
  const emailLower = (base.email || "").toLowerCase();
  const member = emailLower ? membersByEmail[emailLower] : undefined;
  if (member) {
    if (!base.image && member.image) base.image = member.image;
    if (base.name === "Unknown" && member.name) base.name = member.name;
    if (!base.role && member.role) base.role = member.role;
  }

  return base;
}

/**
 * Compute avatar src for a comment author.
 * Returns undefined if no image available (caller should render initials fallback).
 */
function resolveAvatarSrc(createdBy: NormalizedCreatedBy): string | undefined {
  return createdBy.image || undefined;
}

export default function Comments({
  interviewID,
  careerId: _careerId,
  candidateEmail: _candidateEmail,
  isLoading: isLoadingProp = false,
}: Props) {
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [newComment, setNewComment] = useState<string>("");
  const [newCommentMentions, setNewCommentMentions] = useState<MentionSuggestion[]>([]);
  const [isPostingComment, setIsPostingComment] = useState<boolean>(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [editingMentions, setEditingMentions] = useState<MentionSuggestion[]>([]);

  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [replyMentions, setReplyMentions] = useState<MentionSuggestion[]>([]);
  const [isPostingReply, setIsPostingReply] = useState<boolean>(false);

  const [deleteModalMounted, setDeleteModalMounted] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteCommentIndex, setDeleteCommentIndex] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  const [composerKey, setComposerKey] = useState<number>(0);

  // Member lookup map: email (lowercase) -> member record with image/name/role
  const [membersByEmail, setMembersByEmail] = useState<Record<string, { name?: string; image?: string; role?: string }>>({});

  const guestOrgId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const parsed = safeParseJson(localStorage.getItem("guestOrg"));
    return parsed?._id || null;
  }, []);

  const guestUser = useMemo<GuestUser>(() => {
    if (typeof window === "undefined") return {};
    const raw = safeParseJson(localStorage.getItem("user"));
    // Prioritize raw.image (Google login stores it there), then picture, photoURL, avatar
    // No dicebear fallback here – AvatarImage will use initials fallback if needed
    const imageUrl =
      raw?.image ||
      raw?.picture ||
      raw?.photoURL ||
      raw?.avatar ||
      undefined;
    return {
      name: raw?.name || raw?.displayName || "Guest User",
      email: raw?.email || "",
      image: imageUrl,
      role: "guest", // lowercase to match DB schema
    };
  }, []);

  // Fetch org members to build email->member map (for enriching comment avatars)
  useEffect(() => {
    async function fetchMembers() {
      if (!guestOrgId) return;
      try {
        const res = await api.post("/api/fetch-members", { orgID: guestOrgId });
        const raw = Array.isArray(res?.data) ? res.data : res?.data?.members || [];
        const map: Record<string, { name?: string; image?: string; role?: string }> = {};
        raw.forEach((m: any) => {
          const email = (m.email || "").toLowerCase();
          if (email) {
            map[email] = {
              name: m.name || m.displayName,
              image: m.image || m.picture || m.photoURL || m.avatar,
              role: m.role,
            };
          }
        });
        setMembersByEmail(map);
      } catch {
        // Silently fail – avatars will just not be enriched
      }
    }
    fetchMembers();
  }, [guestOrgId]);

  // Render mention markup @[Display](id) into styled spans
  const renderCommentText = (raw: string | undefined | null) => {
    if (!raw) return null;
    const parts: React.ReactNode[] = [];
    const regex = /@\[(.+?)\]\((.+?)\)/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(raw))) {
      if (m.index > lastIndex) parts.push(raw.slice(lastIndex, m.index));
      const display = m[1];
      const id = m[2];
      parts.push(
        <span key={`m-${id}-${m.index}`} style={{ color: "#0F62FE", fontWeight: 500 }}>
          @{display}
        </span>
      );
      const nextChar = raw.charAt(regex.lastIndex);
      if (nextChar && !/\s|[.,;:!?()]/.test(nextChar)) parts.push(" ");
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < raw.length) parts.push(raw.slice(lastIndex));
    return <>{parts}</>;
  };

  useEffect(() => {
    async function load() {
      if (!guestOrgId || !interviewID) {
        setComments([]);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const res = await api.post("/api/fetch-feedback-comment", {
          interviewID,
          orgID: guestOrgId,
          type: "application",
        });
        const arr = Array.isArray(res?.data?.comments) ? res.data.comments : [];
        const filtered = arr.filter((c: any) => (c?.type ?? "application") === "application");
        setComments(filtered);
      } catch {
        setComments([]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [guestOrgId, interviewID]);

  function openDeleteModal(idx: number) {
    const target = comments[idx];
    if (!target?._id) {
      errorToast("Cannot delete this comment", 1200);
      return;
    }
    setDeleteCommentIndex(idx);
    setDeleteModalMounted(true);
    requestAnimationFrame(() => setDeleteModalVisible(true));
  }

  function closeDeleteModal() {
    setDeleteModalVisible(false);
    setDeleteCommentIndex(null);
    setDeleteLoading(false);
    setTimeout(() => setDeleteModalMounted(false), 200);
  }

  async function confirmDeleteComment() {
    if (deleteCommentIndex === null) return;
    const target = comments[deleteCommentIndex];
    setDeleteLoading(true);
    try {
      const commentId = target?._id;
      if (!commentId) throw new Error("Missing comment id");
      await api.post("/api/delete-feedback-comment", {
        interviewID,
        orgID: guestOrgId,
        commentId,
        type: "application",
      });
      setComments((prev) =>
        prev.map((c, i) =>
          i === deleteCommentIndex ? { ...c, deleted: true, deletedAt: new Date().toISOString() } : c
        )
      );
      successToast("Comment deleted", 1200);
      closeDeleteModal();
    } catch (err) {
      console.error(err);
      errorToast("Failed to delete comment", 1500);
      setDeleteLoading(false);
    }
  }

  function startEditComment(c: any, idx: number) {
    if (c.deleted || !c._id) return;
    setEditingCommentId(String(c._id));
    setEditingText(c.text || c.comment || c.feedback || "");
    setEditingMentions(Array.isArray(c.mentions) ? c.mentions : []);
  }

  function cancelEdit() {
    setEditingCommentId(null);
    setEditingText("");
    setEditingMentions([]);
  }

  async function saveEditedComment(idx: number) {
    if (!editingCommentId) return;
    const target = comments[idx];
    const trimmed = editingText.trim();
    if (!trimmed) return;
    try {
      const commentId = target?._id;
      if (!commentId) throw new Error("Missing comment id");
      await api.post("/api/update-feedback-comment", {
        interviewID,
        orgID: guestOrgId,
        commentId,
        newText: trimmed,
        mentions: editingMentions,
        type: "application",
      });
      setComments((prev) =>
        prev.map((c, i) =>
          i === idx
            ? {
                ...c,
                text: trimmed,
                comment: undefined,
                feedback: undefined,
                mentions: editingMentions,
                edited: true,
                editedAt: new Date().toISOString(),
              }
            : c
        )
      );
      successToast("Comment updated", 1200);
      cancelEdit();
    } catch (err) {
      console.error(err);
      errorToast("Failed to update comment", 1500);
    }
  }

  function startReply(parentId: string) {
    if (!parentId) {
      errorToast("Cannot reply to this comment", 1200);
      return;
    }
    setReplyingToCommentId(parentId);
    setReplyText("");
    setReplyMentions([]);
  }

  function cancelReply() {
    setReplyingToCommentId(null);
    setReplyText("");
    setReplyMentions([]);
    setIsPostingReply(false);
  }

  async function postReply(parentId: string) {
    if (!parentId || !replyText.trim()) return;
    if (!guestOrgId) return;
    if (!guestUser?.email) {
      errorToast("Missing user email for posting reply", 1500);
      return;
    }
    setIsPostingReply(true);
    try {
      const payload: any = {
        interviewID,
        orgID: guestOrgId,
        comment: replyText.trim(),
        mentions: replyMentions,
        parentId,
        createdBy: {
          name: guestUser?.name,
          email: guestUser?.email,
          image: guestUser?.image,
          role: "guest", // lowercase to match DB schema
        },
        createdAt: new Date().toISOString(),
        type: "application",
      };
      const res = await api.post("/api/add-feedback-comment", payload);
      const createdReply = res?.data?.comment || payload;
      setComments((prev) => [createdReply, ...prev]);
      successToast("Reply posted", 1200);
      cancelReply();
    } catch (err) {
      console.error(err);
      errorToast("Failed to post reply", 1200);
    } finally {
      setIsPostingReply(false);
    }
  }

  async function postComment() {
    if (!guestOrgId || !interviewID) return;
    if (!newComment.trim()) return;
    if (!guestUser?.email) {
      errorToast("Missing user email for posting comment", 1500);
      return;
    }
    setIsPostingComment(true);
    try {
      const payload: any = {
        interviewID,
        orgID: guestOrgId,
        comment: newComment.trim(),
        mentions: newCommentMentions,
        createdBy: {
          name: guestUser?.name,
          email: guestUser?.email,
          image: guestUser?.image,
          role: "guest", // lowercase to match DB schema
        },
        createdAt: new Date().toISOString(),
        type: "application",
        parentId: null,
      };

      const res = await api.post("/api/add-feedback-comment", payload);
      const createdComment = res?.data?.comment || payload;
      setComments((prev) => [createdComment, ...prev]);
      setNewComment("");
      setNewCommentMentions([]);
      setComposerKey((k) => k + 1);
      successToast("Comment posted", 1200);
    } catch (err) {
      console.error(err);
      errorToast("Failed to post comment", 1200);
    } finally {
      setIsPostingComment(false);
    }
  }

  const { parents, repliesByParent, idToIndex } = useMemo(() => {
    const parents: any[] = [];
    const repliesByParent: Record<string, any[]> = {};
    const idToIndex: Record<string, number> = {};

    comments.forEach((c: any, index: number) => {
      const cid = c._id ? String(c._id) : `legacy-${index}`;
      idToIndex[cid] = index;
      if (c.parentId) {
        const pid = String(c.parentId);
        if (!repliesByParent[pid]) repliesByParent[pid] = [];
        repliesByParent[pid].push(c);
      } else {
        parents.push(c);
      }
    });

    Object.keys(repliesByParent).forEach((k) => {
      repliesByParent[k].sort(
        (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });

    return { parents, repliesByParent, idToIndex };
  }, [comments]);

  if (isLoadingProp || isLoading) return <CommentsSkeleton />;

  return (
    <>
      <Container
        title={<span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>Comments</span>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Composer */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 40 }}>
                <AvatarImage src={guestUser?.image} alt={guestUser?.name || "User"} fallback="initials" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="comment-composer" style={{ position: "relative" }}>
                  <MentionsTagInput
                    key={composerKey}
                    value={newComment}
                    onChange={setNewComment}
                    onMentionsChange={setNewCommentMentions}
                    placeholder="Write a comment about this candidate..."
                    orgId={guestOrgId as string}
                    user={guestUser}
                  />
                  <button
                    type="button"
                    disabled={isPostingComment || !newComment.trim() || !guestUser?.email}
                    onClick={postComment}
                    style={{
                      position: "absolute",
                      right: 16,
                      bottom: 16,
                      background: isPostingComment || !newComment.trim() || !guestUser?.email ? "#D5D7DA" : "#181D27",
                      color: "#fff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 60,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      cursor:
                        isPostingComment || !newComment.trim() || !guestUser?.email ? "not-allowed" : "pointer",
                    }}
                  >
                    <i
                      className="las la-paper-plane text-xl mr-2"
                      style={{ transform: "rotate(-35deg)", display: "inline-block" }}
                    ></i>
                    {isPostingComment ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: "#EAECF0" }} />
          </div>

          {/* Threads */}
          <div style={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>All Comments</div>
          {comments && comments.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                maxHeight: 520,
                overflowY: "auto",
                paddingRight: 8,
              }}
            >
              {parents.map((parent: any, idx: number) => {
                const parentKey = String(parent._id);
                const isEditing = !!parent._id && editingCommentId === parent._id;
                const isParentDeleted = parent.deleted === true || parent.deleted === "true" || !!parent.deletedAt;
                // Normalize createdBy for consistent access (enriched from member map)
                const parentCreatedBy = resolveCreatedBy(parent, membersByEmail);
                const parentAvatarSrc = resolveAvatarSrc(parentCreatedBy);
                const canEdit =
                  !!parent._id &&
                  !!guestUser?.email &&
                  (guestUser.email || "").toLowerCase() === (parentCreatedBy.email || "").toLowerCase() &&
                  !isParentDeleted;
                const resolvedIdx = parent._id ? idToIndex[String(parent._id)] ?? idx : idx;
                const children = repliesByParent[String(parent._id)] || [];

                return (
                  <React.Fragment key={parentKey}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingTop: 8 }}>
                      {isParentDeleted ? (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            backgroundColor: "#F8F9FC",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="las la-user text-xl"></i>
                        </div>
                      ) : (
                        <div style={{ width: 40 }}>
                          <AvatarImage src={parentAvatarSrc} alt={parentCreatedBy.name || "User"} fallback="initials" />
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        {isParentDeleted ? (
                          <>
                            <div style={{ fontStyle: "italic", color: "#6B7280" }}>Comment deleted by its author</div>
                            <div style={{ color: "#717680", fontWeight: 500, fontSize: 14, paddingBottom: 10 }}>
                              {new Date(parent.deletedAt || parent.createdAt || Date.now()).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "numeric",
                              })}
                            </div>
                          </>
                        ) : isEditing ? (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <div>
                                <strong>{parentCreatedBy.name || "Guest"}</strong>
                                <div style={{ fontSize: 12, color: "#6B7280" }}>You are editing a comment</div>
                              </div>
                            </div>

                            <div className="comment-composer" style={{ position: "relative" }}>
                              <MentionsTagInput
                                value={editingText}
                                onChange={setEditingText}
                                onMentionsChange={setEditingMentions}
                                placeholder="Edit comment..."
                                orgId={guestOrgId as string}
                                user={guestUser}
                                autoFocusEnd
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  right: 16,
                                  bottom: 12,
                                  display: "flex",
                                  gap: 8,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  style={{
                                    background: "#fff",
                                    border: "1px solid #D5D7DA",
                                    padding: "8px 16px",
                                    borderRadius: 60,
                                    cursor: "pointer",
                                    fontSize: 14,
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={!editingText.trim()}
                                  onClick={() => saveEditedComment(resolvedIdx)}
                                  style={{
                                    background: !editingText.trim() ? "#E5E7EB" : "#181D27",
                                    color: "#fff",
                                    border: "none",
                                    padding: "8px 16px",
                                    borderRadius: 60,
                                    cursor: !editingText.trim() ? "not-allowed" : "pointer",
                                    fontSize: 14,
                                  }}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <div>
                                <p style={{ marginBottom: 0, fontWeight: 700, fontSize: 14, color: "#181D27" }}>
                                  {parentCreatedBy.name || "Guest"}
                                </p>
                                <div style={{ color: "#717680", fontWeight: 500, fontSize: 14 }}>
                                  <span style={{ textTransform: "capitalize" }}>
                                    {parentCreatedBy.role?.replace("_", " ") || "Guest"}
                                  </span>{" "}
                                  |{" "}
                                  {new Date(parent.createdAt || Date.now()).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "numeric",
                                  })}
                                  {parent.editedAt && <span> | Edited</span>}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                {canEdit ? (
                                  <>
                                    <i
                                      className="la la-trash text-lg"
                                      title="Delete comment"
                                      style={{ cursor: "pointer", color: "#6B7280" }}
                                      onClick={() => openDeleteModal(resolvedIdx)}
                                    />
                                    <i
                                      className="las la-pencil-alt text-lg"
                                      title="Edit comment"
                                      style={{ cursor: "pointer", color: "#6B7280" }}
                                      onClick={() => startEditComment(parent, resolvedIdx)}
                                    />
                                  </>
                                ) : (
                                  <i
                                    className="la la-reply text-lg"
                                    title="Reply"
                                    style={{ cursor: "pointer", color: "#6B7280" }}
                                    onClick={() => startReply(String(parent._id))}
                                  />
                                )}
                              </div>
                            </div>

                            <div style={{ marginTop: 6, fontSize: 16, lineHeight: "24px", color: "#181D27" }}>
                              {renderCommentText(parent.text || parent.comment || parent.feedback)}
                            </div>

                            {replyingToCommentId === parent._id && (
                              <div style={{ marginTop: 12, marginLeft: 32 }}>
                                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                  <div style={{ width: 32 }}>
                                    <AvatarImage src={guestUser?.image} alt={guestUser?.name || "You"} fallback="initials" />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div className="comment-composer" style={{ position: "relative" }}>
                                      <MentionsTagInput
                                        value={replyText}
                                        onChange={setReplyText}
                                        placeholder="Write a reply ..."
                                        orgId={guestOrgId as string}
                                        onMentionsChange={setReplyMentions}
                                        user={guestUser}
                                        autoFocusEnd
                                      />
                                      <div
                                        style={{
                                          position: "absolute",
                                          right: 16,
                                          bottom: 12,
                                          display: "flex",
                                          gap: 8,
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={cancelReply}
                                          style={{
                                            background: "#fff",
                                            border: "1px solid #D5D7DA",
                                            padding: "8px 16px",
                                            borderRadius: 60,
                                            cursor: "pointer",
                                            fontSize: 14,
                                          }}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={!replyText.trim() || isPostingReply}
                                          onClick={() => postReply(String(parent._id))}
                                          style={{
                                            background:
                                              !replyText.trim() || isPostingReply ? "#E5E7EB" : "#181D27",
                                            color: "#fff",
                                            border: "none",
                                            padding: "8px 16px",
                                            borderRadius: 60,
                                            cursor:
                                              !replyText.trim() || isPostingReply ? "not-allowed" : "pointer",
                                            fontSize: 14,
                                          }}
                                        >
                                          {isPostingReply ? "Posting..." : "Reply"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {children.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 32, marginTop: 6 }}>
                        {children.map((reply: any, childIdx: number) => {
                          const replyKey = String(reply._id);
                          const resolvedReplyIdx = idToIndex[String(reply._id)] ?? idx + childIdx + 1;
                          const isReplyEditing = !!reply._id && editingCommentId === reply._id;
                          const isReplyDeleted = reply.deleted === true || reply.deleted === "true" || !!reply.deletedAt;
                          // Normalize createdBy for consistent access (enriched from member map)
                          const replyCreatedBy = resolveCreatedBy(reply, membersByEmail);
                          const replyAvatarSrc = resolveAvatarSrc(replyCreatedBy);
                          const canEditReply =
                            !!reply._id &&
                            !!guestUser?.email &&
                            (guestUser.email || "").toLowerCase() === (replyCreatedBy.email || "").toLowerCase() &&
                            !isReplyDeleted;

                          return (
                            <div key={replyKey} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
                              {isReplyDeleted ? (
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    backgroundColor: "#F8F9FC",
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <i className="las la-user text-lg"></i>
                                </div>
                              ) : (
                                <AvatarImage src={replyAvatarSrc} alt={replyCreatedBy.name || "User"} fallback="initials" />
                              )}

                              <div style={{ flex: 1 }}>
                                {isReplyDeleted ? (
                                  <>
                                    <div style={{ fontStyle: "italic", color: "#6B7280" }}>Comment deleted by its author</div>
                                    <div style={{ color: "#717680", fontWeight: 500, fontSize: 14, paddingBottom: 10 }}>
                                      {new Date(reply.deletedAt || reply.createdAt || Date.now()).toLocaleString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "numeric",
                                      })}
                                    </div>
                                  </>
                                ) : isReplyEditing ? (
                                  <div className="comment-composer" style={{ position: "relative" }}>
                                    <MentionsTagInput
                                      value={editingText}
                                      onChange={setEditingText}
                                      onMentionsChange={setEditingMentions}
                                      placeholder="Edit reply..."
                                      orgId={guestOrgId as string}
                                      user={guestUser}
                                      autoFocusEnd
                                    />
                                    <div style={{ position: "absolute", right: 16, bottom: 12, display: "flex", gap: 8 }}>
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        style={{
                                          background: "#fff",
                                          border: "1px solid #D5D7DA",
                                          padding: "8px 16px",
                                          borderRadius: 60,
                                          cursor: "pointer",
                                          fontSize: 14,
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!editingText.trim()}
                                        onClick={() => saveEditedComment(resolvedReplyIdx)}
                                        style={{
                                          background: !editingText.trim() ? "#E5E7EB" : "#181D27",
                                          color: "#fff",
                                          border: "none",
                                          padding: "8px 16px",
                                          borderRadius: 60,
                                          cursor: !editingText.trim() ? "not-allowed" : "pointer",
                                          fontSize: 14,
                                        }}
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                      <div>
                                        <p style={{ marginBottom: 0, fontWeight: 700, fontSize: 14, color: "#181D27" }}>
                                          {replyCreatedBy.name || "Guest"}
                                        </p>
                                        <div style={{ color: "#717680", fontWeight: 500, fontSize: 14 }}>
                                          <span style={{ textTransform: "capitalize" }}>
                                            {replyCreatedBy.role?.replace("_", " ") || "Guest"}
                                          </span>{" "}
                                          |{" "}
                                          {new Date(reply.createdAt || Date.now()).toLocaleString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "numeric",
                                            minute: "numeric",
                                          })}
                                          {reply.editedAt && <span> | Edited</span>}
                                        </div>
                                      </div>
                                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                        {canEditReply ? (
                                          <>
                                            <i
                                              className="la la-trash text-lg"
                                              title="Delete reply"
                                              style={{ cursor: "pointer", color: "#6B7280" }}
                                              onClick={() => openDeleteModal(resolvedReplyIdx)}
                                            />
                                            <i
                                              className="las la-pencil-alt text-lg"
                                              title="Edit reply"
                                              style={{ cursor: "pointer", color: "#6B7280" }}
                                              onClick={() => startEditComment(reply, resolvedReplyIdx)}
                                            />
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div style={{ marginTop: 12, fontSize: 16, lineHeight: "24px", color: "#181D27" }}>
                                      {renderCommentText(reply.text || reply.comment || reply.feedback)}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {idx < parents.length - 1 && <hr style={{ margin: "12px 0", borderColor: "#EAECF5" }} />}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <span style={{ color: "#6B7280" }}>No comments yet for this candidate.</span>
            </div>
          )}
        </div>
      </Container>

      {deleteModalMounted && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            opacity: deleteModalVisible ? 1 : 0,
            transition: "opacity 220ms ease-in-out",
            pointerEvents: deleteModalVisible ? "auto" : "none",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 470,
              background: "#fff",
              borderRadius: 20,
              padding: "28px 32px 24px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              transform: deleteModalVisible ? "scale(1)" : "scale(0.95)",
              transition: "transform 220ms ease",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src="/delete_swal_comment.svg" alt="delete_svg" />
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827" }}>Delete Comment</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 0 }}>
              <p style={{ marginBottom: 0, fontSize: 15, color: "#4B5563/100", textAlign: "center", fontWeight: 400 }}>
                Are you sure you want to delete this comment?
              </p>
              <p style={{ fontSize: 15, color: "#4B5563/100", textAlign: "center", fontWeight: 400 }}>
                This action cannot be undone.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 4 }}>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                style={{
                  background: "#fff",
                  color: "#111",
                  border: "1px solid #E5E7EB",
                  padding: "10px 26px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  width: "100%",
                  justifyContent: "center",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteComment}
                disabled={deleteLoading}
                style={{
                  background: "#B42318",
                  color: "#fff",
                  border: "none",
                  padding: "10px 26px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                  opacity: deleteLoading ? 0.8 : 1,
                }}
              >
                {deleteLoading && (
                  <span className="la la-spinner" style={{ fontSize: 18, animation: "spin 1s linear infinite" }}></span>
                )}
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
