import React, { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: ReactNode;
  children: ReactNode;
};

export default function Container({ icon, title, children, parentBgColor = "rgba(248, 249, 252, 1)", childBgColor = "#fff", fillHeight = false }: Props & { parentBgColor?: string; childBgColor?: string; fillHeight?: boolean }) {
  return (
    <div
      style={{
        background: parentBgColor,
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        ...(fillHeight && { flex: 1, minHeight: 0, width: "100%" }),
      }}
    >
      <div style={{ display: "flex", marginLeft: 10, alignItems: "center", gap: 12 }}>
        {icon}
        {title}
      </div>

      <div style={{ 
        padding: 24, 
        background: childBgColor, 
        borderRadius: 24,
        ...(fillHeight && { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }),
      }}>
        {children}
      </div>
    </div>
  );
}
