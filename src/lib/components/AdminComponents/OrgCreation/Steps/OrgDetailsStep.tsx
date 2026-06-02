"use client";

import React, { useEffect, useState, useRef } from "react";
import { OrgFormState, COUNTRY_SALARY_UNIT_MAP, COUNTRY_CURRENCY_MAP } from "@/lib/types/orgForm";
import RichTextEditor from "@/lib/components/CareerComponents/RichTextEditor";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(
  () => import("@/lib/components/LocationPicker/LocationPicker"),
  { ssr: false }
);
import { errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import GradientCheckbox from "@/lib/components/GradientCheckbox/GradientCheckbox";
import CurrencyDropdown from "@/lib/components/CareerComponents/CurrencyDropdown";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import Button from "@/lib/components/ui/button/Button";

const currencyOptions = [
  {
    name: "PHP",
    symbol: "₱",
  },
  {
    name: "AUD",
    symbol: "A$",
  },
  {
    name: "SGD",
    symbol: "S$",
  },
  {
    name: "GBP",
    symbol: "£",
  },
  {
    name: "USD",
    symbol: "$",
  },
];

const salaryUnitOptions = [
  { name: "Annual" },
  { name: "Monthly" },
  { name: "Hourly" },
];



interface PhilippinesData {
  provinces: { name: string; key: string }[];
  cities: { name: string; province: string }[];
}

interface OrgDetailsStepProps {
  formState: OrgFormState;
  setFormState: React.Dispatch<React.SetStateAction<OrgFormState>>;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export default function OrgDetailsStep({
  formState,
  setFormState,
  validationErrors,
  setValidationErrors,
}: OrgDetailsStepProps) {
  const [philippinesData, setPhilippinesData] = useState<PhilippinesData>({
    provinces: [],
    cities: [],
  });
  const [provinceList, setProvinceList] = useState<{ name: string; key: string }[]>([]);
  const [cityList, setCityList] = useState<{ name: string; province: string }[]>([]);

  // Organization name validation state
  const [nameCheckStatus, setNameCheckStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [nameErrorMessage, setNameErrorMessage] = useState("");
  const nameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadLocationData = async () => {
      try {
        const response = await fetch("/philippines-locations.json");
        const data: PhilippinesData = await response.json();
        setPhilippinesData(data);
        setProvinceList(data.provinces);

        const defaultProvince = data.provinces[0];
        if (defaultProvince && !formState.province) {
          setFormState((prev) => ({ ...prev, province: defaultProvince.name }));
        }

        const provinceKey = formState.province
          ? data.provinces.find((p) => p.name === formState.province)?.key
          : defaultProvince?.key;

        if (provinceKey) {
          const cities = data.cities.filter((city) => city.province === provinceKey);
          setCityList(cities);
          if (!formState.city && cities.length > 0) {
            setFormState((prev) => ({ ...prev, city: cities[0].name }));
          }
        }
      } catch (error) {
        console.error("Error loading location data:", error);
      }
    };

    loadLocationData();
  }, []);

  const validateFile = (file: File): boolean => {
    if (file.size > 1024 * 1024 * 2) {
      errorToast("File size must be less than 2MB", 1300);
      return false;
    }
    return true;
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setFormState((prev) => ({ ...prev, coverImage: file }));
    }
    e.target.value = "";
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setFormState((prev) => ({ ...prev, image: file }));
      if (validationErrors.image) {
        setValidationErrors((prev) => ({ ...prev, image: false }));
      }
    }
    e.target.value = "";
  };

  const handleDocumentChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: "companyRegistration" | "businessPermit"
  ) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setFormState((prev) => ({
        ...prev,
        documents: { ...prev.documents, [docType]: file },
      }));
    }
    e.target.value = "";
  };

  // Track File objects and URLs with refs
  const coverImageFileRef = useRef<File | null>(null);
  const logoImageFileRef = useRef<File | null>(null);
  const coverImageUrlRef = useRef<string | null>(null);
  const logoImageUrlRef = useRef<string | null>(null);

  // Initialize state with URLs if File objects exist
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(() => {
    if (!formState.coverImage) return null;
    if (typeof formState.coverImage === "string") return formState.coverImage;
    const url = URL.createObjectURL(formState.coverImage);
    coverImageFileRef.current = formState.coverImage;
    coverImageUrlRef.current = url;
    return url;
  });
  const [logoImagePreview, setLogoImagePreview] = useState<string | null>(() => {
    if (!formState.image) return null;
    if (typeof formState.image === "string") return formState.image;
    const url = URL.createObjectURL(formState.image);
    logoImageFileRef.current = formState.image;
    logoImageUrlRef.current = url;
    return url;
  });

  // Update URLs when File objects change
  useEffect(() => {
    // Handle cover image
    if (!formState.coverImage) {
      if (coverImageUrlRef.current && coverImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(coverImageUrlRef.current);
      }
      coverImageUrlRef.current = null;
      coverImageFileRef.current = null;
      setCoverImagePreview(null);
    } else if (typeof formState.coverImage === "string") {
      if (coverImageUrlRef.current && coverImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(coverImageUrlRef.current);
      }
      coverImageUrlRef.current = formState.coverImage;
      coverImageFileRef.current = null;
      setCoverImagePreview(formState.coverImage);
    } else {
      // File object - check if File reference changed or URL doesn't exist
      if (coverImageFileRef.current !== formState.coverImage || !coverImageUrlRef.current) {
        // File changed or URL missing - revoke old URL and create new one
        if (coverImageUrlRef.current && coverImageUrlRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(coverImageUrlRef.current);
        }
        const url = URL.createObjectURL(formState.coverImage);
        coverImageFileRef.current = formState.coverImage;
        coverImageUrlRef.current = url;
        setCoverImagePreview(url);
      }
      // If File reference is the same and URL exists, keep using existing URL
    }

    // Handle logo image
    if (!formState.image) {
      if (logoImageUrlRef.current && logoImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(logoImageUrlRef.current);
      }
      logoImageUrlRef.current = null;
      logoImageFileRef.current = null;
      setLogoImagePreview(null);
    } else if (typeof formState.image === "string") {
      if (logoImageUrlRef.current && logoImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(logoImageUrlRef.current);
      }
      logoImageUrlRef.current = formState.image;
      logoImageFileRef.current = null;
      setLogoImagePreview(formState.image);
    } else {
      // File object - check if File reference changed or URL doesn't exist
      if (logoImageFileRef.current !== formState.image || !logoImageUrlRef.current) {
        // File changed or URL missing - revoke old URL and create new one
        if (logoImageUrlRef.current && logoImageUrlRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(logoImageUrlRef.current);
        }
        const url = URL.createObjectURL(formState.image);
        logoImageFileRef.current = formState.image;
        logoImageUrlRef.current = url;
        setLogoImagePreview(url);
      }
      // If File reference is the same and URL exists, keep using existing URL
    }
  }, [formState.coverImage, formState.image]);

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (coverImageUrlRef.current && coverImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(coverImageUrlRef.current);
      }
      if (logoImageUrlRef.current && logoImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(logoImageUrlRef.current);
      }
    };
  }, []);

  // Debounced organization name validation
  useEffect(() => {
    const checkOrgName = async (name: string) => {
      if (!name.trim()) {
        setNameCheckStatus("idle");
        setNameErrorMessage("");
        return;
      }

      setNameCheckStatus("checking");
      try {
        const response = await api.get(`/api/admin/check-org-name?name=${encodeURIComponent(name.trim())}`);
        if (response.data.available) {
          setNameCheckStatus("available");
          setNameErrorMessage("");
        } else {
          setNameCheckStatus("taken");
          setNameErrorMessage(response.data.message || "This organization name is already taken");
        }
      } catch (error) {
        console.error("Error checking organization name:", error);
        setNameCheckStatus("idle");
        setNameErrorMessage("");
      }
    };

    // Clear previous timeout
    if (nameCheckTimeoutRef.current) {
      clearTimeout(nameCheckTimeoutRef.current);
    }

    // Set new timeout for debounced checking
    nameCheckTimeoutRef.current = setTimeout(() => {
      checkOrgName(formState.name);
    }, 300);

    // Cleanup timeout on unmount
    return () => {
      if (nameCheckTimeoutRef.current) {
        clearTimeout(nameCheckTimeoutRef.current);
      }
    };
  }, [formState.name]);

  const handleProvinceChange = (province: string) => {
    const provinceObj = provinceList.find((p) => p.name === province);
    const cities = philippinesData.cities.filter(
      (city) => city.province === provinceObj?.key
    );
    // Remove option if clicking the same province
    const isSameProvince = formState.province === province;
    if (isSameProvince) {
      setCityList([]);
    } else {
      setCityList(cities);
    }
    setFormState((prev) => ({
      ...prev,
      province: isSameProvince ? "" : province,
      city: isSameProvince ? "" : cities[0]?.name || "",
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", paddingBottom: 32 }}>
      {/* Cover Image and Logo Section */}
      <div style={{ marginBottom: 0 }}>
        {/* Cover Image */}
        <div
          style={{
            width: "100%",
            height: 200,
            borderRadius: 16,
            background: coverImagePreview
              ? `url(${coverImagePreview}) center/cover no-repeat`
              : "linear-gradient(90deg, #9FCAED, #CEB6DA, #EBACC9, #FCCEC0)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="file"
              id="coverImage"
              accept="image/jpeg, image/png, image/jpg"
              hidden
              onChange={handleCoverImageChange}
            />
            <button
              type="button"
              onClick={() => document.getElementById("coverImage")?.click()}
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "1px solid #D5D7DA",
                borderRadius: 999,
                padding: "8px 14px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <i className="la la-camera" />
              {formState.coverImage ? "Replace cover" : "Add cover image"}
            </button>
            {formState.coverImage && (
              <button
                type="button"
                onClick={() => setFormState((prev) => ({ ...prev, coverImage: null }))}
                style={{
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid #D5D7DA",
                  borderRadius: 999,
                  padding: "8px 14px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <i className="la la-trash" style={{ color: "#B42318" }} />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Logo and Info */}
        <div
          style={{
            background: "transparent",
            borderRadius: 0,
            padding: "0 24px 24px",
            marginTop: 0,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
            {/* Logo */}
            <div
              style={{
                width: 180,
                height: 180,
                marginTop: -40,
                borderRadius: "50%",
                border: "8px solid #fff",
                background: logoImagePreview
                  ? `url(${logoImagePreview}) center/cover no-repeat`
                  : "#F8F9FC",
                position: "relative",
                zIndex: 1,
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                borderColor: validationErrors.image ? "#EF4444" : "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {!formState.image && (
                <img
                  src="/user-profile.png"
                  alt="Profile placeholder"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: "20px",
                  }}
                />
              )}
              <input
                type="file"
                id="logo"
                accept="image/jpeg, image/png, image/jpg"
                hidden
                onChange={handleLogoChange}
              />
            </div>

            {/* Info */}
            <div style={{ flex: 1, paddingTop: 24 }}>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#181D27",
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                {formState.name || "New Organization"}
              </h1>
              <button
                type="button"
                onClick={() => document.getElementById("logo")?.click()}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #D5D7DA",
                  borderRadius: 999,
                  padding: "8px 14px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#414651",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <i className="la la-camera" />
                {formState.image ? "Replace Logo" : "Upload Logo"}
              </button>
              {validationErrors.image && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 400 }}>
                    Logo is required.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Organization Details Card */}
      <div
        style={{
          background: "#F8F9FC",
          borderRadius: 16,
          padding: 8,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
            1. Organization Details
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
            {/* Organization Name */}
            <div>
              <label
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#717680",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Organization Name
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) => {
                    setFormState((prev) => ({ ...prev, name: e.target.value }));
                    if (validationErrors.name) {
                      setValidationErrors((prev) => ({ ...prev, name: false }));
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: `1px solid ${validationErrors.name || nameCheckStatus === "taken"
                        ? "#EF4444"
                        : "#E9EAEB"
                      }`,
                    borderRadius: 8,
                    fontSize: 16,
                  }}
                  placeholder="Enter company name"
                />
                {nameCheckStatus === "checking" && (
                  <i
                    className="la la-spinner la-spin"
                    style={{
                      position: "absolute",
                      right: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 16,
                      color: "#717680",
                    }}
                  />
                )}
              </div>
              {validationErrors.name && (
                <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 400, marginTop: 4, display: "block" }}>
                  This is a required field.
                </span>
              )}
              {!validationErrors.name && nameCheckStatus === "taken" && nameErrorMessage && (
                <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 400, marginTop: 4, display: "block" }}>
                  {nameErrorMessage}
                </span>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#717680",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Description
              </label>
              <RichTextEditor
                setText={(text) => setFormState((prev) => ({ ...prev, description: text }))}
                text={formState.description}
                error={false}
              />
            </div>

            {/* Organization Address */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginBottom: 16 }}>
                Organization Address
              </div>

              {/* Location Entries */}
              {formState.locations?.map((location, index) => (
                <div key={index}>
                    <LocationPicker
                      placeholder="Search for a location or pin on map..."
                      value={
                        location.isGPS === false
                          ? {
                              displayName: location.location || location.address,
                              country: location.country,
                              state: location.province,
                              city: location.city,
                              address: location.address,
                              isPinned: false,
                              isGPS: false,
                            }
                          : location.latitude && location.longitude
                          ? {
                              displayName: location.location || location.address,
                              lat: location.latitude,
                              lon: location.longitude,
                              isPinned: true,
                              country: location.country,
                              state: location.province,
                              city: location.city,
                              address: location.address,
                              isGPS: true,
                            }
                          : null
                      }
                      defaultInputValue={location.address}
                      startInManualMode={location.isGPS === false}
                      onModeChange={(isManual) => {
                        setFormState((prev) => {
                          const newLocations = [...(prev.locations || [])];
                          newLocations[index] = { ...newLocations[index], isGPS: !isManual };
                          return { ...prev, locations: newLocations };
                        });
                      }}
                      onChange={(selected) => {
                        const newLocations = [...(formState.locations || [])];
                        let updatedCountry = selected?.country || "Philippines";

                        if (selected) {
                          newLocations[index] = {
                            ...newLocations[index],
                            location: selected.displayName,
                            latitude: selected.lat,
                            longitude: selected.lon,
                            country: updatedCountry,
                            province: selected.state,
                            city: selected.city,
                            address: selected.address || "",
                            isGPS: selected.isGPS,
                          };
                        } else {
                          newLocations[index] = {
                            ...newLocations[index],
                            address: "",
                            location: "",
                            latitude: undefined,
                            longitude: undefined,
                          };
                        }

                        // If this location is HQ, update default settings
                        setFormState((prev) => {
                          const overrides: Partial<OrgFormState> = {};
                          if (newLocations[index].isHQ) {
                             const currency = COUNTRY_CURRENCY_MAP[updatedCountry] || "USD";
                             const salaryUnit = COUNTRY_SALARY_UNIT_MAP[updatedCountry] || "Annual";
                             overrides.defaultCurrency = currency;
                             overrides.defaultSalaryUnit = salaryUnit;
                             // Also update the main country field if it's HQ
                             overrides.country = updatedCountry;
                          }
                          return { ...prev, locations: newLocations, ...overrides };
                        });
                      }}
                      showMap={true}
                      mapHeight={250}
                      showCurrentLocationButton={false}
                      onDelete={
                        formState.locations.length > 1
                          ? () => {
                              const newLocations = formState.locations.filter(
                                (_, i) => i !== index
                              );
                              
                              let overrides: Partial<OrgFormState> = {};
                              
                              // If we're deleting the HQ, make the first remaining one the HQ
                              if (location.isHQ && newLocations.length > 0) {
                                newLocations[0] = { ...newLocations[0], isHQ: true };
                                
                                const newHqCountry = newLocations[0].country || "Philippines";
                                const currency = COUNTRY_CURRENCY_MAP[newHqCountry] || "USD";
                                const salaryUnit = COUNTRY_SALARY_UNIT_MAP[newHqCountry] || "Annual";
                                
                                overrides.defaultCurrency = currency;
                                overrides.defaultSalaryUnit = salaryUnit;
                                overrides.country = newHqCountry;
                              }
                              
                              setFormState((prev) => ({
                                ...prev,
                                locations: newLocations,
                                ...overrides
                              }));
                            }
                          : undefined
                      }
                    />

                    {/* Mark as HQ checkbox */}
                    <div style={{ marginTop: 12 }}>
                      <GradientCheckbox
                        checked={location.isHQ || false}
                        onChange={(checked) => {
                          // Prevent unchecking if already checked (HQ) - must select another location to change HQ
                          if (!checked && location.isHQ) {
                            return;
                          }

                          const newLocations = [
                            ...(formState.locations || []),
                          ].map((loc, i) => ({
                            ...loc,
                            isHQ: i === index ? checked : false,
                          }));
                          
                          setFormState((prev) => {
                             const overrides: Partial<OrgFormState> = {};
                             if (checked) {
                                  const country = newLocations[index].country || "Philippines";
                                  const currency = COUNTRY_CURRENCY_MAP[country] || "USD";
                                  const salaryUnit = COUNTRY_SALARY_UNIT_MAP[country] || "Annual";
                                  overrides.defaultCurrency = currency;
                                  overrides.defaultSalaryUnit = salaryUnit;
                                  overrides.country = country;
                             }
                             return {
                                ...prev,
                                locations: newLocations,
                                ...overrides,
                             };
                          });
                        }}
                        label="Mark as HQ"
                      />
                    </div>

                  {/* Divider between locations */}
                  {index < (formState.locations?.length || 1) - 1 && (
                    <hr
                      style={{
                        margin: "24px 0",
                        border: "none",
                        borderTop: "1px solid #E9EAEB",
                      }}
                    />
                  )}
                </div>
              ))}

              {/* Add more locations button */}
              <div style={{ marginTop: 20 }}>
                <Button
                  label="Add more locations"
                  variant="tertiary-outline"
                  onClick={() => {
                    const newLocation = { country: "Philippines", address: "", location: "", isHQ: false, isGPS: true };
                    setFormState((prev) => ({
                      ...prev,
                      locations: [...(prev.locations || []), newLocation],
                    }));
                  }}
                  size="default"
                  style={{
                    width: "fit-content",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #D5D7DA",
                    color: "#181D27",
                    fontWeight: 500,
                    boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)"
                  }}
                  svgAsset={<i className="la la-plus" style={{ fontSize: 16, marginRight: 8 }} />}
                />
              </div>

              {/* Default Settings Section */}
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #E9EAEB" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginBottom: 16 }}>
                  Default Settings
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  {/* Default Currency */}
                  <div>
                    <label
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#717680",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Default Currency
                    </label>
                    <div
                      style={{
                        width: "100%",
                      }}
                    >
                      <CurrencyDropdown
                        currency={formState.defaultCurrency || "PHP"}
                        onCurrencyChange={(currency) =>
                          setFormState((prev) => ({ ...prev, defaultCurrency: currency }))
                        }
                        currencyOptions={currencyOptions}
                        fullWidth={true}
                      />
                    </div>
                  </div>

                  {/* Default Salary Unit */}
                  <div>
                    <label
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#717680",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Default Salary Unit
                    </label>
                    <div style={{ width: "100%" }}>
                      <CustomDropdown
                        placeholder="Select salary unit"
                        screeningSetting={formState.defaultSalaryUnit || "Monthly"}
                        settingList={salaryUnitOptions}
                        onSelectSetting={(unit) =>
                          setFormState((prev) => ({ ...prev, defaultSalaryUnit: unit }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Documents Card */}
      <div
        style={{
          background: "#F8F9FC",
          borderRadius: 16,
          padding: 8,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
            2. Business Documents
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
            <div>
              <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 8 }}>
                Company/SEC Registration
              </p>
              <input
                type="file"
                id="companyRegistration"
                accept="application/pdf, image/jpeg, image/png, image/jpg"
                hidden
                onChange={(e) => handleDocumentChange(e, "companyRegistration")}
              />
              {formState.documents.companyRegistration ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "#F8F9FC",
                    borderRadius: 8,
                    padding: "16px 24px",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      background: "#181D27",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <i className="la la-file" style={{ color: "#fff", fontSize: 20 }} />
                  </div>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#181D27",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {typeof formState.documents.companyRegistration === "string"
                      ? formState.documents.companyRegistration
                      : formState.documents.companyRegistration.name}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        documents: { ...prev.documents, companyRegistration: null },
                      }))
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 6,
                    }}
                  >
                    <i className="la la-trash" style={{ fontSize: 20, color: "#535862" }} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById("companyRegistration")?.click()}
                  style={{
                    width: "fit-content",
                    padding: "8px 16px",
                    border: "1px solid #D5D7DA",
                    borderRadius: 999,
                    background: "#fff",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <i className="la la-plus-circle" style={{ fontSize: 16 }} />
                  Upload document
                </button>
              )}
            </div>
            <div>
              <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 8 }}>
                Business Permit
              </p>
              <input
                type="file"
                id="businessPermit"
                accept="application/pdf, image/jpeg, image/png, image/jpg"
                hidden
                onChange={(e) => handleDocumentChange(e, "businessPermit")}
              />
              {formState.documents.businessPermit ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "#F8F9FC",
                    borderRadius: 8,
                    padding: "16px 24px",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      background: "#181D27",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <i className="la la-file" style={{ color: "#fff", fontSize: 20 }} />
                  </div>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#181D27",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {typeof formState.documents.businessPermit === "string"
                      ? formState.documents.businessPermit
                      : formState.documents.businessPermit.name}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        documents: { ...prev.documents, businessPermit: null },
                      }))
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 6,
                    }}
                  >
                    <i className="la la-trash" style={{ fontSize: 20, color: "#535862" }} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById("businessPermit")?.click()}
                  style={{
                    width: "fit-content",
                    padding: "8px 16px",
                    border: "1px solid #D5D7DA",
                    borderRadius: 999,
                    background: "#fff",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <i className="la la-plus-circle" style={{ fontSize: 16 }} />
                  Upload document
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Domains Card */}
      <div
        style={{
          background: "#F8F9FC",
          borderRadius: 16,
          padding: 8,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
            3. Email Domains
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
          {/* Subdomain Section */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: "#717680", marginBottom: 8 }}>
              Create company subdomain for Email Subdomain:
            </p>
            <p style={{ fontSize: 13, color: "#717680", marginBottom: 8 }}>
              (e.g. orgname.hellojia.ai)
            </p>
            <p style={{ fontSize: 14, color: "#717680", marginBottom: 8, fontWeight: 500 }}>
              Company Slug (eg. orgname)
            </p>
            <input
              type="text"
              value={formState.companySlug}
              onChange={(e) => setFormState((prev) => ({ ...prev, companySlug: e.target.value }))}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #E9EAEB",
                borderRadius: 8,
                fontSize: 16,
              }}
              placeholder="Enter company slug"
            />
            <p style={{ fontSize: 12, color: "#717680", marginTop: 8 }}>
              This can only be set once, it cannot be edited after creation.
            </p>
          </div>

          {/* Divider */}
          <div style={{ width: "100%", height: 1, background: "#E9EAEB", marginBottom: 24 }}></div>

          {/* Company Domains Section */}
          <div>
            <p style={{ fontSize: 14, color: "#717680", marginBottom: 4 }}>
              Add existing company domain(s)
            </p>
            <p style={{ fontSize: 14, color: "#717680", marginBottom: 12, fontWeight: 500 }}>
              Company Domain (eg. company.com)
            </p>

            {formState.emailDomains.map((domain, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => {
                    const newDomains = [...formState.emailDomains];
                    newDomains[index] = e.target.value;
                    setFormState((prev) => ({ ...prev, emailDomains: newDomains }));
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    border: "1px solid #E9EAEB",
                    borderRadius: 8,
                    fontSize: 16,
                  }}
                  placeholder="Enter company domain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormState((prev) => {
                      const next = prev.emailDomains.filter((_, i) => i !== index);
                      return {
                        ...prev,
                        emailDomains: next.length > 0 ? next : [""],
                      };
                    });
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 6,
                  }}
                >
                  <i className="la la-trash" style={{ fontSize: 24, color: "#535862" }} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                if (formState.emailDomains.length < 5) {
                  setFormState((prev) => ({
                    ...prev,
                    emailDomains: [...prev.emailDomains, ""],
                  }));
                }
              }}
              disabled={formState.emailDomains.length >= 5}
              style={{
                width: "fit-content",
                padding: "8px 16px",
                border: "1px solid #D5D7DA",
                borderRadius: 999,
                background: "#fff",
                fontSize: 14,
                fontWeight: 500,
                cursor: formState.emailDomains.length >= 5 ? "not-allowed" : "pointer",
                opacity: formState.emailDomains.length >= 5 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
              }}
            >
              <i className="la la-plus" style={{ fontSize: 16 }} />
              Add domain {formState.emailDomains.length >= 5 ? "(max 5)" : ""}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
