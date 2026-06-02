"use client";

import SingleDatePicker from "@/lib/components/Dropdown/SingleDatePicker";
import PlanCard from "./PlanCard";
import type { PlanOption } from "./types";

interface SetScheduleStepProps {
  selectedPlan: PlanOption | undefined;
  startDate: string;
  newEndDate: string;
  currentPlanEndDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  creditsRemaining: number;
  currentPlanSchema: "credit-based" | "premium";
  formatCurrency: (amount: number) => string;
}

export default function SetScheduleStep({
  selectedPlan,
  startDate,
  newEndDate,
  currentPlanEndDate,
  onStartDateChange,
  onEndDateChange,
  creditsRemaining,
  currentPlanSchema,
  formatCurrency,
}: SetScheduleStepProps) {
  return (
    <div>
      {selectedPlan && (
        <PlanCard
          plan={selectedPlan}
          isSelected
          formatCurrency={formatCurrency}
        />
      )}

      {currentPlanSchema === "credit-based" && creditsRemaining > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "1px solid #E9EAEB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              flex: "0 0 auto",
            }}
          >
            <i className="la la-info" style={{ color: "#717680", fontSize: 12 }} />
          </div>
          <div style={{ fontSize: 14, color: "#414651" }}>
            <span style={{ fontWeight: 700, color: "#181D27" }}>{creditsRemaining.toLocaleString()}</span>{" "}
            {selectedPlan?.schema === "credit-based"
              ? "remaining credits will be rolled over to the new plan."
              : "remaining credits will be frozen. They will become usable again if the organization switches back to a credit-based plan."
            }
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h4 style={{ fontSize: 16, fontWeight: 600, color: "#181D27", marginBottom: 16 }}>
          Set schedule for this plan
        </h4>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginBottom: 6, display: "block" }}>
              Start date
            </label>
            <SingleDatePicker
              value={startDate}
              onChange={onStartDateChange}
              placeholder="Select start date"
              placement="top"
              disabledDate={(date) => {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const currentDate = new Date(date);
                currentDate.setHours(0, 0, 0, 0);
                // Cannot be before today
                if (currentDate < todayStart) return true;
                // Cannot be more than 5 years in the future
                const fiveYearsFromNow = new Date(todayStart);
                fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                if (currentDate > fiveYearsFromNow) return true;

                // Additional check: Cannot be on or before the current plan's end date
                // UNLESS the current plan ends today or in the past (then allow today)
                if (currentPlanEndDate) {
                  const currentEnd = new Date(currentPlanEndDate);
                  currentEnd.setHours(0, 0, 0, 0);

                  // If current plan ends today or past, we don't enforce blocking based on it
                  if (currentEnd <= todayStart) {
                    return false;
                  }
                  if (currentDate <= currentEnd) return true;
                }

                return false;
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginBottom: 6, display: "block" }}>
              End date
            </label>
            <SingleDatePicker
              value={newEndDate}
              onChange={onEndDateChange}
              placeholder="Select end date"
              placement="top"
              disabledDate={(date: Date) => {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const currentDate = new Date(date);
                currentDate.setHours(0, 0, 0, 0);
                // If no start date, only check absolute future limit
                if (!startDate) {
                  const fiveYearsFromNow = new Date(todayStart);
                  fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                  return currentDate > fiveYearsFromNow;
                }
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                // Cannot be on or before start date
                if (currentDate <= start) return true;
                // Cannot be more than 3 years from start date
                const maxDurationEnd = new Date(start);
                maxDurationEnd.setFullYear(maxDurationEnd.getFullYear() + 3);
                if (currentDate > maxDurationEnd) return true;
                // Cannot be more than 5 years from today
                const fiveYearsFromNow = new Date(todayStart);
                fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                if (currentDate > fiveYearsFromNow) return true;
                return false;
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
