"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import MentionsTagInput from "@/lib/components/CareerComponents/MentionsTagInput";
import AvatarImage from "../AvatarImage/AvatarImage";
import { api } from "@/lib/utils/apiClient";
import { successToast, errorToast } from "@/lib/Utils";
import { Button } from "../ui";

interface CandidateToolTipCommentProps {
  orgID: string;
  candidateEmail: string | undefined;
  applicationOptions: any[];
  commentViewFilter: string;
  setCommentViewFilter: (v: string) => void;
  selectedApplicationId: string | null;
  setSelectedApplicationId: (v: string | null) => void;
  currentUser?: { email?: string; name?: string; image?: string } | any;
}

export default function CandidateToolTipComment({
  orgID,
  candidateEmail,
  applicationOptions,
  commentViewFilter,
  setCommentViewFilter,
  selectedApplicationId,
  setSelectedApplicationId,
  currentUser,
}: CandidateToolTipCommentProps) {
  const commentUser = useMemo(() => {
    const source = currentUser ?? {};
    const email = (source as any)?.email || (source as any)?.user?.email || (source as any)?.profile?.email || undefined;
    const name = (source as any)?.name || (source as any)?.user?.name || (source as any)?.profile?.name || undefined;
    const image = (source as any)?.image || (source as any)?.user?.image || (source as any)?.profile?.image || (source as any)?.photoURL || undefined;
    return { email, name, image };
  }, [currentUser]);

  const [comments, setComments] = useState<any[]>([]);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [composerText, setComposerText] = useState<string>("");
  const [isPostingComment, setIsPostingComment] = useState<boolean>(false);
  const [composerKey, setComposerKey] = useState<number>(0);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [editingMentions, setEditingMentions] = useState<any[]>([]);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyMentionsMap, setReplyMentionsMap] = useState<Record<string, any[]>>({});
  const [isPostingReply, setIsPostingReply] = useState<boolean>(false);
  const [deleteModalMounted, setDeleteModalMounted] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteCommentIndex, setDeleteCommentIndex] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [commentFilterOpen, setCommentFilterOpen] = useState<boolean>(false);

  // Helper: render comment text and convert serialized mentions into styled spans
  const renderCommentText = (raw: string | undefined | null) => {
    if (!raw) return null as any;
    const parts: React.ReactNode[] = [];
    const regex = /@\[(.+?)\]\((.+?)\)/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(raw))) {
      if (m.index > lastIndex) {
        parts.push(raw.slice(lastIndex, m.index));
      }
      const display = m[1];
      const id = m[2];
      parts.push(
        <span key={`m-${id}-${m.index}`} style={{ color: "#0F62FE", fontWeight: 500 }}>@{display}</span>
      );
      const nextChar = raw.charAt(regex.lastIndex);
      if (nextChar && !/\s|[.,;:!?()]/.test(nextChar)) parts.push(" ");
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < raw.length) parts.push(raw.slice(lastIndex));
    return <>{parts}</>;
  };

  async function getJobOwner(jobId: any) {
    try {
      if (!jobId) return null;
      const careersRes = await api.post("/api/fetch-careers", { orgID });
      const careersArr = careersRes?.data || [];
      const match = careersArr.find((c: any) => c?.id === jobId || String(c?._id) === String(jobId));
      if (match) return match.createdBy || null;
    } catch (error) {
      console.error("getJobOwner error:", error);
    }
    return null;
  }

  useEffect(() => {
    const fetchComments = async () => {
      if (!orgID || !candidateEmail) {
        setComments([]);
        setCommentsCount(0);
        return;
      }
      try {
        if (commentViewFilter === "all") {
          const interviewIDs = (applicationOptions || []).map((o: any) => o.interviewID).filter((id: any) => !!id);
          const uniqueInterviewIDs = Array.from(new Set(interviewIDs.map(String)));
          const requests: Promise<any>[] = [];
          // Candidate-level
          requests.push(
            api.post("/api/fetch-feedback-comment", { orgID, candidateEmail }).then((r) => r?.data).catch(() => null)
          );
          // Application-bound
          uniqueInterviewIDs.forEach((id) => {
            requests.push(
              api.post("/api/fetch-feedback-comment", { orgID, interviewID: id, candidateEmail }).then((r) => r?.data).catch(() => null)
            );
          });
          const responses = await Promise.all(requests);
          let items: any[] = [];
          responses.forEach((raw) => {
            if (!raw) return;
            if (Array.isArray(raw)) items.push(...raw);
            else if (Array.isArray(raw?.items)) items.push(...raw.items);
            else if (Array.isArray(raw?.comments)) items.push(...raw.comments);
            else if (raw?.data && Array.isArray(raw.data)) items.push(...raw.data);
          });
          const normalized = items.map((c: any) => ({
            _id: c._id || c.id,
            text: c.text || c.body || c.comment || "",
            createdBy: c.createdBy || c.user || {
              email: c.userEmail || c.createdByEmail,
              name: c.userName || c.createdByName,
              image: c.userImage || c.createdByImage,
            },
            applicationLabel:
              c.applicationLabel || c.appLabel || (() => {
                if (!c.interviewID) return "Candidate";
                const match = applicationOptions.find((o: any) => String(o.interviewID) === String(c.interviewID));
                return match?.label || "Application";
              })(),
            createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
            edited: !!(c.edited || c.isEdited),
            editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
            parentId: c.parentId || c.parent_id || null,
            interviewID: c.interviewID || c.interviewId || null,
            replies: Array.isArray(c.replies) ? c.replies : [],
            deleted: c.deleted === true || c.deleted === "true" ? true : false,
            deletedAt: c.deletedAt || null,
          }));
          const byId = new Map<string, any>();
          normalized.forEach((n) => {
            const key = String(n._id || JSON.stringify(n));
            if (!byId.has(key)) byId.set(key, n);
          });
          const final = Array.from(byId.values()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setComments(final);
          setCommentsCount(final.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
          return;
        }
        if (commentViewFilter === "candidate") {
          const res = await api.post("/api/fetch-feedback-comment", { orgID, candidateEmail });
          const raw = res?.data;
          let items: any[] = [];
          if (Array.isArray(raw)) items = raw;
          else if (Array.isArray(raw?.items)) items = raw.items;
          else if (Array.isArray(raw?.comments)) items = raw.comments;
          else if (raw?.data && Array.isArray(raw.data)) items = raw.data;
          const normalized = items.map((c: any) => ({
            _id: c._id || c.id,
            text: c.text || c.body || c.comment || "",
            createdBy: c.createdBy || c.user || {
              email: c.userEmail || c.createdByEmail,
              name: c.userName || c.createdByName,
              image: c.userImage || c.createdByImage,
            },
            applicationLabel: "Candidate",
            createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
            edited: !!(c.edited || c.isEdited),
            editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
            parentId: c.parentId || c.parent_id || null,
            interviewID: null,
            replies: Array.isArray(c.replies) ? c.replies : [],
            deleted: c.deleted === true || c.deleted === "true" ? true : false,
            deletedAt: c.deletedAt || null,
          }));
          setComments(normalized);
          setCommentsCount(normalized.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
          return;
        }
        if (!selectedApplicationId) {
          setComments([]);
          setCommentsCount(0);
          return;
        }
        const selectedOpt = applicationOptions.find((o) => o.id === selectedApplicationId);
        const res = await api.post("/api/fetch-feedback-comment", {
          orgID,
          interviewID: selectedOpt?.interviewID,
          candidateEmail,
        });
        const raw = res?.data;
        let items: any[] = [];
        if (Array.isArray(raw)) items = raw;
        else if (Array.isArray(raw?.items)) items = raw.items;
        else if (Array.isArray(raw?.comments)) items = raw.comments;
        else if (raw?.data && Array.isArray(raw.data)) items = raw.data;
        const normalized = items.map((c: any) => ({
          _id: c._id || c.id,
          text: c.text || c.body || c.comment || "",
          createdBy: c.createdBy || c.user || {
            email: c.userEmail || c.createdByEmail,
            name: c.userName || c.createdByName,
            image: c.userImage || c.createdByImage,
          },
          applicationLabel: c.applicationLabel || c.appLabel || selectedOpt?.label || "Application",
          createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
          edited: !!(c.edited || c.isEdited),
          editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
          parentId: c.parentId || c.parent_id || null,
          interviewID: c.interviewID || c.interviewId || selectedOpt?.interviewID || null,
          replies: Array.isArray(c.replies) ? c.replies : [],
          deleted: c.deleted === true || c.deleted === "true" ? true : false,
          deletedAt: c.deletedAt || null,
        }));
        setComments(normalized);
        setCommentsCount(
          normalized.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length
        );
      } catch (e) {
        console.error("Failed to fetch feedback comments:", e);
        setComments([]);
        setCommentsCount(0);
      }
    };
    fetchComments();
  }, [orgID, selectedApplicationId, candidateEmail, applicationOptions, commentViewFilter]);

  const startEditComment = (comment: any) => {
    setEditingCommentId(comment?._id || comment?.id || null);
    setEditingText(comment?.text || comment?.comment || "");
    setEditingMentions(Array.isArray(comment?.mentions) ? comment.mentions : []);
    setReplyingToCommentId(null);
  };
  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditingText("");
    setEditingMentions([]);
  };
  const saveEditedComment = async () => {
    if (!editingCommentId || !editingText.trim()) return;
    return saveEditedCommentWith(editingText.trim(), editingMentions, editingCommentId);
  };

  const isCandidateScopedComment = (c: any, inferredInterviewId?: any) => {
    // In "All" view, candidate comments still show up, but the API requires candidate payload.
    // We infer candidate-scoped if:
    // - backend type is explicitly "candidate", OR
    // - there's no interviewID and the UI label indicates "Candidate".
    if (!c) return false;
    if (String(c?.type || "") === "candidate") return true;
    const noInterview = inferredInterviewId == null || inferredInterviewId === "";
    return noInterview && String(c?.applicationLabel || "") === "Candidate";
  };

  const saveEditedCommentWith = async (newBody: string, newMentionsArr: any[], targetCommentId?: string, targetInterviewId?: any) => {
    const commentId = targetCommentId || editingCommentId;
    if (!commentId || !newBody.trim()) return;
    try {
      // Prefer interviewID from the targeted comment to avoid filter-related mismatches
      const target = comments.find((c) => String(c._id) === String(commentId));
      const inferredInterviewId = targetInterviewId !== undefined ? targetInterviewId : (target?.interviewID ?? undefined);
      const selectedOpt = applicationOptions.find((o) => o.id === selectedApplicationId);
      const updBody: any = {
        orgID,
        commentId,
        newText: newBody.trim(),
        mentions: newMentionsArr || [],
      };

      // IMPORTANT: in "all" view, candidate comments are included and must be updated with candidate payload.
      const candidateScoped = isCandidateScopedComment(target, inferredInterviewId) || commentViewFilter === "candidate";
      if (candidateScoped) {
        updBody.type = "candidate";
        updBody.interviewID = null;
        updBody.candidateEmail = candidateEmail || null;
        if (!updBody.candidateEmail) {
          errorToast("Missing candidate email for this comment", 1600);
          return;
        }
      } else {
        updBody.type = "application";
        updBody.interviewID = (inferredInterviewId ?? selectedOpt?.interviewID);
        if (!updBody.interviewID) {
          errorToast("Missing interview id for this comment", 1600);
          return;
        }
      }

      await api.post("/api/update-feedback-comment", updBody);
      // Refetch after edit: aggregate when viewing "all" to keep the list consistent
      if (commentViewFilter === "all") {
        const interviewIDs = (applicationOptions || [])
          .map((o: any) => o.interviewID)
          .filter((id: any) => !!id);
        const uniqueInterviewIDs = Array.from(new Set(interviewIDs.map(String)));

        const requests: Promise<any>[] = [];
        // Candidate-level comments
        requests.push(
          api.post("/api/fetch-feedback-comment", { orgID, candidateEmail }).then((r) => r?.data).catch(() => null)
        );
        // Application-bound comments per interview
        uniqueInterviewIDs.forEach((id) => {
          requests.push(
            api.post("/api/fetch-feedback-comment", { orgID, interviewID: id, candidateEmail }).then((r) => r?.data).catch(() => null)
          );
        });

        const responses = await Promise.all(requests);
        let items: any[] = [];
        responses.forEach((raw) => {
          if (!raw) return;
          if (Array.isArray(raw)) items.push(...raw);
          else if (Array.isArray(raw?.items)) items.push(...raw.items);
          else if (Array.isArray(raw?.comments)) items.push(...raw.comments);
          else if (raw?.data && Array.isArray(raw.data)) items.push(...raw.data);
        });
        const normalized = items.map((c: any) => ({
          _id: c._id || c.id,
          text: c.text || c.body || c.comment || "",
          createdBy: c.createdBy || c.user || {
            email: c.userEmail || c.createdByEmail,
            name: c.userName || c.createdByName,
            image: c.userImage || c.createdByImage,
          },
          applicationLabel:
            c.applicationLabel || c.appLabel || (() => {
              if (!c.interviewID) return "Candidate";
              const match = applicationOptions.find((o: any) => String(o.interviewID) === String(c.interviewID));
              return match?.label || "Application";
            })(),
          createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
          edited: !!(c.edited || c.isEdited),
          editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
          parentId: c.parentId || c.parent_id || null,
          interviewID: c.interviewID || c.interviewId || null,
          replies: Array.isArray(c.replies) ? c.replies : [],
          deleted: c.deleted === true || c.deleted === "true" ? true : false,
          deletedAt: c.deletedAt || null,
        }));
        const byId = new Map<string, any>();
        normalized.forEach((n) => {
          const key = String(n._id || JSON.stringify(n));
          if (!byId.has(key)) byId.set(key, n);
        });
        const final = Array.from(byId.values()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComments(final);
        setCommentsCount(final.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
      } else {
        const fetchEditedBody: any = { orgID, candidateEmail };
        if (commentViewFilter !== "candidate") fetchEditedBody.interviewID = (inferredInterviewId ?? selectedOpt?.interviewID);
        const res = await api.post("/api/fetch-feedback-comment", fetchEditedBody);
        const raw = res?.data;
        let items: any[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.comments)
          ? raw.comments
          : raw?.data && Array.isArray(raw.data)
          ? raw.data
          : [];
        const normalized = items.map((c: any) => ({
          _id: c._id || c.id,
          text: c.text || c.body || c.comment || "",
          createdBy: c.createdBy || c.user || {
            email: c.userEmail || c.createdByEmail,
            name: c.userName || c.createdByName,
            image: c.userImage || c.createdByImage,
          },
          applicationLabel: (commentViewFilter === "candidate") ? "Candidate" : (c.applicationLabel || c.appLabel || selectedOpt?.label || "Application"),
          createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
          edited: !!(c.edited || c.isEdited),
          editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
          parentId: c.parentId || c.parent_id || null,
          interviewID: (commentViewFilter === "candidate") ? null : (c.interviewID || c.interviewId || selectedOpt?.interviewID || null),
          replies: Array.isArray(c.replies) ? c.replies : [],
          deleted: c.deleted === true || c.deleted === "true" ? true : false,
          deletedAt: c.deletedAt || null,
        }));
        setComments(normalized);
        setCommentsCount(normalized.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
      }
      successToast("Comment updated", 1200);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("candidate-comments-updated"));
      }
    } catch (e) {
      const status = (e as any)?.response?.status;
      const msg = (e as any)?.response?.data?.message || (e as any)?.message || "Unknown error";
      console.error("Failed to save edited comment", status, msg, e);
      errorToast(status ? `Failed (${status}): ${msg}` : `Failed to save comment: ${msg}`, 1600);
    } finally {
      cancelEdit();
    }
  };
  const openDeleteModal = (commentOrIdx: any) => {
    // Accept either an index (legacy) or a comment object, and resolve to an index in the
    // underlying `comments` array (which contains parents + replies).
    const resolvedIdx =
      typeof commentOrIdx === "number"
        ? commentOrIdx
        : comments.findIndex((c) => String(c?._id) === String(commentOrIdx?._id));
    if (resolvedIdx < 0 || resolvedIdx >= comments.length) return;
    const target = comments[resolvedIdx];
    if (!target?._id) return;
    setDeleteCommentIndex(resolvedIdx);
    setDeleteModalMounted(true);
    setTimeout(() => {
      setDeleteModalVisible(true);
    }, 12);
  };
  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setDeleteCommentIndex(null);
    setDeleteLoading(false);
    setTimeout(() => setDeleteModalMounted(false), 200);
  };
  const confirmDeleteComment = async () => {
    if (deleteCommentIndex === null) return;
    if (deleteLoading) return;
    const target = comments[deleteCommentIndex];
    setDeleteLoading(true);
    try {
      const selectedOpt = applicationOptions.find((o) => o.id === selectedApplicationId);
      // Preserve explicit null interviewID for candidate-scoped comments in "All" view.
      // Using `??` would incorrectly fall back to selectedOpt.interviewID when target.interviewID is null.
      const inferredInterviewId = target?.interviewID === undefined ? selectedOpt?.interviewID : target?.interviewID;
      const delBody: any = { orgID, commentId: target?._id };

      // IMPORTANT: in "all" view, candidate comments are included and must be deleted with candidate payload.
      const candidateScoped = isCandidateScopedComment(target, inferredInterviewId) || commentViewFilter === "candidate";
      if (candidateScoped) {
        delBody.type = "candidate";
        delBody.interviewID = null;
        delBody.candidateEmail = candidateEmail || null;
        if (!delBody.candidateEmail) {
          errorToast("Missing candidate email for this comment", 1600);
          setDeleteLoading(false);
          return;
        }
      } else {
        // When viewing "all", selectedApplicationId may be null — prefer the comment's own interviewID
        delBody.type = "application";
        if (inferredInterviewId) {
          delBody.interviewID = inferredInterviewId;
        }
        if (!delBody.interviewID) {
          errorToast("Missing interview id for this comment", 1600);
          setDeleteLoading(false);
          return;
        }
      }

      await api.post("/api/delete-feedback-comment", delBody);
      setComments((prev) => prev.map((c, i) => (i === deleteCommentIndex ? { ...c, deleted: true, deletedAt: new Date().toISOString() } : c)));
      setCommentsCount((prev) => Math.max(0, prev - 1));
      // Close modal immediately on success to prevent accidental double-submit (server returns 409 on second try).
      closeDeleteModal();
      try {
        if (commentViewFilter === "all") {
          // Re-run the aggregated fetch (candidate-level + per-interview) so "All" view stays consistent
          const interviewIDs = (applicationOptions || []).map((o: any) => o.interviewID).filter((id: any) => !!id);
          const uniqueInterviewIDs = Array.from(new Set(interviewIDs.map(String)));
          const requests: Promise<any>[] = [];
          // Candidate-level
          requests.push(api.post("/api/fetch-feedback-comment", { orgID, candidateEmail }).then((r) => r?.data).catch(() => null));
          uniqueInterviewIDs.forEach((id) => {
            requests.push(api.post("/api/fetch-feedback-comment", { orgID, interviewID: id, candidateEmail }).then((r) => r?.data).catch(() => null));
          });
          const responses = await Promise.all(requests);
          let items: any[] = [];
          for (const raw of responses) {
            if (!raw) continue;
            if (Array.isArray(raw)) items.push(...raw);
            else if (Array.isArray(raw?.items)) items.push(...raw.items);
            else if (Array.isArray(raw?.comments)) items.push(...raw.comments);
            else if (raw?.data && Array.isArray(raw.data)) items.push(...raw.data);
          }
          const normalized = items.map((c: any) => ({
            _id: c._id || c.id,
            text: c.text || c.body || c.comment || "",
            createdBy: c.createdBy || c.user || {
              email: c.userEmail || c.createdByEmail,
              name: c.userName || c.createdByName,
              image: c.userImage || c.createdByImage,
            },
            applicationLabel:
              c.applicationLabel || c.appLabel || (() => {
                if (!c.interviewID) return "Candidate";
                const match = applicationOptions.find((o: any) => String(o.interviewID) === String(c.interviewID));
                return match?.label || "Application";
              })(),
            createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
            edited: !!(c.edited || c.isEdited),
            editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
            parentId: c.parentId || c.parent_id || null,
            interviewID: c.interviewID || c.interviewId || null,
            replies: Array.isArray(c.replies) ? c.replies : [],
            deleted: c.deleted === true || c.deleted === "true" ? true : false,
            deletedAt: c.deletedAt || null,
          }));
          const byId = new Map<string, any>();
          normalized.forEach((n) => {
            const key = String(n._id || JSON.stringify(n));
            if (!byId.has(key)) byId.set(key, n);
          });
          const final = Array.from(byId.values()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setComments(final);
          setCommentsCount(final.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
        } else {
          const res = await api.post("/api/fetch-feedback-comment", ((): any => {
            const body: any = { orgID, candidateEmail };
            if (commentViewFilter !== "candidate" && inferredInterviewId) body.interviewID = inferredInterviewId;
            return body;
          })());
          const raw = res?.data;
          let items: any[] = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.items)
            ? raw.items
            : Array.isArray(raw?.comments)
            ? raw.comments
            : raw?.data && Array.isArray(raw.data)
            ? raw.data
            : [];
          const normalized = items.map((c: any) => ({
            _id: c._id || c.id,
            text: c.text || c.body || c.comment || "",
            createdBy: c.createdBy || c.user || {
              email: c.userEmail || c.createdByEmail,
              name: c.userName || c.createdByName,
              image: c.userImage || c.createdByImage,
            },
            applicationLabel: (commentViewFilter === "candidate") ? "Candidate" : (c.applicationLabel || c.appLabel || selectedOpt?.label || "Application"),
            createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
            edited: !!(c.edited || c.isEdited),
            editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
            parentId: c.parentId || c.parent_id || null,
            interviewID: c.interviewID || c.interviewId || (commentViewFilter === "candidate" ? null : selectedOpt?.interviewID) || null,
            replies: Array.isArray(c.replies) ? c.replies : [],
            deleted: c.deleted === true || c.deleted === "true" ? true : false,
            deletedAt: c.deletedAt || null,
          }));
          setComments(normalized);
          setCommentsCount(normalized.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
        }
        successToast("Comment deleted", 1200);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("candidate-comments-updated"));
        }
      } catch (inner) {
        const status = (inner as any)?.response?.status;
        const msg = (inner as any)?.response?.data?.message || (inner as any)?.message || "Unknown error";
        console.error("Refetch after delete failed", status, msg, inner);
      }
      closeDeleteModal();
    } catch (err) {
      const delStatus = (err as any)?.response?.status || (err as any)?.status;
      if (delStatus === 409) {
        setComments((prev) => prev.map((c, i) => (i === deleteCommentIndex ? { ...c, deleted: true, deletedAt: c?.deletedAt || new Date().toISOString() } : c)));
        setCommentsCount((prev) => Math.max(0, prev - 1));
        closeDeleteModal();
        return;
      }
      const status2 = (err as any)?.response?.status;
      const msg = (err as any)?.response?.data?.message || (err as any)?.message || "Unknown error";
      console.error("Failed to delete comment", status2, msg, err);
      setDeleteLoading(false);
    }
  };

  const postComment = async () => {
    if (!composerText.trim() || !commentUser?.email) return;
    // When viewing "All comments", default to the current/active application
    // so the new comment is associated with the current career.
    try {
      setIsPostingComment(true);
      const selectedOpt = (() => {
        if (selectedApplicationId) {
          return applicationOptions.find((o) => o.id === selectedApplicationId);
        }
        if (commentViewFilter === "all" || commentViewFilter === "candidate") {
          // Try to infer the current application. Prefer any flag like `isCurrent`/`active`/`current` if present.
          const byFlag = applicationOptions.find((o: any) => o.isCurrent || o.active || o.current);
          if (byFlag) return byFlag;
          // Prefer the first option that actually has an interviewID
          const withInterviewId = applicationOptions.find((o: any) => !!o?.interviewID);
          if (withInterviewId) return withInterviewId;
          // Fallback to the first application option if available.
          return applicationOptions[0];
        }
        return applicationOptions.find((o) => o.id === commentViewFilter);
      })();
      // When no application context exists (e.g., on Candidates page), fall back to candidate-level comment
      const shouldPostAsCandidateLevel = commentViewFilter === "candidate" || (!selectedOpt || !selectedOpt?.interviewID);
      const applicationLabel = shouldPostAsCandidateLevel ? "Candidate" : (selectedOpt?.label || "Application");
      let resolvedRole: string = "Contributor";
      try {
        // Resolve job owner even for candidate-scoped comments using the current application/career context.
        const careerOwner = await getJobOwner(selectedOpt?.id);
        const ownerEmail = typeof careerOwner === "string" ? careerOwner : careerOwner?.email;
        const authorEmail = commentUser?.email || null;
        const isOwner = ownerEmail && authorEmail && String(ownerEmail).toLowerCase() === String(authorEmail).toLowerCase();
        if (isOwner) resolvedRole = "Job Owner";
      } catch {
        console.warn("Failed to resolve job owner for comment role");
      }
      const payload: any = {
        orgID,
        candidateEmail,
        comment: composerText.trim(),
        mentions: [],
        createdBy: {
          email: commentUser.email,
          name: commentUser.name,
          image: commentUser.image,
          role: resolvedRole,
        },
        createdAt: new Date().toISOString(),
        applicationLabel,
      };
      if (!shouldPostAsCandidateLevel) {
        payload.type = "application";
        payload.interviewID = selectedOpt?.interviewID;
        // Do not send candidateEmail for application-scoped comments to satisfy API expectations
        delete payload.candidateEmail;
      } else {
        payload.type = "candidate";
        // Ensure interviewID is not present for candidate comments
        delete payload.interviewID;
      }
      // Explicitly send parentId for top-level comments to satisfy backend schema
      if (!payload.parentId) payload.parentId = null;
      const optimistic = { ...payload, _id: `optimistic-${Date.now()}`, edited: false };
      setComments((prev) => [optimistic, ...prev]);
      setCommentsCount((prev) => prev + 1);
      await api.post("/api/add-feedback-comment", payload);
      setComposerText("");
      setComposerKey((k) => k + 1); // force reset MentionsTagInput state
      // Refetch: if viewing 'all', aggregate candidate-level and all application interviews
      if (commentViewFilter === "all") {
        const interviewIDs = (applicationOptions || []).map((o: any) => o.interviewID).filter((id: any) => !!id);
        const uniqueInterviewIDs = Array.from(new Set(interviewIDs.map(String)));
        const requests: Promise<any>[] = [];
        // Candidate-level
        requests.push(
          api.post("/api/fetch-feedback-comment", { orgID, candidateEmail }).then((r) => r?.data).catch(() => null)
        );
        // Application-bound
        uniqueInterviewIDs.forEach((id) => {
          requests.push(
            api.post("/api/fetch-feedback-comment", { orgID, interviewID: id, candidateEmail }).then((r) => r?.data).catch(() => null)
          );
        });
        const responses = await Promise.all(requests);
        let items: any[] = [];
        responses.forEach((raw) => {
          if (!raw) return;
          if (Array.isArray(raw)) items.push(...raw);
          else if (Array.isArray(raw?.items)) items.push(...raw.items);
          else if (Array.isArray(raw?.comments)) items.push(...raw.comments);
          else if (raw?.data && Array.isArray(raw.data)) items.push(...raw.data);
        });
        const normalized = items.map((c: any) => ({
          _id: c._id || c.id,
          text: c.text || c.body || c.comment || "",
          createdBy: c.createdBy || c.user || {
            email: c.userEmail || c.createdByEmail,
            name: c.userName || c.createdByName,
            image: c.userImage || c.createdByImage,
          },
          applicationLabel:
            c.applicationLabel || c.appLabel || (() => {
              if (!c.interviewID) return "Candidate";
              const match = applicationOptions.find((o: any) => String(o.interviewID) === String(c.interviewID));
              return match?.label || "Application";
            })(),
          createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
          edited: !!(c.edited || c.isEdited),
          editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
          parentId: c.parentId || c.parent_id || null,
          interviewID: c.interviewID || c.interviewId || null,
          replies: Array.isArray(c.replies) ? c.replies : [],
          deleted: c.deleted === true || c.deleted === "true" ? true : false,
          deletedAt: c.deletedAt || null,
        }));
        const byId = new Map<string, any>();
        normalized.forEach((n) => {
          const key = String(n._id || JSON.stringify(n));
          if (!byId.has(key)) byId.set(key, n);
        });
        const final = Array.from(byId.values()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComments(final);
        setCommentsCount(final.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
      } else {
        const fetchBody: any = { orgID, candidateEmail };
        if (commentViewFilter !== "candidate") fetchBody.interviewID = selectedOpt?.interviewID;
        const res = await api.post("/api/fetch-feedback-comment", fetchBody);
        const raw = res?.data;
        let items: any[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.comments)
          ? raw.comments
          : raw?.data && Array.isArray(raw.data)
          ? raw.data
          : [];
        const normalized = items.map((c: any) => ({
          _id: c._id || c.id,
          text: c.text || c.body || c.comment || "",
          createdBy: c.createdBy || c.user || {
            email: c.userEmail || c.createdByEmail,
            name: c.userName || c.createdByName,
            image: c.userImage || c.createdByImage,
          },
          applicationLabel: c.applicationLabel || c.appLabel || applicationLabel,
          createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
          edited: !!(c.edited || c.isEdited),
          editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
          parentId: c.parentId || c.parent_id || null,
          interviewID: c.interviewID || c.interviewId || (commentViewFilter === "candidate" ? null : selectedOpt?.interviewID) || null,
          replies: Array.isArray(c.replies) ? c.replies : [],
          deleted: c.deleted === true || c.deleted === "true" ? true : false,
          deletedAt: c.deletedAt || null,
        }));
        setComments(normalized);
        setCommentsCount(normalized.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
      }
      successToast("Comment posted", 1200);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("candidate-comments-updated"));
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("candidate-comments-updated"));
      }
    } catch (e) {
      const status = (e as any)?.response?.status;
      const msg = (e as any)?.response?.data?.message || (e as any)?.message || "Unknown error";
      console.error("Failed to add feedback comment:", status, msg, e);
      errorToast(status ? `Failed (${status}): ${msg}` : `Failed to post comment: ${msg}`, 1600);
    } finally {
      setIsPostingComment(false);
    }
  };

  const postReply = async (parentId: string, overrideText?: string, overrideMentions?: any[]) => {
    const text = ((overrideText !== undefined ? overrideText : replyDrafts[parentId]) || "").trim();
    const mentions = overrideMentions ?? (replyMentionsMap[parentId] || []);
    if (!text || !commentUser?.email) return;
    try {
      setIsPostingReply(true);
      const selectedOpt = (() => {
        if (selectedApplicationId) return applicationOptions.find((o) => o.id === selectedApplicationId);
        // Candidate view doesn't map to an application option, so infer a context for role resolution.
        const byFlag = applicationOptions.find((o: any) => o.isCurrent || o.active || o.current);
        if (byFlag) return byFlag;
        const withInterviewId = applicationOptions.find((o: any) => !!o?.interviewID);
        if (withInterviewId) return withInterviewId;
        return applicationOptions[0];
      })();

      // Infer interviewID from the parent comment when available (important for 'all' view)
      const parentComment = comments.find((c) => String(c._id) === String(parentId));
      // Preserve explicit null (candidate-scoped) rather than falling back to a selected application.
      // IMPORTANT: do NOT use `??` here because `null` is meaningful (candidate-scoped).
      const parentInterviewRaw =
        parentComment?.interviewID !== undefined ? parentComment?.interviewID : parentComment?.interviewId;
      const inferredInterviewId = parentInterviewRaw === undefined ? selectedOpt?.interviewID : parentInterviewRaw;
      const parentIsCandidate =
        String(parentComment?.type || "") === "candidate" ||
        String(parentComment?.applicationLabel || "") === "Candidate" ||
        parentInterviewRaw === null ||
        inferredInterviewId == null;

      // Resolve role (Job Owner vs Contributor) using current application/career context.
      let resolvedRole: string = "Contributor";
      try {
        const careerOwner = await getJobOwner(selectedOpt?.id);
        const ownerEmail = typeof careerOwner === "string" ? careerOwner : careerOwner?.email;
        const authorEmail = commentUser?.email || null;
        const isOwner = ownerEmail && authorEmail && String(ownerEmail).toLowerCase() === String(authorEmail).toLowerCase();
        if (isOwner) resolvedRole = "Job Owner";
      } catch {
        // ignore
      }

      const replyPayload: any = {
        orgID,
        candidateEmail,
        comment: text,
        parentId,
        mentions,
        createdBy: {
          email: commentUser.email,
          name: commentUser.name,
          image: commentUser.image,
          role: resolvedRole,
        },
        createdAt: new Date().toISOString(),
      };

      // IMPORTANT: Reply type must match the parent comment type (candidate vs application),
      // not just the current filter. "All" view includes both kinds.
      const shouldBeCandidate = commentViewFilter === "candidate" || parentIsCandidate;
      if (!shouldBeCandidate) {
        if (inferredInterviewId) {
          replyPayload.interviewID = inferredInterviewId;
        } else {
          const anyWithInterview = applicationOptions.find((o: any) => !!o?.interviewID);
          if (anyWithInterview) replyPayload.interviewID = anyWithInterview.interviewID;
          else {
            errorToast("No interview/application context found for reply", 1800);
            setIsPostingReply(false);
            return;
          }
        }
        replyPayload.type = "application";
        // Do not send candidateEmail for application-scoped comments to satisfy API expectations
        delete replyPayload.candidateEmail;
      } else {
        replyPayload.type = "candidate";
        replyPayload.interviewID = null;
        if (!candidateEmail) {
          errorToast("Missing candidate email for reply", 1800);
          setIsPostingReply(false);
          return;
        }
      }

      await api.post("/api/add-feedback-comment", replyPayload);

      // Refresh comments: re-run aggregated fetch for 'all', otherwise single-scope fetch
      if (commentViewFilter === "all") {
        const interviewIDs = (applicationOptions || []).map((o: any) => o.interviewID).filter((id: any) => !!id);
        const uniqueInterviewIDs = Array.from(new Set(interviewIDs.map(String)));
        const requests: Promise<any>[] = [];
        requests.push(api.post("/api/fetch-feedback-comment", { orgID, candidateEmail }).then((r) => r?.data).catch(() => null));
        uniqueInterviewIDs.forEach((id) => {
          requests.push(api.post("/api/fetch-feedback-comment", { orgID, interviewID: id, candidateEmail }).then((r) => r?.data).catch(() => null));
        });
        const responses = await Promise.all(requests);
        let items: any[] = [];
        for (const raw of responses) {
          if (!raw) continue;
          if (Array.isArray(raw)) items.push(...raw);
          else if (Array.isArray(raw?.items)) items.push(...raw.items);
          else if (Array.isArray(raw?.comments)) items.push(...raw.comments);
          else if (raw?.data && Array.isArray(raw.data)) items.push(...raw.data);
        }
        const normalized = items.map((c: any) => ({
          _id: c._id || c.id,
          text: c.text || c.body || c.comment || "",
          createdBy: c.createdBy || c.user || {
            email: c.userEmail || c.createdByEmail,
            name: c.userName || c.createdByName,
            image: c.userImage || c.createdByImage,
          },
          applicationLabel:
            c.applicationLabel || c.appLabel || (() => {
              if (!c.interviewID) return "Candidate";
              const match = applicationOptions.find((o: any) => String(o.interviewID) === String(c.interviewID));
              return match?.label || "Application";
            })(),
          createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
          edited: !!(c.edited || c.isEdited),
          editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
          parentId: c.parentId || c.parent_id || null,
          interviewID: c.interviewID || c.interviewId || null,
          replies: Array.isArray(c.replies) ? c.replies : [],
          deleted: c.deleted === true || c.deleted === "true" ? true : false,
          deletedAt: c.deletedAt || null,
        }));
        const byId = new Map<string, any>();
        normalized.forEach((n) => {
          const key = String(n._id || JSON.stringify(n));
          if (!byId.has(key)) byId.set(key, n);
        });
        const final = Array.from(byId.values()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComments(final);
        setCommentsCount(final.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
      } else {
        const replyFetchBody: any = { orgID, candidateEmail };
        if (commentViewFilter !== "candidate") replyFetchBody.interviewID = inferredInterviewId ?? selectedOpt?.interviewID;
        const res = await api.post("/api/fetch-feedback-comment", replyFetchBody);
        const raw = res?.data;
        let items: any[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.comments)
          ? raw.comments
          : raw?.data && Array.isArray(raw.data)
          ? raw.data
          : [];
        const normalized = items.map((c: any) => ({
          _id: c._id || c.id,
          text: c.text || c.body || c.comment || "",
          createdBy: c.createdBy || c.user || {
            email: c.userEmail || c.createdByEmail,
            name: c.userName || c.createdByName,
            image: c.userImage || c.createdByImage,
          },
          applicationLabel: (commentViewFilter === "candidate") ? "Candidate" : (c.applicationLabel || c.appLabel || selectedOpt?.label || "Application"),
          createdAt: c.createdAt || c.created_date || c.created || new Date().toISOString(),
          edited: !!(c.edited || c.isEdited),
          editedAt: c.editedAt || c.updatedAt || c.lastEditedAt || null,
          parentId: c.parentId || c.parent_id || null,
          interviewID: c.interviewID || c.interviewId || (commentViewFilter === "candidate" ? null : selectedOpt?.interviewID) || null,
          replies: Array.isArray(c.replies) ? c.replies : [],
          deleted: c.deleted === true || c.deleted === "true" ? true : false,
          deletedAt: c.deletedAt || null,
        }));
        setComments(normalized);
        setCommentsCount(normalized.filter((it: any) => !(it?.deleted === true || it?.deleted === "true" || !!it?.deletedAt)).length);
      }
      successToast("Reply posted", 1200);
    } catch (e) {
      console.error("Failed to post reply", e);
      errorToast("Failed to post reply", 1400);
    } finally {
      setIsPostingReply(false);
      setReplyingToCommentId(null);
      setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
      setReplyMentionsMap((prev) => ({ ...prev, [parentId]: [] }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("candidate-comments-updated"));
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("candidate-comments-updated"));
      }
    }
  };

  const { parents, repliesByParent } = useMemo(() => {
    const parents: any[] = [];
    const repliesByParent: Record<string, any[]> = {};
    comments.forEach((c: any) => {
      const pid = c.parentId || c.parent_id || null;
      if (pid) {
        const key = String(pid);
        if (!repliesByParent[key]) repliesByParent[key] = [];
        repliesByParent[key].push(c);
      } else {
        parents.push(c);
      }
    });
    return { parents, repliesByParent };
  }, [comments]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <i className="la la-comment" style={{ color: "#A4A7AE", fontSize: 20 }}></i>
          <span style={{ color: "#717680", fontSize: 14, fontWeight: 600, padding: "2px 10px", minWidth: 20 }}>
            {commentsCount} comments
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setCommentFilterOpen((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#fff",
              border: "1px solid #ffffff",
              borderRadius: 10,
              fontWeight: 700,
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: 14,
              fontStyle: "bold",
              color: "#535862",
              outline: "none",
              boxShadow: "none",
            }}
          >
            <span>Show comments on:</span>
            <strong>{commentViewFilter === "all" ? "All comments" : (commentViewFilter === "candidate" ? "Candidate" : applicationOptions.find((o) => o.id === commentViewFilter)?.label || "Candidate")}</strong>
            <i className="la la-angle-down" style={{ fontSize: 14 }}></i>
          </button>
          {commentFilterOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", border: "1px solid #E9EAEB", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", padding: 8, minWidth: 220, zIndex: 6000 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <button className="comment-filter-option" onClick={() => { setCommentViewFilter("all"); setCommentFilterOpen(false); }} style={{ textAlign: "left", background: "transparent", border: "none", padding: "8px 10px", cursor: "pointer", color: "#111827", borderRadius: 8 }}>All comments</button>
                <button className="comment-filter-option" onClick={() => { setCommentViewFilter("candidate"); setSelectedApplicationId(null); setCommentFilterOpen(false); }} style={{ textAlign: "left", background: "transparent", border: "none", padding: "8px 10px", cursor: "pointer", color: "#111827", borderRadius: 8 }}>Candidate</button>
                {applicationOptions.filter((opt) => String(opt.id) !== 'candidate').map((opt) => (
                  <button className="comment-filter-option" key={`flt-${opt.id}`} onClick={() => { setCommentViewFilter(opt.id); setSelectedApplicationId(opt.id); setCommentFilterOpen(false); }} style={{ textAlign: "left", background: "transparent", border: "none", padding: "8px 10px", cursor: "pointer", color: "#111827", borderRadius: 8 }}>{opt.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        /* Remove focus ring for mouse users, keep for keyboard users (accessibility) */
        button:focus:not(:focus-visible) {
          outline: none !important;
          box-shadow: none !important;
        }

        /* Hover states for dropdown options */
        .comment-filter-option:hover {
          background: #F8F9FC !important;
        }
        .comment-filter-option:active {
          background: #EEF2FF !important;
        }
      `}</style>

      {/* Composer */}
      <div style={{ padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <img src={commentUser?.image || "/default-avatar.png"} alt={commentUser?.name || "You"} style={{ width: 40, height: 40, borderRadius: 999 }} />
          <div style={{ flex: 1, position: "relative", overflow: "visible", zIndex: 5000 }}>
            <div className="comment-composer" style={{ position: "relative", overflow: "visible" }}>
              <MentionsTagInput
                key={composerKey}
                placeholder="Write a comment about this candidate…"
                orgId={orgID}
                user={commentUser}
                value={composerText}
                onChange={(val: string) => setComposerText(val)}
                onMentionsChange={() => {}}
              />
              <Button
                variant="primary"
                style={{ position: "absolute", right: 16, bottom: 16, borderRadius: 60, border: "none", padding: "9px 16px", fontSize: 14, color: "#fff", background: !composerText.trim() || isPostingComment || !commentUser?.email ? "#D5D7DA" : "#181D27", display: "flex", alignItems: "center", cursor: !composerText.trim() || isPostingComment || !commentUser?.email ? "not-allowed" : "pointer" }}
                disabled={!composerText.trim() || isPostingComment || !commentUser?.email}
                onClick={postComment}
                label={isPostingComment ? "Posting..." : "Post"}
                icon="/paper-plane.svg"
              >
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div
        style={{
          padding: "8px 16px 40px 16px", // extra bottom space so the last comment can scroll fully into view
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "visible",
        }}
      >
        {comments && comments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {parents
              .filter((p: any) => {
                if (commentViewFilter === "all") return true;
                if (commentViewFilter === "candidate") return String(p.applicationLabel) === "Candidate";
                const selected = applicationOptions.find((o) => o.id === commentViewFilter);
                return String(p.applicationLabel) === String(selected?.label);
              })
              .map((p: any, idx: number) => {
                const parentKey = String(p._id);
                const isEditing = !!p._id && editingCommentId === p._id;
                const isParentDeleted = p.deleted === true || p.deleted === "true" || !!p.deletedAt;
                const authorEmail = typeof p.createdBy === "string" ? p.createdBy : (p.createdBy?.email || "");
                const canEdit = !!p._id && !!commentUser?.email && (commentUser.email.toLowerCase() === authorEmail.toLowerCase()) && !isParentDeleted;
                const children = (repliesByParent[String(p._id)] || []).filter((c: any) => {
                  if (commentViewFilter === "all") return true;
                  if (commentViewFilter === "candidate") return String(c.applicationLabel) === "Candidate";
                  const selected = applicationOptions.find((o) => o.id === commentViewFilter);
                  return String(c.applicationLabel) === String(selected?.label);
                });

                return (
                  <React.Fragment key={parentKey}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingTop: 8 }}>
                      {isParentDeleted ? (
                        <div style={{ width: 40, height: 40, backgroundColor: "#F8F9FC", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <i className="las la-user text-xl"></i>
                        </div>
                      ) : (
                        <div style={{ width: 40 }}>
                          <AvatarImage src={p.createdBy?.image} alt={p.createdBy?.name || "User"} />
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        {isParentDeleted ? (
                          <>
                            <div style={{ fontStyle: "italic", color: "#6B7280" }}>Comment deleted by its author</div>
                            <div style={{ color: "#717680", fontWeight: 500, fontSize: "14px", paddingBottom: 10 }}>
                              {new Date(p.deletedAt || p.createdAt || Date.now()).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "numeric" })}
                            </div>
                          </>
                        ) : isEditing ? (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <div>
                                <strong>{p.createdBy?.name || p.createdByName || "Contributor"}</strong>
                                <div style={{ fontSize: 12, color: "#6B7280" }}>
                                  <span>You are editing a comment</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ flex: 1 }}>
                              <div className="comment-composer" style={{ position: "relative", overflow: "visible" }}>
                                <MentionsTagInput
                                  key={`edit-${p._id}`}
                                  value={editingText}
                                  onChange={setEditingText}
                                  onMentionsChange={setEditingMentions}
                                  placeholder="Edit comment..."
                                  orgId={orgID}
                                  user={commentUser}
                                  autoFocusEnd
                                />
                                <div style={{ position: "absolute", right: 16, bottom: 12, display: "flex", gap: 8, zIndex: 10, pointerEvents: "auto" }}>
                                  <button onClick={cancelEdit} style={{ background: "#fff", border: "1px solid #D5D7DA", padding: "8px 16px", borderRadius: 60, cursor: "pointer", fontSize: 14 }}>Cancel</button>
                                  <button
                                    disabled={!editingText.trim()}
                                    onClick={() => {
                                      // Defer to ensure the latest keystroke/mentions propagate before saving
                                      setTimeout(() => {
                                        requestAnimationFrame(() =>
                                          saveEditedCommentWith(editingText.trim(), editingMentions, String(p._id), p.interviewID)
                                        );
                                      }, 0);
                                    }}
                                    style={{ background: !editingText.trim() ? "#E5E7EB" : "#181D27", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 60, cursor: !editingText.trim() ? "not-allowed" : "pointer", fontSize: 14 }}
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <div>
                                <p style={{ marginBottom: 0, fontWeight: 700, fontSize: "14px", color: "#181D27" }}>
                                  {p.createdBy?.name || p.createdByName || "Contributor"}
                                  {p.applicationLabel && (
                                    <span style={{ marginLeft: 6, fontWeight: 300, color: "#717680" }}>
                                      {" "}on{" "}
                                      <span style={{ fontWeight: 500, borderBottom: "1px solid #717680" }}>{p.applicationLabel}</span>
                                      {String(p.applicationLabel) === "Candidate" ? null : <>{" "}application</>}
                                    </span>
                                  )}
                                </p>
                                <div style={{ color: "#717680", fontWeight: 500, fontSize: "14px" }}>
                                  <span style={{ textTransform: "capitalize" }}>{p.createdBy?.role?.replace("_", " ")}</span> | {new Date(p.createdAt || Date.now()).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "numeric" })}
                                  {p.editedAt && (() => {
                                    const editedDate = new Date(p.editedAt);
                                    const time = (Date.now() - editedDate.getTime()) / 1000;
                                    let label = "Edited";
                                    if (time <= 60) {
                                      label = "Edited just now";
                                    } else if (time < 3600) {
                                      label = `Edited ${Math.floor(time / 60)}m ago`;
                                    }
                                    return <span> | {label}</span>;
                                  })()}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                {canEdit ? (
                                  <>
                                    <i className="la la-trash text-lg" title="Delete comment" style={{ cursor: "pointer", color: "#6B7280" }} onClick={() => openDeleteModal(p)} />
                                    <i className="las la-pencil-alt text-lg" title="Edit comment" style={{ cursor: "pointer", color: "#6B7280" }} onClick={() => startEditComment(p)} />
                                  </>
                                ) : (
                                  <i className="la la-reply text-lg" title="Reply" style={{ cursor: "pointer", color: "#6B7280" }} onClick={() => setReplyingToCommentId(p._id)} />
                                )}
                              </div>
                            </div>

                            <div style={{ marginTop: 6, fontSize: "16px", lineHeight: "24px", color: "#181D27", paddingBottom: 10 }}>{renderCommentText(p.text || p.comment || p.feedback)}</div>

                            {replyingToCommentId === p._id && (
                              <div style={{ marginTop: 12, marginLeft: 32 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, paddingBottom: 10 }}>
                                  <i className="las la-undo" style={{ transform: "scaleX(-1) scaleY(-1)", display: "inline-block", fontSize: "14px", color: "#A4A7AE" }}></i>
                                  <p style={{ margin: 0, fontSize: "14px", color: "#A4A7AE", fontWeight: "500", lineHeight: "20px" }}>Replying to {p.createdBy?.name || p.createdByName || "Contributor"}</p>
                                </div>
                                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                  <div style={{ width: 32 }}>
                                    <AvatarImage src={commentUser?.image} alt={commentUser?.name || "You"} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div className="comment-composer" style={{ position: "relative", overflow: "visible" }}>
                                      <MentionsTagInput
                                        key={`reply-${String(p._id)}`}
                                        value={replyDrafts[String(p._id)] || ""}
                                        onChange={(val) => setReplyDrafts((prev) => ({ ...prev, [String(p._id)]: val }))}
                                        onMentionsChange={(mnts) => setReplyMentionsMap((prev) => ({ ...prev, [String(p._id)]: mnts }))}
                                        placeholder="Write a reply ..."
                                        orgId={orgID}
                                        user={commentUser}
                                        autoFocusEnd
                                      />
                                      <div style={{ position: "absolute", right: 16, bottom: 12, display: "flex", gap: 8, zIndex: 10, pointerEvents: "auto" }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReplyingToCommentId(null);
                                            setReplyDrafts((prev) => ({ ...prev, [String(p._id)]: "" }));
                                            setReplyMentionsMap((prev) => ({ ...prev, [String(p._id)]: [] }));
                                          }}
                                          style={{ background: "#fff", border: "1px solid #D5D7DA", padding: "8px 16px", borderRadius: 60, cursor: "pointer", fontSize: 14 }}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={!((replyDrafts[String(p._id)] || "").trim()) || isPostingReply}
                                          onClick={() => postReply(String(p._id))}
                                          style={{
                                            background: !((replyDrafts[String(p._id)] || "").trim()) || isPostingReply ? "#E5E7EB" : "#181D27",
                                            color: "#fff",
                                            border: "none",
                                            padding: "8px 16px",
                                            borderRadius: 60,
                                            cursor: !((replyDrafts[String(p._id)] || "").trim()) || isPostingReply ? "not-allowed" : "pointer",
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
                        {children.map((r: any, childIdx: number) => {
                          const replyKey = String(r._id);
                          const isReplyEditing = !!r._id && editingCommentId === r._id;
                          const isReplyDeleted = r.deleted === true || r.deleted === "true" || !!r.deletedAt;
                          const replyAuthorEmail = typeof r.createdBy === "string" ? r.createdBy : (r.createdBy?.email || "");
                          const canEditReply = !!r._id && !!commentUser?.email && (commentUser.email.toLowerCase() === replyAuthorEmail.toLowerCase()) && !isReplyDeleted;

                          return (
                            <div key={replyKey} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
                              {isReplyDeleted ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 4, paddingBottom: 10 }}>
                                  <i className="las la-undo" style={{ transform: "scaleX(-1) scaleY(-1)", display: "inline-block", fontSize: "14px", color: "#A4A7AE" }}></i>
                                  <div style={{ width: 32, height: 32, backgroundColor: "#F8F9FC", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <i className="las la-user text-lg"></i>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <i className="las la-undo" style={{ transform: "scaleX(-1) scaleY(-1)", display: "inline-block", fontSize: "16px", color: "#A4A7AE", marginBottom: 5 }}></i>
                                  <AvatarImage src={r.createdBy?.image} alt={r.createdBy?.name || "User"} />
                                </div>
                              )}
                              <div style={{ flex: 1 }}>
                                {isReplyDeleted ? (
                                  <>
                                    <div style={{ fontStyle: "italic", color: "#6B7280" }}>Comment deleted by its author</div>
                                    <div style={{ color: "#717680", fontWeight: 500, fontSize: "14px", paddingBottom: 10 }}>{new Date(r.deletedAt || r.createdAt || Date.now()).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "numeric" })}</div>
                                  </>
                                ) : isReplyEditing ? (
                                  <div className="comment-composer" style={{ position: "relative", overflow: "visible" }}>
                                    <MentionsTagInput
                                      key={`edit-${r._id}`}
                                      value={editingText}
                                      onChange={setEditingText}
                                      onMentionsChange={setEditingMentions}
                                      placeholder="Edit reply..."
                                      orgId={orgID}
                                      user={commentUser}
                                      autoFocusEnd
                                    />
                                    <div style={{ position: "absolute", right: 16, bottom: 12, display: "flex", gap: 8, zIndex: 10, pointerEvents: "auto" }}>
                                      <button onClick={cancelEdit} style={{ background: "#fff", border: "1px solid #D5D7DA", padding: "8px 16px", borderRadius: 60, cursor: "pointer", fontSize: 14 }}>Cancel</button>
                                      <button
                                        disabled={!editingText.trim()}
                                        onClick={() => {
                                          setTimeout(() => {
                                            requestAnimationFrame(() =>
                                              saveEditedCommentWith(editingText.trim(), editingMentions, String(r._id), r.interviewID)
                                            );
                                          }, 0);
                                        }}
                                        style={{ background: !editingText.trim() ? "#E5E7EB" : "#181D27", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 60, cursor: !editingText.trim() ? "not-allowed" : "pointer", fontSize: 14 }}
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                    <div>
                                      <p style={{ marginBottom: 0, fontWeight: 700, fontSize: "14px", color: "#181D27" }}>
                                        {r.createdBy?.name || r.createdByName || "Contributor"}
                                        {r.applicationLabel && (
                                          <span style={{ marginLeft: 6, fontWeight: 300, color: "#717680" }}>
                                            {" "}on{" "}
                                            <span style={{ fontWeight: 500, borderBottom: "1px solid #717680" }}>{r.applicationLabel}</span>
                                            {String(r.applicationLabel) === "Candidate" ? null : <>{" "}application</>}
                                          </span>
                                        )}
                                      </p>
                                      <div style={{ color: "#717680", fontWeight: 500, fontSize: "14px" }}>
                                        <span style={{ textTransform: "capitalize" }}>{r.createdBy?.role?.replace("_", " ")}</span> | {new Date(r.createdAt || Date.now()).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "numeric" })}
                                        {r.editedAt && (() => {
                                          const editedDate = new Date(r.editedAt);
                                          const time = (Date.now() - editedDate.getTime()) / 1000;
                                          let label = "Edited";
                                          if (time <= 60) {
                                            label = "Edited just now";
                                          } else if (time < 3600) {
                                            label = `Edited ${Math.floor(time / 60)}m ago`;
                                          }
                                          return <span> | {label}</span>;
                                        })()}
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                      {canEditReply ? (
                                        <>
                                          <i className="la la-trash text-lg" title="Delete reply" style={{ cursor: "pointer", color: "#6B7280" }} onClick={() => openDeleteModal(r)} />
                                          <i className="las la-pencil-alt text-lg" title="Edit reply" style={{ cursor: "pointer", color: "#6B7280" }} onClick={() => startEditComment(r)} />
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                )}

                                {!isReplyEditing && !isReplyDeleted && (
                                  <div style={{ marginTop: 12, fontSize: "16px", lineHeight: "24px", color: "#181D27" }}>{renderCommentText(r.text || r.comment || r.feedback)}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {idx < parents.length - 1 && (
                      <hr style={{ margin: "12px 0", borderColor: "#EAECF5" }} />
                    )}
                  </React.Fragment>
                );
              })}
          </div>
        ) : null}
      </div>

      {deleteModalMounted && typeof window !== "undefined" &&
        createPortal(
          (
            <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, opacity: deleteModalVisible ? 1 : 0, transition: "opacity 220ms ease-in-out", pointerEvents: deleteModalVisible ? "auto" : "none" }}>
              <div style={{ width: "100%", maxWidth: 470, background: "#fff", borderRadius: 20, padding: "28px 32px 24px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", gap: 20, transform: deleteModalVisible ? "scale(1)" : "scale(0.95)", transition: "transform 220ms ease" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src="/delete_swal_comment.svg" alt="delete_svg" />
                  </div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827" }}>Delete Comment</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginTop: 0 }}>
                  <p style={{ marginBottom: 0, fontSize: 15, color: "#4B5563/100", textAlign: "center", fontWeight: 400 }}>Are you sure you want to delete this comment?</p>
                  <p style={{ fontSize: 15, color: "#4B5563/100", textAlign: "center", fontWeight: 400 }}>This action cannot be undone.</p>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 4 }}>
                  <button type="button" onClick={closeDeleteModal} disabled={deleteLoading} style={{ background: "#fff", color: "#111", border: "1px solid #E5E7EB", padding: "10px 26px", borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: "pointer", width: "100%", justifyContent: "center", display: "inline-flex", alignItems: "center" }}>
                    Cancel
                  </button>
                  <button type="button" onClick={confirmDeleteComment} disabled={deleteLoading} style={{ background: "#B42318", color: "#fff", border: "none", padding: "10px 26px", borderRadius: 999, fontSize: 14, fontWeight: 600, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: deleteLoading ? "not-allowed" : "pointer", opacity: deleteLoading ? 0.8 : 1 }}>
                    {deleteLoading && <span className="la la-spinner" style={{ fontSize: 18, animation: "spin 1s linear infinite" }}></span>}
                    {deleteLoading ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ),
          document.body
        )}
    </div>
  );
}
