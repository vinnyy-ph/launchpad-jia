import React from "react";
import Link from "next/link";
import { GuestPortalContainer } from "@/lib/components/GuestPortalComponents";

export default function NotFound() {
  return (
    <GuestPortalContainer activeTab="careers">
      <div
        style={{
          border: "1px solid #EAECF0",
          borderRadius: 16,
          padding: "16px 24px",
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Career not found</h2>
        <p style={{ color: "#667085", marginTop: 0 }}>
          The career you are looking for does not exist or may have been removed.
        </p>
        <Link href="/careers" style={{ color: "#344054", textDecoration: "none", fontWeight: 500 }}>
          ← Back to careers
        </Link>
      </div>
    </GuestPortalContainer>
  );
}
