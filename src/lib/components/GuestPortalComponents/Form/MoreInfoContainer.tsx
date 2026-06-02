import React from "react";
import UserAvatar from "@/lib/components/RequisitionsComponents/UserAvatar";

type MoreInfoContainerProps = {
  moreInfoBy: string;
  moreInfoReason: string;
  moreInfoEmail?: string;
  moreInfoAvatar?: string;
};

const MoreInfoContainer: React.FC<MoreInfoContainerProps> = ({
  moreInfoBy,
  moreInfoReason,
  moreInfoEmail,
  moreInfoAvatar,
}) => {
  return (
    <div
      style={{
        background: "rgba(255, 252, 245, 1)",
        border: "1px solid rgba(254, 239, 199, 1)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", marginLeft: 10, alignItems: "center", gap: 4 }}>
        <UserAvatar
          name={moreInfoBy}
          email={moreInfoEmail || moreInfoBy}
          avatar={moreInfoAvatar}
          size={32}
        />
        <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(24, 29, 39, 1)" }}>
          {moreInfoBy} | Requires More Info
        </span>
      </div>

      <div
        style={{
          padding: 24,
          background: "#fff",
          borderRadius: 24,
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            .more-info-content-reset * {
              margin: 0 !important;
              padding: 0 !important;
              margin-left: 0 !important;
              padding-left: 0 !important;
              margin-bottom: 0 !important;
              padding-bottom: 0 !important;
              margin-top: 0 !important;
              padding-top: 0 !important;
              margin-right: 0 !important;
              padding-right: 0 !important;
            }
            .more-info-content-reset ul,
            .more-info-content-reset ol {
              list-style-position: inside !important;
              margin-block-start: 0 !important;
              margin-block-end: 0 !important;
              margin-inline-start: 0 !important;
              margin-inline-end: 0 !important;
              padding-inline-start: 0 !important;
            }
            .more-info-content-reset li {
              margin-inline-start: 0 !important;
              padding-inline-start: 0 !important;
            }
            .more-info-content-reset p:not(:last-child),
            .more-info-content-reset ul:not(:last-child),
            .more-info-content-reset ol:not(:last-child) {
              margin-bottom: 8px !important;
            }
          `
        }} />
        <div
          className="more-info-content-reset"
          style={{
            fontSize: 14,
            color: "#475467",
            lineHeight: "20px",
          }}
          dangerouslySetInnerHTML={{ __html: moreInfoReason }}
        />
      </div>
    </div>
  );
};

export default MoreInfoContainer;
