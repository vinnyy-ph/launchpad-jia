"use client";

import { useState, useEffect } from "react";
import { PricingPlanFormData, DEFAULT_PRICING_PLAN } from "@/lib/types/pricing";

interface PricingPlanFormProps {
  initialData?: PricingPlanFormData;
  onSubmit: (data: PricingPlanFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  mode?: "create" | "edit";
  formId?: string;
}

interface ValidationErrors {
  name?: string;
  costPerMonth?: string;
  costPerYear?: string;
  creditsPerMonth?: string;
  additionalJobPostCost?: string;
  maxActiveJobPosts?: string;
  maxAdminSeats?: string;
  maxGuestHMSeats?: string;
}

export default function PricingPlanForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Create Plan",
  isLoading = false,
  mode = "create",
  formId,
}: PricingPlanFormProps) {
  const [formData, setFormData] = useState<PricingPlanFormData>(
    initialData || DEFAULT_PRICING_PLAN
  );
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const validateInteger = (value: string): boolean => {
    if (value === "") return false;
    const num = Number(value);
    return !isNaN(num) && Number.isInteger(num) && num >= 0;
  };

  const validateNumber = (value: string): boolean => {
    if (value === "") return false;
    const num = Number(value);
    return !isNaN(num) && num >= 0;
  };

  const handleChange = (field: keyof PricingPlanFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSchemaChange = (schema: "credit-based" | "premium") => {
    setFormData((prev) => ({
      ...prev,
      schema,
      // Reset schema-specific fields
      creditsPerMonth: schema === "credit-based" ? (prev.creditsPerMonth || 0) : undefined,
      costPerYear: schema === "premium" ? (prev.costPerYear || 0) : undefined,
      additionalJobPostCost: schema === "premium" ? (prev.additionalJobPostCost || 0) : undefined,
    }));
  };

  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formData.name || formData.name.trim() === "") {
      newErrors.name = "Plan name is required";
    }

    if (!validateNumber(String(formData.costPerMonth))) {
      newErrors.costPerMonth = "Must be a valid positive number";
    }

    // maxActiveJobPosts: null = unlimited, or must be a valid non-negative integer
    if (formData.maxActiveJobPosts !== null && !validateInteger(String(formData.maxActiveJobPosts))) {
      newErrors.maxActiveJobPosts = "Must be a whole number 0 or greater, or Unlimited";
    }

    // maxAdminSeats: null = unlimited, or must be a valid non-negative integer
    if (formData.maxAdminSeats !== null && !validateInteger(String(formData.maxAdminSeats))) {
      newErrors.maxAdminSeats = "Must be a whole number 0 or greater, or Unlimited";
    }

    if (formData.maxGuestHMSeats !== null && !validateInteger(String(formData.maxGuestHMSeats))) {
      newErrors.maxGuestHMSeats = "Must be a positive whole number or leave empty for unlimited";
    }

    if (formData.schema === "credit-based") {
      if (!validateInteger(String(formData.creditsPerMonth))) {
        newErrors.creditsPerMonth = "Must be a positive whole number";
      }
    }

    if (formData.schema === "premium") {
      if (!validateNumber(String(formData.costPerYear))) {
        newErrors.costPerYear = "Must be a valid positive number";
      }
      if (!validateNumber(String(formData.additionalJobPostCost))) {
        newErrors.additionalJobPostCost = "Must be a valid positive number";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit(formData);
    }
  };

  const isFormValid = (): boolean => {
    if (!formData.name || formData.name.trim() === "") return false;
    if (!validateNumber(String(formData.costPerMonth))) return false;
    // null = unlimited is valid, otherwise must be a valid integer
    if (formData.maxActiveJobPosts !== null && !validateInteger(String(formData.maxActiveJobPosts))) return false;
    if (formData.maxAdminSeats !== null && !validateInteger(String(formData.maxAdminSeats))) return false;
    
    if (formData.schema === "credit-based") {
      if (!validateInteger(String(formData.creditsPerMonth))) return false;
    }
    
    if (formData.schema === "premium") {
      if (!validateNumber(String(formData.costPerYear))) return false;
      if (!validateNumber(String(formData.additionalJobPostCost))) return false;
    }
    
    return true;
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #D5D7DA",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
  };

  const errorInputStyle = {
    ...inputStyle,
    borderColor: "#DC2626",
  };

  const labelStyle = {
    fontSize: "14px",
    fontWeight: 500,
    color: "#414651",
    marginBottom: "6px",
    display: "block",
  };

  const errorTextStyle = {
    fontSize: "12px",
    color: "#DC2626",
    marginTop: "4px",
  };

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      style={{ display: "flex", flexDirection: "column", gap: "20px" }}
    >
      {/* Plan Name */}
      <div>
        <label style={labelStyle}>Plan name</label>
        <input
          type="text"
          placeholder="Enter name for plan"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          style={errors.name ? errorInputStyle : inputStyle}
        />
        {errors.name && <p style={errorTextStyle}>{errors.name}</p>}
      </div>

      {/* Schema Selection */}
      <div>
        <label style={labelStyle}>Plan schema:</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "12px 16px",
              border: `1px solid ${formData.schema === "credit-based" ? "#5925DC" : "#D5D7DA"}`,
              borderRadius: "8px",
              cursor: "pointer",
              backgroundColor: formData.schema === "credit-based" ? "#FAFAFF" : "white",
            }}
          >
            <input
              type="radio"
              name="schema"
              checked={formData.schema === "credit-based"}
              onChange={() => handleSchemaChange("credit-based")}
              style={{ marginTop: "2px" }}
            />
            <div>
              <div style={{ fontWeight: 500, color: "#181D27" }}>Credits</div>
              <div style={{ fontSize: "13px", color: "#717680" }}>
                Credits will be consumed for each AI Interview successfully conducted.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "12px 16px",
              border: `1px solid ${formData.schema === "premium" ? "#C11574" : "#D5D7DA"}`,
              borderRadius: "8px",
              cursor: "pointer",
              backgroundColor: formData.schema === "premium" ? "#FFFAFD" : "white",
            }}
          >
            <input
              type="radio"
              name="schema"
              checked={formData.schema === "premium"}
              onChange={() => handleSchemaChange("premium")}
              style={{ marginTop: "2px" }}
            />
            <div>
              <div style={{ fontWeight: 500, color: "#181D27" }}>Premium</div>
              <div style={{ fontSize: "13px", color: "#717680" }}>
                Limits will be tied to the number of active job postings.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Cost Fields */}
      <div style={{ display: "flex", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Cost / month</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#717680" }}>₱</span>
            <input
              type="number"
              placeholder="0.00"
              value={formData.costPerMonth || ""}
              onChange={(e) => handleChange("costPerMonth", Number(e.target.value))}
              style={{ ...inputStyle, paddingLeft: "28px" }}
              min="0"
              step="0.01"
            />
          </div>
          {errors.costPerMonth && <p style={errorTextStyle}>{errors.costPerMonth}</p>}
        </div>

        {formData.schema === "premium" && (
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Cost / year</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#717680" }}>₱</span>
              <input
                type="number"
                placeholder="0.00"
                value={formData.costPerYear || ""}
                onChange={(e) => handleChange("costPerYear", Number(e.target.value))}
                style={{ ...inputStyle, paddingLeft: "28px" }}
                min="0"
                step="0.01"
              />
            </div>
            {errors.costPerYear && <p style={errorTextStyle}>{errors.costPerYear}</p>}
          </div>
        )}
      </div>

      {/* Schema-specific fields */}
      {formData.schema === "credit-based" && (
        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>New credits / month</label>
            <input
              type="number"
              placeholder="0"
              value={formData.creditsPerMonth || ""}
              onChange={(e) => handleChange("creditsPerMonth", Number(e.target.value))}
              style={errors.creditsPerMonth ? errorInputStyle : inputStyle}
              min="0"
              step="1"
            />
            {errors.creditsPerMonth && <p style={errorTextStyle}>{errors.creditsPerMonth}</p>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Maximum Active Credit-based Job Posts</label>
            <select
              value={formData.maxActiveJobPosts === null ? "unlimited" : String(formData.maxActiveJobPosts)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "unlimited") {
                  handleChange("maxActiveJobPosts", null);
                } else {
                  const num = Number(val);
                  if (!isNaN(num) && num >= 0) {
                    handleChange("maxActiveJobPosts", num);
                  }
                }
              }}
              style={errors.maxActiveJobPosts ? errorInputStyle : inputStyle}
            >
              <option value="unlimited">Unlimited</option>
              {Array.from({ length: 101 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            {errors.maxActiveJobPosts && <p style={errorTextStyle}>{errors.maxActiveJobPosts}</p>}
          </div>
        </div>
      )}

      {formData.schema === "premium" && (
        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Additional Job Post Cost</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#717680" }}>₱</span>
              <input
                type="number"
                placeholder="0.00"
                value={formData.additionalJobPostCost || ""}
                onChange={(e) => handleChange("additionalJobPostCost", Number(e.target.value))}
                style={{ ...inputStyle, paddingLeft: "28px" }}
                min="0"
                step="0.01"
              />
            </div>
            {errors.additionalJobPostCost && <p style={errorTextStyle}>{errors.additionalJobPostCost}</p>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Maximum Active Premium Job Posts</label>
            <select
              value={formData.maxActiveJobPosts === null ? "unlimited" : String(formData.maxActiveJobPosts)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "unlimited") {
                  handleChange("maxActiveJobPosts", null);
                } else {
                  const num = Number(val);
                  if (!isNaN(num) && num >= 0) {
                    handleChange("maxActiveJobPosts", num);
                  }
                }
              }}
              style={errors.maxActiveJobPosts ? errorInputStyle : inputStyle}
            >
              <option value="unlimited">Unlimited</option>
              {Array.from({ length: 101 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            {errors.maxActiveJobPosts && <p style={errorTextStyle}>{errors.maxActiveJobPosts}</p>}
          </div>
        </div>
      )}

      {/* Seats */}
      <div style={{ display: "flex", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Maximum Admin Seats</label>
          <select
            value={formData.maxAdminSeats === null ? "unlimited" : String(formData.maxAdminSeats)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "unlimited") {
                handleChange("maxAdminSeats", null);
              } else {
                const num = Number(val);
                if (!isNaN(num) && num >= 0) {
                  handleChange("maxAdminSeats", num);
                }
              }
            }}
            style={errors.maxAdminSeats ? errorInputStyle : inputStyle}
          >
            <option value="unlimited">Unlimited</option>
            {Array.from({ length: 101 }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          {errors.maxAdminSeats && <p style={errorTextStyle}>{errors.maxAdminSeats}</p>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>
            Maximum Guest or HM Seats <span style={{ color: "#717680" }}>(optional)</span>
          </label>
          <select
            value={formData.maxGuestHMSeats === null ? "unlimited" : String(formData.maxGuestHMSeats)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "unlimited") {
                handleChange("maxGuestHMSeats", null);
              } else {
                const num = Number(val);
                if (!isNaN(num) && num >= 0) {
                  handleChange("maxGuestHMSeats", num);
                }
              }
            }}
            style={errors.maxGuestHMSeats ? errorInputStyle : inputStyle}
          >
            <option value="unlimited">Unlimited</option>
            {Array.from({ length: 101 }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          {errors.maxGuestHMSeats && <p style={errorTextStyle}>{errors.maxGuestHMSeats}</p>}
        </div>
      </div>

      {/* Actions (only shown in modal/create mode) */}
      {mode === "create" && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid #D5D7DA",
                backgroundColor: "white",
                color: "#414651",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!isFormValid() || isLoading}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: isFormValid() && !isLoading ? "#181D27" : "#D5D7DA",
              color: "white",
              fontSize: "14px",
              fontWeight: 500,
              cursor: isFormValid() && !isLoading ? "pointer" : "not-allowed",
            }}
          >
            {isLoading ? "Creating..." : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

export { type PricingPlanFormProps, type ValidationErrors };
