"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

function MicrosoftCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      window.opener?.postMessage(
        { type: "MICROSOFT_OAUTH_ERROR", error: "Missing authorization code or state." },
        window.location.origin
      );
      window.close();
      return;
    }

    const queryParams = new URLSearchParams({ code, state }).toString();

    fetch(`/api/auth/microsoft/callback?${queryParams}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Outlook integration failed.");
        }
        return data;
      })
      .then((clientPayload) => {
        window.opener?.postMessage(
          { type: "MICROSOFT_OAUTH_PAYLOAD", clientPayload },
          window.location.origin
        );
        window.close();
      })
      .catch((err: Error) => {
        window.opener?.postMessage(
          { type: "MICROSOFT_OAUTH_ERROR", error: err.message },
          window.location.origin
        );
        window.close();
      });
  }, [searchParams]);

  return null;
}

export default function MicrosoftCallbackPage() {
  return <MicrosoftCallbackContent />;
}
