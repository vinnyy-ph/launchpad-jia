"use client";

import SingleDatePicker from "@/lib/components/Dropdown/SingleDatePicker";
import PlanCard from "./PlanCard";
import type { CurrentPlanDisplay } from "./types";

// Inlined from planUtils.ts
const getPlanBadge = (plan: any, organization: any) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const endDate = plan.schema === 'credit-based'
    ? organization.creditBasedPlanIdEndDate
    : organization.premiumPlanIdEndDate;
  if (!endDate) return 'Current';
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  if (end <= todayStart) return 'Ended';
  if (end > todayStart) return 'Expiring';
  return 'Current';
};

const isDateTodayOrPast = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dateNormalized = new Date(date);
  dateNormalized.setHours(0, 0, 0, 0);
  return dateNormalized <= todayStart;
};

interface CurrentPlanStepProps {
  currentPlan: CurrentPlanDisplay;
  currentPlanEnded: boolean;
  endDate: string;
  onEndDateChange: (date: string) => void;
  onEndPlan: () => void;
  formatCurrency: (amount: number) => string;
  formatDateForUi: (date: string) => string;
  isEndDateInPast: (date: string) => boolean;
  planStartDate?: Date | string;
}

export default function CurrentPlanStep({
  currentPlan,
  currentPlanEnded,
  endDate,
  onEndDateChange,
  onEndPlan,
  formatCurrency,
  formatDateForUi,
  isEndDateInPast,
  planStartDate,
}: CurrentPlanStepProps) {
  // Create organization object for utility function
  // Use null for end date if plan hasn't been ended yet (show Current badge)
  // getPlanBadge expects flat fields: creditBasedPlanIdEndDate or premiumPlanIdEndDate
  const organization = {
    [currentPlan.schema === 'credit-based' ? 'creditBasedPlanIdEndDate' : 'premiumPlanIdEndDate']:
      currentPlanEnded ? endDate : null // Use null to show Current badge initially
  };

  const badge = getPlanBadge(currentPlan, organization);


  // Determine badge states based on utility result
  const showCurrentBadge = badge === 'Current';
  const showExpiringBadge = badge === 'Expiring';
  const showEndedBadge = badge === 'Ended';

  return (
    <div>
      <PlanCard
        plan={currentPlan}
        isCurrent={showCurrentBadge}
        isExpiring={showExpiringBadge}
        isEnded={showEndedBadge}
        startedOn={currentPlan.startedOn}
        endsOn={currentPlanEnded ? formatDateForUi(endDate) : currentPlan.endsOn}
        formatCurrency={formatCurrency}
      />

      {!currentPlanEnded ? (
        <div
          style={{
            border: "1px solid #E9EAEB",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#FEF3F2",
                  border: "1px solid #FECDCA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                }}
              >
                <i className="la la-exclamation-triangle" style={{ color: "#F04438", fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1b1b1bff" }}>
                  You must end the current plan before assigning a new one.
                </div>
                <div style={{ fontSize: 13, color: "#1b1b1bff", marginTop: 4, lineHeight: "18px" }}>
                  Ending this plan will disable its limits and benefits starting on the end date.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onEndPlan}
              disabled={!endDate}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid #F04438",
                background: "#F04438",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: endDate ? "pointer" : "not-allowed",
                opacity: endDate ? 1 : 0.45,
                whiteSpace: "nowrap",
                flex: "0 0 auto",
              }}
            >
              End this plan
            </button>
          </div>

          <div>
            <label
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#414651",
                marginBottom: 6,
                display: "block",
              }}
            >
              End date
            </label>
            <SingleDatePicker
              value={endDate}
              onChange={onEndDateChange}
              placeholder="Select end date"
              placement="top"
              disabledDate={(date: Date) => {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const currentDate = new Date(date);
                currentDate.setHours(0, 0, 0, 0);
                // When ending an existing plan, allow today onwards (allowToday = true)
                // Cannot select dates before today
                if (currentDate < todayStart) return true;
                // If we have a plan start date, enforce max duration
                if (planStartDate) {
                  const startNormalized = new Date(planStartDate);
                  startNormalized.setHours(0, 0, 0, 0);
                  // Cannot be more than 3 years from start date
                  const maxDurationEnd = new Date(startNormalized);
                  maxDurationEnd.setFullYear(maxDurationEnd.getFullYear() + 3);
                  if (currentDate > maxDurationEnd) return true;
                }
                // Cannot be more than 5 years from today
                const fiveYearsFromNow = new Date(todayStart);
                fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                if (currentDate > fiveYearsFromNow) return true;
                return false;
              }}
            />
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "12px 16px",
            background: "#ffffffff",
            border: "1px solid #e9eaeb",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <i className="la la-exclamation-triangle" style={{ color: "#F04438", fontSize: 20, marginTop: 2 }} />
          <span style={{ fontSize: 14, color: "#161616ff", fontWeight: "600" }}>
            {isDateTodayOrPast(endDate)
              ? `This organization's plan has ended on ${formatDateForUi(endDate)}.`
              : `This organization's plan ends on ${formatDateForUi(endDate)}.`}
          </span>
        </div>
      )}
    </div>
  );
}
