import React from "react";
import ReplyContainer from "./ReplyContainer";

interface Reply {
  avatarSrc: string;
  name: string;
  role: string;
  timestamp: string;
  content: React.ReactNode;
}

interface RepliesContainerProps {
  replies: Reply[];
}

export default function RepliesContainer({ replies }: RepliesContainerProps) {
  if (replies.length === 0) return null;

  return (
    <div
      style={{
        marginLeft: 40,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div style={{ color: "#98A2B3", marginTop: 8 }}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8.0013 4.66797L11.3346 8.0013M11.3346 8.0013L8.0013 11.3346M11.3346 8.0013H3.33464C2.62739 8.0013 1.94911 7.72035 1.44902 7.22025C0.94892 6.72016 0.667969 6.04188 0.667969 5.33464V0.667969"
            stroke="#A4A7AE"
            strokeWidth="1.336"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        {replies.map((reply, index) => (
          <ReplyContainer
            key={index}
            avatarSrc={reply.avatarSrc}
            name={reply.name}
            role={reply.role}
            timestamp={reply.timestamp}
            content={reply.content}
            isReply={true}
          />
        ))}
      </div>
    </div>
  );
}
