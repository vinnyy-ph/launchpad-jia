import React from "react";

type SkeletonBoxProps = {
  width: string | number;
  height: string | number;
  borderRadius?: number;
  style?: React.CSSProperties;
};

/**
 * Reusable shimmer skeleton box component for loading states.
 * Provides a visual silhouette placeholder with animated shimmer effect.
 */
export default function SkeletonBox({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonBoxProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        ...style,
      }}
    />
  );
}

/**
 * CSS keyframes for shimmer animation.
 * Include this in a parent component or global styles.
 */
export const shimmerKeyframes = `
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

/**
 * Wrapper component that includes shimmer animation styles.
 * Wrap skeleton components with this to ensure animation works.
 */
export function SkeletonWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{shimmerKeyframes}</style>
      {children}
    </>
  );
}
