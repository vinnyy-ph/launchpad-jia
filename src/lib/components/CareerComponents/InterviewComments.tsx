import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import moment from "moment";
import { api } from "@/lib/utils/apiClient";
import useDebounce from "@/lib/hooks/useDebounceHook";
import MentionDropdown from "./MentionDropdown";
import CommentNodeComponent, { CommentNode, InterviewComment } from "./CommentNode";

export type { InterviewComment };

type UserInfo =
  | {
    name?: string;
    email?: string;
    image?: string;
  }
  | null;

interface CommentComposerProps {
  user: UserInfo;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  placeholder?: string;
  submitLabel?: string;
  submittingLabel?: string;
  containerStyle?: React.CSSProperties;
  disabled?: boolean;
  orgId?: string | null;
  onCancel?: () => void;
  showCancelButton?: boolean;
}

const getAuthorInitial = (
  name?: string,
  email?: string,
  fallback?: string
) => (name || email || fallback || "R").charAt(0).toUpperCase();

const MENTION_TERMINATOR = "\u00a0"; // non-breaking space acts as visible boundary

type MentionState = {
  active: boolean;
  query: string;
  startIndex: number | null;
};

type MemberSuggestion = {
  _id: string;
  name?: string;
  email?: string;
  image?: string;
};

const mentionTokenStyles: React.CSSProperties = {
  display: "inline",
  backgroundColor: "#C7D2FE",
  color: "#4F46E5",
  borderRadius: 4,
  padding: "0 4px",
  fontWeight: 600,
};

const mentionTokenStyleString =
  "display:inline;background-color:#EEF2FF;color:#4B48EC;border-radius:4px;padding:0 4px;font-weight:600;";

const createMentionRegex = () =>
  new RegExp(`@([^${MENTION_TERMINATOR}]+)${MENTION_TERMINATOR}`, "g");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\u00a0/g, "&nbsp;");

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

const sanitizeMentionLabel = (member: MemberSuggestion) => {
  const rawLabel =
    member.name?.trim() ||
    member.email?.trim() ||
    "Teammate";
  return rawLabel.replace(/\s+/g, " ").trim();
};

type MentionRange = {
  start: number;
  end: number;
  label: string;
};

const getMentionRanges = (text: string): MentionRange[] => {
  const ranges: MentionRange[] = [];
  const regex = createMentionRegex();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    ranges.push({
      start: match.index,
      end: regex.lastIndex,
      label: match[1],
    });
  }
  return ranges;
};

export const CommentComposer: React.FC<CommentComposerProps> = ({
  user,
  value,
  onChange,
  onSubmit,
  isSubmitting,
  placeholder = "Write a comment about this candidate...",
  submitLabel = "Post",
  submittingLabel = "Posting...",
  containerStyle,
  disabled = false,
  orgId,
  onCancel,
  showCancelButton = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [mentionState, setMentionState] = useState<MentionState>({
    active: false,
    query: "",
    startIndex: null,
  });
  const [mentionOptions, setMentionOptions] = useState<MemberSuggestion[]>([]);
  const [isMentionLoading, setIsMentionLoading] = useState(false);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const debouncedMentionQuery = useDebounce(mentionState.query, 250);
  const mentionRanges = useMemo(() => getMentionRanges(value), [value]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const isButtonDisabled = !value.trim() || isSubmitting || disabled;

  const updateDropdownPosition = useCallback(() => {
    if (!textareaRef.current || !composerRef.current || !mirrorRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    const composerRect = composerRef.current.getBoundingClientRect();
    const mirror = mirrorRef.current;

    if (mentionState.startIndex !== null) {
      const beforeCaret = textarea.value.slice(0, mentionState.startIndex + 1);
      mirror.textContent = beforeCaret;
      mirror.style.cssText = window.getComputedStyle(textarea).cssText;
      mirror.style.position = "absolute";
      mirror.style.visibility = "hidden";
      mirror.style.whiteSpace = "pre-wrap";
      mirror.style.wordBreak = "break-word";
      mirror.style.width = `${textarea.clientWidth}px`;
      mirror.style.height = "auto";
      mirror.style.overflow = "hidden";

      const marker = document.createElement("span");
      marker.textContent = "@";
      mirror.appendChild(marker);

      const markerRect = marker.getBoundingClientRect();
      mirror.innerHTML = "";

      const top =
        markerRect.bottom -
        composerRect.top -
        textarea.scrollTop +
        6;
      const left =
        markerRect.left -
        composerRect.left -
        textarea.scrollLeft;

      setDropdownPosition({
        top,
        left: Math.max(left, 0),
      });
      return;
    }

    const textareaRect = textarea.getBoundingClientRect();
    setDropdownPosition({
      top: textareaRect.bottom - composerRect.top + 8,
      left: textareaRect.left - composerRef.current.getBoundingClientRect().left,
    });
  }, [mentionState.startIndex]);

  const resetMentionState = useCallback(() => {
    setMentionState({ active: false, query: "", startIndex: null });
    setMentionOptions([]);
    setActiveMentionIndex(0);
    setIsMentionLoading(false);
  }, []);

  const evaluateMentionTrigger = useCallback(
    (text: string, cursorPosition: number | null) => {
      if (disabled) {
        resetMentionState();
        return;
      }

      if (cursorPosition === null) {
        resetMentionState();
        return;
      }

      const uptoCursor = text.slice(0, cursorPosition);

      // Check if cursor is right after a completed mention (ends with MENTION_TERMINATOR)
      if (uptoCursor.endsWith(MENTION_TERMINATOR)) {
        resetMentionState();
        return;
      }

      // Match @ that is NOT preceded by a non-whitespace character (to avoid matching inside completed mentions)
      const match = /(^|\s)@([^@\u00a0]*)$/u.exec(uptoCursor);

      if (match) {
        const query = match[2] ?? "";
        const startIndex = cursorPosition - query.length - 1;
        setMentionState({
          active: true,
          query,
          startIndex,
        });
      } else {
        resetMentionState();
      }
    },
    [disabled, resetMentionState]
  );

  useEffect(() => {
    if (!mentionState.active || !orgId || disabled) {
      if (!mentionState.active) {
        setMentionOptions([]);
      }
      setIsMentionLoading(false);
      return;
    }

    let isCancelled = false;
    setIsMentionLoading(true);
    const params: Record<string, string | number> = {
      orgID: orgId,
      page: 1,
      limit: 8,
    };

    if (debouncedMentionQuery.trim()) {
      params.search = debouncedMentionQuery.trim();
    }

    api
      .get("/api/search-members", { params })
      .then((response) => {
        if (isCancelled) {
          return;
        }
        setMentionOptions(response.data?.members ?? []);
        setActiveMentionIndex(0);
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error("Failed to load mention suggestions", error);
          setMentionOptions([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsMentionLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedMentionQuery, mentionState.active, orgId, disabled]);

  useEffect(() => {
    if (mentionState.active) {
      updateDropdownPosition();
    }
  }, [mentionState.active, updateDropdownPosition]);

  // Auto-close dropdown when no results after user stops typing
  useEffect(() => {
    if (
      mentionState.active &&
      !isMentionLoading &&
      mentionOptions.length === 0 &&
      debouncedMentionQuery.trim().length > 0
    ) {
      const timer = setTimeout(() => {
        resetMentionState();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [
    mentionState.active,
    isMentionLoading,
    mentionOptions.length,
    debouncedMentionQuery,
    resetMentionState,
  ]);

  useEffect(() => {
    const handleResize = () => {
      if (mentionState.active) {
        updateDropdownPosition();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mentionState.active, updateDropdownPosition]);

  const handleSubmit = useCallback(() => {
    if (!isButtonDisabled) {
      onSubmit();
    }
  }, [isButtonDisabled, onSubmit]);

  const handleTextareaChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const nextValue = event.target.value;
    onChange(nextValue);
    evaluateMentionTrigger(nextValue, event.target.selectionStart ?? null);
  };

  const handleSelectionChange = (
    event: React.SyntheticEvent<HTMLTextAreaElement>
  ) => {
    evaluateMentionTrigger(
      event.currentTarget.value,
      event.currentTarget.selectionStart ?? null
    );
  };

  const moveCaret = useCallback(
    (position: number) => {
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = position;
          textareaRef.current.selectionEnd = position;
          textareaRef.current.focus();
          updateDropdownPosition();
        }
      });
    },
    [updateDropdownPosition]
  );

  const findPreviousMentionBoundary = useCallback(
    (caret: number) => {
      return mentionRanges.find(
        (range) => caret > range.start && caret <= range.end
      );
    },
    [mentionRanges]
  );

  const findNextMentionBoundary = useCallback(
    (caret: number) => {
      return mentionRanges.find(
        (range) => caret >= range.start && caret < range.end
      );
    },
    [mentionRanges]
  );

  const handleMentionSelection = (member: MemberSuggestion) => {
    if (!textareaRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart ?? value.length;
    const insertionStart =
      mentionState.startIndex !== null
        ? mentionState.startIndex
        : Math.max(cursorPosition - (mentionState.query.length + 1), 0);

    const before = value.slice(0, insertionStart);
    const after = value.slice(cursorPosition);
    const mentionLabel = sanitizeMentionLabel(member);
    const mentionToken = `@${mentionLabel}${MENTION_TERMINATOR}`;
    // Don't add extra space - the MENTION_TERMINATOR already acts as a space
    const nextValue = `${before}${mentionToken}${after}`;

    onChange(nextValue);
    resetMentionState();

    moveCaret(before.length + mentionToken.length);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
      return;
    }

    const textarea = textareaRef.current;
    const caretPosition = textarea?.selectionStart ?? null;
    const hasSelection =
      textarea &&
      (textarea.selectionStart ?? 0) !== (textarea.selectionEnd ?? 0);

    if (
      !disabled &&
      caretPosition !== null &&
      !hasSelection &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      if (event.key === "ArrowLeft") {
        const mention = findPreviousMentionBoundary(caretPosition);
        if (mention) {
          event.preventDefault();
          moveCaret(mention.start);
          return;
        }
      } else {
        const mention = findNextMentionBoundary(caretPosition);
        if (mention) {
          event.preventDefault();
          moveCaret(mention.end);
          return;
        }
      }
    }

    if (!mentionState.active || disabled) {
      return;
    }

    if (event.key === "ArrowDown" && mentionOptions.length > 0) {
      event.preventDefault();
      setActiveMentionIndex((prev) =>
        (prev + 1) % mentionOptions.length
      );
      return;
    }

    if (event.key === "ArrowUp" && mentionOptions.length > 0) {
      event.preventDefault();
      setActiveMentionIndex((prev) =>
        prev === 0 ? mentionOptions.length - 1 : prev - 1
      );
      return;
    }

    if (
      (event.key === "Enter" || event.key === "Tab") &&
      mentionOptions.length > 0
    ) {
      event.preventDefault();
      handleMentionSelection(mentionOptions[activeMentionIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetMentionState();
      return;
    }
  };

  return (
    <div
      ref={composerRef}
      className="comment-composer"
      style={{
        position: "relative",
        width: "100%",
        paddingLeft: 56,
        ...(containerStyle || {}),
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: 0,
          width: 40,
          height: 40,
          borderRadius: "50%",
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9EAEB",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.08)",
        }}
      >
        {user?.image ? (
          <img
            src={user.image}
            alt={user?.name || "Recruiter"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <span
            style={{
              fontWeight: 600,
              color: "#414651",
            }}
          >
            {getAuthorInitial(user?.name, user?.email)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ position: "relative" }}>
          {/* Background layer */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              zIndex: 0,
            }}
          />
          
          {/* Highlighting overlay for mentions */}
          <div
            ref={highlightRef}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "1px solid transparent",
              borderRadius: 12,
              padding: "10px 110px 10px 16px",
              fontSize: 14,
              lineHeight: "20px",
              minHeight: 88,
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
              pointerEvents: "none",
              overflow: "hidden",
              zIndex: 1,
            }}
          >
            {(() => {
              const segments: React.ReactNode[] = [];
              let lastIndex = 0;
              
              // Sort ranges by start position
              const sortedRanges = [...mentionRanges].sort((a, b) => a.start - b.start);
              
              sortedRanges.forEach((range, idx) => {
                // Add text before mention (invisible)
                if (range.start > lastIndex) {
                  segments.push(
                    <span key={`text-${idx}`} style={{ color: 'transparent' }}>
                      {value.slice(lastIndex, range.start)}
                    </span>
                  );
                }
                
                // Add highlighted mention background only (exclude the trailing non-breaking space)
                const mentionText = value.slice(range.start, range.end);
                const mentionWithoutTerminator = mentionText.endsWith(MENTION_TERMINATOR) 
                  ? mentionText.slice(0, -1) 
                  : mentionText;
                const terminatorOnly = mentionText.endsWith(MENTION_TERMINATOR) 
                  ? MENTION_TERMINATOR 
                  : '';
                
                segments.push(
                  <span
                    key={`mention-${idx}`}
                    style={{
                      backgroundColor: '#C7D2FE',
                      color: 'transparent',
                      borderRadius: 4,
                    }}
                  >
                    {mentionWithoutTerminator}
                  </span>
                );
                
                // Add the non-breaking space without highlight
                if (terminatorOnly) {
                  segments.push(
                    <span key={`terminator-${idx}`} style={{ color: 'transparent' }}>
                      {terminatorOnly}
                    </span>
                  );
                }
                
                lastIndex = range.end;
              });
              
              // Add remaining text (invisible)
              if (lastIndex < value.length) {
                segments.push(
                  <span key="text-end" style={{ color: 'transparent' }}>
                    {value.slice(lastIndex)}
                  </span>
                );
              }
              
              return segments;
            })()}
          </div>
          
          <textarea
            ref={textareaRef}
            className="comment-textarea"
            placeholder={placeholder}
            value={value}
            onChange={handleTextareaChange}
            onSelect={handleSelectionChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
            }}
            onScroll={(e) => {
              if (mentionState.active) {
                updateDropdownPosition();
              }
              // Sync scroll with highlight overlay
              if (highlightRef.current) {
                highlightRef.current.scrollTop = e.currentTarget.scrollTop;
                highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
            onKeyDown={handleKeyDown}
            style={{
              position: "relative",
              width: "100%",
              border: `1px solid ${isFocused ? "#6172F3" : "#E4E7EC"}`,
              borderRadius: 12,
              padding: "10px 110px 10px 16px",
              outline: "none",
              resize: "none",
              backgroundColor: "transparent",
              fontSize: 14,
              lineHeight: "20px",
              minHeight: 88,
              boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
              caretColor: "#101828",
              zIndex: 2,
            }}
            disabled={disabled}
          />
        </div>
        <div
          ref={mirrorRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            visibility: "hidden",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            pointerEvents: "none",
            zIndex: -1,
          }}
        />
        {mentionState.active && !disabled && (
          <MentionDropdown
            mentionOptions={mentionOptions}
            isMentionLoading={isMentionLoading}
            activeMentionIndex={activeMentionIndex}
            onSelect={handleMentionSelection}
            position={dropdownPosition}
            orgId={orgId}
            query={mentionState.query}
            textareaWidth={textareaRef.current?.clientWidth}
          />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 15,
          right: 20,
          display: "flex",
          gap: 8,
          zIndex: 10,
        }}
      >
        {showCancelButton && onCancel && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 8,
              border: "1px solid #E4E7EC",
              backgroundColor: "#FFFFFF",
              color: "#344054",
              padding: "6px 14px",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={isButtonDisabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleSubmit();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 8,
            border: "none",
            backgroundColor: isButtonDisabled ? "#F2F4F7" : "#181D27",
            color: isButtonDisabled ? "#98A2B3" : "#FFFFFF",
            padding: "6px 14px",
            fontWeight: 600,
            fontSize: 13,
            cursor: isButtonDisabled ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: isButtonDisabled
              ? "none"
              : "0px 1px 2px rgba(24, 29, 39, 0.2)",
          }}
        >
          <i className="la la-paper-plane" style={{ fontSize: 14 }}></i>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
};

interface InterviewCommentsProps {
  user: UserInfo;
  orgId?: string | null;
  comments: InterviewComment[];
  newComment: string;
  setNewComment: React.Dispatch<React.SetStateAction<string>>;
  onAddComment: () => void | Promise<void>;
  isSavingComment: boolean;
  commentBeingDeleted: string | null;
  onDeleteComment: (commentId: string) => void;
  onReplyToComment: (
    parentCommentId: string,
    message: string
  ) => Promise<void>;
  onEditComment: (
    commentId: string,
    updatedMessage: string
  ) => Promise<void>;
  commentBeingUpdated: string | null;
  replyParentBeingSaved: string | null;
  commentsContainerRef: RefObject<HTMLDivElement>;
}

const InterviewComments: React.FC<InterviewCommentsProps> = ({
  user,
  orgId,
  comments,
  newComment,
  setNewComment,
  onAddComment,
  isSavingComment,
  commentBeingDeleted,
  onDeleteComment,
  onReplyToComment,
  onEditComment,
  commentBeingUpdated,
  replyParentBeingSaved,
  commentsContainerRef,
}) => {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(
    null
  );
  const [replyDraft, setReplyDraft] = useState("");
  const [threadVisibility, setThreadVisibility] = useState<
    Record<string, "collapsed" | "expanded">
  >({});

  const isCurrentUsersComment = (comment: InterviewComment) => {
    if (comment.author?.email && user?.email) {
      return comment.author.email === user.email;
    }
    if (comment.author?.name && user?.name) {
      return comment.author.name === user.name;
    }
    return false;
  };

  useEffect(() => {
    if (
      editingCommentId &&
      !comments.some((comment) => comment.id === editingCommentId)
    ) {
      setEditingCommentId(null);
      setEditingDraft("");
    }
  }, [comments, editingCommentId]);

  useEffect(() => {
    if (
      replyingToCommentId &&
      !comments.some((comment) => comment.id === replyingToCommentId)
    ) {
      setReplyingToCommentId(null);
      setReplyDraft("");
    }
  }, [comments, replyingToCommentId]);

  const commentTree = useMemo<CommentNode[]>(() => {
    const lookup = new Map<string, CommentNode>();
    comments.forEach((comment) => {
      lookup.set(comment.id, { ...comment, replies: [] });
    });

    const roots: CommentNode[] = [];

    lookup.forEach((comment) => {
      if (comment.parentId && lookup.has(comment.parentId)) {
        const parent = lookup.get(comment.parentId);
        parent?.replies.push(comment);
      } else {
        roots.push(comment);
      }
    });

    const sortNodes = (nodes: CommentNode[]) => {
      nodes.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      nodes.forEach((node) => sortNodes(node.replies));
    };

    sortNodes(roots);
    return roots;
  }, [comments]);

  const handleStartEditing = (comment: InterviewComment) => {
    setEditingCommentId(comment.id);
    setEditingDraft(comment.message);
    setReplyingToCommentId(null);
    setReplyDraft("");
  };

  const handleCancelEditing = () => {
    setEditingCommentId(null);
    setEditingDraft("");
  };

  const handleSaveEdit = async () => {
    if (!editingCommentId || !editingDraft.trim()) {
      return;
    }
    try {
      await onEditComment(editingCommentId, editingDraft.trim());
      setEditingCommentId(null);
      setEditingDraft("");
    } catch (error) {
      // leave editor open for retry
    }
  };

  const handleToggleReply = (commentId: string) => {
    if (replyingToCommentId === commentId) {
      setReplyingToCommentId(null);
      setReplyDraft("");
      return;
    }
    setReplyingToCommentId(commentId);
    setReplyDraft("");
    setEditingCommentId(null);
    setEditingDraft("");
  };

  const handleSubmitReply = async () => {
    if (!replyingToCommentId || !replyDraft.trim()) {
      return;
    }
    try {
      await onReplyToComment(replyingToCommentId, replyDraft.trim());
      setReplyingToCommentId(null);
      setReplyDraft("");
    } catch (error) {
      // leave reply open for retry
    }
  };

  const determineThreadState = (
    commentId: string,
    depth: number,
    hasReplies: boolean
  ): "collapsed" | "expanded" => {
    if (!hasReplies) {
      return "expanded";
    }
    const explicit = threadVisibility[commentId];
    if (explicit) {
      return explicit;
    }
    // Default to collapsed for all replies
    return "collapsed";
  };

  const toggleThreadState = (
    commentId: string,
    depth: number,
    hasReplies: boolean
  ) => {
    if (!hasReplies) {
      return;
    }
    setThreadVisibility((prev) => {
      const current = prev[commentId] ?? "collapsed";
      const next = current === "collapsed" ? "expanded" : "collapsed";
      return {
        ...prev,
        [commentId]: next,
      };
    });
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <CommentComposer
          user={user}
          orgId={orgId}
          value={newComment}
          onChange={setNewComment}
          onSubmit={onAddComment}
          isSubmitting={isSavingComment}
          placeholder="Write a comment about this candidate..."
          submitLabel="Post"
          submittingLabel="Posting..."
        />
        {/* <span
              style={{
                fontSize: 12,
                color: "#717680",
              }}
            >
              Comments are visible to everyone with access to this interview.
            </span> */}
        <hr style={{ border: "none", borderTop: "1px solid #E4E7EC", margin: "16px 0" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: -32 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#111827",
          }}
        >
          All Comments
        </span>
        {commentTree.length > 0 ? (
          <div
            ref={commentsContainerRef}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {commentTree.map((comment, index) => (
              <CommentNodeComponent
                key={comment.id}
                commentNode={comment}
                depth={0}
                isLastSibling={index === commentTree.length - 1}
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
        ) : (
          <div
            style={{
              border: "1px dashed #D5D7DA",
              borderRadius: 12,
              padding: "32px 16px",
              textAlign: "center",
              color: "#717680",
              backgroundColor: "#FCFCFD",
            }}
          >
            No comments yet. Be the first to leave a note for your team.
          </div>
        )}
      </div>
    </>
  );
};

export default InterviewComments;

