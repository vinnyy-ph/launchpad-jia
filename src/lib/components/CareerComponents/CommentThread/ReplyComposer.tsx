"use client";

import { useEffect, useRef } from "react";
import AvatarImage from "../../AvatarImage/AvatarImage";
import MentionsTagInput from "../MentionsTagInput";

type ReplyComposerProps = {
  parent: any;
  replyText: string;
  setReplyText: (text: string) => void;
  replyMentions: any[];
  setReplyMentions: (mentions: any[]) => void;
  user: any;
  effectiveOrgID: string;
  cancelReply: () => void;
  postReply: (parentId: string) => void;
  isPostingReply: boolean;
  replyToName?: string;
  teamMembers?: any[];
}

export function ReplyComposer({ parent, replyText, setReplyText, replyMentions, setReplyMentions, user, effectiveOrgID, cancelReply, postReply, isPostingReply, replyToName, teamMembers }: ReplyComposerProps) {
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <div ref={composerRef} style={{ marginTop: 12, marginLeft: 0 }}>
      {replyToName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 10 }}>
          <i className="las la-undo" style={{ transform: 'scaleX(-1) scaleY(-1)', display: 'inline-block', fontSize: '14px', color: "#A4A7AE" }}></i>
          <p style={{ margin: 0, fontSize: '14px', color: "#A4A7AE", fontWeight: '500', lineHeight: '20px' }}>Replying to {replyToName}</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 32 }}>
          <AvatarImage src={user?.image} alt={user?.name || 'You'} />
        </div>

        <div style={{ flex: 1 }}>
          <div className="comment-composer" style={{ position: 'relative' }}>
            <MentionsTagInput
              value={replyText}
              onChange={setReplyText}
              placeholder="Write a reply ..."
              orgId={effectiveOrgID as string}
              onMentionsChange={setReplyMentions}
              user={user}
              teamMembers={teamMembers}
            />
            <div style={{ position: 'absolute', right: 16, bottom: 12, display: 'flex', gap: 8 }}>
              <button onClick={cancelReply} style={{
                background: '#fff',
                border: '1px solid #D5D7DA',
                padding: '8px 16px',
                borderRadius: 60,
                cursor: 'pointer',
                fontSize: 14
              }}>
                Cancel</button>
              <button disabled={!replyText.trim() || isPostingReply} onClick={() => postReply(parent._id)} style={{
                background: !replyText.trim() || isPostingReply ? '#E5E7EB' : '#181D27',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 60,
                cursor: !replyText.trim() || isPostingReply ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}>
                {isPostingReply ? 'Posting...' : 'Reply'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}