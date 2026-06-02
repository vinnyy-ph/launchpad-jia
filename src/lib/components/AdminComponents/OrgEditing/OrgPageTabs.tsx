"use client";

interface OrgPageTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "plan-usage", label: "Plan and Usage" },
  { id: "members", label: "Members" },
];

export default function OrgPageTabs({ activeTab, onTabChange }: OrgPageTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid #E9EAEB",
        marginBottom: 24,
      }}
    >
      {tabs.map((tab) => (
        <div key={tab.id} style={{ position: "relative" }}>
          <button
            onClick={() => onTabChange(tab.id)}
            onMouseDown={(e) => e.preventDefault()}
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? "#181D27" : "#717680",
              background: "none",
              border: "none",
              outline: "none",
              boxShadow: "none",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {tab.label}
          </button>
          {activeTab === tab.id && (
            <div
              style={{
                height: 4,
                width: "100%",
                background:
                  "linear-gradient(90deg, rgba(159, 202, 237, 0.5) 0%, rgba(206, 182, 218, 0.5) 34%, rgba(235, 172, 201, 0.5) 67%, rgba(252, 206, 192, 0.5) 100%)",
                position: "absolute",
                bottom: -1,
                left: 0,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
