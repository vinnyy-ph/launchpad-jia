"use client";
import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/utils/apiClient";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import MentionsTagInput, { MentionSuggestion } from "@/lib/components/CareerComponents/MentionsTagInput";
import styles from "@/lib/styles/components/CommentThreads.module.scss";
import { errorToast, successToast } from "@/lib/Utils";
import { normalizeCareerTeamRole } from "@/lib/utils/careerTeamRole";
import { AuthorIcon } from "./CommentThread/AuthorIcon";
import { CommentEditMode } from "./CommentThread/CommentEditMode";
import { Comment } from "./CommentThread/Comment";
import { ReplyComposer } from "./CommentThread/ReplyComposer";

type Props = {
  interview: any;
  effectiveOrgID: string | null | undefined;
  user: any;
  comments?: any[];
  setComments?: (c: any[]) => void;
  teamMembers?: any[];
};

export default function CommentThreads({ interview, effectiveOrgID, user, comments: initialComments, setComments: parentSetComments, teamMembers }: Props) {
  const [comments, setComments] = useState<any[]>(initialComments || []); // Comments array
    const [newComment, setNewComment] = useState<string>(""); // New comment text
    const [newCommentMentions, setNewCommentMentions] = useState<MentionSuggestion[]>([]);
    const [isPostingComment, setIsPostingComment] = useState<boolean>(false); // Indicates if a comment is being posted
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null); // ID of comment being edited
    const [editingText, setEditingText] = useState<string>(""); // Edited comment text
    const [editingMentions, setEditingMentions] = useState<MentionSuggestion[]>([]); // Edited comment mentions
    const [showDeleteCommentModal, setShowDeleteCommentModal] = useState<boolean>(false); // Controls visibility of delete comment modal
    const [deleteCommentIndex, setDeleteCommentIndex] = useState<number | null>(null); // Index of comment to delete
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false); // Indicates if delete operation is in progress
    const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null); // ID of comment being replied to
    const [replyToComment, setReplyToComment] = useState<any | null>(null); // The specific comment being replied to (for display)
    const [replyText, setReplyText] = useState<string>(""); // Reply comment text
    const [replyMentions, setReplyMentions] = useState<MentionSuggestion[]>([]); // Reply comment mentions
    const [isPostingReply, setIsPostingReply] = useState<boolean>(false); // Indicates if a reply is being posted
    const [deleteModalMounted, setDeleteModalMounted] = useState(false); // Controls mounting of delete comment modal
    const [deleteModalVisible, setDeleteModalVisible] = useState(false); // Controls visibility of delete comment modal
    const [composerKey, setComposerKey] = useState<number>(0); // Force MentionsTagInput reset after successful post
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set()); // Tracks which parent threads have all replies expanded

    const getCurrentRole = (email: string | undefined): string | undefined => {
      if (!email) return undefined;
      if (!teamMembers) return undefined;
      const normalizedEmail = email.trim().toLowerCase();
      const member = teamMembers.find(
        (m: any) => m.email?.trim()?.toLowerCase() === normalizedEmail
      );
      return normalizeCareerTeamRole(member?.role) || member?.role;
    };

   // Render comment text: replace serialized mentions @[Display](id) with styled inline spans
    const renderCommentText = (raw: string | undefined | null) => {
      if (!raw) return null;
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
        // push mention span
        parts.push(
          <span key={`m-${id}-${m.index}`} style={{ color: '#0F62FE', fontWeight: 500 }}>@{display}</span>
        );
        // if next char after match is not whitespace or punctuation, insert a space
        const nextChar = raw.charAt(regex.lastIndex);
        if (nextChar && !/\s|[.,;:!?()]/.test(nextChar)) parts.push(' ');
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < raw.length) parts.push(raw.slice(lastIndex));
      return <>{parts}</>;
    };

    // Helper to update local comments and inform parent if provided
    function updateComments(updater: any) {
      setComments((prev) => (typeof updater === "function" ? updater(prev) : updater));
    }

    // Sync local comments up to parent AFTER render (avoid "setState while rendering" warning)
    useEffect(() => {
      try {
        if (typeof parentSetComments === "function") parentSetComments(comments);
      } catch {
        // ignore
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comments]);

    // Fetch comments from standalone comments collection when interview/org available
    useEffect(() => {
      async function load() {
        try {
          if (!interview?.interviewID || !effectiveOrgID) return;
          const res = await api.post('/api/fetch-feedback-comment', {
            interviewID: interview.interviewID,
            orgID: effectiveOrgID,
          });
          const arr = Array.isArray(res?.data?.comments) ? res.data.comments : [];
          // Filter to application-scoped comments only
          const filtered = arr.filter((c: any) => (c?.type ?? 'application') === 'application');
          updateComments(filtered);
        } catch (e) {
          // fall back to existing props
        }
      }
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interview?.interviewID, effectiveOrgID]);

    // Mark comments as viewed when component mounts and comments are loaded
    useEffect(() => {
      const markAsViewed = async () => {
        if (!interview?.interviewID || !effectiveOrgID) return;
        if (comments.length === 0) return; // No comments to mark

        try {
          await api.post("/api/applicants/comments/mark-viewed", {
            applicantEmail: interview.email || interview.candidateEmail,
            interviewIDs: [interview.interviewID],
            orgID: effectiveOrgID,
          });

          // Dispatch event to update badge counts elsewhere
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("candidate-comments-viewed"));
          }
        } catch (error) {
          console.error("Error marking comments as viewed:", error);
        }
      };

      markAsViewed();
    }, [interview?.interviewID, effectiveOrgID, comments.length, interview?.email, interview?.candidateEmail]);

    async function postComment() {
      // Ensure interview exists
      if (!interview) return;
      if (!newComment || !newComment.trim()) return;
      
      setIsPostingComment(true);
      let userRole = "Contributor";
  
      try {
        // Find user's role from team members
        const authorEmail = user?.email?.trim();
        if (authorEmail && teamMembers) {
          const member = teamMembers.find(
            (m: any) => m.email?.trim()?.toLowerCase() === authorEmail.toLowerCase()
          );
          if (member?.role) {
            userRole = normalizeCareerTeamRole(member.role) || member.role;
          }
        }
  
        const payload = {
          interviewID: interview.interviewID,
          orgID: effectiveOrgID,
          comment: newComment.trim(),
          mentions: newCommentMentions, // Include mentions data
          createdBy: {
            name: user?.name,
            email: user?.email,
            image: user?.image,
            role: userRole,
          },
          createdAt: new Date().toISOString(),
          type: 'application',
        };
  
        // Try adding via API
        const res = await api.post("/api/add-feedback-comment", payload);
  
        // If API returns the created comment, prepend it; otherwise optimistically use payload
        const createdComment = res?.data?.comment || payload;
        updateComments((prev: any[]) => [createdComment, ...prev]);
        setNewComment("");
        setNewCommentMentions([]); // Clear mentions
        setComposerKey((k) => k + 1); // Force MentionsTagInput remount to clear contentEditable
        successToast("Comment posted", 1200);
      } catch (err) {
        console.error(err);
        errorToast("Failed to post comment", 1200);
      } finally {
        setIsPostingComment(false);
      }
    }
  

  
    // Open delete confirmation modal
    function openDeleteModal(idx:number){
      const target = comments[idx];
      if (!target?._id) {
        errorToast("Cannot delete this comment", 1200);
        return;
      }
      setDeleteCommentIndex(idx);
      setDeleteModalMounted(true);
      requestAnimationFrame(() => setDeleteModalVisible(true));
    }
  
    // Close delete confirmation modal
    function closeDeleteModal(){
      setDeleteModalVisible(false);
      setShowDeleteCommentModal(false);
      setDeleteCommentIndex(null);
      setDeleteLoading(false);
  
      setTimeout(() => setDeleteModalMounted(false), 200);
    }
  
    // Confirm deletion of a comment
    async function confirmDeleteComment(){
      if (deleteCommentIndex === null) return;
      const target = comments[deleteCommentIndex];
      setDeleteLoading(true);
      try {
        const commentId = target?._id;
        if (!commentId) throw new Error('Missing comment id');
        await api.post("/api/delete-feedback-comment", {
          interviewID: interview?.interviewID,
          orgID: effectiveOrgID,
          commentId,
        });
        // Soft-delete locally: keep the comment but mark as deleted
        updateComments((prev: any[]) => prev.map((c, i) =>
          i === deleteCommentIndex
            ? { ...c, deleted: true, deletedAt: new Date().toISOString() }
            : c
        ));
        successToast("Comment deleted", 1200);
        closeDeleteModal();
      } catch(err){
        console.error(err);
        errorToast("Failed to delete comment", 1500);
        setDeleteLoading(false);
      }
    }
  
    // Start editing a comment
    function startEditComment(c: any, idx: number){
      if (c.deleted || !c._id) return; // safety
      const id = c._id;
      setEditingCommentId(id);
      setEditingText(c.text || c.comment || c.feedback || "");
      setEditingMentions(c.mentions || []); // Load existing mentions
    }
  
    // Cancel editing
    function cancelEdit(){
      setEditingCommentId(null);
      setEditingText("");
      setEditingMentions([]); // Reset mentions
    }
  
    // Save edited comment
    async function saveEditedComment(idx: number){
      if (!editingCommentId) return;
      const target = comments[idx];
      const trimmed = editingText.trim();
      if (!trimmed) return;
      try {
        const commentId = target?._id; 
        if (!commentId) throw new Error('Missing comment id');
        await api.post('/api/update-feedback-comment', {
          interviewID: interview?.interviewID,
          orgID: effectiveOrgID,
          commentId,
          newText: trimmed,
          mentions: editingMentions, // Include updated mentions
        });
        // Optimistic local update
        updateComments((prev: any[]) => prev.map((c, i) => i === idx ? { ...c, text: trimmed, comment: undefined, feedback: undefined, mentions: editingMentions, edited: true, editedAt: new Date().toISOString() } : c)); // Update text and mark as edited
        successToast('Comment updated', 1200);
        cancelEdit();
      } catch(err){
        console.error(err);
        errorToast('Failed to update comment', 1500);
      }
    }
  
    // Start replying to a comment
    function startReply(commentId: string){
      if(!commentId){
        errorToast("Cannot reply to this comment", 1200);
        return;
      }
      
      // Find the comment being replied to
      const comment = comments.find((c: any) => c._id === commentId);
      if (!comment) {
        errorToast("Comment not found", 1200);
        return;
      }
      
      // Determine the thread root and reply-to context
      // Auto-tag the author in the composer
      const authorName = comment.createdBy?.name || 'Contributor';
      const authorEmail = comment.createdBy?.email || comment._id;
      setReplyText(`@[${authorName}](${authorEmail}) `);
      setReplyMentions([{ id: authorEmail, display: authorName, email: comment.createdBy?.email }]);
      setReplyToComment(comment);
      // Auto-expand the thread when replying
      const threadRoot = comment.parentId || comment._id;
      setExpandedThreads((prev) => { const next = new Set(prev); next.add(threadRoot); return next; });

      if (comment.parentId) {
        // Replying to a reply -> thread root is the parent
        setReplyingToCommentId(comment.parentId);
      } else {
        // Replying to a parent -> thread root is this comment
        setReplyingToCommentId(comment._id);
      }
    }
  
    // Cancel Reply
    function cancelReply(){
      setReplyingToCommentId(null);
      setReplyToComment(null);
      setReplyText("");
      setReplyMentions([]); // Reset mentions
      setIsPostingReply(false);
    }
  
    // Reply to parent comment
    async function postReply(parentId: string){
  
      // Ensure interview exists
      if(!parentId || !replyText.trim() || !interview) return;
      setIsPostingReply(true);
      let userRole = "Contributor";
      
      try {
        // Find user's role from team members
        const authorEmail = user?.email?.trim();
        if (authorEmail && teamMembers) {
          const member = teamMembers.find(
            (m: any) => m.email?.trim()?.toLowerCase() === authorEmail.toLowerCase()
          );
          if (member?.role) {
            userRole = normalizeCareerTeamRole(member.role) || member.role;
          }
        }
         const payload = {
            interviewID: interview.interviewID,
            orgID: effectiveOrgID,
            comment: replyText.trim(),
            mentions: replyMentions, // Include mentions data
            parentId,
            replyTo: replyToComment ? {
              _id: replyToComment._id,
              name: replyToComment.createdBy?.name,
              email: replyToComment.createdBy?.email,
            } : null,
            createdBy: {
              name: user?.name,
              email: user?.email, 
              image: user?.image,
              role: userRole,
            },
            createdAt: new Date().toISOString(),
            type: 'application',
          };
         
          // Add reply
          const res = await api.post("/api/add-feedback-comment", payload);
          // Merge API response with payload to ensure replyTo is always preserved
          const createdReply = res?.data?.comment
            ? { ...payload, ...res.data.comment, replyTo: res.data.comment.replyTo || payload.replyTo }
            : payload;
  
          updateComments((prev: any[])=> [createdReply, ...prev]);
          successToast("Reply posted", 1200);
          cancelReply();
      
      } catch (error) {
        console.error(error);
        errorToast("Failed to post reply", 1200);
      } finally {
        setIsPostingReply(false);
      }
    }


    // Group comments into parents and flat replies for two-level threaded rendering
    const { parents, repliesByParent, idToIndex } = React.useMemo(() => {
        const parents: any[] = [];
        const repliesByParent: Record<string, any[]> = {};
        const idToIndex: Record<string, number> = {};

        // Build mappings
        comments.forEach((c: any, index: number) => {
          const cid = c._id ? String(c._id) : `legacy-${index}`;
          idToIndex[cid] = index;

          // Separate parents and replies
          if (c.parentId) {
            const pid = String(c.parentId);
            if (!repliesByParent[pid]) repliesByParent[pid] = [];
            repliesByParent[pid].push(c);
          } else {
            parents.push(c);
          }
        });

        // Sort replies chronologically within each parent thread
        Object.values(repliesByParent).forEach((replies) => {
          replies.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });

        return { parents, repliesByParent, idToIndex };
    }, [comments]);



  return ( <>
     {/* New comment input area */}
        <div className="layered-card-outer--solid" style={{ marginTop: 0 }}>
            <div className="layered-card-middle">
              <span className={styles.sectionTitle}>Comments</span>

              {/* New comment input area */}
              <div className="layered-card-content">
                <div style={{ display: "flex", flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                  <div className={styles.avatarWrapper}>
                    <AvatarImage src={user?.image} alt={user?.name || "User"} />
                  </div>
                  <div className={styles.commentComposerWrapper}>
                    <div className={`${styles.commentComposer} comment-composer`}>
                      {/* Changed text area to MentionsTagInput */}
                      <MentionsTagInput
                        key={composerKey}
                        value={newComment}
                        onChange={setNewComment}
                        placeholder="Write a comment to this candidate ..."
                        orgId={effectiveOrgID as string}
                        onMentionsChange={setNewCommentMentions} // New prop to capture mentions
                        user={user}
                        teamMembers={teamMembers}
                      />

                      {/* Changed button to be positioned absolutely */}
                      <button
                        disabled={isPostingComment || !newComment.trim()}
                        onClick={() => postComment()}
                        className={styles.postButton}
                        style={{
                          background: isPostingComment || !newComment.trim() ? '#D5D7DA' : '#181D27',
                          cursor: isPostingComment || !newComment.trim() ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <i className="las la-paper-plane text-xl mr-2" style={{transform: "rotate(-35deg)", display:"inline-block"}}></i>
                        <span>{isPostingComment ? 'Posting...' : 'Post'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <hr style={{ margin: "16px 0", borderColor: "#EEF2F7" }} />

                {/* Comments List */}
                <h4 style={{ margin: "8px 0" }}>All Comments</h4>              

                {comments && comments.length > 0 ? (
                  <div className={styles.commentThread}>
                    {/* Individual comment with parent ID */}
                    {parents.map((parent: any, idx: number) => {
                      const parentKey = String(parent._id);
                      const parentId = parent._id;
                      const isEditing = !!parent._id && editingCommentId === parent._id;
                      const isParentDeleted = parent.deleted === true || parent.deleted === 'true' || !!parent.deletedAt;
                      const canEditParent = parentId && ((user?.email || '').toLowerCase() === (typeof parent.createdBy === 'string' ? (parent.createdBy || '').toLowerCase() : (parent.createdBy?.email || '').toLowerCase())) && !isParentDeleted;
                      const canEdit = !!parent._id && ((user?.email || '').toLowerCase() === (typeof parent.createdBy === 'string' ? (parent.createdBy || '').toLowerCase() : (parent.createdBy?.email || '').toLowerCase())) && !isParentDeleted;
                      const resolvedIdx = parent._id ? (idToIndex[String(parent._id)] ?? idx) : idx;
                      const children = repliesByParent[String(parent._id)] || [];

                      return (
                        // Individual Parent Comment
                        <React.Fragment key={parentKey}>
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingTop: 8 }}>
                            {/* Checks if comment is deleted then the Avatar will change*/}
                            <AuthorIcon useFallback={isParentDeleted} image={parent.createdBy?.image} name={parent.createdBy?.name} />
                            
                            <div style={{ flex: 1 }}>
                              {/* Checks if comment is deleted then show appropriate message */}
                              {isParentDeleted ? (
                                <Comment
                                  mode="deleted"
                                  details={parent}
                                />
                              ) : isEditing ? (
                                <CommentEditMode
                                  details={parent}
                                  states={{
                                    editingText,
                                    setEditingText,
                                    setEditingMentions,
                                    effectiveOrgID,
                                    user,
                                    cancelEdit,
                                    saveEditedComment,
                                    resolvedIdx,
                                    teamMembers
                                  }}
                                />
                              ) : (
                                <>
                                  <Comment
                                    mode="active"
                                    details={parent}
                                    canEdit={canEdit}
                                    openDeleteModal={openDeleteModal}
                                    startEditComment={startEditComment}
                                    startReply={startReply}
                                    resolvedIdx={resolvedIdx}
                                    currentRole={
                                      normalizeCareerTeamRole(
                                        getCurrentRole(parent.createdBy?.email) ||
                                          parent.createdBy?.role
                                      ) || parent.createdBy?.role
                                    }
                                  />

                                 {/* Render comment area */}
                                  <div style={{ 
                                      alignItems: "flex-start",
                                      marginTop: 6, 
                                      fontFamily: "Font family/body",
                                      fontStyle: "normal",     
                                      fontSize: "16px",
                                      lineHeight: "24px",
                                      letterSpacing: "0",
                                      color: "#181D27",
                                      verticalAlign: "middle" ,
                                      paddingBottom: 10}}>{renderCommentText(parent.text || parent.comment || parent.feedback)}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Child comments — flat two-level list */}
                          {(children.length > 0 || replyingToCommentId === parent._id) && (() => {
                            const isExpanded = expandedThreads.has(String(parent._id));
                            const shouldCollapse = children.length >= 4 && !isExpanded;
                            const visibleReplies = shouldCollapse ? [children[children.length - 1]] : children;
                            const hiddenCount = children.length - 1;
                            return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginLeft: 32, marginTop: 6, paddingLeft: 16, borderLeft: '2px solid #E5E7EB' }}>
                              {/* Show more replies button */}
                              {shouldCollapse && (
                                <button
                                  onClick={() => setExpandedThreads((prev) => { const next = new Set(prev); next.add(String(parent._id)); return next; })}
                                  style={{ background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: '#0F62FE', fontSize: '14px', fontWeight: 500, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                  <i className="las la-comment-dots" style={{ fontSize: '16px' }}></i>
                                  Show {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
                                </button>
                              )}
                              {visibleReplies.map((reply: any, childIdx: number) => {
                                const replyKey = String(reply._id);
                                const resolvedReplyIdx = idToIndex[String(reply._id)] ?? (idx + childIdx + 1);
                                const isReplyEditing = !!reply._id && editingCommentId === reply._id;
                                const isReplyDeleted = reply.deleted === true || reply.deleted === 'true' || !!reply.deletedAt;
                                const canEditReply = !!reply._id && ((user?.email || '').toLowerCase() === (typeof reply.createdBy === 'string' ? (reply.createdBy || '').toLowerCase() : (reply.createdBy?.email || '').toLowerCase())) && !isReplyDeleted;
                                return (
                                  <React.Fragment key={replyKey}>
                                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
                                      {isReplyDeleted ? (
                                        <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                                          <i className="las la-undo" style={{transform: 'scaleX(-1) scaleY(-1)', display: 'inline-block', fontSize: '16px', color: "#A4A7AE", marginBottom: 5}}></i>
                                          <div style={{ width: 32, height: 32, backgroundColor: '#F8F9FC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <i className="las la-user text-lg"></i>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                                          <i className="las la-undo" style={{transform: 'scaleX(-1) scaleY(-1)', display: 'inline-block', fontSize: '16px', color: "#A4A7AE", marginBottom: 5}}></i>
                                          <AvatarImage src={reply.createdBy?.image} alt={reply.createdBy?.name || "User"} />
                                        </div>
                                      )}
                                      <div style={{ flex: 1 }}>
                                        {isReplyDeleted ? (
                                          <>
                                            <div style={{ fontStyle: 'italic', color: '#6B7280' }}>Comment deleted by its author</div>
                                            <div style={{ color: '#717680', fontFamily: "Font family/body", fontWeight: 500, fontStyle: "normal", fontSize: "14px", lineHeight: "20px", letterSpacing: "0", paddingBottom: 10 }}>
                                              {new Date(reply.deletedAt || reply.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                            </div>
                                          </>
                                        ) : isReplyEditing ? (
                                          <div className="comment-composer" style={{ position: 'relative' }}>
                                            <MentionsTagInput
                                              value={editingText}
                                              onChange={setEditingText}
                                              onMentionsChange={setEditingMentions}
                                              placeholder="Edit reply..."
                                              orgId={effectiveOrgID as string}
                                              user={user}
                                              autoFocusEnd
                                              teamMembers={teamMembers}
                                            />
                                            <div style={{ position: 'absolute', right: 16, bottom: 12, display: 'flex', gap: 8 }}>
                                              <button onClick={cancelEdit} style={{ background: '#fff', border: '1px solid #D5D7DA', padding: '8px 16px', borderRadius: 60, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
                                              <button disabled={!editingText.trim()} onClick={() => saveEditedComment(resolvedReplyIdx)} style={{ background: !editingText.trim() ? '#E5E7EB' : '#181D27', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 60, cursor: !editingText.trim() ? 'not-allowed' : 'pointer', fontSize: 14 }}>Save</button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                            <div>
                                              <p style={{ marginBottom: 0, fontFamily: "Font family/body", fontWeight: 700, fontStyle: "normal", fontSize: "14px", lineHeight: "20px", letterSpacing: "0", verticalAlign: "middle", color: "#181D27" }}>
                                                {reply.createdBy?.name || reply.createdByName || 'Contributor'}
                                              </p>
                                              <div style={{ color: '#717680', fontFamily: "Font family/body", fontWeight: 500, fontStyle: "normal", fontSize: "14px", lineHeight: "20px", letterSpacing: "0", textAlign: "right", verticalAlign: "middle" }}>
                                                <span style={{ textTransform: 'capitalize' }}>{(normalizeCareerTeamRole(getCurrentRole(reply.createdBy?.email) || reply.createdBy?.role) || 'Contributor')?.replace('_', ' ')}</span> | {new Date(reply.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                                {reply.editedAt && (() => {
                                                  const editedDate = new Date(reply.editedAt);
                                                  const time = (Date.now() - editedDate.getTime()) / 1000;
                                                  let label = 'Edited';
                                                  if (time <= 60) { label = 'Edited just now'; }
                                                  else if (time < 3600) { label = `Edited ${Math.floor(time / 60)}m ago`; }
                                                  return <span> | {label}</span>;
                                                })()}
                                              </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                              <i className="la la-reply text-lg" title="Reply" style={{ cursor: 'pointer', color: '#6B7280' }} onClick={() => startReply(reply._id)} />
                                              {canEditReply && (
                                                <>
                                                  <i className="la la-trash text-lg" title="Delete reply" style={{ cursor: 'pointer', color: '#6B7280' }} onClick={() => openDeleteModal(resolvedReplyIdx)} />
                                                  <i className="las la-pencil-alt text-lg" title="Edit reply" style={{ cursor: 'pointer', color: '#6B7280' }} onClick={() => startEditComment(reply, resolvedReplyIdx)} />
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Reply text */}
                                        {!isReplyEditing && !isReplyDeleted && (
                                          <div style={{ alignItems: "flex-start", marginTop: 8, paddingBottom: 4, fontFamily: "Font family/body", fontStyle: "normal", fontSize: "16px", lineHeight: "24px", letterSpacing: "0", color: "#181D27", verticalAlign: "middle" }}>
                                            {renderCommentText(reply.text || reply.comment || reply.feedback)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </React.Fragment>
                                );
                              })}

                              {/* Reply composer — always at the bottom of the flat reply list */}
                              {replyingToCommentId === parent._id && (
                                <ReplyComposer
                                  parent={parent}
                                  replyText={replyText}
                                  setReplyText={setReplyText}
                                  replyMentions={replyMentions}
                                  setReplyMentions={setReplyMentions}
                                  user={user}
                                  effectiveOrgID={effectiveOrgID}
                                  cancelReply={cancelReply}
                                  postReply={postReply}
                                  isPostingReply={isPostingReply}
                                  replyToName={replyToComment?.createdBy?.name}
                                  teamMembers={teamMembers}
                                />
                              )}
                            </div>
                            );
                          })()}

                          {/* Bottom separator: shown once per parent thread, after replies if any */}
                          {idx < parents.length - 1 && (
                            <hr style={{ margin: "12px 0", borderColor: "#EAECF5" }} />
                          )}
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
            </div>
          </div>

      {deleteModalMounted && (
        <div style={{position:'fixed',inset:0,background:'rgba(17,24,39,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000, opacity:deleteModalVisible ? 1 : 0, transition: 'opacity 220ms ease-in-out', pointerEvents: deleteModalVisible ? 'auto' : 'none'}}>
          <div style={{width:'100%',maxWidth:470,background:'#fff',borderRadius:20,padding:'28px 32px 24px',boxShadow:'0 8px 24px rgba(0,0,0,0.12)',display:'flex',flexDirection:'column',gap:20,  transform: deleteModalVisible ? 'scale(1)' : 'scale(0.95)', transition: 'transform 220ms ease'}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
              <div style={{width:80,height:80, display:'flex',alignItems:'center',justifyContent:'center'}}>
                <img src="/delete_swal_comment.svg" alt="delete_svg" />
              </div>
              <h2 style={{margin:0,fontSize:20,fontWeight:600,color:'#111827'}}>Delete Comment</h2>
            </div>
            <div style={{display:'flex', flexDirection:'column', marginTop: 0}}>
              <p style={{marginBottom:0,fontSize:15,color:'#4B5563/100',textAlign:'center', fontWeight:400}}>Are you sure you want to delete this comment?</p>
              <p style={{fontSize:15,color:'#4B5563/100',textAlign:'center', fontWeight:400}}>This action cannot be undone.</p>
            </div>
            <div style={{display:'flex',justifyContent:'center',gap:12,marginTop:4}}>
              <button onClick={closeDeleteModal} disabled={deleteLoading} style={{background:'#fff',color:'#111',border:'1px solid #E5E7EB',padding:'10px 26px',borderRadius:999,fontSize:14,fontWeight:500,cursor:'pointer', width:"100%", justifyContent:'center', display:'inline-flex', alignItems:'center'}}>
                Cancel
              </button>
              <button onClick={confirmDeleteComment} disabled={deleteLoading} style={{background:'#B42318',color:'#fff',border:'none',padding:'10px 26px',borderRadius:999,fontSize:14,fontWeight:600, width:"100%" , display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,cursor:deleteLoading?'not-allowed':'pointer',opacity:deleteLoading?0.8:1}}>
                {deleteLoading && <span className="la la-spinner" style={{fontSize:18,animation:'spin 1s linear infinite'}}></span>}
                {deleteLoading? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
  
  </>
   
  );
}
