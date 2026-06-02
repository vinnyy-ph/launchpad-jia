"use client";

import React, { memo } from "react";
import styles from "./group.module.scss";

export interface GroupProps extends React.HTMLAttributes<HTMLDivElement> {
  justify?: React.CSSProperties["justifyContent"];
  align?: React.CSSProperties["alignItems"];
  wrap?: React.CSSProperties["flexWrap"];
  gap?: number | string;
  grow?: boolean;
  preventGrowOverflow?: boolean;
}

type StylableChildProps = {
  style?: React.CSSProperties;
};

function resolveSpacing(gap: GroupProps["gap"]): string {
  if (typeof gap === "number") return `${gap}px`;
  if (typeof gap === "string") return gap;
  return "16px";
}

function Group({
  justify = "flex-start",
  align = "center",
  wrap = "wrap",
  gap = "16px",
  grow = false,
  preventGrowOverflow = true,
  className,
  style,
  children,
  ...props
}: GroupProps) {
  const filteredChildren = React.Children.toArray(children);

  const childrenCount = filteredChildren.length;
  const resolvedGap = resolveSpacing(gap);
  const childWidth =
    childrenCount > 0
      ? `calc(${100 / childrenCount}% - (${resolvedGap} - ${resolvedGap} / ${childrenCount}))`
      : undefined;

  const rootStyle: React.CSSProperties = {
    justifyContent: justify,
    alignItems: align,
    flexWrap: wrap,
    gap: resolvedGap,
    ...style,
  };

  return (
    <div
      className={`${styles.root} ${grow ? styles.grow : ""} ${className || ""}`.trim()}
      style={rootStyle}
      {...props}
    >
      {filteredChildren.map((child, index) => {
        if (!grow || !React.isValidElement<StylableChildProps>(child)) {
          return child;
        }

        const childStyle: React.CSSProperties = {
          ...(child.props.style ?? {}),
          flexGrow: 1,
          ...(preventGrowOverflow && childWidth ? { maxWidth: childWidth } : {}),
        };

        return React.cloneElement(child, {
          key: child.key ?? index,
          style: childStyle,
        });
      })}
    </div>
  );
}

export default memo(Group);
