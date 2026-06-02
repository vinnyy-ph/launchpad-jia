import React from "react";
import { RichTextInputField, SalaryRangeInputField, OfficeLocationInputField, EmploymentTypeInputField, MultiSelectField } from "@/lib/components/GuestPortalComponents/Form/RequisitionFieldInputVariant";

export type ReadOnlyTextFieldProps = {
  label: string;
  required?: boolean;
  value: string | number;
  widthPercentage?: number;
  isEditMode?: boolean;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  onErrorChange?: (error: string) => void;
};

export const ReadOnlyTextField: React.FC<ReadOnlyTextFieldProps> = ({
  label,
  required,
  value,
  widthPercentage = 100,
  isEditMode = false,
  onChange,
  onValueChange,
  onErrorChange,
}) => {
  const [editValue, setEditValue] = React.useState(value);
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  
  // Use refs to avoid infinite loops - callbacks shouldn't trigger effect re-runs
  const onErrorChangeRef = React.useRef(onErrorChange);
  const onValueChangeRef = React.useRef(onValueChange);
  onErrorChangeRef.current = onErrorChange;
  onValueChangeRef.current = onValueChange;

  React.useEffect(() => {
    let newError = "";
    if (touched && required) {
      const strValue = String(editValue).trim();
      if (!strValue) {
        newError = `${label} is required.`;
      }
    }
    setError(newError);
    onErrorChangeRef.current?.(newError);
  }, [touched, required, editValue, label]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTouched(true);
    setEditValue(e.target.value);
    onChange?.(e.target.value);
    onValueChangeRef.current?.(e.target.value);
  };

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 24,
          }}
        >
          {isEditMode ? (
            <div>
              <input
                type="text"
                value={editValue}
                onChange={handleChange}
                onBlur={() => setTouched(true)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: error ? "1px solid #F04438" : "1px solid #D0D5DD",
                  fontSize: 14,
                  color: "#101828",
                  fontWeight: 500,
                  width: `${widthPercentage}%`,
                  outline: "none",
                  backgroundColor: "#FFFFFF",
                }}
              />
              {error && (
                <p style={{ color: "#F04438", fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                fontSize: 14,
                color: "#101828",
                fontWeight: 500,
                width: `${widthPercentage}%`,
                backgroundColor: "#F9FAFB",
              }}
            >
              {value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export type SalaryRangeFieldProps = {
  label: string;
  required?: boolean;
  min: string | number;
  max: string | number;
  currency: string;
  isEditMode?: boolean;
  onChange?: (min: string, max: string) => void;
  onValueChange?: (value: { min: string; max: string; currency: string }) => void;
  onErrorChange?: (error: string) => void;
};

export const SalaryRangeField: React.FC<SalaryRangeFieldProps> = ({ label, required, min, max, currency, isEditMode = false, onChange, onValueChange, onErrorChange }) => {
  const [minValue, setMinValue] = React.useState(String(min));
  const [maxValue, setMaxValue] = React.useState(String(max));
  const [currencyValue, setCurrencyValue] = React.useState(currency);
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  
  // Use refs to avoid infinite loops
  const onErrorChangeRef = React.useRef(onErrorChange);
  const onValueChangeRef = React.useRef(onValueChange);
  onErrorChangeRef.current = onErrorChange;
  onValueChangeRef.current = onValueChange;

  React.useEffect(() => {
    let newError = "";
    if (touched && required) {
      if (!minValue.trim() || !maxValue.trim()) {
        newError = "Salary range is required.";
      } else {
        const minNum = parseFloat(minValue);
        const maxNum = parseFloat(maxValue);
        if (isNaN(minNum) || isNaN(maxNum)) {
          newError = "Please enter valid salary amounts.";
        } else if (minNum > maxNum) {
          newError = "Maximum salary must be greater than or equal to minimum.";
        }
      }
    }
    setError(newError);
    onErrorChangeRef.current?.(newError);
  }, [touched, required, minValue, maxValue]);

  if (isEditMode) {
    return (
      <SalaryRangeInputField
        label={label}
        required={required}
        minSalary={{
          value: minValue,
          onChange: (value) => {
            setTouched(true);
            setMinValue(value);
            onChange?.(value, maxValue);
            onValueChangeRef.current?.({ min: value, max: maxValue, currency: currencyValue });
          }
        }}
        maxSalary={{
          value: maxValue,
          onChange: (value) => {
            setTouched(true);
            setMaxValue(value);
            onChange?.(minValue, value);
            onValueChangeRef.current?.({ min: minValue, max: value, currency: currencyValue });
          }
        }}
        currency={{
          value: currencyValue,
          onChange: (value) => {
            setCurrencyValue(value);
            onValueChangeRef.current?.({ min: minValue, max: maxValue, currency: value });
          },
          options: ['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY']
        }}
        error={error}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "flex-start",
            }}
          >
            <div
              style={{
                width: "260px",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                display: "flex",
                alignItems: "center",
                fontSize: 14,
                color: "#101828",
                backgroundColor: "#F9FAFB",
              }}
            >
              <span style={{ marginRight: 8, color: "rgba(113, 118, 128, 1)" }}>₱</span>
              <span style={{ flex: 1, color: "#101828", fontWeight: 500 }}>{min}</span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontWeight: 500,
                  color: "#101828",
                  marginLeft: 8,
                }}
              >
                {currency}
              </span>
            </div>
            <div
              style={{
                width: "260px",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                display: "flex",
                alignItems: "center",
                fontSize: 14,
                color: "#101828",
                backgroundColor: "#F9FAFB",
              }}
            >
              <span style={{ marginRight: 8, color: "rgba(113, 118, 128, 1)" }}>₱</span>
              <span style={{ flex: 1, color: "#101828", fontWeight: 500 }}>{max}</span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontWeight: 500,
                  color: "#101828",
                  marginLeft: 8,
                }}
              >
                {currency}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export type MinMaxFieldProps = {
  label: string;
  required?: boolean;
  min: string | number;
  max: string | number;
  isEditMode?: boolean;
  onChange?: (min: string, max: string) => void;
};

export const MinMaxField: React.FC<MinMaxFieldProps> = ({ label, required, min, max, isEditMode = false, onChange }) => {
  const [minValue, setMinValue] = React.useState(min);
  const [maxValue, setMaxValue] = React.useState(max);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinValue(e.target.value);
    onChange?.(e.target.value, String(maxValue));
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxValue(e.target.value);
    onChange?.(String(minValue), e.target.value);
  };
  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "flex-start",
            }}
          >
            {isEditMode ? (
              <>
                <div
                  style={{
                    flex: "0 0 260px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="number"
                    value={minValue}
                    onChange={handleMinChange}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #D0D5DD",
                      fontSize: 14,
                      color: "#101828",
                      fontWeight: 500,
                      outline: "none",
                    }}
                  />
                  <span style={{ fontWeight: 500, color: "#717680" }}>Min</span>
                </div>
                <div
                  style={{
                    flex: "0 0 260px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="number"
                    value={maxValue}
                    onChange={handleMaxChange}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #D0D5DD",
                      fontSize: 14,
                      color: "#101828",
                      fontWeight: 500,
                      outline: "none",
                    }}
                  />
                  <span style={{ fontWeight: 500, color: "#717680" }}>Max</span>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    flex: "0 0 260px",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #E9EAEB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 14,
                    color: "#101828",
                    backgroundColor: "#F9FAFB",
                  }}
                >
                  <span style={{ color: "#101828", fontWeight: 500 }}>{min}</span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontWeight: 500,
                      color: "#717680",
                    }}
                  >
                    Min
                  </span>
                </div>
                <div
                  style={{
                    flex: "0 0 260px",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #E9EAEB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 14,
                    color: "#101828",
                    backgroundColor: "#F9FAFB",
                  }}
                >
                  <span style={{ color: "#101828", fontWeight: 500 }}>{max}</span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontWeight: 500,
                      color: "#717680",
                    }}
                  >
                    Max
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export type OfficeLocationFieldProps = {
  label: string;
  required?: boolean;
  country: string;
  stateOrProvince: string;
  city: string;
  isEditMode?: boolean;
  onChange?: (country: string, stateOrProvince: string, city: string) => void;
  onValueChange?: (value: { country: string; stateOrProvince: string; city: string }) => void;
  onErrorChange?: (error: string) => void;
};

export const OfficeLocationField: React.FC<OfficeLocationFieldProps> = ({
  label,
  required,
  country,
  stateOrProvince,
  city,
  isEditMode = false,
  onChange,
  onValueChange,
  onErrorChange,
}) => {
  const [countryValue, setCountryValue] = React.useState(country);
  const [stateValue, setStateValue] = React.useState(stateOrProvince);
  const [cityValue, setCityValue] = React.useState(city);
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  
  // Use refs to avoid infinite loops
  const onErrorChangeRef = React.useRef(onErrorChange);
  const onValueChangeRef = React.useRef(onValueChange);
  onErrorChangeRef.current = onErrorChange;
  onValueChangeRef.current = onValueChange;

  React.useEffect(() => {
    let newError = "";
    if (touched && required && (!countryValue || !stateValue || !cityValue)) {
      newError = "Office location is required.";
    }
    setError(newError);
    onErrorChangeRef.current?.(newError);
  }, [touched, required, countryValue, stateValue, cityValue]);

  if (isEditMode) {
    return (
      <OfficeLocationInputField
        label={label}
        required={required}
        country={{
          value: countryValue,
          onChange: (value) => {
            setTouched(true);
            setCountryValue(value);
            onChange?.(value, stateValue, cityValue);
            onValueChangeRef.current?.({ country: value, stateOrProvince: stateValue, city: cityValue });
          },
          options: ['Philippines', 'United States', 'Canada', 'Australia']
        }}
        stateProvince={{
          value: stateValue,
          onChange: (value) => {
            setTouched(true);
            setStateValue(value);
            onChange?.(countryValue, value, cityValue);
            onValueChangeRef.current?.({ country: countryValue, stateOrProvince: value, city: cityValue });
          },
          options: ['Metro Manila', 'Cebu', 'Davao']
        }}
        city={{
          value: cityValue,
          onChange: (value) => {
            setTouched(true);
            setCityValue(value);
            onChange?.(countryValue, stateValue, value);
            onValueChangeRef.current?.({ country: countryValue, stateOrProvince: stateValue, city: value });
          },
          options: ['Manila', 'Quezon City', 'Makati']
        }}
        error={error}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "flex-start",
            }}
          >
            {/* Country */}
            <div
              style={{
                flex: "0 0 260px",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
                color: "#101828",
                backgroundColor: "#F9FAFB",
              }}
            >
              <span style={{ fontWeight: 500 }}>{country}</span>
              <img src="/icons/chevron.svg" alt="" style={{ width: 16, height: 16 }} />
            </div>

            {/* State / Province */}
            <div
              style={{
                flex: "0 0 260px",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
                color: "#101828",
                backgroundColor: "#F9FAFB",
              }}
            >
              <span style={{ fontWeight: 500 }}>{stateOrProvince}</span>
              <img src="/icons/chevron.svg" alt="" style={{ width: 16, height: 16 }} />
            </div>

            {/* City */}
            <div
              style={{
                flex: "0 0 260px",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
                color: "#101828",
                backgroundColor: "#F9FAFB",
              }}
            >
              <span style={{ fontWeight: 500 }}>{city}</span>
              <img src="/icons/chevron.svg" alt="" style={{ width: 16, height: 16 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export type EmploymentTypeFieldProps = {
  label: string;
  required?: boolean;
  employmentType: string;
  duration?: string;
  durationUnit?: string;
  isEditMode?: boolean;
  onValueChange?: (value: { employmentType: string; duration: string; durationUnit: string }) => void;
  onErrorChange?: (error: string) => void;
};

export const EmploymentTypeField: React.FC<EmploymentTypeFieldProps> = ({
  label,
  required,
  employmentType,
  duration,
  durationUnit,
  isEditMode = false,
  onValueChange,
  onErrorChange,
}) => {
  const [employmentTypeValue, setEmploymentTypeValue] = React.useState(employmentType);
  const [durationValue, setDurationValue] = React.useState(duration || "");
  const [durationUnitValue, setDurationUnitValue] = React.useState(
    durationUnit === "Months" || durationUnit === "Years" ? durationUnit : "Months"
  );
  const [error, setError] = React.useState<string>("");
  const [touched, setTouched] = React.useState(false);
  
  // Use refs to avoid infinite loops
  const onErrorChangeRef = React.useRef(onErrorChange);
  const onValueChangeRef = React.useRef(onValueChange);
  onErrorChangeRef.current = onErrorChange;
  onValueChangeRef.current = onValueChange;

  React.useEffect(() => {
    let newError = "";
    if (touched && required) {
      if (!employmentTypeValue) {
        newError = "Employment type is required.";
      } else if (employmentTypeValue === "Contract" && !durationValue.trim()) {
        newError = "Contract duration is required.";
      }
    }
    setError(newError);
    onErrorChangeRef.current?.(newError);
  }, [touched, required, employmentTypeValue, durationValue]);

  if (isEditMode) {
    return (
      <EmploymentTypeInputField
        label={label}
        required={required}
        employmentType={{
          value: employmentTypeValue,
          onChange: (selectedType) => {
            setTouched(true);
            setEmploymentTypeValue(selectedType);
            const newDuration = selectedType !== "Contract" ? "" : durationValue;
            if (selectedType !== "Contract") {
              setDurationValue("");
            }
            onValueChangeRef.current?.({ employmentType: selectedType, duration: newDuration, durationUnit: durationUnitValue });
          },
          options: ["Contract", "Full-time", "Part-time"],
        }}
        duration={{
          value: durationValue,
          onChange: (val) => {
            setTouched(true);
            setDurationValue(val);
            onValueChangeRef.current?.({ employmentType: employmentTypeValue, duration: val, durationUnit: durationUnitValue });
          },
        }}
        durationUnit={{
          value: durationUnitValue,
          onChange: (val) => {
            setDurationUnitValue(val);
            onValueChangeRef.current?.({ employmentType: employmentTypeValue, duration: durationValue, durationUnit: val });
          },
          options: ["Months", "Years"],
        }}
        error={error}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                flex: "0 0 260px",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                fontSize: 14,
                color: "#101828",
                fontWeight: 500,
                backgroundColor: "#F9FAFB",
              }}
            >
              {employmentTypeValue || "Choose"}
            </div>
            {durationValue && durationUnitValue && (
              <div
                style={{
                  flex: "0 0 260px",
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #E9EAEB",
                  fontSize: 14,
                  color: "#101828",
                  backgroundColor: "#F9FAFB",
                  boxSizing: "border-box",
                }}
              >
                <span style={{ flex: 1, fontWeight: 500 }}>{durationValue}</span>
                <span style={{ marginLeft: 8, fontWeight: 500, color: "#101828" }}>
                  {durationUnitValue}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export type WorkArrangementFieldProps = {
  label: string;
  required?: boolean;
  workArrangement: string;
  workDays?: string;
  isEditMode?: boolean;
  onValueChange?: (value: { workArrangement: string; workDays: string }) => void;
  onErrorChange?: (error: string) => void;
};

export const WorkArrangementField: React.FC<WorkArrangementFieldProps> = ({
  label,
  required,
  workArrangement,
  workDays,
  isEditMode = false,
  onValueChange,
  onErrorChange,
}) => {
  const [workArrangementValue, setWorkArrangementValue] = React.useState(workArrangement);
  const [workDaysValue, setWorkDaysValue] = React.useState(workDays || "");
  const [error, setError] = React.useState<string>("");
  const [touched, setTouched] = React.useState(false);
  
  // Use refs to avoid infinite loops
  const onErrorChangeRef = React.useRef(onErrorChange);
  const onValueChangeRef = React.useRef(onValueChange);
  onErrorChangeRef.current = onErrorChange;
  onValueChangeRef.current = onValueChange;

  React.useEffect(() => {
    let newError = "";
    if (touched && required) {
      if (!workArrangementValue) {
        newError = "Work arrangement is required.";
      } else if (workArrangementValue === "Hybrid" && !workDaysValue) {
        newError = "Please select days per week for hybrid arrangement.";
      }
    }
    setError(newError);
    onErrorChangeRef.current?.(newError);
  }, [touched, required, workArrangementValue, workDaysValue]);

  if (isEditMode) {
    const values = [
      {
        value: workArrangementValue,
        onChange: (value: string) => {
          setTouched(true);
          setWorkArrangementValue(value);
          const newWorkDays = value !== "Hybrid" ? "" : workDaysValue;
          if (value !== "Hybrid") {
            setWorkDaysValue("");
          }
          onValueChangeRef.current?.({ workArrangement: value, workDays: newWorkDays });
        },
        options: ["Hybrid", "Remote", "On-site"],
      },
      ...(workArrangementValue === "Hybrid"
        ? [
            {
              value: workDaysValue,
              onChange: (val: string) => {
                setTouched(true);
                setWorkDaysValue(val);
                onValueChangeRef.current?.({ workArrangement: workArrangementValue, workDays: val });
              },
              options: [
                "3 days per week",
                "2 days per week",
                "4 days per week",
                "5 days per week",
              ],
            },
          ]
        : []),
    ];

    return (
      <MultiSelectField
        label={label}
        required={required}
        values={values}
        error={error}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                flex: "0 0 260px",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                fontSize: 14,
                color: "#101828",
                fontWeight: 500,
                backgroundColor: "#F9FAFB",
              }}
            >
              {workArrangementValue || "Choose"}
            </div>
            {workDaysValue && (
              <div
                style={{
                  flex: "0 0 260px",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #E9EAEB",
                  fontSize: 14,
                  color: "#101828",
                  fontWeight: 500,
                  backgroundColor: "#F9FAFB",
                }}
              >
                {workDaysValue}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

type FieldType = "textfield" | "textarea" | "richtext" | "dropdown" | "checkbox" | "salaryRange" | "minMax" | "officeLocation" | "employmentType" | "workArrangement";

type BaseField = {
  id: string;
  type: FieldType;
};

type TextFieldConfig = BaseField &
  ({
    type: "textfield";
  } & ReadOnlyTextFieldProps);

type TextAreaFieldConfig = BaseField &
  ({
    type: "textarea";
  } & TextAreaFieldProps);

type RichTextFieldConfig = BaseField & {
  type: "richtext";
  label: string;
  required?: boolean;
  contentHtml: string;
};

type DropdownFieldConfig = BaseField &
  ({
    type: "dropdown";
  } & Omit<DropdownFieldProps, "onSelect">);

type CheckboxFieldConfig = BaseField &
  ({
    type: "checkbox";
  } & CheckboxGroupFieldProps);

type SalaryRangeFieldConfig = BaseField &
  ({
    type: "salaryRange";
  } & SalaryRangeFieldProps);

type MinMaxFieldConfig = BaseField &
  ({
    type: "minMax";
  } & MinMaxFieldProps);

type OfficeLocationFieldConfig = BaseField &
  ({
    type: "officeLocation";
  } & OfficeLocationFieldProps);

type EmploymentTypeFieldConfig = BaseField &
  ({
    type: "employmentType";
  } & EmploymentTypeFieldProps);

type WorkArrangementFieldConfig = BaseField &
  ({
    type: "workArrangement";
  } & WorkArrangementFieldProps);

export type RequisitionFormField =
  | TextFieldConfig
  | TextAreaFieldConfig
  | RichTextFieldConfig
  | DropdownFieldConfig
  | CheckboxFieldConfig
  | SalaryRangeFieldConfig
  | MinMaxFieldConfig
  | OfficeLocationFieldConfig
  | EmploymentTypeFieldConfig
  | WorkArrangementFieldConfig;

export type RenderFieldProps = {
  field: RequisitionFormField;
  isEditMode?: boolean;
  onValueChange?: (fieldId: string, value: any) => void;
  onErrorChange?: (fieldId: string, error: string) => void;
};

export const RenderField: React.FC<RenderFieldProps> = ({ field, isEditMode = false, onValueChange, onErrorChange }) => {
  if (field.type === "textfield") {
    const { id, type, ...props } = field;

    return <ReadOnlyTextField {...props} isEditMode={isEditMode} onValueChange={(v) => onValueChange?.(id, v)} onErrorChange={(e) => onErrorChange?.(id, e)} />;
  }

  if (field.type === "textarea") {
    const { id, type, ...props } = field;

    return <TextAreaField {...props} isEditMode={isEditMode} onValueChange={(v) => onValueChange?.(id, v)} onErrorChange={(e) => onErrorChange?.(id, e)} />;
  }

  if (field.type === "richtext") {
    const { id, type, label, required, contentHtml } = field;

    return <RichTextField label={label} required={required} contentHtml={contentHtml} isEditMode={isEditMode} onValueChange={(v) => onValueChange?.(id, v)} onErrorChange={(e) => onErrorChange?.(id, e)} />;
  }

  if (field.type === "dropdown") {
    const { id, type, selected, ...rest } = field;
    const [current, setCurrent] = React.useState(selected);

    return (
      <DropdownField
        {...rest}
        selected={current}
        onSelect={(value) => {
          setCurrent(value);
        }}
      />
    );
  }

  if (field.type === "checkbox") {
    const { id, type, ...props} = field;

    return <CheckboxGroupField {...props} />;
  }

  if (field.type === "salaryRange") {
    const { id, type, ...props } = field;

    return <SalaryRangeField {...props} isEditMode={isEditMode} onValueChange={(v) => onValueChange?.(id, v)} onErrorChange={(e) => onErrorChange?.(id, e)} />;
  }

  if (field.type === "minMax") {
    const { id, type, ...props } = field;

    return <MinMaxField {...props} isEditMode={isEditMode} />;
  }

  if (field.type === "officeLocation") {
    const { id, type, ...props } = field;

    return <OfficeLocationField {...props} isEditMode={isEditMode} onValueChange={(v) => onValueChange?.(id, v)} onErrorChange={(e) => onErrorChange?.(id, e)} />;
  }

  if (field.type === "employmentType") {
    const { id, type, ...props } = field;

    return <EmploymentTypeField {...props} isEditMode={isEditMode} onValueChange={(v) => onValueChange?.(id, v)} onErrorChange={(e) => onErrorChange?.(id, e)} />;
  }

  if (field.type === "workArrangement") {
    const { id, type, ...props } = field;

    return <WorkArrangementField {...props} isEditMode={isEditMode} onValueChange={(v) => onValueChange?.(id, v)} onErrorChange={(e) => onErrorChange?.(id, e)} />;
  }

  return null;
};

export type TextAreaFieldProps = {
  label: string;
  required?: boolean;
  value: string;
  isEditMode?: boolean;
  onChange?: (value: string) => void;
  minHeight?: number;
  onValueChange?: (value: string) => void;
  onErrorChange?: (error: string) => void;
};

export const TextAreaField: React.FC<TextAreaFieldProps> = ({ 
  label, 
  required, 
  value, 
  isEditMode = false, 
  onChange,
  minHeight = 200,
  onValueChange,
  onErrorChange,
}) => {
  const [editValue, setEditValue] = React.useState(value);
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  
  // Use refs to avoid infinite loops
  const onErrorChangeRef = React.useRef(onErrorChange);
  const onValueChangeRef = React.useRef(onValueChange);
  onErrorChangeRef.current = onErrorChange;
  onValueChangeRef.current = onValueChange;

  React.useEffect(() => {
    let newError = "";
    if (touched && required && !editValue.trim()) {
      newError = `${label} is required.`;
    }
    setError(newError);
    onErrorChangeRef.current?.(newError);
  }, [touched, required, editValue, label]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTouched(true);
    setEditValue(e.target.value);
    onChange?.(e.target.value);
    onValueChangeRef.current?.(e.target.value);
  };

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 24,
          }}
        >
          {isEditMode ? (
            <div>
              <textarea
                value={editValue}
                onChange={handleChange}
                onBlur={() => setTouched(true)}
                style={{
                  width: "100%",
                  minHeight: minHeight,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: error ? "1px solid #F04438" : "1px solid #D0D5DD",
                  fontSize: 14,
                  color: "#101828",
                  fontWeight: 500,
                  outline: "none",
                  backgroundColor: "#FFFFFF",
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                }}
              />
              {error && (
                <p style={{ color: "#F04438", fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                fontSize: 14,
                color: "#101828",
                fontWeight: 500,
                backgroundColor: "#F9FAFB",
                minHeight: minHeight,
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export type RichTextFieldProps = {
  label: string;
  required?: boolean;
  contentHtml?: string;
  children?: React.ReactNode;
  isEditMode?: boolean;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  onErrorChange?: (error: string) => void;
};

export const RichTextField: React.FC<RichTextFieldProps> = ({ label, required, contentHtml, children, isEditMode = false, onChange, onValueChange, onErrorChange }) => {
  const [editValue, setEditValue] = React.useState(contentHtml || '');
  const [error, setError] = React.useState<string>("");
  const [touched, setTouched] = React.useState(false);
  
  // Use refs to avoid infinite loops
  const onErrorChangeRef = React.useRef(onErrorChange);
  const onValueChangeRef = React.useRef(onValueChange);
  onErrorChangeRef.current = onErrorChange;
  onValueChangeRef.current = onValueChange;

  const getPlainText = (html: string) =>
    html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

  React.useEffect(() => {
    let newError = "";
    if (touched && required && !getPlainText(editValue)) {
      newError = "This field is required.";
    }
    setError(newError);
    onErrorChangeRef.current?.(newError);
  }, [touched, required, editValue]);

  if (isEditMode) {
    return (
      <RichTextInputField
        label={label}
        required={required}
        value={editValue}
        onChange={(value) => {
          setTouched(true);
          setEditValue(value);
          onChange?.(value);
          onValueChangeRef.current?.(value);
        }}
        minHeight={200}
        showToolbar={true}
        error={error}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 24,
            fontSize: 14,
            color: "#101828",
            fontWeight: 500,
            lineHeight: 1.5,
            minHeight: 200,
            overflowY: "auto",
          }}
        >
          <style>
            {`
              .richtext-content ul,
              .richtext-content ol {
                padding-left: 0 !important;
                margin-left: 0 !important;
                list-style-position: inside;
              }
            `}
          </style>
          {contentHtml ? (
            <div 
              className="richtext-content"
              dangerouslySetInnerHTML={{ __html: contentHtml }} 
            />
          ) : children}
        </div>
      </div>
    </div>
  );
};

export type DropdownFieldOption = string;

export type DropdownFieldProps = {
  label: string;
  required?: boolean;
  options: readonly DropdownFieldOption[];
  selected: string;
  onSelect?: (value: string) => void;
  widthPercentage?: number;
};

export const DropdownField: React.FC<DropdownFieldProps> = ({
  label,
  required,
  options,
  selected,
  onSelect,
  widthPercentage = 50,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    if (onSelect) {
      onSelect(value);
    }
    setOpen(false);
  };

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 24,
          }}
        >
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #E9EAEB",
                fontSize: 14,
                color: "#101828",
                fontWeight: 500,
                backgroundColor: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: `${widthPercentage}%`,
              }}
            >
              <span>{selected}</span>
              <img
                src="/icons/chevron.svg"
                alt=""
                style={{
                  width: 16,
                  height: 16,
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
            </button>
            {open && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  width: `${widthPercentage}%`,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: 8,
                  boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                  zIndex: 10,
                  overflow: "hidden",
                }}
              >
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      backgroundColor: selected === option ? "#F3F4F6" : "#FFFFFF",
                      color: "#101828",
                      fontSize: 14,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = selected === option ? "#F3F4F6" : "#FFFFFF")
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export type CheckboxOption = {
  label: string;
  checked: boolean;
};

export type CheckboxGroupFieldProps = {
  label: string;
  required?: boolean;
  options: CheckboxOption[];
};

export const CheckboxGroupField: React.FC<CheckboxGroupFieldProps> = ({ label, required, options }) => {
  const [items, setItems] = React.useState(options);
  // Simplified structure: parent gray wrapper -> child white wrapper -> checkboxes directly
  const handleToggle = (targetLabel: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.label === targetLabel ? { ...item, checked: !item.checked } : item
      )
    );
  };

  return (
    <div>
      <div
        style={{
          borderRadius: 16,
          backgroundColor: "#F8F9FC",
          padding: 8,
        }}
      >
        <label
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#344054",
            display: "block",
            marginBottom: 8,
            padding: "4px 12px",
          }}
        >
          {label}
          {required && <span style={{ color: "#D92D20" }}>*</span>}
        </label>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {items.map((option) => {
            const isChecked = option.checked;
            const borderColor = isChecked ? "#181D27" : "#D5D7DA";

            return (
              <label
                key={option.label}
                onClick={() => handleToggle(option.label)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  color: "#181D27",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: `1px solid ${borderColor}`,
                    backgroundColor: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isChecked && (
                    <img src="/iconsV3/checkbox-check.svg" alt="" style={{ width: 12, height: 12 }} />
                  )}
                </div>
                {option.label}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};
