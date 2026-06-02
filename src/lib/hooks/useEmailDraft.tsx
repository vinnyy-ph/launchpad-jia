import { useRef, useCallback, useState } from "react";
import { apiClient } from "@/lib/utils/apiClient";
import { errorToast } from "@/lib/Utils";

export function useEmailDraft({
  initialDraft,
  onDraftSaved,
  debounceMs = 1200,
  retryLimit = 2,
}) {
  const draftRef = useRef(initialDraft || {});
  const lastSavedDraftRef = useRef(initialDraft || {});
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  /** Set when a save returns draftId so the component can include it in subsequent payloads (e.g. when user changes sender to Outlook). */
  const [savedDraftId, setSavedDraftId] = useState(
    typeof initialDraft?.draftId === "string" ? initialDraft.draftId : null,
  );

  // Helper: deep compare two objects (shallow for perf, deep for correctness)
  function isDraftChanged(a, b) {
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  // Save draft to API with retry logic
  const saveDraft = useCallback(
    async (draft, attempt = 0) => {
      if (isSavingRef.current) return;
      if (!isDraftChanged(draft, lastSavedDraftRef.current)) return; // No changes
      isSavingRef.current = true;
      setIsSaving(true);
      setSaveError(null);
      try {
        const res = await apiClient.post(
          "/api/mailgun-module/mg-save-draft",
          draft,
        );
        if (res?.data?.data?.draftId) {
          const id = res.data.data.draftId;
          draftRef.current = { ...draft, draftId: id };
          lastSavedDraftRef.current = { ...draftRef.current };
          setSavedDraftId(id);
          if (onDraftSaved) onDraftSaved(id);
        }
      } catch (e) {
        setSaveError(e);
        // Show error toast if invalid account (404)
        if (e?.response?.status === 404 && e?.response?.data?.error) {
          errorToast(e.response.data.error, 3000);
        }
        // Retry if failed and attempts left
        if (attempt < retryLimit) {
          setTimeout(() => saveDraft(draft, attempt + 1), 1000 * (attempt + 1));
        }
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [onDraftSaved, retryLimit],
  );

  // Debounced save: only save if changed
  const triggerSave = useCallback(
    (draft) => {
      draftRef.current = { ...draftRef.current, ...draft };
      if (!isDraftChanged(draftRef.current, lastSavedDraftRef.current)) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        saveDraft(draftRef.current);
      }, debounceMs);
    },
    [debounceMs, saveDraft],
  );

  // Manual flush (immediate save); returns Promise so callers can await before closing
  const flush = useCallback((): Promise<void> => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    return saveDraft(draftRef.current);
  }, [saveDraft]);

  return {
    triggerSave,
    flush,
    draft: draftRef.current,
    /** Include in subsequent getDraftPayload() so saves update the same draft (e.g. after user changes sender to Outlook). */
    savedDraftId,
    isSaving,
    saveError,
  };
}
