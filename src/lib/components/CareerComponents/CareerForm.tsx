"use client";

import { useEffect, useRef, useState } from "react";
import InterviewQuestionGeneratorV2 from "./InterviewQuestionGeneratorV2";
import RichTextEditor from "@/lib/components/CareerComponents/RichTextEditor";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import VoiceSelector from "@/lib/components/CareerComponents/VoiceSelector";
import CurrencyDropdown from "@/lib/components/CareerComponents/CurrencyDropdown";
import philippineCitiesAndProvinces from "../../../../public/philippines-locations.json";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { useAppContext } from "@/lib/context/AppContext";
import axios from "axios";
import CareerActionModal from "./CareerActionModal";
import FullScreenLoadingAnimation from "./FullScreenLoadingAnimation";
// Setting List icons
const screeningSettingList = [
  {
    name: "Good Fit and above",
    icon: "la la-check",
  },
  {
    name: "Only Strong Fit",
    icon: "la la-check-double",
  },
  {
    name: "No Automatic Promotion",
    icon: "la la-times",
  },
];
const workSetupOptions = [
  {
    name: "Fully Remote",
  },
  {
    name: "Onsite",
  },
  {
    name: "Hybrid",
  },
];

const employmentTypeOptions = [
  {
    name: "Full-Time",
  },
  {
    name: "Part-Time",
  },
];

const currencyOptions = [
  {
    name: "PHP",
    symbol: "₱",
  },
  {
    name: "USD",
    symbol: "$",
  },
  {
    name: "EUR",
    symbol: "€",
  },
  {
    name: "JPY",
    symbol: "¥",
  },
  {
    name: "CNY",
    symbol: "¥",
  },
];

const projectOptions = [
  {
    name: "Project A",
  },
  {
    name: "Project B",
  },
  {
    name: "Project C",
  },
];

export default function CareerForm({
  career,
  formType,
  setShowEditModal,
}: {
  career?: any;
  formType: string;
  setShowEditModal?: (show: boolean) => void;
}) {
  const { user, orgID } = useAppContext();
  const [jobTitle, setJobTitle] = useState(career?.jobTitle || "");
  const [headcount, setHeadcount] = useState(career?.headcount || "");
  const [project, setProject] = useState(career?.project || "");
  const [description, setDescription] = useState(career?.description || "");
  const [workSetup, setWorkSetup] = useState(career?.workSetup || "");
  const [screeningSetting, setScreeningSetting] = useState(
    career?.screeningSetting || "Good Fit and above"
  );
  const [employmentType, setEmploymentType] = useState(
    career?.employmentType || "Full-Time"
  );
  const [voice, setVoice] = useState(career?.voice || "alloy");
  const [requireVideo, setRequireVideo] = useState(
    career?.requireVideo || true
  );
  const [salaryNegotiable, setSalaryNegotiable] = useState(
    career?.salaryNegotiable || true
  );
  const [currency, setCurrency] = useState(career?.currency || "PHP");
  const [minimumSalary, setMinimumSalary] = useState(
    career?.minimumSalary || ""
  );
  const [maximumSalary, setMaximumSalary] = useState(
    career?.maximumSalary || ""
  );
  const [questions, setQuestions] = useState(
    career?.questions || [
      {
        id: 1,
        category: "CV Validation / Experience",
        questionCountToAsk: null,
        questions: [],
      },
      {
        id: 2,
        category: "Technical",
        questionCountToAsk: null,
        questions: [],
      },
      {
        id: 3,
        category: "Behavioral",
        questionCountToAsk: null,
        questions: [],
      },
      {
        id: 4,
        category: "Analytical",
        questionCountToAsk: null,
        questions: [],
      },
      {
        id: 5,
        category: "Others",
        questionCountToAsk: null,
        questions: [],
      },
    ]
  );
  const [country, setCountry] = useState(career?.country || "Philippines");
  const [province, setProvince] = useState(career?.province || "");
  const [city, setCity] = useState(career?.location || "");
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState("");
  const [isSavingCareer, setIsSavingCareer] = useState(false);
  const savingCareerRef = useRef(false);

  const isFormValid = () => {
    return (
      jobTitle?.trim().length > 0 &&
      description?.trim().length > 0 &&
      questions.some((q) => q.questions.length > 0) &&
      workSetup?.trim().length > 0
    );
  };

  const updateCareer = async (status: string) => {
    if (
      Number(minimumSalary) &&
      Number(maximumSalary) &&
      Number(minimumSalary) > Number(maximumSalary)
    ) {
      errorToast("Minimum salary cannot be greater than maximum salary", 1300);
      return;
    }
    let userInfoSlice = {
      image: user.image,
      name: user.name,
      email: user.email,
    };
    const updatedCareer = {
      _id: career._id,
      jobTitle,
      headcount: isNaN(Number(headcount)) ? null : Number(headcount),
      project,
      description,
      workSetup,
      questions,
      lastEditedBy: userInfoSlice,
      status,
      updatedAt: Date.now(),
      screeningSetting,
      requireVideo,
      salaryNegotiable,
      currency,
      minimumSalary: isNaN(Number(minimumSalary))
        ? null
        : Number(minimumSalary),
      maximumSalary: isNaN(Number(maximumSalary))
        ? null
        : Number(maximumSalary),
      country,
      province,
      // Backwards compatibility
      location: city,
      employmentType,
    };
    try {
      setIsSavingCareer(true);
      const response = await axios.post("/api/update-career", updatedCareer);
      if (response.status === 200) {
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
              Career updated
            </span>
          </div>,
          1300,
          <i
            className="la la-check-circle"
            style={{ color: "#039855", fontSize: 32 }}
          ></i>
        );
        setTimeout(() => {
          window.location.href = `/recruiter-dashboard/careers/manage/${career._id}`;
        }, 1300);
      }
    } catch (error) {
      console.error(error);
      errorToast("Failed to update career", 1300);
    } finally {
      setIsSavingCareer(false);
    }
  };

  const confirmSaveCareer = (status: string) => {
    if (
      Number(minimumSalary) &&
      Number(maximumSalary) &&
      Number(minimumSalary) > Number(maximumSalary)
    ) {
      errorToast("Minimum salary cannot be greater than maximum salary", 1300);
      return;
    }

    setShowSaveModal(status);
  };

  const saveCareer = async (status: string) => {
    setShowSaveModal("");
    if (!status) {
      return;
    }

    if (!savingCareerRef.current) {
      setIsSavingCareer(true);
      savingCareerRef.current = true;
      let userInfoSlice = {
        image: user.image,
        name: user.name,
        email: user.email,
      };
      const career = {
        jobTitle,
        headcount: isNaN(Number(headcount)) ? null : Number(headcount),
        project,
        description,
        workSetup,
        questions,
        lastEditedBy: userInfoSlice,
        createdBy: userInfoSlice,
        screeningSetting,
        orgID,
        requireVideo,
        salaryNegotiable,
        currency,
        minimumSalary: isNaN(Number(minimumSalary))
          ? null
          : Number(minimumSalary),
        maximumSalary: isNaN(Number(maximumSalary))
          ? null
          : Number(maximumSalary),
        country,
        province,
        // Backwards compatibility
        location: city,
        status,
        employmentType,
        voice,
      };

      try {
        const response = await axios.post("/api/add-career", career);
        if (response.status === 200) {
          candidateActionToast(
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginLeft: 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                Career added {status === "active" ? "and published" : ""}
              </span>
            </div>,
            1300,
            <i
              className="la la-check-circle"
              style={{ color: "#039855", fontSize: 32 }}
            ></i>
          );
          setTimeout(() => {
            window.location.href = `/recruiter-dashboard/careers`;
          }, 1300);
        }
      } catch (error) {
        errorToast("Failed to add career", 1300);
      } finally {
        savingCareerRef.current = false;
        setIsSavingCareer(false);
      }
    }
  };

  const triggerCareerCreatedEvent = () => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof (window as any)?.gtag === "function"
      ) {
        (window as any)?.gtag?.("event", "career_created");
      }
    } catch (error) {
      console.error("Error triggering career created event", error);
    }
  };

  useEffect(() => {
    const parseProvinces = () => {
      setProvinceList(philippineCitiesAndProvinces.provinces);
      const defaultProvince = philippineCitiesAndProvinces.provinces[0];
      if (!career?.province) {
        setProvince(defaultProvince.name);
      }
      const cities = philippineCitiesAndProvinces.cities.filter(
        (city) => city.province === defaultProvince.key
      );
      setCityList(cities);
      if (!career?.location) {
        setCity(cities[0].name);
      }
    };
    parseProvinces();
  }, [career]);

  return (
    <div className="col">
      {formType === "add" ? (
        <div
          style={{
            marginBottom: "35px",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}>
            Add new career
          </h1>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button
              disabled={!isFormValid() || isSavingCareer}
              style={{
                width: "fit-content",
                color: "#414651",
                background: "#fff",
                border: "1px solid #D5D7DA",
                padding: "8px 16px",
                borderRadius: "60px",
                cursor:
                  !isFormValid() || isSavingCareer ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                confirmSaveCareer("inactive");
              }}
            >
              Save as Unpublished
            </button>
            <button
              disabled={!isFormValid() || isSavingCareer}
              style={{
                width: "fit-content",
                background:
                  !isFormValid() || isSavingCareer ? "#D5D7DA" : "black",
                color: "#fff",
                border: "1px solid #E9EAEB",
                padding: "8px 16px",
                borderRadius: "60px",
                cursor:
                  !isFormValid() || isSavingCareer ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                confirmSaveCareer("active");
              }}
            >
              <i
                className="la la-check-circle"
                style={{ color: "#fff", fontSize: 20, marginRight: 8 }}
              ></i>
              Save as Published
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            marginBottom: "35px",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}>
            Edit Career Details
          </h1>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button
              style={{
                width: "fit-content",
                color: "#414651",
                background: "#fff",
                border: "1px solid #D5D7DA",
                padding: "8px 16px",
                borderRadius: "60px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                setShowEditModal?.(false);
              }}
            >
              Cancel
            </button>
            <button
              disabled={!isFormValid() || isSavingCareer}
              style={{
                width: "fit-content",
                color: "#414651",
                background: "#fff",
                border: "1px solid #D5D7DA",
                padding: "8px 16px",
                borderRadius: "60px",
                cursor:
                  !isFormValid() || isSavingCareer ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                updateCareer("inactive");
              }}
            >
              Save Changes as Unpublished
            </button>
            <button
              disabled={!isFormValid() || isSavingCareer}
              style={{
                width: "fit-content",
                background:
                  !isFormValid() || isSavingCareer ? "#D5D7DA" : "black",
                color: "#fff",
                border: "1px solid #E9EAEB",
                padding: "8px 16px",
                borderRadius: "60px",
                cursor:
                  !isFormValid() || isSavingCareer ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                updateCareer("active");
              }}
            >
              <i
                className="la la-check-circle"
                style={{ color: "#fff", fontSize: 20, marginRight: 8 }}
              ></i>
              Save Changes as Published
            </button>
          </div>
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          width: "100%",
          gap: 16,
          alignItems: "flex-start",
          marginTop: 16,
        }}
      >
        <div
          style={{
            width: "60%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
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
                <div
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#181D27",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="la la-suitcase"
                    style={{ color: "#FFFFFF", fontSize: 20 }}
                  ></i>
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Career Information
                </span>
              </div>
              <div className="layered-card-content">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
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
                    <span>Job Title</span>
                    <input
                      value={jobTitle}
                      className="form-control"
                      placeholder="Enter job title"
                      onChange={(e) => {
                        setJobTitle(e.target.value || "");
                      }}
                    ></input>
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
                    <span>Headcount</span>
                    <input
                      type="number"
                      value={headcount}
                      className="form-control"
                      placeholder="0"
                      min={0}
                      onChange={(e) => {
                        setHeadcount(e.target.value || "");
                      }}
                    ></input>
                  </div>
                </div>

                <span>Project</span>
                <CustomDropdown
                  onSelectSetting={(project) => {
                    setProject(project);
                  }}
                  screeningSetting={project}
                  settingList={projectOptions}
                  placeholder="Choose a project for this career"
                />

                <span>Description</span>
                <RichTextEditor
                  setText={setDescription}
                  text={description}
                  error={false}
                />
              </div>
            </div>
          </div>

          <InterviewQuestionGeneratorV2
            questions={questions}
            setQuestions={(questions) => setQuestions(questions)}
            jobTitle={jobTitle}
            description={description}
          />
        </div>

        <div
          style={{
            width: "40%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
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
                <div
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#181D27",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="la la-cog"
                    style={{ color: "#FFFFFF", fontSize: 20 }}
                  ></i>
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Settings
                </span>
              </div>
              <div className="layered-card-content">
                <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
                  <i
                    className="la la-id-badge"
                    style={{ color: "#414651", fontSize: 20 }}
                  ></i>
                  <span>Screening Setting</span>
                </div>
                <CustomDropdown
                  onSelectSetting={(setting) => {
                    setScreeningSetting(setting);
                  }}
                  screeningSetting={screeningSetting}
                  settingList={screeningSettingList}
                />
                <span>
                  This settings allows Jia to automatically endorse candidates
                  who meet the chosen criteria.
                </span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", flexDirection: "row", gap: 8 }}
                  >
                    <i
                      className="la la-video"
                      style={{ color: "#414651", fontSize: 20 }}
                    ></i>
                    <span>Require Video Interview</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={requireVideo}
                        onChange={() => setRequireVideo(!requireVideo)}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span>{requireVideo ? "Yes" : "No"}</span>
                  </div>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "1px",
                    backgroundColor: "#E9EAEB",
                    marginTop: 16,
                    marginBottom: 16,
                  }}
                />

                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                  AI Interview Voice
                </span>
                <span style={{ fontSize: 14, color: "#717680", fontWeight: 400 }}>
                  Select the voice Jia will use for this specific career.
                </span>
                <div style={{ width: "100%" }}>
                  <VoiceSelector
                    selectedVoice={voice}
                    onSelectVoice={(voiceId) => {
                      setVoice(voiceId);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

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
                <div
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#181D27",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="la la-ellipsis-h"
                    style={{ color: "#FFFFFF", fontSize: 20 }}
                  ></i>
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Additional Information
                </span>
              </div>
              <div className="layered-card-content">
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Work Setting
                </span>
                <span>Employment Type</span>
                <CustomDropdown
                  onSelectSetting={(employmentType) => {
                    setEmploymentType(employmentType);
                  }}
                  screeningSetting={employmentType}
                  settingList={employmentTypeOptions}
                  placeholder="Select Employment Type"
                />

                <span>Work Setup Arrangement</span>
                <CustomDropdown
                  onSelectSetting={(setting) => {
                    setWorkSetup(setting);
                  }}
                  screeningSetting={workSetup}
                  settingList={workSetupOptions}
                  placeholder="Select Work Setup"
                />

                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
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
                        checked={salaryNegotiable}
                        onChange={() => setSalaryNegotiable(!salaryNegotiable)}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span>{salaryNegotiable ? "Negotiable" : "Fixed"}</span>
                  </div>
                </div>

                <span>Minimum Salary</span>
                <div style={{ position: "relative" }}>
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
                    {currencyOptions.find((c) => c.name === currency)?.symbol ||
                      "₱"}
                  </span>
                  <input
                    type="number"
                    className="form-control"
                    style={{ paddingLeft: "28px", paddingRight: "80px" }}
                    placeholder="0"
                    min={0}
                    value={minimumSalary}
                    onChange={(e) => {
                      setMinimumSalary(e.target.value || "");
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    <CurrencyDropdown
                      currency={currency}
                      onCurrencyChange={setCurrency}
                      currencyOptions={currencyOptions}
                    />
                  </div>
                </div>

                <span>Maximum Salary</span>
                <div style={{ position: "relative" }}>
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
                    {currencyOptions.find((c) => c.name === currency)?.symbol ||
                      "₱"}
                  </span>
                  <input
                    type="number"
                    className="form-control"
                    style={{ paddingLeft: "28px", paddingRight: "80px" }}
                    placeholder="0"
                    min={0}
                    value={maximumSalary}
                    onChange={(e) => {
                      setMaximumSalary(e.target.value || "");
                    }}
                  ></input>
                  <div
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    <CurrencyDropdown
                      currency={currency}
                      onCurrencyChange={setCurrency}
                      currencyOptions={currencyOptions}
                    />
                  </div>
                </div>

                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Location
                </span>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
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
                        setCountry(setting);
                      }}
                      screeningSetting={country}
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
                        setProvince(province);
                        const provinceObj = provinceList.find(
                          (p) => p.name === province
                        );
                        const cities =
                          philippineCitiesAndProvinces.cities.filter(
                            (city) => city.province === provinceObj.key
                          );
                        setCityList(cities);
                        setCity(cities[0].name);
                      }}
                      screeningSetting={province}
                      settingList={provinceList}
                      placeholder="Select State / Province"
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
                        setCity(city);
                      }}
                      screeningSetting={city}
                      settingList={cityList}
                      placeholder="Select City"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showSaveModal && (
        <CareerActionModal
          action={showSaveModal}
          onAction={(action) => saveCareer(action)}
        />
      )}
      {isSavingCareer && (
        <FullScreenLoadingAnimation
          title={formType === "add" ? "Saving career..." : "Updating career..."}
          subtext={`Please wait while we are ${
            formType === "add" ? "saving" : "updating"
          } the career`}
        />
      )}
    </div>
  );
}
