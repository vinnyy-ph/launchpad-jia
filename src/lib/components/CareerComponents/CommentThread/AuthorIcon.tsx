"use client";

import styles from "@/lib/styles/components/CommentThreads.module.scss";
import AvatarImage from "../../AvatarImage/AvatarImage";

type AuthorIconProps = {
  useFallback?: boolean;
  image?: string | null;
  name?: string | null;
}
export function AuthorIcon({ useFallback = false, image, name }: AuthorIconProps) {
  if (useFallback) {
    return (
      <div className={styles.fallbackUserIcon}>
        <i className="las la-user text-xl"></i>
      </div>
    )
  }

  return (
    <div style={{ width: 40 }}>
      <AvatarImage
        src={image || `https://api.dicebear.com/9.x/shapes/svg?seed=${name || "User"}`}
        alt={name || "User"}
      />
    </div>
  )
}