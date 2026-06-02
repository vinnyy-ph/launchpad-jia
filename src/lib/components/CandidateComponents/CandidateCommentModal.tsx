"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// Inline modal markup used (no external Modal component available)
import MentionsTagInput from "../CareerComponents/MentionsTagInput";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import { api } from "@/lib/utils/apiClient";
import { successToast, errorToast } from "@/lib/Utils";
import { Button } from "../ui";


interface Props {
  open: boolean;
  onClose: () => void;
  candidate: any;
  orgId: string;
  user: any;
  onPosted?: (comment: any) => void;
}

const CandidateCommentModal: React.FC<Props> = ({ open, onClose, candidate, orgId, user, onPosted }) => {
  // Comment state (copied/adapted from InterviewAnalysis comments implementation)
  const [text, setText] = useState<string>("");
  const [mentions, setMentions] = useState<any[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentMentions, setNewCommentMentions] = useState<any[]>([]);
  const [isPostingComment, setIsPostingComment] = useState<boolean>(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [editingMentions, setEditingMentions] = useState<any[]>([]);
  const [deleteCommentIndex, setDeleteCommentIndex] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [replyMentions, setReplyMentions] = useState<any[]>([]);
  const [isPostingReply, setIsPostingReply] = useState<boolean>(false);
  const mountedRef = useRef(false);
  const router = useRouter();
  const interview = candidate?.interviews?.[0] || null;
  const stageLabel = interview?.stage || candidate?.stage || candidate?.currentStep || interview?.status || null;
  const [deleteModalMounted, setDeleteModalMounted] = useState(false); // Controls mounting of delete comment modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false); // Controls visibility of delete comment modal
  const [showDeleteCommentModal, setShowDeleteCommentModal] = useState<boolean>(false); // Controls visibility of delete comment modal
  const [skillList, setSkillList] = useState<string[]>(Array.isArray(candidate?.skills) ? candidate.skills : []);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [composerKey, setComposerKey] = useState<number>(0); // Force MentionsTagInput reset after successful post
  

  useEffect(() => {
    if (open) {
      console.debug('CandidateCommentModal open — candidate:', candidate, 'interview:', interview, 'stageLabel:', stageLabel);
    }
  }, [open, candidate, interview, stageLabel]);

  useEffect(() => {
    if (open && !mountedRef.current) {
      mountedRef.current = true;
    }
    if (!open) {
      setText("");
      setMentions([]);
      setIsPosting(false);
      setComments([]);
      setNewCommentMentions([]);
      setIsPostingComment(false);
      setEditingCommentId(null);
      setEditingText("");
      setEditingMentions([]);
      setDeleteCommentIndex(null);
      setDeleteLoading(false);
      setReplyingToCommentId(null);
      setReplyText("");
      setReplyMentions([]);
      setIsPostingReply(false);
    }
  }, [open]);

  // Hook to load skills when modal opens / candidate changes
  useEffect(() => {
    let mounted = true;
    async function load() {
      setSkillsLoading(true);
      const skills = await fetchCandidateSkills(candidate, orgId);
      if (!mounted) return;
      setSkillList(skills);
      setSkillsLoading(false);
    }
    if (candidate) load();
    return () => { mounted = false; };
  }, [candidate?._id, candidate?.email, candidate?.skills, orgId]);

  // Helper: render comment text and convert serialized mentions into styled spans
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
      parts.push(
        <span key={`m-${id}-${m.index}`} style={{ color: '#0F62FE', fontWeight: 500 }}>@{display}</span>
      );
      const nextChar = raw.charAt(regex.lastIndex);
      if (nextChar && !/\s|[.,;:!?()]/.test(nextChar)) parts.push(' ');
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < raw.length) parts.push(raw.slice(lastIndex));
    return <>{parts}</>;
  };

  // Fetch candidate-scoped comments only (no interview binding)
  useEffect(() => {
    async function fetchComments() {
      try {
        const res = await api.post('/api/fetch-feedback-comment', { interviewID: null, orgID: orgId, candidateEmail: candidate?.email });
        const arr = Array.isArray(res?.data?.comments) ? res.data.comments : [];
        const filtered = arr.filter((c: any) => (c?.type ?? 'candidate') === 'candidate');
        setComments(filtered);
      } catch (err) {
        setComments([]);
      }
    }
    if (candidate) fetchComments();
  }, [candidate, orgId]);

  // Helpers copied/adapted: getJobOwner
  async function getJobOwner(jobId:any){
    try {
      if (!jobId) return null;
           // Resolved role issue
      const careersRes = await api.post('/api/fetch-careers', { orgID: orgId });
      const careersArr = careersRes?.data || [];
      const match = careersArr.find((c: any) => c?.id === jobId || String(c?._id) === String(jobId));
      if (match) return match.createdBy || null;
    } catch (error) {
      console.error("getJobOwner error:", error);
    }
    return null;
  }

  // No duplicate skills, trimmed strings
  function normalizeSkills(arr: string[]|undefined|null) {
    if (!Array.isArray(arr)) return []; 
    return Array.from(new Set(arr.map(s => String(s || '').trim()).filter(Boolean))); //
  }

  // Get skills data from user CV
  async function fetchSkillsFromUserCV(userCV: any): Promise<string[]> {
    if (!userCV) return [];
    if (Array.isArray(userCV.skills) && userCV.skills.length) return normalizeSkills(userCV.skills);
    // parse digitalCV: find a section with title matching "skills"
    const digital = userCV.digitalCV || userCV.parsed?.digitalCV;
    if (Array.isArray(digital)) {
      const sec = digital.find((s: any) => /skills?/i.test(String(s?.title || '')));
      if (sec) {
        if (Array.isArray(sec.items) && sec.items.length) return normalizeSkills(sec.items);
        if (typeof sec.text === 'string') {
          const tokens = sec.text.split(/[\n,;:/]+/).map(t => t.trim()).filter(Boolean);
          return normalizeSkills(tokens);
        }
      }
    }
    return [];
  }

  // Main function to fetch candidate skills
  async function fetchCandidateSkills(candidate: any, orgId?: string): Promise<string[]> {
    try {
      const interviewID = candidate?.interviews?.[0]?.interviewID || candidate?.interviews?.[0]?._id || null;
      if (!interviewID) return [];

      const res = await api.post('/api/interview-details', {
        id: String(interviewID),
        orgID: orgId,
      });

      const updatedSkills = Array.isArray(res?.data?.updatedSkills) ? res.data.updatedSkills : [];
      return normalizeSkills(updatedSkills);
    } catch (err) {
      console.debug('interview-details error', err?.response || err);
      return [];
    }
  }

  // Post a new comment (copied from page)
  async function postComment() {
    const interviewID = candidate?.interviews?.[0]?.interviewID || candidate?.interviews?.[0]?._id || null;
    if (!interviewID) return;
    if (!text || !text.trim()) return;
    setIsPostingComment(true);
    try {
      let userRole = "Contributor";
      // Resolved role issue
      const careerID = candidate?.interviews?.[0]?.careerID || candidate?.interviews?.[0]?.id || candidate?.careerID || candidate?.interviews?.[0]?.interviewID || null;
      const careerOwner = await getJobOwner(careerID);
      const ownerEmail = typeof careerOwner === "string" ? careerOwner : careerOwner?.email;
      const authorEmail = user?.email || null;
      const isOwner = ownerEmail && authorEmail && ownerEmail.toLowerCase() === authorEmail.toLowerCase();
      if (isOwner) userRole = "Job Owner";

      const payload = {
        interviewID: null,
        orgID: orgId,
        comment: text.trim(),
        mentions: newCommentMentions.length ? newCommentMentions : mentions,
        createdBy: {
          name: user?.name,
          email: user?.email,
          image: user?.image,
          role: userRole,
        },
        createdAt: new Date().toISOString(),
        type: 'candidate',
        candidateEmail: candidate?.email || null,
      };

      const res = await api.post("/api/add-feedback-comment", payload);
      const createdComment = res?.data?.comment || payload;
      setComments((prev) => [createdComment, ...prev]);
      setText("");
      setNewCommentMentions([]);
      successToast("Comment posted", 1200);
      setComposerKey((k) => k + 1); // Force MentionsTagInput remount to clear contentEditable
      if (onPosted) onPosted(createdComment);
    } catch (err) {
      console.error(err);
      errorToast("Failed to post comment", 1200);
    } finally {
      setIsPostingComment(false);
    }
  }

  // Edit/comment helpers
  function startEditComment(c: any, idx: number){
    if (c.deleted || !c._id) return;
    const id = c._id;
    setEditingCommentId(id);
    setEditingText(c.text || c.comment || c.feedback || "");
    setEditingMentions(c.mentions || []);
  }

  function cancelEdit(){
    setEditingCommentId(null);
    setEditingText("");
    setEditingMentions([]);
  }

  async function saveEditedComment(idx: number){
    if (!editingCommentId) return;
    const target = comments[idx];
    const trimmed = editingText.trim();
    if (!trimmed) return;
    try {
      const commentId = target?._id;
      if (!commentId) throw new Error('Missing comment id');
      await api.post('/api/update-feedback-comment', {
        interviewID: null,
        orgID: orgId,
        commentId,
        newText: trimmed,
        mentions: editingMentions,
        type: 'candidate',
        candidateEmail: candidate?.email || null,
      });
      setComments(prev => prev.map((c, i) => i === idx ? { ...c, text: trimmed, comment: undefined, feedback: undefined, mentions: editingMentions, edited: true, editedAt: new Date().toISOString() } : c));
      successToast('Comment updated', 1200);
      cancelEdit();
    } catch(err){
      console.error(err);
      errorToast('Failed to update comment', 1500);
    }
  }

  // Delete helpers
  function openDeleteModal(idx:number){
    const target = comments[idx];
    if (!target?._id) {
      errorToast("Cannot delete this comment", 1200);
      return;
    }
    setDeleteCommentIndex(idx);
    // Mount and reveal the delete confirmation modal with a small timing gap
    setDeleteModalMounted(true);
    // allow the modal to mount then animate visible
    setTimeout(() => {
      setDeleteModalVisible(true);
      setShowDeleteCommentModal(true);
    }, 12);
  }

    // Close delete confirmation modal
  function closeDeleteModal(){
    setDeleteModalVisible(false);
    setShowDeleteCommentModal(false);
    setDeleteCommentIndex(null);
    setDeleteLoading(false);

    setTimeout(() => setDeleteModalMounted(false), 200);
  }

  async function confirmDeleteComment(){
    if (deleteCommentIndex === null) return;
    const target = comments[deleteCommentIndex];
    setDeleteLoading(true);
    try {
      const commentId = target?._id;
      if (!commentId) throw new Error('Missing comment id');
      await api.post("/api/delete-feedback-comment", {
        interviewID: null,
        orgID: orgId,
        commentId,
        type: 'candidate',
        candidateEmail: candidate?.email || null,
      });
      setComments(prev => prev.map((c, i) => i === deleteCommentIndex ? { ...c, deleted: true, deletedAt: new Date().toISOString() } : c));
      successToast("Comment deleted", 1200);
      // close the delete modal and reset index
      setDeleteCommentIndex(null);
      closeDeleteModal();
    } catch(err){
      console.error(err);
      errorToast("Failed to delete comment", 1500);
      setDeleteLoading(false);
    }
  }

  // Reply helpers
  function startReply(parentId:string){
    if(!parentId){
      errorToast("Cannot reply to this comment", 1200);
      return;
    }
    setReplyingToCommentId(parentId);
    setReplyText("");
  }

  function cancelReply(){
    setReplyingToCommentId(null);
    setReplyText("");
    setReplyMentions([]);
    setIsPostingReply(false);
  }

  async function postReply(parentId: string){
    if(!parentId || !replyText.trim()) return;
    setIsPostingReply(true);
    try {
      let userRole = "Contributor";
      const careerID = candidate?.interviews?.[0]?.careerID || candidate?.interviews?.[0]?.id || candidate?.careerID || candidate?.interviews?.[0]?.interviewID || null;
      const jobOwner = await getJobOwner(careerID);
      const ownerEmail = typeof jobOwner === "string" ? jobOwner : jobOwner?.email;
      const authorEmail = user?.email || null;
      const isOwner = ownerEmail && authorEmail && ownerEmail.toLowerCase() === authorEmail.toLowerCase();
      if (isOwner) userRole = "Job Owner";
      const payload = {
        interviewID: null,
        orgID: orgId,
        comment: replyText.trim(),
        mentions: replyMentions,
        parentId,
        createdBy: {
          name: user?.name,
          email: user?.email,
          image: user?.image,
          role: userRole,
        },
        createdAt: new Date().toISOString(),
        type: 'candidate',
        candidateEmail: candidate?.email || null,
      };
      const res = await api.post("/api/add-feedback-comment", payload);
      const createdReply = res?.data?.comment || payload;
      setComments((prev)=> [createdReply, ...prev]);
      successToast("Reply posted", 1200);
      cancelReply();
    } catch (error) {
      console.error(error);
      errorToast("Failed to post reply", 1200);
    } finally {
      setIsPostingReply(false);
    }
  }

  // Group comments into parents and replies for threaded rendering
  const { parents, repliesByParent, idToIndex } = React.useMemo(() => {
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
      repliesByParent[k].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return { parents, repliesByParent, idToIndex };
  }, [comments]);

  

  if (!open) return null;
  return (
    <div className="modal-background fade-in-bottom">
      <div className="modal-container">
        <div className="modal-content" style={{ maxWidth: 860, width: '100%', background: '#fff', border: `1.5px solid #E9EAEB`, borderRadius: 14, boxShadow: "0 8px 32px rgba(30,32,60,0.18)" }}>
          <div className="modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid rgba(15,23,42,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Comments</h3>
            <button type="button" className="close" aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          {/* Candidate header (name, stage tag, job link + action buttons) */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(15,23,42,0.04)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AvatarImage
                  src={candidate?.image || '/default-avatar.png'}
                  alt={candidate?.name || 'Candidate'}
                  style={{ width: 56, height: 56, borderRadius: '50%' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 0, gap: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>{candidate?.name || 'Candidate Name'}</h3>

                    {stageLabel ? (
                      <div style={{ background: '#FFFAEB', color: '#B54708', fontSize: 12, padding: '4px 8px', border: '1px solid #FEDF89', borderRadius: 999, fontWeight: 500 }}>{stageLabel}</div>
                    ) : (
                      <div style={{ color: '#DC2626', fontSize: 12, padding: '4px 8px' }}>No stage</div>
                    )}
                  </div>

                  <div
                    onClick={() => {
                      
                    const interviewID =
                      interview?.interviewID || interview?._id || candidate?.interviews?.[0]?.interviewID || candidate?.interviews?.[0]?._id || null;
                    const careerID =
                      interview?.careerID || interview?.id || candidate?.interviews?.[0]?.careerID || candidate?.interviews?.[0]?.id || candidate?.careerID || null;

                    if (!careerID || !interviewID) {
                      errorToast("Missing interview/career id", 1500);
                      return;
                    }

                    router.push(
                      `/recruiter-dashboard/careers/manage/${careerID}/interview-analysis/${interviewID}?orgID=${orgId}`
                    );
                    }}
                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  >
                    <span>
                      for{' '}
                      <span style={{ color: '#1570EF', fontWeight: 500, fontSize: 16, borderBottom: '1px solid #1570EF' }}>{interview?.jobTitle || candidate?.jobTitle || candidate?.role || '—'}</span>
                    </span>
                    <i className="la la-external-link-alt" style={{ fontSize: 16, color: '#1570EF', marginLeft: 4 }} />
                  </div>
                </div>
              </div>

              {/* Added skill tags */}
              <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Skills</p>
                {skillsLoading ? (
                  <span style={{ fontSize: 12, color: '#6B7280' }}>Loading skills...</span>
                ) : skillList.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {skillList.map((skill, idx) => (
                      <div key={`skill-${idx}`} style={{ background: '#F8F9FC', color: '#363F72', fontSize: 13, fontWeight: 700, padding: '2px 8px', border: '1px solid #D5D9EB', borderRadius: 999 }}>{skill}</div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: '#6B7280' }}>No skills listed</span>
                )}
              </div>
            </div>
          </div>

          {/* Composer area */}
          <div style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <img src={user?.image || '/default-avatar.png'} alt={user?.name || 'You'} style={{ width: 40, height: 40, borderRadius: 999 }} />
              <div style={{ flex: 1 }}>
                <div className="comment-composer" style={{position: 'relative'}}>
                  <MentionsTagInput
                    key={composerKey}
                    value={text}
                    onChange={setText}
                    onMentionsChange={setMentions}
                    placeholder={`Write a comment about this candidate...`}
                    orgId={orgId}
                    user={user}
                  />
                  <Button 
                  onClick={postComment} 
                  disabled={!text.trim() || isPostingComment} 
                  // aria-label="Post comment" 
                  variant="primary"
                  label={isPostingComment ? 'Posting...' : 'Post'}
                  icon="/paper-plane.svg"
                  style={{ 
                    position: 'absolute', 
                    right: 16, 
                    bottom: 16,
                  }}
                    >
                   {/* <i className="las la-paper-plane" style={{ transform: "rotate(-35deg)" }}></i> */}
                </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Comments list */}
          <div style={{ padding: '8px 20px 20px', maxHeight: '46vh', overflowY: 'auto' }}>
            <div style={{ color: '#111827', fontWeight: 600, marginBottom: 12 }}>All Comments</div>
            {/* Comments rendering should be added here. Keep placeholder for now. */}
            {comments && comments.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {parents.map((parent: any, idx: number) => {
                  const parentKey = String(parent._id);
                  const parentId = parent._id;
                  const isEditing = !!parent._id && editingCommentId === parent._id;
                  const isParentDeleted = parent.deleted === true || parent.deleted === 'true' || !!parent.deletedAt;
                  const canEdit = !!parent._id && ((user?.email || '').toLowerCase() === (typeof parent.createdBy === 'string' ? (parent.createdBy || '').toLowerCase() : (parent.createdBy?.email || '').toLowerCase())) && !isParentDeleted;
                  const resolvedIdx = parent._id ? (idToIndex[String(parent._id)] ?? idx) : idx;
                  const children = repliesByParent[String(parent._id)] || [];

                  return (
                    <React.Fragment key={parentKey}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingTop: 8 }}>
                        {isParentDeleted ? (
                          <div style={{ width: 40, height: 40, backgroundColor: '#F8F9FC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="las la-user text-xl"></i>
                          </div>
                        ) : (
                          <div style={{ width: 40 }}>
                            <AvatarImage src={parent.createdBy?.image} alt={parent.createdBy?.name || "User"} />
                          </div>
                        )}

                        <div style={{ flex: 1 }}>
                          {isParentDeleted ? (
                            <>
                              <div style={{ fontStyle: 'italic', color: '#6B7280' }}>Comment deleted by its author</div>
                              <div style={{ color: '#717680', fontWeight: 500, fontSize: '14px', paddingBottom: 10 }}>
                                {new Date(parent.deletedAt || parent.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                              </div>
                            </>
                          ) : isEditing ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <div>
                                  <strong>{parent.createdBy?.name || parent.createdByName || 'Contributor'}</strong>
                                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                                    <span>You are editing a comment</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ flex:1 }}>
                                <div className="comment-composer" style={{position: 'relative'}}>
                                  <MentionsTagInput
                                    value={editingText}
                                    onChange={setEditingText}
                                    onMentionsChange={setEditingMentions}
                                    placeholder="Edit comment..."
                                    orgId={orgId}
                                    user={user}
                                    autoFocusEnd
                                    />
                                  <div style={{ position: 'absolute', right: 16, bottom: 12, display: 'flex', gap: 8  }}>
                                    <button onClick={cancelEdit} style={{ background: '#fff', border: '1px solid #D5D7DA', padding: '8px 16px', borderRadius: 60, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
                                    <button disabled={!editingText.trim()} onClick={() => saveEditedComment(resolvedIdx)} style={{ background: !editingText.trim() ? '#E5E7EB' : '#181D27', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 60, cursor: !editingText.trim() ? 'not-allowed' : 'pointer', fontSize: 14 }}>Save</button>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <div>
                                  <p style={{ marginBottom: 0, fontWeight: 700, fontSize: '14px', color: '#181D27' }}>{parent.createdBy?.name || parent.createdByName || 'Contributor'}</p>
                                  <div style={{ color: '#717680', fontWeight: 500, fontSize: '14px' }}>
                                    <span style={{ textTransform: 'capitalize' }}>{parent.createdBy?.role?.replace('_', ' ')}</span> | {new Date(parent.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                    {parent.editedAt && (() => {
                                      const editedDate = new Date(parent.editedAt);
                                      const time = (Date.now() - editedDate.getTime()) / 1000;
                                      let label = 'Edited';
                                      if(time <= 60) {label = 'Edited just now';}
                                      else if (time < 3600) {label = `Edited ${Math.floor(time / 60)}m ago`;}
                                      return <span> | {label}</span>
                                    })()}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                  {canEdit ? (
                                    <>
                                      <i className="la la-trash text-lg" title="Delete comment" style={{ cursor: 'pointer', color: '#6B7280' }} onClick={() => openDeleteModal(resolvedIdx)} />
                                      <i className="las la-pencil-alt text-lg" title="Edit comment" style={{ cursor: 'pointer', color: '#6B7280' }} onClick={() => startEditComment(parent, resolvedIdx)} />
                                    </>
                                  ) : (
                                    <i className="la la-reply text-lg" title="Reply" style={{ cursor: 'pointer', color: '#6B7280' }} onClick={() => startReply(parent._id)} />
                                  )}
                                </div>
                              </div>

                              <div style={{ marginTop: 6, fontSize: '16px', lineHeight: '24px', color: '#181D27', paddingBottom: 10 }}>{renderCommentText(parent.text || parent.comment || parent.feedback)}</div>

                              {replyingToCommentId === parent._id && (
                                <div style={{ marginTop: 12, marginLeft: 32 }}>
                                  <div style={{display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 10}}>
                                    <i className="las la-undo" style={{transform: 'scaleX(-1) scaleY(-1)', display: 'inline-block', fontSize: '14px',  color: "#A4A7AE"}}></i>
                                    <p style={{margin: 0, fontSize: '14px',  color: "#A4A7AE", fontWeight: '500', lineHeight: '20px'}}>Replying to {parent.createdBy?.name || parent.createdByName || 'Contributor'}</p>
                                  </div>
                                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <div style={{ width: 32 }}>
                                      <AvatarImage src={user?.image} alt={user?.name || 'You'} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div className="comment-composer" style={{position: 'relative'}}>
                                        <MentionsTagInput
                                          value={replyText}
                                          onChange={setReplyText}
                                          placeholder="Write a reply ..."
                                          orgId={orgId}
                                          onMentionsChange={setReplyMentions}
                                          user={user}
                                          autoFocusEnd
                                        />
                                        <div style={{ position: 'absolute', right: 16, bottom: 12, display: 'flex', gap: 8 }}>
                                          <button onClick={cancelReply} style={{ background: '#fff', border: '1px solid #D5D7DA', padding: '8px 16px', borderRadius: 60, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
                                          <button disabled={!replyText.trim() || isPostingReply} onClick={() => postReply(parent._id)} style={{ background: !replyText.trim() || isPostingReply ? '#E5E7EB' : '#181D27', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 60, cursor: !replyText.trim() || isPostingReply ? 'not-allowed' : 'pointer', fontSize: 14 }}>{isPostingReply ? 'Posting...' : 'Reply'}</button>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginLeft: 32, marginTop: 6 }}>
                          {children.map((reply: any, childIdx: number) => {
                            const replyKey = String(reply._id);
                            const resolvedReplyIdx = idToIndex[String(reply._id)] ?? (idx + childIdx + 1);
                            const isReplyEditing = !!reply._id && editingCommentId === reply._id;
                            const isReplyDeleted = reply.deleted === true || reply.deleted === 'true' || !!reply.deletedAt;
                            const canEditReply = !!reply._id && ((user?.email || '').toLowerCase() === (typeof reply.createdBy === 'string' ? (reply.createdBy || '').toLowerCase() : (reply.createdBy?.email || '').toLowerCase())) && !isReplyDeleted;

                            return (
                              <div key={replyKey} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
                                {isReplyDeleted ? (
                                  <div style={{display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 10}}>
                                    <i className="las la-undo" style={{transform: 'scaleX(-1) scaleY(-1)', display: 'inline-block', fontSize: '14px',  color: "#A4A7AE"}}></i>
                                    <div style={{ width: 32, height: 32, backgroundColor: '#F8F9FC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <i className="las la-user text-lg"></i>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                                    <i className="las la-undo" style={{transform: 'scaleX(-1) scaleY(-1)', display: 'inline-block', fontSize: '16px',  color: "#A4A7AE", marginBottom: 5}}></i>
                                    <AvatarImage src={reply.createdBy?.image} alt={reply.createdBy?.name || "User"} />
                                  </div>
                                )}
                                <div style={{ flex: 1 }}>
                                  {isReplyDeleted ? (
                                    <>
                                      <div style={{ fontStyle: 'italic', color: '#6B7280' }}>Comment deleted by its author</div>
                                      <div style={{ color: '#717680', fontWeight: 500, fontSize: '14px', paddingBottom: 10 }}>{new Date(reply.deletedAt || reply.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}</div>
                                    </>
                                  ) : isReplyEditing ? (
                                    <div className="comment-composer" style={{ position: 'relative' }}>
                                      <MentionsTagInput
                                        value={editingText}
                                        onChange={setEditingText}
                                        onMentionsChange={setEditingMentions}
                                        placeholder="Edit reply..."
                                        orgId={orgId}
                                        user={user}
                                        autoFocusEnd
                                      />
                                      <div style={{ position: 'absolute', right: 16, bottom: 12, display: 'flex', gap: 8}}>
                                        <button onClick={cancelEdit} style={{ background: '#fff', border: '1px solid #D5D7DA', padding: '8px 16px', borderRadius: 60, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
                                        <button disabled={!editingText.trim()} onClick={() => saveEditedComment(resolvedReplyIdx)} style={{ background: !editingText.trim() ? '#E5E7EB' : '#181D27', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 60, cursor: !editingText.trim() ? 'not-allowed' : 'pointer', fontSize: 14 }}>Save</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                      <div>
                                        <p style={{ marginBottom: 0, fontWeight: 700, fontSize: '14px', color: '#181D27' }}>{reply.createdBy?.name || reply.createdByName || 'Contributor'}</p>
                                        <div style={{ color: '#717680', fontWeight: 500, fontSize: '14px' }}>
                                          <span style={{ textTransform: 'capitalize' }}>{reply.createdBy?.role?.replace('_', ' ')}</span> | {new Date(reply.createdAt || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric',  hour: 'numeric', minute: 'numeric' })}
                                          {reply.editedAt && (() => {
                                            const editedDate = new Date(reply.editedAt);
                                            const time = (Date.now() - editedDate.getTime()) / 1000;
                                            let label = 'Edited';
                                            if(time <= 60) {label = 'Edited just now';}
                                            else if (time < 3600) {label = `Edited ${Math.floor(time / 60)}m ago`;}
                                            return <span> | {label}</span>
                                          })()}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                        {canEditReply ? (
                                          <>
                                            <i className="la la-trash text-lg" title="Delete reply" style={{ cursor: 'pointer', color: '#6B7280' }} onClick={() => openDeleteModal(resolvedReplyIdx)} />
                                            <i className="las la-pencil-alt text-lg" title="Edit reply" style={{ cursor: 'pointer', color: '#6B7280' }} onClick={() => startEditComment(reply, resolvedReplyIdx)} />
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                  )}

                                  {!isReplyEditing && !isReplyDeleted && (
                                    <div style={{ marginTop: 12, fontSize: '16px', lineHeight: '24px', color: '#181D27' }}>{renderCommentText(reply.text || reply.comment || reply.feedback)}</div>
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
            ) : (
              <div style={{ padding: 16 }}>
                <span style={{ color: "#6B7280" }}>No comments yet for this candidate.</span>
              </div>
            )}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateCommentModal;
