"use client";

import React from "react";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import philippineCitiesAndProvinces from "../../../../../public/philippines-locations.json";

const workSetupOptions = [
  { name: "Fully Remote" },
  { name: "Onsite" },
  { name: "Hybrid" },
];

const employmentTypeOptions = [{ name: "Full-Time" }, { name: "Part-Time" }];

const projectOptions = [
  { name: "Project A" },
  { name: "Project B" },
  { name: "Project C" },
];

interface CareerDetailsStepProps {
  careerForm: any;
  setCareerForm: (careerForm: any) => void;
  provinceList: any;
  cityList: any;
  setCityList: (cityList: any) => void;
  user: any;
  orgMembers: any[];
  teamMembers: any[];
  showMemberDropdown: boolean;
  setShowMemberDropdown: (show: boolean) => void;
  loadingMembers: boolean;
  addTeamMember: (member: any) => void;
  removeTeamMember: (email: string) => void;
  updateMemberRole: (email: string, role: string) => void;
  showRoleDropdown: string | null;
  setShowRoleDropdown: (email: string | null) => void;
  roleOptions: Array<{ name: string; description: string }>;
  currentUserRole: string;
  setCurrentUserRole: (role: string) => void;
  memberSearchQuery: string;
  setMemberSearchQuery: (query: string) => void;
  validationErrors: { [key: string]: boolean };
  setValidationErrors: (errors: { [key: string]: boolean }) => void;
}

export default function CareerDetailsStep({
  careerForm,
  setCareerForm,
  provinceList,
  cityList,
  setCityList,
  user,
  orgMembers,
  teamMembers,
  showMemberDropdown,
  setShowMemberDropdown,
  loadingMembers,
  addTeamMember,
  removeTeamMember,
  updateMemberRole,
  showRoleDropdown,
  setShowRoleDropdown,
  roleOptions,
  currentUserRole,
  setCurrentUserRole,
  memberSearchQuery,
  setMemberSearchQuery,
  validationErrors,
  setValidationErrors,
}: CareerDetailsStepProps) {
  return (
    <div
      style={{ display: "flex", flexDirection: "row", gap: 16, width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "70%",
        }}
      >
        {/* Career Information Card */}
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                1. Career Information
              </span>
            </div>
            <div className="layered-card-content">
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                Basic Information
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "50%",
                  }}
                >
                  <span style={{ marginBottom: 8 }}>Job Title</span>
                  <input
                    value={careerForm.jobTitle}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0.375rem 0.75rem",
                      fontSize: "1rem",
                      lineHeight: "1.5",
                      backgroundColor: "#FFFFFF",
                      border: `1px solid ${
                        validationErrors.jobTitle ? "#EF4444" : "#E9EAEB"
                      }`,
                      borderRadius: "8px",
                    }}
                    placeholder="Enter job title"
                    onChange={(e) => {
                      setCareerForm({
                        ...careerForm,
                        jobTitle: e.target.value || "",
                      });
                      if (validationErrors.jobTitle) {
                        setValidationErrors({
                          ...validationErrors,
                          jobTitle: false,
                        });
                      }
                    }}
                  ></input>
                  <div style={{ minHeight: "18px", marginTop: 4 }}>
                    {validationErrors.jobTitle && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#EF4444",
                          fontWeight: 400,
                        }}
                      >
                        This is a required field.
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "50%",
                  }}
                >
                  <span style={{ marginBottom: 8 }}>Headcount</span>
                  <input
                    type="number"
                    value={careerForm.headcount || ""}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0.375rem 0.75rem",
                      fontSize: "1rem",
                      lineHeight: "1.5",
                      backgroundColor: "#FFFFFF",
                      border: `1px solid ${
                        validationErrors.headcount ? "#EF4444" : "#E9EAEB"
                      }`,
                      borderRadius: "8px",
                    }}
                    placeholder="Enter headcount"
                    min={0}
                    onChange={(e) => {
                      setCareerForm({
                        ...careerForm,
                        headcount: e.target.value || "",
                      });
                      if (validationErrors.headcount) {
                        setValidationErrors({
                          ...validationErrors,
                          headcount: false,
                        });
                      }
                    }}
                  ></input>
                  <div style={{ minHeight: "18px", marginTop: 4 }}>
                    {validationErrors.headcount && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#EF4444",
                          fontWeight: 400,
                        }}
                      >
                        This is a required field.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <span>Project</span>
              <CustomDropdown
                onSelectSetting={(project) => {
                  setCareerForm({ ...careerForm, project: project });
                }}
                screeningSetting={careerForm.project}
                settingList={projectOptions}
                placeholder="Choose a project for this career"
              />

              <span
                style={{
                  fontSize: 16,
                  color: "#181D27",
                  fontWeight: 700,
                  marginTop: 24,
                }}
              >
                Work Setting
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 8,
                    width: "50%",
                  }}
                >
                  <span>Employment Type</span>
                  <CustomDropdown
                    onSelectSetting={(employmentType) => {
                      setCareerForm({
                        ...careerForm,
                        employmentType: employmentType,
                      });
                      if (validationErrors.employmentType) {
                        setValidationErrors({
                          ...validationErrors,
                          employmentType: false,
                        });
                      }
                    }}
                    screeningSetting={careerForm.employmentType}
                    settingList={employmentTypeOptions}
                    placeholder="Choose employment type"
                    error={
                      validationErrors.employmentType
                        ? "This is a required field."
                        : null
                    }
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 8,
                    width: "50%",
                  }}
                >
                  <span>Arrangement</span>
                  <CustomDropdown
                    onSelectSetting={(setting) => {
                      setCareerForm({ ...careerForm, workSetup: setting });
                      if (validationErrors.workSetup) {
                        setValidationErrors({
                          ...validationErrors,
                          workSetup: false,
                        });
                      }
                    }}
                    screeningSetting={careerForm.workSetup}
                    settingList={workSetupOptions}
                    placeholder="Choose work arrangement"
                    error={
                      validationErrors.workSetup
                        ? "This is a required field."
                        : null
                    }
                  />
                </div>
              </div>

              <span
                style={{
                  fontSize: 16,
                  color: "#181D27",
                  fontWeight: 700,
                  marginTop: 24,
                }}
              >
                Location
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 8,
                    width: "33.33%",
                  }}
                >
                  <span>Country</span>
                  <CustomDropdown
                    onSelectSetting={(setting) => {
                      setCareerForm({ ...careerForm, country: setting });
                    }}
                    screeningSetting={careerForm.country}
                    settingList={[]}
                    placeholder="Select Country"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 8,
                    width: "33.33%",
                  }}
                >
                  <span>State / Province</span>
                  <CustomDropdown
                    onSelectSetting={(province) => {
                      const provinceObj = provinceList.find(
                        (p: any) => p.name === province
                      );
                      const cities = philippineCitiesAndProvinces.cities.filter(
                        (city: any) => city.province === provinceObj.key
                      );
                      setCareerForm({
                        ...careerForm,
                        city: cities[0].name,
                        province: province,
                      });
                      setCityList(cities);
                      if (validationErrors.province) {
                        setValidationErrors({
                          ...validationErrors,
                          province: false,
                        });
                      }
                    }}
                    screeningSetting={careerForm.province}
                    settingList={provinceList}
                    placeholder="Choose state / province"
                    error={
                      validationErrors.province
                        ? "This is a required field."
                        : null
                    }
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 8,
                    width: "33.33%",
                  }}
                >
                  <span>City</span>
                  <CustomDropdown
                    onSelectSetting={(city) => {
                      setCareerForm({ ...careerForm, city: city });
                      if (validationErrors.city) {
                        setValidationErrors({
                          ...validationErrors,
                          city: false,
                        });
                      }
                    }}
                    screeningSetting={careerForm.city}
                    settingList={cityList}
                    placeholder="Choose city"
                    error={
                      validationErrors.city ? "This is a required field." : null
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 24,
                }}
              >
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Salary
                </span>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                    minWidth: "130px",
                  }}
                >
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={careerForm.salaryNegotiable}
                      onChange={() =>
                        setCareerForm({
                          ...careerForm,
                          salaryNegotiable: !careerForm.salaryNegotiable,
                        })
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                  <span>
                    {careerForm.salaryNegotiable ? "Negotiable" : "Fixed"}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "50%",
                  }}
                >
                  <span style={{ marginBottom: 8 }}>Minimum Salary</span>
                  <div style={{ position: "relative", width: "100%" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#6c757d",
                        fontSize: "16px",
                        pointerEvents: "none",
                      }}
                    >
                      P
                    </span>
                    <input
                      type="number"
                      style={{
                        width: "100%",
                        height: "48px",
                        paddingTop: "0.375rem",
                        paddingBottom: "0.375rem",
                        paddingLeft: "28px",
                        paddingRight: "0.75rem",
                        fontSize: "1rem",
                        lineHeight: "1.5",
                        backgroundColor: "#FAFAFA",
                        border: `1px solid ${
                          validationErrors.minimumSalary ? "#EF4444" : "#E9EAEB"
                        }`,
                        borderRadius: "8px",
                      }}
                      placeholder="0"
                      min={0}
                      value={careerForm.minimumSalary}
                      onChange={(e) => {
                        setCareerForm({
                          ...careerForm,
                          minimumSalary: e.target.value || "",
                        });
                        if (validationErrors.minimumSalary) {
                          setValidationErrors({
                            ...validationErrors,
                            minimumSalary: false,
                          });
                        }
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: "30px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#6c757d",
                        fontSize: "16px",
                        pointerEvents: "none",
                      }}
                    >
                      PHP
                    </span>
                  </div>
                  <div style={{ minHeight: "18px", marginTop: 4 }}>
                    {validationErrors.minimumSalary && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#EF4444",
                          fontWeight: 400,
                        }}
                      >
                        This is a required field.
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "50%",
                  }}
                >
                  <span style={{ marginBottom: 8 }}>Maximum Salary</span>
                  <div style={{ position: "relative", width: "100%" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#6c757d",
                        fontSize: "16px",
                        pointerEvents: "none",
                      }}
                    >
                      P
                    </span>
                    <input
                      type="number"
                      style={{
                        width: "100%",
                        height: "48px",
                        paddingTop: "0.375rem",
                        paddingBottom: "0.375rem",
                        paddingLeft: "28px",
                        paddingRight: "0.75rem",
                        fontSize: "1rem",
                        lineHeight: "1.5",
                        backgroundColor: "#FAFAFA",
                        border: `1px solid ${
                          validationErrors.maximumSalary ? "#EF4444" : "#E9EAEB"
                        }`,
                        borderRadius: "8px",
                      }}
                      placeholder="0"
                      min={0}
                      value={careerForm.maximumSalary}
                      onChange={(e) => {
                        setCareerForm({
                          ...careerForm,
                          maximumSalary: e.target.value || "",
                        });
                        if (validationErrors.maximumSalary) {
                          setValidationErrors({
                            ...validationErrors,
                            maximumSalary: false,
                          });
                        }
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: "30px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#6c757d",
                        fontSize: "16px",
                        pointerEvents: "none",
                      }}
                    >
                      PHP
                    </span>
                  </div>
                  <div style={{ minHeight: "18px", marginTop: 4 }}>
                    {validationErrors.maximumSalary && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#EF4444",
                          fontWeight: 400,
                        }}
                      >
                        This is a required field.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Job Description Card - Placeholder for RichTextEditor */}
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                2. Job Description
              </span>
            </div>
            <div className="layered-card-content">
              {/* RichTextEditor will be rendered here from parent */}
              <span style={{ fontSize: 14, color: "#717680" }}>
                Job Description editor goes here
              </span>
            </div>
          </div>
        </div>

        {/* Team Access Card - Placeholder */}
        <div className="layered-card-outer" style={{ marginBottom: "32px" }}>
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                3. Team Access
              </span>
            </div>
            <div className="layered-card-content">
              {/* Team Access UI will be rendered here from parent */}
              <span style={{ fontSize: 14, color: "#717680" }}>
                Team Access UI goes here
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tips Sidebar */}
      <div
        className="layered-card-outer"
        style={{
          width: "30%",
          position: "sticky",
          top: "16px",
          alignSelf: "flex-start",
        }}
      >
        <div className="layered-card-middle">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <i
              className="la la-lightbulb-o"
              style={{
                fontSize: 28,
                background:
                  "linear-gradient(135deg, #E9A5C9 0%, #C8B5DA 50%, #9FCAED 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            ></i>
            <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
              Tips
            </span>
          </div>
          <div className="layered-card-content">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p
                style={{
                  fontSize: 14,
                  color: "#414651",
                  fontWeight: 400,
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: "#181D27" }}>
                  Use clear, standard job titles
                </span>{" "}
                <span style={{ color: "#717680" }}>
                  for better searchability (e.g., "Software Engineer" instead of
                  "Code Ninja" or "Tech Rockstar").
                </span>
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: "#414651",
                  fontWeight: 400,
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: "#181D27" }}>
                  Avoid abbreviations
                </span>{" "}
                <span style={{ color: "#717680" }}>
                  or internal role codes that applicants may not understand
                  (e.g., use "QA Engineer" instead of "QE II" or "QA-TL").
                </span>
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: "#414651",
                  fontWeight: 400,
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: "#181D27" }}>
                  Keep it concise
                </span>{" "}
                <span style={{ color: "#717680" }}>
                  — job titles should be no more than a few words (2—4 max),
                  avoiding fluff or marketing terms.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
