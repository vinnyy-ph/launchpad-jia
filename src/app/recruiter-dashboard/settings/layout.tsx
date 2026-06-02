import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({ children }: LayoutProps) {
  return <div id="content">{children}</div>;
}
