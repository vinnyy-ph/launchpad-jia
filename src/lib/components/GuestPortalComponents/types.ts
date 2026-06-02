export type GuestPortalTab = "careers" | "requisitions";

export interface TabsProps {
  isCareers: boolean;
  onTabChange: (tab: GuestPortalTab) => void;
}
