"use client";

import { useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { Organization } from "@/lib/types/organization";

interface AdditionalFeaturesCardProps {
  organization: Organization;
  onUpdate: (updates: Partial<Organization>) => void;
}

const features = [
  {
    key: "projectsEnabled",
    label: "Projects",
    description: "Enable project-based hiring workflows",
  },
  {
    key: "guestPortalEnabled",
    label: "Guest Portal",
    description: "Allow guest hiring managers to access the portal",
  },
  {
    key: "linkedCareersEnabled",
    label: "Linked Careers",
    description: "Allows linking parent and child career posts for candidate pipeline management.",
  },
];

export default function AdditionalFeaturesCard({
  organization,
  onUpdate,
}: AdditionalFeaturesCardProps) {
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);

  const getFeatureValue = (key: string): boolean => {
    return (organization as any)[key] || false;
  };

  const handleToggle = async (featureKey: string) => {
    const currentValue = getFeatureValue(featureKey);
    const newValue = !currentValue;

    setTogglingFeature(featureKey);
    try {
      await api.patch("/api/admin/toggle-org-feature", {
        orgId: organization._id,
        feature: featureKey,
        enabled: newValue,
      });

      const updates: Partial<Organization> = {
        [featureKey]: newValue,
      };

      onUpdate(updates);
      const featureLabel = features.find(f => f.key === featureKey)?.label ?? featureKey;
      candidateActionToast(
        `${featureLabel} ${newValue ? "enabled" : "disabled"}`,
        1300,
        <i className={`la ${newValue ? "la-check-circle text-success" : "la-times-circle"}`} />
      );
    } catch (error) {
      errorToast("Error updating feature", 1300);
    } finally {
      setTogglingFeature(null);
    }
  };

  return (
    <div
      style={{
        background: "#F8F9FC",
        borderRadius: 16,
        padding: 8,
      }}
    >
      {/* Header */}
      <div style={{ padding: "10px 12px" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
          Additional Features
        </h3>
      </div>

      {/* Content */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {features.map((feature) => {
            const isEnabled = getFeatureValue(feature.key);
            const isToggling = togglingFeature === feature.key;
            const isDisabled = false; // Features are independent now

            return (
              <div
                key={feature.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid #E9EAEB",
                  opacity: isDisabled ? 0.5 : 1,
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#181D27", margin: 0 }}>
                    {feature.label}
                  </p>
                  <p style={{ fontSize: 12, color: "#717680", margin: 0, marginTop: 2 }}>
                    {feature.description}
                  </p>
                </div>

                <button
                  onClick={() => handleToggle(feature.key)}
                  disabled={isToggling || isDisabled}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    background: isEnabled ? "#12B76A" : "#E9EAEB",
                    cursor: isToggling || isDisabled ? "not-allowed" : "pointer",
                    position: "relative",
                    transition: "background 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#fff",
                      position: "absolute",
                      top: 2,
                      left: isEnabled ? 22 : 2,
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
