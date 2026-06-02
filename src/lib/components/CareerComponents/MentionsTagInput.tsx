import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from "react-dom";
import { api } from '@/lib/utils/apiClient';
import { normalizeCareerTeamRole } from "@/lib/utils/careerTeamRole";

export interface MentionSuggestion { id: string; display: string; email?: string; avatarUrl?: string; isRole?: boolean; roleMembers?: MentionSuggestion[] }

type TextSegment = { type: 'text'; value: string };
type MentionSegment = { type: 'mention'; chip: MentionSuggestion };
type Segment = TextSegment | MentionSegment;

function isMention(seg: Segment): seg is MentionSegment {
  return seg.type === 'mention';
}

interface MentionsTagInputProps {
  value: string;
  onChange: (val: string) => void;
  onMentionsChange?: (mentions: MentionSuggestion[]) => void;
  orgId: string;
  user: any;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocusEnd?: boolean;
  teamMembers?: any[];
}

// Regex to match serialized mentions: @[display](id)
const MENTION_REGEX = /@\[(.+?)\]\((.+?)\)/g;

// Parse serialized string into segments
function parseSerialized(raw: string): Segment[] {
  if (!raw) return [{ type: 'text', value: '' }];
  const out: Segment[] = [];
  let last = 0; let m: RegExpExecArray | null;
  while ((m = MENTION_REGEX.exec(raw))) {
    if (m.index > last) out.push({ type: 'text', value: raw.slice(last, m.index) });
    out.push({ type: 'mention', chip: { display: m[1], id: m[2] } });
    last = MENTION_REGEX.lastIndex;
  }
  if (last < raw.length) out.push({ type: 'text', value: raw.slice(last) });
  return out.length ? out : [{ type: 'text', value: '' }];
}

// Serialize segments back into string
function serialize(segments: Segment[]): string {
  return segments.map(s => s.type === 'text' ? s.value : `@[${s.chip.display}](${s.chip.id})`).join('');
}

const MentionsTagInput: React.FC<MentionsTagInputProps> = ({
  value,
  onChange,
  onMentionsChange,
  orgId,
  user,
  placeholder,
  disabled,
  className,
  autoFocusEnd,
  teamMembers
}) => {
  const [segments, setSegments] = useState<Segment[]>(() => parseSerialized(value));
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSerialized = useRef<string>(value);
  // Avoid infinite loops when parents pass inline handlers:
  // the segments-render effect should NOT re-run just because `onChange` identity changes.
  const onChangeRef = useRef(onChange);
  const onMentionsChangeRef = useRef(onMentionsChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onMentionsChangeRef.current = onMentionsChange; }, [onMentionsChange]);
  const triggerPosition = useRef<Range | null>(null);
  const pendingFocus = useRef<{ id: string; display: string } | null>(null);
  const initializedRef = useRef<boolean>(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const getCaretRect = useCallback((): DOMRect | null => {
    if (typeof window === "undefined") return null;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!range) return null;

    // Prefer native rects when available
    const rects = range.getClientRects();
    const nativeRect = rects && rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    if (nativeRect && (nativeRect.left || nativeRect.top || nativeRect.right || nativeRect.bottom)) {
      return nativeRect;
    }

    // Fallback: insert a temporary marker at the caret to measure exact position.
    // This is more reliable inside contentEditable, especially with collapsed ranges.
    try {
      const marker = document.createElement("span");
      marker.textContent = "\u200b"; // zero-width space
      marker.style.position = "fixed";
      marker.style.pointerEvents = "none";
      marker.style.opacity = "0";

      const cloned = range.cloneRange();
      cloned.collapse(true);
      cloned.insertNode(marker);

      const mr = marker.getBoundingClientRect();
      marker.parentNode?.removeChild(marker);

      // Restore selection (in case DOM mutation disturbed it)
      sel.removeAllRanges();
      sel.addRange(range);

      if (mr && (mr.left || mr.top || mr.right || mr.bottom)) return mr;
    } catch {
      // ignore and fallback
    }

    return null;
  }, []);

  // Position the dropdown near the caret (or editor) in viewport coordinates.
  // This avoids odd placement inside transformed/scrollable containers (like the Candidate tooltip modal).
  const computeDropdownPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const menuWidth = 260;
    const menuMaxHeight = 240;
    const viewportPadding = 8;

    const caretRect = getCaretRect();
    const editorRect = editorRef.current ? editorRef.current.getBoundingClientRect() : null;

    const baseRect = caretRect || editorRect;

    if (!baseRect) return;

    // Anchor to the caret "end" (right edge) so the dropdown appears where you're typing.
    const preferredLeft = baseRect.right;
    const preferredTop = baseRect.bottom + 8;

    let left = Math.min(
      Math.max(preferredLeft, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding
    );

    const spaceBelow = window.innerHeight - preferredTop - viewportPadding;
    const spaceAbove = baseRect.top - viewportPadding;

    let top = preferredTop;
    if (spaceBelow < Math.min(menuMaxHeight, 160) && spaceAbove > spaceBelow) {
      // place above caret when there isn't enough room below
      top = Math.max(viewportPadding, baseRect.top - 8 - Math.min(menuMaxHeight, spaceAbove));
    }

    setDropdownPos({ top, left });
  }, [getCaretRect]);

  // Sync in if parent value changes externally
  useEffect(() => {
    if (value !== lastSerialized.current) {
      setSegments(parseSerialized(value));
    }
  }, [value]);

  // Fetch members suggestions
  const fetchMembers = useCallback(async (q: string) => {
    if (!orgId) return setSuggestions([]);
    try {
      const res = await api.post('/api/fetch-members', { orgID: orgId });
      const raw = Array.isArray(res.data) ? res.data : res.data?.members || [];
      const currentUserEmail = user?.email?.toLowerCase();

      let filtered = raw.filter((m: any) => [m.name, m.email].filter(Boolean).some(v => String(v).toLowerCase().includes(q.toLowerCase())))
     
      if(currentUserEmail) {
        filtered = filtered.filter((m: any) => (m.email || '').toLowerCase() !== currentUserEmail);
      }

      filtered = filtered.slice(0, 8);
      
      const memberSuggestions: MentionSuggestion[] = filtered.map((m:any) => ({ id: m._id || m.email, display: m.name || m.email, email: m.email, avatarUrl: m.image || m.avatar || m.photo })); // attempt common avatar field names

      // Derive role suggestions from career teamMembers
      let roleSuggestions: MentionSuggestion[] = [];
      if (teamMembers && teamMembers.length > 0) {
        const roleMap: Record<string, any[]> = {};
        teamMembers.forEach((tm: any) => {
          const normalizedRole = normalizeCareerTeamRole(tm.role) || tm.role;
          if (normalizedRole) {
            if (!roleMap[normalizedRole]) roleMap[normalizedRole] = [];
            roleMap[normalizedRole].push(tm);
          }
        });
        roleSuggestions = Object.entries(roleMap)
          .filter(([roleName]) => roleName.toLowerCase().includes(q.toLowerCase()))
          .map(([roleName, members]) => ({
            id: `role:${roleName}`,
            display: roleName,
            isRole: true,
            roleMembers: members.map((m: any) => ({
              id: m._id || m.email,
              display: m.name || m.email,
              email: m.email,
              avatarUrl: m.image || m.avatar || m.photo,
            })),
          }));
      }

      setSuggestions([...roleSuggestions, ...memberSuggestions]);
    } catch (e) {
      setSuggestions([]);
    }
  }, [orgId, user, teamMembers]);

  // Render segments into contentEditable
  useEffect(() => {
    const html = segments.map(seg => {
      if (seg.type === 'text') {
        return seg.value
          .replace(/&/g,'&amp;')
          .replace(/</g,'&lt;')
          .replace(/>/g,'&gt;')
          .replace(/\n/g,'<br/>');
      }
      // Editing pill (no leading @ inside chip)
      return `<span class="mention-chip" data-id="${seg.chip.id}" 
      style="background: #F5FAFF;
            color: #175CD3;
            padding: 4px 8px;
            border-radius: 8px;
            font-weight: 600;
            display: inline-block;
            border: 1px solid #D1E9FF;
            margin: 0 4px 0 0;
            white-space: nowrap;
      " contenteditable="false">${seg.chip.display}</span>`;
    }).join('');
    if (editorRef.current) {
      const root = editorRef.current;
      const needsRewrite = !!pendingFocus.current || !initializedRef.current; // always rewrite on first init or if we have pending focus
      if (needsRewrite) {
        // save caret absolute offset so we can restore after updating innerHTML
        const savedOffset = getCaretAbsoluteOffset();
        if (root.innerHTML !== html) {
          root.innerHTML = html || '<br />';
        }

        // If we have a pending focus (inserted mention), move caret after it
        if (pendingFocus.current) {
          const p = pendingFocus.current;
          pendingFocus.current = null;
          setTimeout(() => {
            const nodes = Array.from(root.querySelectorAll('.mention-chip')) as HTMLElement[];
            for (let i = nodes.length - 1; i >= 0; i--) {
              const n = nodes[i];
              if (n.getAttribute('data-id') === p.id && (n.textContent || '').trim() === p.display) {
                const range = document.createRange();
                range.setStartAfter(n);
                range.collapse(true);
                const sel = window.getSelection();
                if (sel) { sel.removeAllRanges(); sel.addRange(range); }
                (root as HTMLElement).focus();
                return;
              }
            }
            // fallback: restore saved offset if cannot find node
            setCaretAtCharOffset(savedOffset);
          }, 0);
        } else {
          // On first init with autoFocusEnd, place caret at end; otherwise restore offset
          if (!initializedRef.current && autoFocusEnd) {
            setTimeout(() => placeCaretAtEnd(), 0);
          } else {
            setTimeout(() => setCaretAtCharOffset(savedOffset), 0);
          }
        }
        initializedRef.current = true;
      }
    }
    const serialized = serialize(segments);
    lastSerialized.current = serialized;
    onChangeRef.current(serialized);
    onMentionsChangeRef.current?.(segments.filter(isMention).map(s=> s.chip));
  }, [segments]);

  // Place caret at end of contentEditable
  const placeCaretAtEnd = () => {
    const el = editorRef.current; if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
  };

  // Extract plain text (for scanning @query)
  const getPlainTextWithMarkers = (): { text: string; map: Segment[] } => {
    let text = '';
    segments.forEach(seg => {
      if (seg.type === 'text') text += seg.value;
      else text += `@${seg.chip.display}`; // visual text of chip
    });
    return { text, map: segments };
  };

  // Place caret at end of contentEditable
  const getCaretAbsoluteOffset = (): number => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return 0;
    const range = sel.getRangeAt(0).cloneRange();
    const tempRange = range.cloneRange();
    tempRange.selectNodeContents(editorRef.current as HTMLDivElement);
    tempRange.setEnd(range.endContainer, range.endOffset);
    return tempRange.toString().length;
  };

  // Place caret at specific character offset in contentEditable
  const setCaretAtCharOffset = (offset: number) => {
    const root = editorRef.current; if (!root) return;
    let remaining = Math.max(0, offset);
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(true);

    const nodes = Array.from(root.childNodes);
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (remaining <= text.length) {
          range.setStart(node, remaining);
          range.collapse(true);
          const sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(range); }
          (root as HTMLElement).focus();
          return;
        }
        remaining -= text.length;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const txt = (el.textContent || '');
        const len = txt.length;
        if (el.classList.contains('mention-chip')) {
          // mention counts as its display length but caret cannot be inside it, place it after the element
          if (remaining <= len) {
            range.setStartAfter(el);
            range.collapse(true);
            const sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(range); }
            (root as HTMLElement).focus();
            return;
          }
          remaining -= len;
        } else {
          // other element - treat by textContent
          if (remaining <= len) {
            // find a text node inside element to position inside
            const textNode = el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE ? el.firstChild : null;
            if (textNode) {
              const offsetIn = Math.min(remaining, (textNode.textContent||'').length);
              range.setStart(textNode, offsetIn);
            } else {
              range.setStartAfter(el);
            }
            range.collapse(true);
            const sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(range); }
            (root as HTMLElement).focus();
            return;
          }
          remaining -= len;
        }
      }
    }
    // fallback: place at end
    const sel = window.getSelection();
    range.selectNodeContents(root);
    range.collapse(false);
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    (root as HTMLElement).focus();
  };

  // Open suggestions dropdown
  const openSuggestions = (initialQuery: string) => {
    setQuery(initialQuery);
    setActiveIndex(0);
    setShowSuggestions(true);
    fetchMembers(initialQuery);
    computeDropdownPosition();
    // store trigger position for later replacement
    const sel = window.getSelection();
    if (sel && sel.rangeCount) triggerPosition.current = sel.getRangeAt(0).cloneRange();
  };

  const closeSuggestions = () => {
    setShowSuggestions(false);
    setQuery('');
    setSuggestions([]);
    triggerPosition.current = null;
    setDropdownPos(null);
  };

  // Read editor text directly from the DOM in a way that matches Range.toString() offsets.
  // This avoids stale/shifted offsets (e.g. when mention chips exist) and prevents the
  // suggestions dropdown from staying open after deleting a mention or the '@' trigger.
  const getDomTextAndCaret = (): { text: string; caretOffset: number } => {
    const root = editorRef.current;
    if (!root || typeof window === "undefined") return { text: "", caretOffset: 0 };
    let text = "";
    try {
      const all = document.createRange();
      all.selectNodeContents(root);
      text = all.toString();
    } catch {
      text = root.textContent || "";
    }
    const caretOffset = getCaretAbsoluteOffset();
    return { text, caretOffset };
  };

  // Handle key presses
  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (disabled) return;
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        if (!suggestions.length) return;
        e.preventDefault();
        setActiveIndex(i => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        if (!suggestions.length) return;
        e.preventDefault();
        setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter') {
        if (!suggestions.length) return;
        e.preventDefault();
        selectSuggestion(activeIndex);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); closeSuggestions(); return; }
    }
    if (e.key === 'Enter') {
      // allow newline
      e.preventDefault();
      insertText('\n');
    }
  };

  // Insert plain text at caret position
  const insertText = (text: string) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    // move caret after inserted text
    range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range);
    rebuildSegmentsFromDom();
  };

  // Rebuild segments from current DOM content
  const rebuildSegmentsFromDom = () => {
    const el = editorRef.current; if (!el) return;
    const newSegments: Segment[] = [];
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const v = node.textContent || '';
        if (v) newSegments.push({ type: 'text', value: v });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const elNode = node as HTMLElement;
        if (elNode.classList.contains('mention-chip')) {
          const id = elNode.getAttribute('data-id') || '';
          const display = (elNode.textContent || '').replace(/^@/, '');
          newSegments.push({ type: 'mention', chip: { id, display } });
        } else {
          const v = elNode.textContent || '';
          if (v) newSegments.push({ type: 'text', value: v });
        }
      }
    });
    if (!newSegments.length) newSegments.push({ type: 'text', value: '' });
    setSegments(newSegments);
  };

  // Select suggestion at index
  const selectSuggestion = (idx: number) => {
    const sug = suggestions[idx]; if (!sug) return;
    const { text, caretOffset } = getDomTextAndCaret();
    const atIndex = text.lastIndexOf('@', caretOffset - 1);
    if (atIndex === -1) { closeSuggestions(); return; }

    let pos = 0;
    let atSegIdx = -1, atSegOffset = -1;
    let caretSegIdx = -1, caretSegOffset = -1;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const len = seg.type === 'text' ? seg.value.length : seg.chip.display.length;

      if (atSegIdx === -1 && seg.type === 'text' && pos + len > atIndex) {
        atSegIdx = i;
        atSegOffset = atIndex - pos;
      }

      if (caretSegIdx === -1 && pos + len >= caretOffset) {
        if (seg.type === 'text') {
          caretSegIdx = i;
          caretSegOffset = caretOffset - pos;
        } else {
          caretSegIdx = i + 1;
          caretSegOffset = 0;
        }
      }

      pos += len;
    }

    // Fallback: caret at the very end
    if (caretSegIdx === -1) {
      caretSegIdx = segments.length;
      caretSegOffset = 0;
    }

    if (atSegIdx === -1 || segments[atSegIdx]?.type !== 'text') { closeSuggestions(); return; }

    const newSegments: Segment[] = [];
    for (let i = 0; i < atSegIdx; i++) {
      newSegments.push({ ...segments[i] });
    }

    const atSeg = segments[atSegIdx] as TextSegment;
    if (atSegOffset > 0) {
      newSegments.push({ type: 'text', value: atSeg.value.slice(0, atSegOffset) });
    }

    if (sug.isRole && sug.roleMembers && sug.roleMembers.length > 0) {
      sug.roleMembers.forEach((member, i) => {
        newSegments.push({ type: 'mention', chip: { id: member.id, display: member.display, email: member.email, avatarUrl: member.avatarUrl } });
        if (i < sug.roleMembers!.length - 1) {
          newSegments.push({ type: 'text', value: ' ' });
        }
      });
      const lastMember = sug.roleMembers[sug.roleMembers.length - 1];
      pendingFocus.current = { id: lastMember.id, display: lastMember.display };
    } else {
      newSegments.push({ type: 'mention', chip: sug });
      pendingFocus.current = { id: sug.id, display: sug.display };
    }

    let afterText = '';
    if (atSegIdx === caretSegIdx) {
      // @ and caret are in the same text segment
      afterText = atSeg.value.slice(caretSegOffset);
    } else if (caretSegIdx < segments.length && segments[caretSegIdx]?.type === 'text') {
      afterText = (segments[caretSegIdx] as TextSegment).value.slice(caretSegOffset);
    }

    const needsSpace = !afterText.startsWith(' ') && !afterText.startsWith('\n') && !afterText.startsWith('.') && !afterText.startsWith(',');
    const postText = (needsSpace ? ' ' : '') + afterText;
    if (postText) {
      newSegments.push({ type: 'text', value: postText });
    }

    const startAfter = atSegIdx === caretSegIdx ? atSegIdx + 1 : caretSegIdx + 1;
    for (let i = startAfter; i < segments.length; i++) {
      newSegments.push({ ...segments[i] });
    }

    setSegments(mergeAdjacentText(newSegments));
    closeSuggestions();
  };

  // Merge adjacent text segments
  function mergeAdjacentText(segs: Segment[]): Segment[] {
    const out: Segment[] = [];
    for (const s of segs) {
      const last = out[out.length - 1];
      if (last && last.type === 'text' && s.type === 'text') {
        last.value += s.value;
      } else out.push({ ...s });
    }
    return out;
  }

  // Handle input event in contentEditable
  const handleInput: React.FormEventHandler<HTMLDivElement> = () => {
    rebuildSegmentsFromDom();
    // After rebuilding, detect if we are in an @query
    const { text, caretOffset } = getDomTextAndCaret();
    const atIndex = text.lastIndexOf('@', Math.max(0, caretOffset - 1));
    if (atIndex >= 0) {
      // Only trigger when @ is at the start, after whitespace, or after common separators.
      const prev = atIndex === 0 ? "" : text.charAt(atIndex - 1);
      const validPrefix = atIndex === 0 || /\s|[([{<>"'.,;:!?]/.test(prev);
      if (!validPrefix) {
        closeSuggestions();
        return;
      }
      // Extract query substring from after '@' to caret
      const q = text.slice(atIndex + 1, caretOffset);
      if (/^[A-Za-z0-9._ -]{0,32}$/.test(q)) {
        openSuggestions(q);
        return;
      }
    }
    closeSuggestions();
  };

  // Handle paste event to insert plain text only
  const handlePaste: React.ClipboardEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    insertText(text);
  };

  // Keep dropdown anchored during scroll/resize while open
  useEffect(() => {
    if (!showSuggestions) return;
    const onReposition = () => computeDropdownPosition();
    window.addEventListener("resize", onReposition);
    // Capture scroll from any scrollable ancestor
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [showSuggestions, computeDropdownPosition]);

  return (
    <div className={className} style={{ position: 'relative' }}>
      <div
        ref={editorRef}
        className="custom-mentions-editor"
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder || ''}
        style={{
          minHeight: 120,
          padding: '12px 16px',
          border: '1px solid #E0E2E7',
          borderRadius: 8,
          fontSize: 16,
          lineHeight: '22px',
          outline: 'none',
          background: disabled ? '#F5F5F5' : '#FFFFFF',
          cursor: disabled ? 'not-allowed' : 'text',
          overflowY: 'auto'
        }}
      />
      {showSuggestions && suggestions.length > 0 && dropdownPos && typeof window !== "undefined" &&
        createPortal(
          <div
            className="mentions-suggestions"
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              background: "#FFFFFF",
              border: "1px solid #E0E2E7",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              zIndex: 10000,
              maxHeight: 240,
              overflowY: "auto",
              width: 260
            }}
          >
            {suggestions.map((s, i) => (
              <div
                key={s.id}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(i); }}
                onMouseEnter={() => setActiveIndex(i)} // Allow hover to change active
                style={{
                  padding: "8px 12px",
                  background: i === activeIndex ? "#F1F5F9" : "#FFFFFF",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <div style={{ width:28, height:28, borderRadius:"50%", overflow:"hidden", background: s.isRole ? "#EEF4FF" : "#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {s.isRole ? (
                    <i className="la la-users-cog" style={{ fontSize: 14, color: "#175CD3" }}></i>
                  ) : s.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatarUrl} alt={s.display} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  ) : (
                    <span style={{ fontSize:12, color:"#374151" }}>{s.display.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div style={{ display:"flex", flexDirection:"column" }}>
                  <span style={{ fontWeight: 500, color: s.isRole ? "#175CD3" : "#111827" }}>{s.display}</span>
                  {s.isRole ? (
                    <span style={{ fontSize:12, color:"#6B7280" }}>{s.roleMembers?.length || 0} member{(s.roleMembers?.length || 0) !== 1 ? 's' : ''}</span>
                  ) : (
                    s.email && <span style={{ fontSize:12, color:"#6B7280" }}>{s.email}</span>
                  )}
                </div>
              </div>
            ))}
            {suggestions.length === 0 && (
              <div style={{ padding: "8px 12px", fontSize: 14, color: "#6B7280" }}>No matches</div>
            )}
          </div>,
          document.body
        )
      }
      <style jsx>{`
        .custom-mentions-editor:empty:before { content: attr(data-placeholder); color: #9CA3AF; pointer-events:none; }
      `}</style>
    </div>
  );
};

export default MentionsTagInput;

// Also export for explicit custom naming if desired
export { MentionsTagInput, MentionsTagInput as CustomMentionsInput };
