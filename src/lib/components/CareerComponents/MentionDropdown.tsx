import React from "react";

type MemberSuggestion = {
  _id: string;
  name?: string;
  email?: string;
  image?: string;
};

interface MentionDropdownProps {
  mentionOptions: MemberSuggestion[];
  isMentionLoading: boolean;
  activeMentionIndex: number;
  onSelect: (member: MemberSuggestion) => void;
  position: { top: number; left: number };
  orgId?: string | null;
  query: string;
  textareaWidth?: number;
}

const getAuthorInitial = (
  name?: string,
  email?: string,
  fallback?: string
) => (name || email || fallback || "R").charAt(0).toUpperCase();

const MentionDropdown: React.FC<MentionDropdownProps> = ({
  mentionOptions,
  isMentionLoading,
  activeMentionIndex,
  onSelect,
  position,
  orgId,
  query,
  textareaWidth,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        width: textareaWidth ? Math.min(textareaWidth, 420) : undefined,
        maxWidth: "calc(100% - 56px)",
        border: "1px solid #E4E7EC",
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        boxShadow: "0px 12px 24px rgba(16, 24, 40, 0.12)",
        maxHeight: 240,
        overflowY: "auto",
        padding: 8,
        zIndex: 10,
      }}
    >
      {orgId ? (
        isMentionLoading ? (
          <div
            style={{
              padding: "8px 4px",
              fontSize: 13,
              color: "#667085",
            }}
          >
            Searching teammates...
          </div>
        ) : mentionOptions.length > 0 ? (
          mentionOptions.map((member, index) => (
            <button
              type="button"
              key={member._id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(member)}
              style={{
                width: "100%",
                border: "none",
                backgroundColor:
                  index === activeMentionIndex ? "#EEF2FF" : "transparent",
                borderRadius: 10,
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {member.image ? (
                <img
                  src={member.image}
                  alt={member.name || member.email || "Team member"}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    backgroundColor: "#F2F4F7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    color: "#414651",
                  }}
                >
                  {getAuthorInitial(member.name, member.email)}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#101828",
                  }}
                >
                  {member.name || member.email || "Teammate"}
                </span>
                {member.email && (
                  <span style={{ fontSize: 12, color: "#667085" }}>
                    {member.email}
                  </span>
                )}
              </div>
            </button>
          ))
        ) : (
          <div
            style={{
              padding: "8px 4px",
              fontSize: 13,
              color: "#667085",
            }}
          >
            No teammates match "{query || " "}".
          </div>
        )
      ) : (
        <div
          style={{
            padding: "8px 4px",
            fontSize: 13,
            color: "#667085",
          }}
        >
          Connect to an organization to mention teammates.
        </div>
      )}
    </div>
  );
};

export default MentionDropdown;
