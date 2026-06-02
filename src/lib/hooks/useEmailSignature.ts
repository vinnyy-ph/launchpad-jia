import { useEffect, useRef } from "react";
import { apiClient } from "@/lib/utils/apiClient";

function isValidOrgId(value: unknown): value is string {
  return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
}

export function useEmailSignature({
  fromSender,
  orgID,
  user,
  currentBody,
  setBody,
  bodyEditorRef,
}) {
  // Signature cache to avoid redundant API calls
  const signatureCacheRef = useRef(new Map());

  useEffect(() => {
    async function fetchAndInsertSignature() {
      if (currentBody && currentBody.trim() !== "") return;
      if (!fromSender || fromSender.length === 0) return;
      const sender = fromSender[0];
      const userId = sender.userId || sender.id || sender.value || null;
      const orgId = orgID || user?.orgID || user?.organizationId;
      if (!isValidOrgId(orgId)) return;
      const cacheKey = userId ? `user-${userId}` : `org-${orgId}`;
      let signature = "";
      if (signatureCacheRef.current.has(cacheKey)) {
        signature = signatureCacheRef.current.get(cacheKey) || "";
      } else {
        let fetchedSignature = "";
        try {
          const res = await apiClient.get("/api/emails/settings", {
            params: { orgID: orgId },
          });
          fetchedSignature = res?.data?.emailSettings?.signature || "";
        } catch (err) {
          console.error("Failed to fetch email signature:", err);
        }
        signature = fetchedSignature;
        signatureCacheRef.current.set(cacheKey, signature);
      }
      if (signature) {
        setBody(`<br><br>${signature}`);
        if (
          bodyEditorRef &&
          bodyEditorRef.current &&
          typeof bodyEditorRef.current.insertTemplate === "function"
        ) {
          bodyEditorRef.current.insertTemplate("", `<br><br>${signature}`);
        }
      }
    }
    fetchAndInsertSignature();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromSender, orgID, user]);
}
