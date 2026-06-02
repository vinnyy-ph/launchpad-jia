// TODO (Vince) - Replace alert and windows.confirm
// TODO (Vince) - Check all API call

"use client";

import styles from "@/lib/styles/screen/uploadCV.module.scss";
import { contextProvider } from "@/lib/context/Context";
import { CORE_API_URL } from "@/lib/Utils";
import axios from "axios";
import Markdown from "react-markdown";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import { decodeHtmlEntities } from "@/lib/utils/sanitizeInput";

export default function () {
  const pathname = usePathname();
  const fileInputRef = useRef(null);
  const { user, setModalType } = contextProvider();
  const [buildingCV, setBuildingCV] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [digitalCV, setDigitalCV] = useState(null);
  const [editingCV, setEditingCV] = useState(null);
  const [file, setFile] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [interviewData, setInterviewData] = useState(null);
  const [screeningResult, setScreeningResult] = useState(null);
  const [userCV, setUserCV] = useState(null);
  const cvSections = [
    "Introduction",
    "Current Position",
    "Contact Info",
    "Skills",
    "Experience",
    "Education",
    "Projects",
    "Certifications",
    "Awards",
  ];
  const [step, setStep] = useState(["Submit CV", "CV Screening", "Review"]);
  const [viewDropdown, setViewDropdown] = useState(null);
  const [preScreeningQuestions, setPreScreeningQuestions] = useState([]);

  function checkFile(file) {
    if (file.length > 1) {
      alert("Only one file is allowed.");
      return false;
    }

    if (file[0].size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB.");
      return false;
    }

    if (
      ![
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ].includes(file[0].type)
    ) {
      alert("Only PDF, DOC, DOCX, or TXT files are allowed.");
      return false;
    }

    return file[0];
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFile(e.dataTransfer.files);
  }

  function handleEditChange() {
    setEditingCV(null);
  }

  function handleEditCV(section) {
    setEditingCV(section);

    setTimeout(() => {
      const sectionDetails = document.getElementById(section);
      sectionDetails.focus();
    }, 100);
  }

  function handleFile(files) {
    const file = checkFile(files);

    if (file) {
      setFile(file);
      handleFileSubmit(file);
    }
  }

  function handleFileChange(e) {
    const files = e.target.files;

    if (files.length > 0) {
      handleFile(files);
    }
  }

  function handleRemoveFile(e) {
    e.stopPropagation();
    e.target.value = "";

    setFile(null);
    setHasChanges(false);
    setUserCV(null);

    const storedCV = localStorage.getItem("userCV");

    if (storedCV != "null") {
      setDigitalCV(storedCV);
    } else {
      setDigitalCV(null);
    }
  }

  function handleReviewCV() {
    const parsedUserCV = JSON.parse(digitalCV);
    const formattedCV = {};

    cvSections.map((section, index) => {
      formattedCV[section] = parsedUserCV.digitalCV[index].content?.trim();
    });

    setFile(parsedUserCV.fileInfo);
    setUserCV(formattedCV);
  }

  function handleUploadCV() {
    fileInputRef.current.click();
  }

  function handleRedirection(type) {
    setModalType("loading");
    localStorage.removeItem("interviewData");
    localStorage.removeItem("interviews");

    if (type == "dashboard") {
      window.location.href = "/whitecloak/applicant";
    }

    if (type == "interview") {
      // sessionStorage.setItem("interviewRedirection", pathname);
      window.location.href = `/interview/${interviewData.interviewID}`;
    }
  }

  useEffect(() => {
    const interviewData = localStorage.getItem("interviewData");
    const storedCV = localStorage.getItem("userCV");

    if (storedCV && storedCV != "null") {
      setDigitalCV(storedCV);
    }

    if (interviewData) {
      const parsedInterviewData = JSON.parse(interviewData);

      if (parsedInterviewData?.preScreeningQuestions?.length > 0) {
        setStep(["Submit CV", "Pre-screening Questions", "Review"]);
        setPreScreeningQuestions(
          parsedInterviewData.preScreeningQuestions.map((p) => {
            return {
              ...p,
              selectedAnswers: [],
            };
          })
        );
      }

      setCurrentStep(step[0]);
      setInterviewData(parsedInterviewData);
      setLoading(false);
    } else {
      Swal.fire({
        title: "No Application",
        text: "No application is currently being managed.",
        icon: "info",
        confirmButtonColor: "#000",
        confirmButtonText: "OK",
        allowOutsideClick: true,
        customClass: {
          popup: "fade-in",
          confirmButton: "button",
        },
      }).then(() => {
        window.location.href = "/whitecloak/applicant";
      });
    }
  }, []);

  useEffect(() => {
    if (loading) {
      setModalType("loading");
    } else {
      setModalType(null);
    }
  }, [loading]);

  useEffect(() => {
    sessionStorage.setItem("hasChanges", JSON.stringify(hasChanges));
  }, [hasChanges]);

  async function handleCVScreen() {
    if (editingCV != null) {
      alert("Please save the changes first.");
      return false;
    }

    const allEmpty = Object.values(userCV).every(
      (value: any) => value?.trim() === ""
    );

    if (allEmpty) {
      alert("No details to be save.");
      return false;
    }

    let parsedDigitalCV = {
      errorRemarks: null,
      digitalCV: null,
    };

    if (digitalCV) {
      parsedDigitalCV = JSON.parse(digitalCV);

      if (parsedDigitalCV.errorRemarks) {
        alert(
          "Please fix the errors in the CV first.\n\n" +
            parsedDigitalCV.errorRemarks
        );
        return false;
      }
    }

    setCurrentStep(step[1]);

    if (!step.includes("Pre-screening Questions")) {
      if (hasChanges) {
        const formattedUserCV = cvSections.map((section) => ({
          name: section,
          content: userCV[section]?.trim() || "",
        }));

        parsedDigitalCV.digitalCV = formattedUserCV;

        const data = {
          name: user.name,
          cvData: parsedDigitalCV,
          email: user.email,
          fileInfo: null,
        };

        if (file) {
          data.fileInfo = {
            name: file.name,
            size: file.size,
            type: file.type,
          };
        }
        await api
          .post("/api/whitecloak/save-cv", data)
          .then(async () => {
            setHasChanges(false);
            localStorage.setItem("userCV", JSON.stringify(parsedDigitalCV));
          })
          .catch((err) => {
            alert("Error saving CV. Please try again.");
            setCurrentStep(step[0]);
            console.log(err);
          });
      }

      await api
        .post("/api/whitecloak/screen-cv", {
          interviewID: interviewData.interviewID,
        })
        .then(async (res) => {
          const result = await res.data;
          if (result.error) {
            alert(result.message);
            setCurrentStep(step[0]);
          }

          setScreeningResult(result.status);
          setCurrentStep(step[2]);
        })
        .catch((err) => {
          alert("Error screening CV. Please try again.");
          setCurrentStep(step[0]);
          console.log(err);
        });
    }
  }

  async function continueToReview() {
    const rangeQuestions = preScreeningQuestions.filter(
      (q) => q.questionFormat === "Range"
    );
    if (rangeQuestions.length) {
      for (const question of rangeQuestions) {
        const maxAnswer = question.selectedAnswers?.find(
          (answer) => answer.type === "Maximum"
        );
        const minAnswer = question.selectedAnswers?.find(
          (answer) => answer.type === "Minimum"
        );
        if (maxAnswer && minAnswer && Number(maxAnswer.value) <= Number(minAnswer.value)) {
          alert(
            "Maximum value must be greater than the minimum value for all range questions."
          );
          return;
        }
      }
    }

    setCurrentStep(step[2]);

    let parsedDigitalCV = {
      errorRemarks: null,
      digitalCV: null,
    };

    if (digitalCV) {
      parsedDigitalCV = JSON.parse(digitalCV);
    }

    if (hasChanges) {
      const formattedUserCV = cvSections.map((section) => ({
        name: section,
        content: userCV[section]?.trim() || "",
      }));

      parsedDigitalCV.digitalCV = formattedUserCV;

      const data = {
        name: user.name,
        cvData: parsedDigitalCV,
        email: user.email,
        fileInfo: null,
      };

      if (file) {
        data.fileInfo = {
          name: file.name,
          size: file.size,
          type: file.type,
        };
      }
      await api
        .post("/api/whitecloak/save-cv", data)
        .then(async () => {
          setHasChanges(false);
          localStorage.setItem("userCV", JSON.stringify(parsedDigitalCV));
        })
        .catch((err) => {
          alert("Error saving CV. Please try again.");
          setCurrentStep(step[0]);
          console.log(err);
        });
    }

    await api
      .post("/api/whitecloak/manage-application", {
        interviewData: interviewData,
        body: {
          preScreeningQuestions: preScreeningQuestions.map((q) => {
            if (q.questionFormat === "Range") {
              q.selectedAnswers = q.selectedAnswers.map((a) => ({
                ...a,
                value: Number(a.value),
              }));
            }
            return q;
          }),
        },
      })
      .catch((err) => {
        alert("Error updating pre-screening questions. Please try again.");
        setCurrentStep(step[1]);
        console.log(err);
      });

    api
      .post("/api/whitecloak/screen-cv", {
        interviewID: interviewData.interviewID,
      })
      .then((res) => {
        const result = res.data;

        if (result.error) {
          alert(result.message);
          setCurrentStep(step[0]);
        } else {
          setScreeningResult(result);
        }
      })
      .catch((err) => {
        alert("Error screening CV. Please try again.");
        setCurrentStep(step[0]);
        console.log(err);
      })
      .finally(() => {
        setHasChanges(false);
      });
  }

  function isPreScreeningQuestionsValid() {
    return preScreeningQuestions.every((q) => {
      if (q.questionFormat === "Range") {
        return (
          q.selectedAnswers?.length === 2 &&
          q.selectedAnswers.every((a) => !isNaN(Number(a.value)) && Number(a.value) > 0)
        );
      }
      return (
        q.selectedAnswers?.length > 0 &&
        q.selectedAnswers.every((a) => a.value.trim() != "")
      );
    });
  }

  async function handleFileSubmit(file) {
    setBuildingCV(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fName", file.name);
    formData.append("userEmail", user.email);

    await axios({
      method: "POST",
      url: `${CORE_API_URL}/upload-cv`,
      data: formData,
    })
      .then(async (res) => {
        await api
          .post("/api/whitecloak/digitalize-cv", { chunks: res.data.cvChunks })
          .then(async (res) => {
            const result = await res.data.result;
            const parsedUserCV = JSON.parse(result);
            const formattedCV = {};

            cvSections.map((section, index) => {
              formattedCV[section] =
                parsedUserCV.digitalCV[index].content?.trim();
            });

            setDigitalCV(result);
            setHasChanges(true);
            setUserCV(formattedCV);
          })
          .catch((err) => {
            alert("Error building CV. Please try again.");
            console.log(err);
          })
          .finally(() => {
            setBuildingCV(false);
          });
      })
      .catch((err) => {
        alert("Error building CV. Please try again.");
        console.log(err);
      })
      .finally(() => {
        setBuildingCV(false);
      });
  }

  return (
    <>
      <div className={styles.bg} />

      {interviewData && !loading && (
        <div className={styles.uploadCVContainer}>
          <div className={styles.uploadCVHeader}>
            <span className={styles.tag}>
              <img alt="zap" src="/icons/zap.svg" />
              You're applying for
            </span>
            <span className={styles.title}>{interviewData.jobTitle}</span>
            {interviewData.location && (
              <span className={styles.location}>
                <img alt="map-pin" src="/icons/map-pin.svg" />
                {interviewData.location}
                {interviewData.workSetup && (
                  <>
                    <hr /> {interviewData.workSetup}
                  </>
                )}
              </span>
            )}
          </div>

          <div className={styles.stepContainer}>
            <div className={styles.step}>
              {step.map((_, index) => (
                <div className={styles.stepBar} key={index}>
                  <img
                    alt="step"
                    src={`/icons/${
                      step.indexOf(currentStep) == index
                        ? "in-progress"
                        : step.indexOf(currentStep) > index
                        ? "completed"
                        : "pending"
                    }.svg`}
                  />
                  {index < step.length - 1 && (
                    <hr
                      className={`${
                        step.indexOf(currentStep) > index ? styles.done : ""
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className={styles.step}>
              {step.map((item, index) => (
                <span
                  className={`${styles.stepDetails} ${
                    step.indexOf(currentStep) < index ? styles.pending : ""
                  }`}
                  key={index}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {currentStep == step[0] &&
            (userCV || buildingCV ? (
              <>
                {file ? (
                  <div className={styles.fileContainer}>
                    <img alt="completed" src="/icons/completed.svg" />
                    <span className={styles.title}>{file.name}</span>
                    {buildingCV ? (
                      <span className={styles.description}>
                        Building your profile...
                      </span>
                    ) : (
                      <img
                        alt="x"
                        className={styles.xIcon}
                        onClick={handleRemoveFile}
                        src="/icons/xV2.svg"
                      />
                    )}
                  </div>
                ) : (
                  <div
                    className={styles.fileContainer}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <img alt="upload" src="/icons/upload.svg" />
                    <span className={styles.title}>
                      Click to upload or drag and drop
                    </span>
                    <button onClick={handleUploadCV}>Upload CV</button>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      style={{ display: "none" }}
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </div>
                )}

                {!buildingCV && (
                  <>
                    <div className={styles.cvDetailsContainer}>
                      {cvSections.map((section, index) => (
                        <div className={styles.cvDetailsCard} key={index}>
                          <span
                            className={`${styles.sectionTitle} ${
                              editingCV == section ? styles.forEditing : ""
                            }`}
                          >
                            {section}

                            {editingCV == section ? (
                              <button onClick={handleEditChange}>
                                Save Changes
                              </button>
                            ) : (
                              <img
                                alt="square-pen"
                                src="/icons/square-pen.svg"
                                onClick={() => handleEditCV(section)}
                              />
                            )}
                          </span>

                          <hr />

                          {editingCV == section ? (
                            <>
                              <textarea
                                id={section}
                                value={userCV ? userCV[section] : ""}
                                placeholder="Upload your CV to auto-fill this section."
                                onBlur={(e) => {
                                  e.target.placeholder =
                                    "Upload your CV to auto-fill this section.";
                                }}
                                onClick={(e) => {
                                  (e.target as HTMLInputElement).placeholder =
                                    "";
                                }}
                                onChange={(e) => {
                                  setUserCV({
                                    ...userCV,
                                    [section]: e.target.value,
                                  });
                                  setHasChanges(true);
                                }}
                              />
                            </>
                          ) : (
                            <span
                              className={`${styles.sectionDetails} ${
                                userCV && userCV[section]?.trim()
                                  ? styles.withDetails
                                  : ""
                              }`}
                            >
                              <Markdown>
                                {userCV && userCV[section]?.trim()
                                  ? userCV[section]?.trim()
                                  : "Upload your CV to auto-fill this section."}
                              </Markdown>
                            </span>
                          )}
                        </div>
                      ))}

                      <button onClick={handleCVScreen}>
                        {!step.includes("Pre-screening Questions") ? (
                          "Submit CV"
                        ) : (
                          <>
                            Continue
                            <img alt="" src="/iconsV3/arrow.svg" />
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className={styles.cvManageContainer}>
                <div
                  className={`${styles.cvContainer} ${styles.forUpload}`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <img alt="upload" src={`/icons/upload.svg`} />
                  <button onClick={handleUploadCV}>Upload CV</button>
                  <span>
                    Choose or drag and drop a file here. Our AI tools will
                    automatically pre-fill your CV and also check how well it
                    matches the role.
                  </span>
                </div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  style={{ display: "none" }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />

                <div className={`${styles.cvContainer} ${styles.forReview}`}>
                  <img alt="scan-search" src={`/icons/scan-search.svg`} />
                  <button
                    className={`${digitalCV ? "" : styles.disabled}`}
                    disabled={!digitalCV}
                    onClick={handleReviewCV}
                  >
                    Review Current CV
                  </button>
                  <span>
                    Already uploaded a CV? Take a moment to review your details
                    before we proceed.
                  </span>
                </div>
              </div>
            ))}

          {(currentStep === "CV Screening" ||
            (currentStep == step[2] && !screeningResult)) && (
            <div className={styles.cvScreeningContainer}>
              <img alt="cv-screening" src="/gifs/cv-screening.gif" />
              <span className={styles.title}>Sit tight!</span>

              <span className={`mobileView ${styles.description}`}>
                Our smart reviewer is checking your qualifications. We'll let
                you know what's next in just a moment.
              </span>

              <span className={`webView ${styles.description}`}>
                Our smart reviewer is checking your qualifications.
              </span>
              <span className={`webView ${styles.description}`}>
                We'll let you know what's next in just a moment.
              </span>
            </div>
          )}

          {currentStep === "Pre-screening Questions" && (
            <div className={styles.preScreeningContainer}>
              <h1 className={styles.title}>Quick Pre-screening</h1>
              <span className={styles.description}>
                Just a few short questions to help your recruiters assess you
                faster. Takes less than a minute.
              </span>
              <div className={styles.questionContainer}>
                {preScreeningQuestions.map((question, index) => (
                  <div key={index} className={styles.gradientContainer}>
                    <div className={styles.cardContainer}>
                      <span className={styles.question}>
                        {question.question}
                      </span>
                      {question.questionFormat === "Dropdown" && (
                        <div className={styles.answerContainer}>
                          <div
                            style={{
                              position: "relative",
                              width: "100%",
                              height: "100%",
                            }}
                          >
                            <div
                              className={styles.dropDownAnswerContainer}
                              onClick={() => {
                                if (viewDropdown == index) {
                                  setViewDropdown(null);
                                } else {
                                  setViewDropdown(index);
                                }
                              }}
                            >
                              {decodeHtmlEntities(question.selectedAnswers?.[0]?.value || '') ||
                                "Select an answer"}
                              <img alt="ellipsis" src="/iconsV3/chevron.svg" />
                            </div>
                            {viewDropdown == index && (
                              <div className={styles.dropdownContainer}>
                                {question.answers.map((option, index) => (
                                  <span
                                    key={index}
                                    onClick={() => {
                                      setPreScreeningQuestions(
                                        preScreeningQuestions.map((q) => {
                                          if (question.id == q.id) {
                                            return {
                                              ...q,
                                              selectedAnswers: [
                                                {
                                                  id: option.id,
                                                  value: option.value,
                                                  type: "Dropdown",
                                                },
                                              ],
                                            };
                                          }
                                          return q;
                                        })
                                      );
                                      setViewDropdown(null);
                                    }}
                                  >
                                    {decodeHtmlEntities(option.value || '')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {question.questionFormat === "Range" && (
                        <div className={styles.answerContainer}>
                          <div className={styles.rangeInputContainer}>
                            <div className={styles.rangeInput}>
                              <span>Minimum Salary</span>
                              <div className={styles.rangeFormContainer}>
                                <span>P</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={
                                    question.selectedAnswers?.find(
                                      (a) => a.type === "Minimum"
                                    )?.value || ""
                                  }
                                  onChange={(e) => {
                                    setPreScreeningQuestions(
                                      preScreeningQuestions.map((q) => {
                                        if (question.id == q.id) {
                                          const answers = q.answers.find(
                                            (a) => a.type === "Minimum"
                                          );
                                          const existingSelectedAnswers =
                                            q.selectedAnswers || [];
                                          const inputValue = (e.target.value || '').toString();
                                          const formattedValue = inputValue.replace(/,/g, '').replace(/[^0-9.]/g, '');
                                          return {
                                            ...q,
                                            selectedAnswers:
                                              existingSelectedAnswers.find(
                                                (a) => a.type === "Minimum"
                                              )
                                                ? existingSelectedAnswers.map(
                                                    (a) =>
                                                      a.type === "Minimum"
                                                        ? {
                                                            ...a,
                                                            value: formattedValue,
                                                          }
                                                        : a
                                                  )
                                                : [
                                                    ...existingSelectedAnswers,
                                                    {
                                                      id: answers.id,
                                                      value: formattedValue,
                                                      type: "Minimum",
                                                    },
                                                  ],
                                          };
                                        }
                                        return q;
                                      })
                                    );
                                  }}
                                />
                              </div>
                            </div>
                            <div className={styles.rangeInput}>
                              <span>Maximum Salary</span>
                              <div className={styles.rangeFormContainer}>
                                <span>P</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={
                                    question.selectedAnswers?.find(
                                      (a) => a.type === "Maximum"
                                    )?.value || ""
                                  }
                                  onChange={(e) => {
                                    setPreScreeningQuestions(
                                      preScreeningQuestions.map((q) => {
                                        if (question.id == q.id) {
                                          const answers = q.answers.find(
                                            (a) => a.type === "Maximum"
                                          );
                                          const existingSelectedAnswers =
                                            q.selectedAnswers || [];
                                          const inputValue = (e.target.value || '').toString();
                                          const formattedValue = inputValue.replace(/,/g, '').replace(/[^0-9.]/g, '');
                                          return {
                                            ...q,
                                            selectedAnswers:
                                              existingSelectedAnswers.find(
                                                (a) => a.type === "Maximum"
                                              )
                                                ? existingSelectedAnswers.map(
                                                    (a) =>
                                                      a.type === "Maximum"
                                                        ? {
                                                            ...a,
                                                            value: formattedValue,
                                                          }
                                                        : a
                                                  )
                                                : [
                                                    ...existingSelectedAnswers,
                                                    {
                                                      id: answers.id,
                                                      value: formattedValue,
                                                      type: "Maximum",
                                                    },
                                                  ],
                                          };
                                        }
                                        return q;
                                      })
                                    );
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {question.questionFormat === "Checkboxes" && (
                        <div className={styles.answerContainer}>
                          {question.answers.map((option, index) => (
                            <div
                              key={index}
                              className={styles.checkboxContainer}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  question.selectedAnswers?.find(
                                    (a) => a.id === option.id
                                  ) || false
                                }
                                onChange={(e) => {
                                  setPreScreeningQuestions(
                                    preScreeningQuestions.map((q) => {
                                      if (question.id == q.id) {
                                        const selectedAnswers: any[] =
                                          q.selectedAnswers || [];
                                        return {
                                          ...q,
                                          selectedAnswers: selectedAnswers.find(
                                            (a) => a.id === option.id
                                          )
                                            ? selectedAnswers.filter(
                                                (a) => a.id !== option.id
                                              )
                                            : [
                                                ...selectedAnswers,
                                                {
                                                  id: option.id,
                                                  value: option.value,
                                                  type: question.questionFormat,
                                                },
                                              ],
                                        };
                                      }
                                      return q;
                                    })
                                  );
                                }}
                              />
                              <span>{option.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {["Short Answer", "Long Answer"].includes(
                        question.questionFormat
                      ) && (
                        <div className={styles.answerContainer}>
                          <input
                            className={`${styles.answerInput} ${
                              question.questionFormat === "Short Answer"
                                ? styles.shortAnswer
                                : styles.longAnswer
                            }`}
                            type="text"
                            placeholder="Your answer"
                            onChange={(e) => {
                              setPreScreeningQuestions(
                                preScreeningQuestions.map((q) => {
                                  if (question.id == q.id) {
                                    return {
                                      ...q,
                                      selectedAnswers: q.selectedAnswers?.length
                                        ? q.selectedAnswers.map((a) =>
                                            a.type === question.questionFormat
                                              ? { ...a, value: e.target.value }
                                              : a
                                          )
                                        : [
                                            {
                                              id: "1",
                                              value: e.target.value,
                                              type: question.questionFormat,
                                            },
                                          ],
                                    };
                                  }
                                  return q;
                                })
                              );
                            }}
                            value={question.selectedAnswers?.[0]?.value || ""}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`${styles.buttonContainer} ${
                  !isPreScreeningQuestionsValid() ? styles.disabled : ""
                }`}
              >
                <button
                  disabled={!isPreScreeningQuestionsValid()}
                  onClick={continueToReview}
                >
                  Continue
                  <img alt="" src="/iconsV3/arrow.svg" />
                </button>
              </div>
            </div>
          )}

          {currentStep == step[2] && screeningResult && (
            <div
              className={`${styles.cvResultContainer} ${
                screeningResult == "For AI Interview"
                  ? styles.forInterview
                  : styles.forReview
              }`}
            >
              {screeningResult == "For AI Interview" ? (
                <>
                  <img alt="party-popper" src="/icons/party-popper.svg" />
                  <span className={`${styles.title} ${styles.withMargin}`}>
                    Hooray! You’re a strong fit for this role.
                  </span>
                  <span className={styles.description}>
                    Our AI reviewer thinks you might be a great match.
                  </span>
                  <span className={`${styles.description} ${styles.bold}`}>
                    Ready to take the next step?
                  </span>
                  <span className={styles.description}>
                    You may start your AI interview now.
                  </span>
                  <div className={styles.buttonContainer}>
                    <button onClick={() => handleRedirection("interview")}>
                      Start AI Interview
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => handleRedirection("dashboard")}
                    >
                      View Dashboard
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img alt="user-check" src="/icons/user-check.svg" />
                  <span className={styles.title}>Your CV is now being</span>
                  <span className={styles.title}>
                    reviewed by the hiring team.
                  </span>
                  <span className={styles.description}>
                    We’ll be in touch soon with updates about your application.
                  </span>
                  <div className={styles.buttonContainer}>
                    <button onClick={() => handleRedirection("dashboard")}>
                      View Dashboard
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
