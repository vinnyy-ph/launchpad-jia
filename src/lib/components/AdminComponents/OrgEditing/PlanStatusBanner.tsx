"use client";

interface PlanStatusBannerProps {
    planName: string;
    endDate: string;
    isExpired: boolean;
    isExpiringSoon: boolean;
    onChooseNewPlan: () => void;
    onEditSchedule: () => void;
    variant?: "standalone" | "inline";
}

export default function PlanStatusBanner({
    planName,
    endDate,
    isExpired,
    isExpiringSoon,
    onChooseNewPlan,
    onEditSchedule,
    variant = "standalone",
}: PlanStatusBannerProps) {
    // Handle no plan state
    const hasNoPlan = !planName || planName === "Basic";

    // Don't show banner if neither expired nor expiring soon and has a plan
    if (!isExpired && !isExpiringSoon && !hasNoPlan) {
        return null;
    }

    // Different message for no plan vs expired/expiring
    let message: string;
    let buttonText: string;
    let handleClick: () => void;

    if (hasNoPlan && !isExpired && !isExpiringSoon) {
        message = "No plan assigned to this organization.";
        buttonText = "Choose a plan";
        handleClick = onChooseNewPlan;
    } else if (isExpired) {
        message = `This organization's previous plan (${planName}) has expired on ${endDate}.`;
        buttonText = "Choose new plan";
        handleClick = onChooseNewPlan;
    } else {
        message = `This organization's plan (${planName}) will expire soon on ${endDate}.`;
        buttonText = "Edit Plan Schedule";
        handleClick = onEditSchedule;
    }

    const BannerContent = (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                background: "#FFF9F8",
                border: "1px solid #FEE4E2",
                borderRadius: 16,
                width: "100%",
                marginBottom: variant === "inline" ? 16 : 0,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "#FEF3F2",
                        border: "1px solid #FECDCA",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <i
                        className="la la-exclamation-triangle"
                        style={{ color: "#F04438", fontSize: 20 }}
                    />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#181D27" }}>
                    {message}
                </span>
            </div>
            <button
                type="button"
                onClick={handleClick}
                style={{
                    padding: "12px 24px",
                    borderRadius: 999,
                    border: isExpiringSoon ? "1px solid #D5D7DA" : "none",
                    background: isExpiringSoon ? "#fff" : "#181D27",
                    color: isExpiringSoon ? "#414651" : "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: isExpiringSoon ? "0px 1px 2px rgba(16, 24, 40, 0.05)" : "none",
                }}
            >
                {buttonText}
            </button>
        </div>
    );

    if (variant === "inline") {
        return BannerContent;
    }

    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #E9EAEB",
                borderRadius: 16,
                padding: "32px 24px",
                marginBottom: 16,
            }}
        >
            {BannerContent}
        </div>
    );
}
