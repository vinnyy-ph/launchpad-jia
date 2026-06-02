"use client";

import React from "react";
import Breadcrumbs from "./Breadcrumps";
import SuccessScreen from "./SuccessScreen";
import LoadingScreen from "./LoadingScreen";
import MoreInfoContainer from "./MoreInfoContainer";
import {
  TextInputField,
  RichTextInputField,
  MultiSelectField,
  OfficeLocationInputField,
  SalaryRangeInputField,
  EmploymentTypeInputField,
} from "./RequisitionFieldInputVariant";
import { Button } from "../../ui";

type CreateRequisitionFormProps = {
  onBack: () => void;
  onSubmit?: (data: any) => void | Promise<void>;
  onViewRequisitions?: () => void;
  onBackToHome?: () => void;
  initialData?: {
    positionName?: string;
    jobDescription?: string;
    headcount?: string;
    workArrangement?: string;
    workDays?: string;
    officeLocation?: {
      country?: string;
      stateProvince?: string;
      city?: string;
    };
    salaryRange?: {
      min?: string;
      max?: string;
      currency?: string;
    };
    employmentType?: string;
    duration?: {
      value?: string;
      unit?: string;
    };
    reason?: string;
  };
  isEditMode?: boolean;
  isViewMode?: boolean;
  status?: string;
  moreInfoReason?: string;
  moreInfoBy?: string;
  moreInfoEmail?: string;
  moreInfoAvatar?: string;
};

const CreateRequisitionForm: React.FC<CreateRequisitionFormProps> = ({ 
  onBack, 
  onSubmit, 
  onViewRequisitions, 
  onBackToHome,
  initialData,
  isEditMode = false,
  isViewMode = false,
  status,
  moreInfoReason,
  moreInfoBy,
  moreInfoEmail,
  moreInfoAvatar
}) => {
  // Load Philippines locations data
  const [locationsData, setLocationsData] = React.useState<{
    provinces: Array<{ name: string; key: string; region: string }>;
    cities: Array<{ name: string; province: string; city?: boolean }>;
  } | null>(null);

  React.useEffect(() => {
    fetch('/philippines-locations.json')
      .then(response => response.json())
      .then(data => setLocationsData(data))
      .catch(error => console.error('Error loading locations data:', error));
  }, []);

  // Load city options when initialData has a province
  React.useEffect(() => {
    if (locationsData && initialData?.officeLocation?.stateProvince) {
      const province = locationsData.provinces.find(
        p => p.name === initialData.officeLocation.stateProvince
      );
      if (province) {
        const cities = locationsData.cities
          .filter(city => city.province === province.key)
          .map(city => city.name)
          .sort();
        setCityOptions(cities);
      }
    }
  }, [locationsData, initialData]);
  
  // Form submission state
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [positionName, setPositionName] = React.useState(initialData?.positionName || "");
  const [jobDescription, setJobDescription] = React.useState(initialData?.jobDescription || "");
  const [headcount, setHeadcount] = React.useState(initialData?.headcount || "");
  const [workArrangement, setWorkArrangement] = React.useState(initialData?.workArrangement || "");
  const [workDays, setWorkDays] = React.useState(initialData?.workDays || "");
  const [country, setCountry] = React.useState(initialData?.officeLocation?.country || "Philippines");
  const [stateProvince, setStateProvince] = React.useState(initialData?.officeLocation?.stateProvince || "");
  const [cityOptions, setCityOptions] = React.useState<string[]>([]);
  const [city, setCity] = React.useState(initialData?.officeLocation?.city || "");
  const [minSalary, setMinSalary] = React.useState(initialData?.salaryRange?.min || "");
  const [maxSalary, setMaxSalary] = React.useState(initialData?.salaryRange?.max || "");
  const [currency, setCurrency] = React.useState(initialData?.salaryRange?.currency || "PHP");
  const [employmentType, setEmploymentType] = React.useState(initialData?.employmentType || "");
  const [duration, setDuration] = React.useState(initialData?.duration?.value || "");
  const [durationUnit, setDurationUnit] = React.useState(
    initialData?.duration?.unit === "Months" || initialData?.duration?.unit === "Years"
      ? initialData.duration.unit
      : "Months"
  );
  const [reason, setReason] = React.useState(initialData?.reason || "");

  const [touched, setTouched] = React.useState<{ [key: string]: boolean }>({
    positionName: false,
    jobDescription: false,
    headcount: false,
    workArrangement: false,
    officeLocation: false,
    salaryRange: false,
    employmentType: false,
    reason: false,
  });

  // Track if form has been modified in edit mode
  const hasFormChanged = React.useMemo(() => {
    if (!isEditMode || !initialData) return true; // Allow submit for new forms
    
    return (
      positionName !== (initialData.positionName || "") ||
      jobDescription !== (initialData.jobDescription || "") ||
      headcount !== (initialData.headcount || "") ||
      workArrangement !== (initialData.workArrangement || "") ||
      workDays !== (initialData.workDays || "") ||
      country !== (initialData.officeLocation?.country || "Philippines") ||
      stateProvince !== (initialData.officeLocation?.stateProvince || "") ||
      city !== (initialData.officeLocation?.city || "") ||
      minSalary !== (initialData.salaryRange?.min || "") ||
      maxSalary !== (initialData.salaryRange?.max || "") ||
      currency !== (initialData.salaryRange?.currency || "PHP") ||
      employmentType !== (initialData.employmentType || "") ||
      duration !== (initialData.duration?.value || "") ||
      durationUnit !== (initialData.duration?.unit === "Months" || initialData.duration?.unit === "Years"
        ? initialData.duration.unit
        : "Months") ||
      reason !== (initialData.reason || "")
    );
  }, [
    isEditMode,
    initialData,
    positionName,
    jobDescription,
    headcount,
    workArrangement,
    workDays,
    country,
    stateProvince,
    city,
    minSalary,
    maxSalary,
    currency,
    employmentType,
    duration,
    durationUnit,
    reason,
  ]);

  // Handle employment type change and reset duration when switching types
  const handleEmploymentTypeChange = (selectedType: string) => {
    setEmploymentType(selectedType);
    // Clear duration when changing employment type to avoid confusion
    setDuration("");
  };

  // Generate province options from data
  const provinceOptions = React.useMemo(() => {
    if (!locationsData) return [];
    return locationsData.provinces
      .map(province => province.name)
      .sort();
  }, [locationsData]);

  // Handle province change and update city options
  const handleProvinceChange = (selectedProvince: string) => {
    setStateProvince(selectedProvince);
    
    if (!locationsData || !selectedProvince) {
      setCityOptions([]);
      setCity(""); // Reset city when no province selected
      return;
    }

    // Find the province key
    const province = locationsData.provinces.find(p => p.name === selectedProvince);
    if (!province) {
      setCityOptions([]);
      setCity(""); // Reset city when province not found
      return;
    }

    // Get cities for this province and sort alphabetically
    const cities = locationsData.cities
      .filter(city => city.province === province.key)
      .map(city => city.name)
      .sort();
    
    setCityOptions(cities);
    
    // Automatically select the first city (alphabetically)
    if (cities.length > 0) {
      setCity(cities[0]);
    } else {
      setCity(""); // Reset if no cities found
    }
  };

  const handleFieldBlur = (field: string, event: React.FocusEvent) => {
    // Don't mark as touched if focus is moving within the same field container
    // This prevents the error from flashing when clicking dropdown options
    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const getPlainText = (html: string) =>
    html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

  const errors: { [key: string]: string } = {};

  if (!positionName.trim()) {
    errors.positionName = "Position name is required.";
  }

  if (!getPlainText(jobDescription)) {
    errors.jobDescription = "Job description is required.";
  }

  if (!headcount.trim()) {
    errors.headcount = "Headcount is required.";
  } else if (!/^\d+$/.test(headcount.trim()) || parseInt(headcount.trim(), 10) <= 0) {
    errors.headcount = "Please enter a valid number.";
  }

  if (!workArrangement) {
    errors.workArrangement = "Work arrangement is required.";
  } else if (workArrangement === "Hybrid" && !workDays) {
    errors.workArrangement = "Please select days per week for hybrid arrangement.";
  }

  if (!stateProvince || !city) {
    errors.officeLocation = "State / province and city are required.";
  }

  if (!minSalary.trim() || !maxSalary.trim()) {
    errors.salaryRange = "Minimum and maximum salary are required.";
  } else {
    const min = Number(minSalary.replace(/,/g, ""));
    const max = Number(maxSalary.replace(/,/g, ""));
    if (isNaN(min) || isNaN(max)) {
      errors.salaryRange = "Please enter valid salary numbers.";
    } else if (min > max) {
      errors.salaryRange = "Maximum salary should be greater than or equal to minimum.";
    }
  }

  if (!employmentType) {
    errors.employmentType = "Employment type is required.";
  } else if (employmentType === "Contract" && !duration.trim()) {
    errors.employmentType = "Contract duration is required.";
  }

  if (!getPlainText(reason)) {
    errors.reason = "Reason for requisition is required.";
  }

  const isFormValid = Object.keys(errors).length === 0;

  const handleSubmit = async () => {
    if (!isFormValid) {
      setTouched({
        positionName: true,
        jobDescription: true,
        headcount: true,
        workArrangement: true,
        officeLocation: true,
        salaryRange: true,
        employmentType: true,
        reason: true,
      });
      return;
    }

    const formData = {
      positionName,
      jobDescription,
      headcount,
      workArrangement,
      ...(workArrangement === "Hybrid" && workDays ? { workDays } : {}),
      officeLocation: { country, stateProvince, city },
      salaryRange: { min: minSalary, max: maxSalary, currency },
      employmentType,
      ...(employmentType === "Contract" && duration ? { duration: { value: duration, unit: durationUnit } } : {}),
      reason,
    };
    
    // Show loading screen
    setIsSubmitting(true);
    
    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      
      // Show success screen after loading completes
      setIsSubmitted(true);
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      // Reset loading state on error
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = () => {
    // Reset loading state
    setIsSubmitting(false);
  };

  // If form is submitting, show loading screen
  if (isSubmitting) {
    return <LoadingScreen isEditMode={isEditMode} onCancel={handleCancelSubmit} />;
  }

  // If form is submitted, show success screen
  if (isSubmitted) {
    return <SuccessScreen onViewRequisitions={onViewRequisitions} onBackToHome={onBackToHome} isResubmit={isEditMode} />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        width: "100%",
      }}
    >
      {/* Breadcrumbs Header */}
      <Breadcrumbs onBack={onBack} title={isViewMode ? "View Requisition" : isEditMode ? "Edit Requisition" : "Create a Requisition"} />

      {/* Form Content - Constrained Width */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          maxWidth: "1200px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* Form Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <h3 style={{ fontSize: 24, fontWeight: 600, color: "#101828", marginTop: 0, marginBottom: 0 }}>
              {isViewMode ? "View Requisition" : isEditMode ? "Edit Requisition" : "Requisition Form"}
            </h3>
            <p style={{ fontSize: 16, fontWeight: 500, color: "#717680", marginTop: 0, marginBottom: 0, lineHeight: 1.5 }}>
              {isViewMode
                ? "Review the requisition details below."
                : isEditMode 
                ? "Update the requisition details below and submit your changes."
                : "Use this form to request the creation of a new position, define job details, and begin the hiring process."}
            </p>
          </div>
          {!isViewMode && (
            <p style={{ fontSize: 14, fontWeight: 500, color: "#D92D20", marginTop: 0, marginBottom: 0 }}>
              * Indicates required question
            </p>
          )}
          
          {/* More Info Container */}
          {status === "Requires More Info" && moreInfoReason && moreInfoBy && (
            <MoreInfoContainer
              moreInfoBy={moreInfoBy}
              moreInfoReason={moreInfoReason}
              moreInfoEmail={moreInfoEmail}
              moreInfoAvatar={moreInfoAvatar}
            />
          )}
        </div>

        {/* Form Fields Container */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Position Name */}
          <div onBlur={(e) => handleFieldBlur("positionName", e)}>
            <TextInputField
              label="Position Name"
              required
              value={positionName}
              onChange={setPositionName}
              placeholder="Your answer"
              widthPercentage={100}
              disabled={isViewMode}
              error={touched.positionName ? errors.positionName : ""}
            />
          </div>

          {/* Job Description */}
          <div onBlur={(e) => handleFieldBlur("jobDescription", e)}>
            <RichTextInputField
              label="Job Description"
              required
              value={jobDescription}
              onChange={setJobDescription}
              placeholder="Your answer"
              disabled={isViewMode}
              error={touched.jobDescription ? errors.jobDescription : ""}
            />
          </div>

          {/* Headcount */}
          <div onBlur={(e) => handleFieldBlur("headcount", e)}>
            <TextInputField
              label="Headcount"
              required
              value={headcount}
              onChange={(val) => setHeadcount(val.replace(/\D/g, ""))}
              placeholder="Enter number"
              disabled={isViewMode}
              error={touched.headcount ? errors.headcount : ""}
            />
          </div>

          {/* Work Arrangement */}
          <div onBlur={(e) => handleFieldBlur("workArrangement", e)}>
            <MultiSelectField
              label="Work Arrangement"
              required
              values={[
                {
                  value: workArrangement,
                  onChange: setWorkArrangement,
                  options: ["Hybrid", "Remote", "On-site"],
                },
                ...(workArrangement === "Hybrid"
                  ? [
                      {
                        value: workDays,
                        onChange: setWorkDays,
                        options: [
                          "3 days per week",
                          "2 days per week",
                          "4 days per week",
                          "5 days per week",
                        ],
                      },
                    ]
                  : []),
              ]}
              disabled={isViewMode}
              error={touched.workArrangement ? errors.workArrangement : ""}
            />
          </div>

          {/* Office Location */}
          <div onBlur={(e) => handleFieldBlur("officeLocation", e)}>
            <OfficeLocationInputField
              label="Office Location"
              required
              country={{
                value: country,
                onChange: setCountry,
                options: ["Philippines", "United States", "Singapore"],
              }}
              stateProvince={{
                value: stateProvince,
                onChange: handleProvinceChange,
                options: provinceOptions,
              }}
              city={{
                value: city,
                onChange: setCity,
                options: cityOptions,
              }}
              disabled={isViewMode}
              error={touched.officeLocation ? errors.officeLocation : ""}
            />
          </div>

          {/* Salary Range */}
          <div onBlur={(e) => handleFieldBlur("salaryRange", e)}>
            <SalaryRangeInputField
              label="Salary Range"
              required
              minSalary={{
                value: minSalary,
                onChange: setMinSalary,
              }}
              maxSalary={{
                value: maxSalary,
                onChange: setMaxSalary,
              }}
              currency={{
                value: currency,
                onChange: setCurrency,
                options: ["PHP", "USD"],
              }}
              disabled={isViewMode}
              error={touched.salaryRange ? errors.salaryRange : ""}
            />
          </div>

          {/* Employment Type */}
          <div onBlur={(e) => handleFieldBlur("employmentType", e)}>
            <EmploymentTypeInputField
              label="Employment Type"
              required
              employmentType={{
                value: employmentType,
                onChange: handleEmploymentTypeChange,
                options: ["Contract", "Full-time", "Part-time"],
              }}
              duration={{
                value: duration,
                onChange: setDuration,
              }}
              durationUnit={{
                value: durationUnit,
                onChange: setDurationUnit,
                options: ["Months", "Years"],
              }}
              disabled={isViewMode}
              error={touched.employmentType ? errors.employmentType : ""}
            />
          </div>

          {/* Reason for Requisition */}
          <div onBlur={(e) => handleFieldBlur("reason", e)}>
            <RichTextInputField
              label="Reason for Requisition"
              required
              value={reason}
              onChange={setReason}
              placeholder="Your answer"
              minHeight={100}
              showToolbar={false}
              disabled={isViewMode}
              error={touched.reason ? errors.reason : ""}
            />
          </div>
        </div>

        {/* Submit Button */}
        {!isViewMode && (
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16, paddingBottom: 16 }}>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!hasFormChanged || !isFormValid || isSubmitting}
              style={{ width: "177px" }}
              label={isSubmitting ? "Submitting..." : isEditMode ? "Resubmit" : "Submit"}
              >
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateRequisitionForm;
