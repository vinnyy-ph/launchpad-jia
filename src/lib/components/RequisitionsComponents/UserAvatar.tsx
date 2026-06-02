import React from "react";

// Google-style color palette for avatar backgrounds
const AVATAR_COLORS = [
  "#1A73E8", // Google Blue
  "#EA4335", // Google Red
  "#FBBC04", // Google Yellow
  "#34A853", // Google Green
  "#FF6D01", // Orange
  "#46BDC6", // Teal
  "#7B1FA2", // Purple
  "#C2185B", // Pink
  "#00ACC1", // Cyan
  "#8D6E63", // Brown
];

/**
 * Generates a consistent color based on a string (email or name).
 * Uses a simple hash function to always return the same color for the same input.
 */
function getColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Gets the initial from a name (Google-style: single letter only).
 * Returns the first letter of the first name.
 */
function getInitials(name: string): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

type UserAvatarProps = {
  name: string;
  email: string;
  avatar?: string;
  size?: number;
  style?: React.CSSProperties;
};

/**
 * UserAvatar component that displays a Google-style avatar.
 * - If avatar URL is provided and valid, shows the image
 * - Otherwise, shows initials with a consistent background color based on email
 */
const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  email,
  avatar,
  size = 32,
  style,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const [resolvedAvatar, setResolvedAvatar] = React.useState<string | null>(null);

  // Resolve the avatar URL - prioritize localStorage for current user
  React.useEffect(() => {
    setImageError(false);
    
    // First, try to get current user's Google image from localStorage
    if (typeof window !== "undefined" && email) {
      try {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          const user = JSON.parse(storedUser);
          // If email matches current logged-in user, use their Google image
          if (user.email?.toLowerCase() === email.toLowerCase() && user.image) {
            setResolvedAvatar(user.image);
            return;
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Check if avatar is a valid URL (not empty, not dicebear, not placeholder)
    if (avatar && avatar.trim() !== "" && !avatar.includes("dicebear.com") && !avatar.includes("placeholder")) {
      setResolvedAvatar(avatar);
    } else {
      setResolvedAvatar(null);
    }
  }, [avatar, email]);

  const showInitials = !resolvedAvatar || imageError;
  const backgroundColor = getColorFromString(email || name);
  const initials = getInitials(name);
  const fontSize = size * 0.5; // Google-style: ~50% of avatar size for single letter

  if (showInitials) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          ...style,
        }}
      >
        <span
          style={{
            color: "#FFFFFF",
            fontSize,
            fontWeight: 500,
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedAvatar!}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setImageError(true)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        ...style,
      }}
    />
  );
};

export default UserAvatar;

