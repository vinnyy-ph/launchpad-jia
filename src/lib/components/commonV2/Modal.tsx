// TODO (Job Portal) - Check API

"use client";

import styles from "@/lib/styles/commonV2/modal.module.scss";
import { useAppContext } from "@/lib/context/ContextV2";
import { signInWithGoogle } from "@/lib/firebase/firebaseClient";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { useEffect, useRef, useState } from "react";
import { processDate } from "@/lib/utils/helpersV2";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  getCurrentPipelineStage,
  getStage,
  getEnabledStages,
} from "@/lib/Utils";
import VideoPlayer from "./VideoPlayer";
import { performLogout } from "@/lib/Utils";
import { troubleshootingGuideModalData } from "@/lib/data/modal";
import Button from "../ui/button/Button";

export default function ({ modalType, setModalType }) {
  const [rememberMe, setRememberMe] = useState(true);
  const [applicationData, setApplicationData] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [radioValue, setRadioValue] = useState(null);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [isResettingSetup, setIsResettingSetup] = useState(false);
  // const [tempInputValue, setTempInputValue] = useState("");
  // const [tempRadioValue, setTempRadioValue] = useState(null);
  const { user, setToasterType } = useAppContext();
  const modalList = [
    "location",
    "signIn",
    "loading",
    "applied",
    "share",
    "report",
    "manageCV",
    "retake",
    "cancel",
    "jobDescription",
    "reminder",
    "screening",
    "logout",
    "journeyTracker",
    "preScreeningGuide",
    "talentVaultExpired",
    "troubleshootingGuide",
    "talentVaultSetupPrompt",
  ];
  const checkList = {
    [modalList[5]]: [
      "I think it’s spam or a scam",
      "I think it’s discriminatory or offensive",
      "I think something is broken or incorrect",
    ],
    [modalList[8]]: [
      "I already received a job offer from another company.",
      "I find the application process too long.",
      "I applied to the wrong job role.",
      "Others",
    ],
  };

  let handleButtonClick = () => {};

  function handleClose() {
    setModalType(null);
    setPopupBlocked(false);

    if (modalType == modalList[6]) {
      sessionStorage.setItem(modalType, "true");
    }
  }

  if (modalType == modalList[0]) {
    handleButtonClick = () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;

            axios({
              method: "GET",
              url: `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            })
              .then((res) => {
                const location = res.data.address.town;
                sessionStorage.setItem("location", location);
                handleClose();
              })
              .catch((err) => {
                alert("Failed to get detailed location.");
                console.error(err);
              });
          },
          (err) => {
            alert("Location access was denied.");
            console.error(err);
          },
        );
      } else {
        alert("Geolocation is not supported in this browser.");
      }
    };
  }

  if (modalType == modalList[1]) {
    handleButtonClick = () => {
      signInWithGoogle("job-portal", {
        rememberMe,
        onPopupBlocked: () => setPopupBlocked(true),
      });
    };
  }

  if (modalType == modalList[3]) {
    handleButtonClick = () => {
      window.location.href = pathConstants.uploadCV;
    };
  }

  if (modalType == modalList[4]) {
    handleButtonClick = () => {
      const spanElement = document.getElementById("selected-job-link");

      if (spanElement && window.isSecureContext) {
        navigator.clipboard.writeText(spanElement.innerText).then(() => {
          handleClose();
          setToasterType("share");
        });
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = spanElement.innerText;
        textArea.style.position = "fixed"; // Avoid scrolling
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand("copy");
          if (!successful) throw new Error("Fallback copy failed");
          setToasterType("share");
          handleClose();
        } catch (err) {
          console.error("Fallback copy error:", err);
          alert("Unable to copy. Please try manually.");
        }

        document.body.removeChild(textArea);
      }
    };
  }

  if (modalType == modalList[5]) {
    handleButtonClick = () => {
      const data = {
        careerID: applicationData._id,
        createdAt: Date.now(),
        concern: inputValue.trim(),
        report: radioValue,
      };

      reportJob(data);
    };
  }

  if (modalType == modalList[6]) {
    handleButtonClick = () => {
      sessionStorage.setItem(modalType, "true");
      window.location.href = pathConstants.manageCV;
    };
  }

  if (modalType == modalList[7]) {
    handleButtonClick = () => {
      const data = {
        interviewData: applicationData,
        email: user.email,
        body: {
          updatedAt: Date.now(),
          retakeRequest: {
            reason: inputValue.trim(),
            status: "Pending",
            createdAt: Date.now(),
            approvedBy: null,
            approvedAt: null,
          },
        },
      };

      manageApplication(data);
    };
  }

  if (modalType == modalList[8]) {
    let currentStage;
    if (
      applicationData?.currentStep &&
      applicationData?.status &&
      applicationData?.pipelineStages
    ) {
      currentStage = getCurrentPipelineStage(applicationData.pipelineStages, {
        status: applicationData.status,
        currentStep: applicationData.currentStep,
        stageId: applicationData.stageId,
        substageId: applicationData.substageId,
      });
    }
    handleButtonClick = () => {
      const date = Date.now();
      const data = {
        interviewData: applicationData,
        email: user.email,
        body: {
          applicationStatus: "Cancelled",
          archived: true,
          cancelReason: inputValue,
          completedAt: date,
          selectedReason: radioValue,
          updatedAt: date,
        },
        interviewTransaction: {
          action: "Cancelled",
          fromStage: getStage(applicationData),
          fromStageId: currentStage?.stage?.id,
          fromSubstageId: currentStage?.substage?.id,
          interviewUID: applicationData._id,
          careerId: applicationData?.careerID,
          updatedBy: {
            email: user.email,
            image: user.image,
            name: user.name,
          },
        },
      };

      manageApplication(data);
    };
  }

  if (modalType == modalList[12]) {
    handleButtonClick = () => {
      const redirectTo = window.location.origin.includes("localhost")
        ? "/job-portal"
        : pathConstants.employee;
      performLogout(redirectTo);
    };
  }

  if (modalType == modalList[15]) {
    handleButtonClick = async () => {
      if (isResettingSetup) {
        return;
      }

      try {
        setIsResettingSetup(true);
        await api.patch("/api/talent-vault/profiles", {
          action: "reactivate_profile",
          payload: {},
        });
        setModalType(null);
        window.location.href = pathConstants.talentVaultSetup;
      } catch (error: any) {
        console.error("Error resetting Talent Vault setup:", error);
        alert(error?.message || "Failed to restart setup. Please try again.");
      } finally {
        setIsResettingSetup(false);
      }
    };
  }

  if (modalType == modalList[17]) {
    handleButtonClick = () => {
      setModalType(null);
      window.location.href = pathConstants.talentVaultSetup;
    };
  }

  useEffect(() => {
    if (
      [
        modalList[3],
        modalList[4],
        modalList[5],
        modalList[7],
        modalList[8],
        modalList[9],
        modalList[11],
        modalList[13],
        modalList[14],
      ].includes(modalType)
    ) {
      const storedSelectedCareer = sessionStorage.getItem("selectedCareer");

      if (storedSelectedCareer) {
        const parseStoredSelectedCareer = JSON.parse(storedSelectedCareer);
        setApplicationData(parseStoredSelectedCareer);
      }
    }
  }, [modalType]);

  function manageApplication(data) {
    api
      .post("/api/whitecloak/manage-application", data)
      .then((_) => {
        location.reload();
      })
      .catch((err) => {
        alert("Job cancellation failed.");
        setModalType(null);
        console.log(err);
      });
  }

  function reportJob(data) {
    axios({ method: "POST", url: "/api/job-portal/report-job", data })
      .then((res) => {
        setReportSuccess(res.data.success);
      })
      .catch((err) => {
        alert("Error on report job.");
        console.log(err);
      });
  }

  return (
    <div className={styles.modalContainer}>
      {modalType == modalList[0] && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img alt="" className={styles.logo} src={assetConstants.crosshair} />
          <span className={styles.title}>See results closer to you?</span>
          <span className={styles.description}>
            To get the closest and most relevant results, let Jia use your
            device’s exact location.
          </span>
          <button onClick={handleButtonClick}>
            <img alt="" src={assetConstants.crosshairV2} />
            Use Exact Location
          </button>
          <button className="secondaryBtn" onClick={handleClose}>
            Not Now
          </button>
        </div>
      )}

      {modalType == modalList[1] && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img
            alt="x"
            className={styles.xIcon}
            src={assetConstants.x}
            onClick={handleClose}
          />
          <img alt="logo" src={assetConstants.jiaLogo} />
          <span className={styles.title}>Let’s get you set up!</span>
          <span className={styles.description}>
            Sign in to save jobs and apply with one click
          </span>
          <button className="secondaryBtn" onClick={handleButtonClick}>
            <img alt="google" src={assetConstants.google} />
            Continue with Google
          </button>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 12,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span>Remember me</span>
          </label>
          <span className={styles.bottomText}>
            By continuing, you agree to our
            <br />
            <span className={styles.bold}>Terms of Service</span> and{" "}
            <span className={styles.bold}>Privacy Policy</span>
          </span>

          <div
            className={styles.loginGuide}
            onClick={() => setModalType(modalList[16])}
            role="button"
            tabIndex={0}
          >
            <img src="/icons/info.svg" alt="info" />
            <span>Have trouble signing in?</span>
          </div>
        </div>
      )}

      {modalType == modalList[1] && popupBlocked && (
        <div className={styles.popupBlockedBanner} role="alert">
          <div className={styles.popupBlockedBannerIcon}>
            <img src="/icons/alert-triangle.svg" alt="alert" />
          </div>
          <span className={styles.popupBlockedBannerText}>
            <b>Pop-ups blocked:</b> Your browser blocked the sign-in window.
            Allow pop-ups for this site to continue signing in.
          </span>
          <div className={styles.popupBlockedBannerButton}>
            <Button
              variant="secondary"
              label="Learn more"
              onClick={() => setModalType(modalList[16])}
            />
          </div>
        </div>
      )}

      {modalType == modalList[2] && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <Image
            alt="loading"
            src={assetConstants.loading}
            unoptimized
            width={164}
            height={129}
          />
          <span className={styles.title}>Loading...</span>
        </div>
      )}

      {modalType == modalList[3] && applicationData && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img
            alt="logo"
            className={styles.logo}
            src={assetConstants.checkV2}
          />
          <span className={styles.title}>Success!</span>
          <span className={styles.description}>You have applied for the</span>
          <span className={styles.description}>
            <span className={styles.bold}>{applicationData.jobTitle}</span> role
          </span>
          <button className="secondaryBtn" onClick={handleButtonClick}>
            OK
          </button>
        </div>
      )}

      {modalType == modalList[4] && applicationData && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img alt="" className={styles.logo} src={assetConstants.share} />
          <span className={styles.title}>Share Job</span>
          <div className={styles.bottomContainer}>
            <span id="selected-job-link">
              {`${window.location.origin}${pathConstants.jobOpenings}/${applicationData._id}`}
            </span>
            <img alt="" src={assetConstants.copy} onClick={handleButtonClick} />
          </div>
        </div>
      )}

      {modalType == modalList[5] && applicationData && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img alt="" className={styles.logo} src={assetConstants.alert} />
          <span className={styles.title}>Report Job</span>

          {!radioValue && (
            <>
              <span className={styles.description}>
                Why are you reporting this?
              </span>
              <fieldset>
                {checkList[modalType].map((item, index) => (
                  <label key={index}>
                    <input
                      type="radio"
                      name={modalType}
                      value={item}
                      onClick={() => setRadioValue(item)}
                    />
                    {item}
                  </label>
                ))}
              </fieldset>
            </>
          )}

          {radioValue && !reportSuccess && (
            <>
              <span className={styles.description}>
                What concerns do you have about this job post?
              </span>
              <textarea
                placeholder="Describe the issue..."
                onBlur={(e) => (e.target.placeholder = "Describe the issue...")}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={(e) => (e.target.placeholder = "")}
              />

              <div className={styles.bottomContainer}>
                <button className="secondaryBtn" onClick={handleClose}>
                  Cancel
                </button>
                <button
                  className={inputValue.trim() ? "" : "disabled"}
                  disabled={!inputValue.trim()}
                  onClick={handleButtonClick}
                >
                  Report Job
                </button>
              </div>
            </>
          )}

          {reportSuccess && (
            <>
              <span className={styles.description}>
                Thank you for reporting this. We appreciate you letting us know.
              </span>
              <button className="secondaryBtn" onClick={handleClose}>
                OK
              </button>
            </>
          )}
        </div>
      )}

      {modalType == modalList[6] && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img
            alt="x"
            className={styles.xIcon}
            src={assetConstants.x}
            onClick={handleClose}
          />
          <img alt="logo" src={assetConstants.jiaLogo} />
          <span className={styles.title}>Welcome!</span>
          <span className={styles.description}>
            You are now one step closer to your dream job. Get started by
            managing your CV to apply to jobs faster.
          </span>
          <button className="secondaryBtn" onClick={handleButtonClick}>
            Manage CV
          </button>
          <span className={styles.bottomText} onClick={handleClose}>
            Maybe Later
          </span>
        </div>
      )}

      {modalType == modalList[7] && applicationData && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img alt="" className={styles.logo} src={assetConstants.rotateCcw} />
          <span className={styles.title}>Request to Retake</span>
          <span className={styles.description}>
            If something went wrong or you would like another chance to take
            your AI interview, let us know why.
          </span>
          <textarea
            placeholder="Tell us what happened..."
            onBlur={(e) => (e.target.placeholder = "Tell us what happened...")}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={(e) => (e.target.placeholder = "")}
          />
          <div className={styles.bottomContainer}>
            <button className="secondaryBtn" onClick={handleClose}>
              Cancel
            </button>
            <button
              className={inputValue.trim() ? "" : "disabled"}
              onClick={handleButtonClick}
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {modalType == modalList[8] && applicationData && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img alt="" className={styles.logo} src={assetConstants.trash} />
          <span className={styles.title}>Cancel Application</span>
          <span className={styles.description}>
            Are you sure you want to cancel your application for this role? ? If
            so, please tell us why.
          </span>

          <fieldset>
            {checkList[modalType].map((item, index) => (
              <label key={index}>
                <input
                  type="radio"
                  name={modalType}
                  value={item}
                  onClick={() => setRadioValue(item)}
                />
                {index == 3 ? `${item} (please specify reason)` : item}
              </label>
            ))}
          </fieldset>

          {radioValue == checkList[modalType][3] && (
            <textarea
              placeholder="Tell us what happened..."
              onBlur={(e) =>
                (e.target.placeholder = "Tell us what happened...")
              }
              onChange={(e) => setInputValue(e.target.value)}
              onClick={(e) => ((e.target as HTMLInputElement).placeholder = "")}
            />
          )}

          <div className={styles.bottomContainer}>
            <button className="secondaryBtn" onClick={handleClose}>
              Go Back
            </button>
            <button
              className={
                radioValue &&
                ((radioValue == checkList[modalType][3] && inputValue.trim()) ||
                  radioValue != checkList[modalType][3])
                  ? styles.secondaryBtn
                  : "disabled"
              }
              onClick={handleButtonClick}
            >
              Cancel Application
            </button>
          </div>
        </div>
      )}

      {modalType == modalList[9] && applicationData && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <div className={styles.gradientContainer}>
            <div className={styles.jobDetailsContainer}>
              {applicationData.jobTitle && (
                <div className={styles.titleContainer}>
                  <span>{applicationData.jobTitle}</span>
                </div>
              )}

              {applicationData.organization &&
                applicationData.organization.name && (
                  <span className={styles.companyName}>
                    {applicationData.organization.name}
                  </span>
                )}

              {applicationData.location && (
                <span className={`${styles.details} ${styles.withMargin}`}>
                  <img alt="" src={assetConstants.mapPin} />
                  {applicationData.location}
                </span>
              )}

              {applicationData.createdAt && (
                <span className={styles.details}>
                  <img alt="" src={assetConstants.clock} />
                  {processDate(applicationData.createdAt)}
                </span>
              )}

              {applicationData.workSetup && (
                <div className={styles.tagContainer}>
                  <span>{applicationData.workSetup}</span>
                </div>
              )}

              <hr />

              <p
                className={styles.jobDescription}
                dangerouslySetInnerHTML={{
                  __html: applicationData.description,
                }}
              />
              <button onClick={handleClose}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* {modalType == modalList[10] && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img alt="logo" className={styles.logo} src={assetConstants.bellV2} />
          <span className={styles.title}>Set A Reminder to Reapply</span>
          <span className={styles.description}>
            <span className={styles.bold}>Reminder Date:</span>
            <br />
            January 28, 2026
          </span>

          <textarea
            placeholder="Add a personal note...."
            onBlur={(e) => (e.target.placeholder = "Add a personal note...")}
            onChange={(e) => setInputValue(e.target.value)}
            onClick={(e) => ((e.target as HTMLInputElement).placeholder = "")}
          />
          <label>
            <input type="checkbox" />
            Send me an email reminder
          </label>

          <div className={styles.bottomContainer}>
            <button onClick={handleClose}>Cancel</button>
            <button
              className={
                inputValue.trim() ? styles.secondaryBtn : styles.disabled
              }
              onClick={handleButtonClick}
            >
              Set Reminder
            </button>
          </div>
        </div>
      )} */}

      {/* AI Screening Results modal hidden from candidates */}
      {false && modalType == modalList[11] && applicationData && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img alt="" className={styles.logo} src={assetConstants.result} />
          <span className={styles.title}>AI Screening Results</span>

          <div
            className={styles.resultContainer}
            dangerouslySetInnerHTML={{
              __html:
                applicationData.currentStep == "AI Intervew"
                  ? applicationData.summary
                  : applicationData.cvScreeningReason,
            }}
          />

          <div className={styles.bottomContainer}>
            <button className="secondaryBtn" onClick={handleClose}>
              OK
            </button>
          </div>
        </div>
      )}

      {modalType == modalList[12] && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img alt="" className={styles.logo} src={assetConstants.logoutV3} />
          <span className={styles.title}>Log Out Confirmation</span>

          <span className={styles.description}>
            Are you sure you want to log out?
          </span>

          <div className={styles.bottomContainer}>
            <button className="secondaryBtn" onClick={handleClose}>
              Cancel
            </button>
            <button onClick={handleButtonClick}>Confirm</button>
          </div>
        </div>
      )}

      {modalType == modalList[15] && (
        <div className={`${styles.modalContent} ${styles[modalType]}`}>
          <img
            alt="Warning"
            className={styles.talentVaultExpiredIcon}
            src="/iconsV3/warning-badge.svg"
          />
          <span className={`${styles.title} ${styles.talentVaultExpiredTitle}`}>
            Your Talent Vault profile is currently inactive.
          </span>
          <span
            className={`${styles.description} ${styles.talentVaultExpiredDescription}`}
          >
            Update your profile to stay visible to employers.
          </span>

          <div className={styles.talentVaultExpiredActions}>
            <button
              type="button"
              className={styles.talentVaultExpiredDismissButton}
              onClick={handleClose}
            >
              Dismiss
            </button>
            <button
              type="button"
              className={styles.talentVaultExpiredReactivateButton}
              onClick={() => void handleButtonClick()}
              disabled={isResettingSetup}
            >
              {isResettingSetup ? "Reactivating..." : "Reactivate Now"}
            </button>
          </div>
        </div>
      )}

      {modalType == modalList[13] && applicationData && (
        <JourneyTrackerModal
          interview={applicationData}
          user={user}
          onClose={handleClose}
          setModalType={setModalType}
          assetConstants={assetConstants}
          pathConstants={pathConstants}
        />
      )}

      {modalType == modalList[14] && applicationData && (
        <PreScreeningGuideModal
          interview={applicationData}
          user={user}
          onClose={handleClose}
          setModalType={setModalType}
          assetConstants={assetConstants}
          pathConstants={pathConstants}
        />
      )}

      {modalType == modalList[16] && (
        <TroubleshootingGuideModal
          onClose={handleClose}
          setModalType={setModalType}
          assetConstants={assetConstants}
          pathConstants={pathConstants}
        />
      )}

      {modalType == modalList[17] && (
        <div className={`${styles.modalContent} ${styles.talentVaultSetupPrompt}`}>
          <img
            alt="Setup"
            className={styles.talentVaultSetupPromptIcon}
            src={assetConstants.talentVault}
          />
          <span className={`${styles.title} ${styles.talentVaultSetupPromptTitle}`}>
            Set up your Talent Vault profile
          </span>
          <span
            className={`${styles.description} ${styles.talentVaultSetupPromptDescription}`}
          >
            You haven&apos;t set up your Talent Vault profile yet. Complete your
            profile to get discovered by top employers.
          </span>

          <div className={styles.talentVaultSetupPromptActions}>
            <button
              type="button"
              className={styles.talentVaultSetupPromptDismissButton}
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.talentVaultSetupPromptSetupButton}
              onClick={handleButtonClick}
            >
              Setup Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function JourneyTrackerModal({
  interview,
  user,
  onClose,
  setModalType,
  assetConstants,
  pathConstants,
}) {
  const router = useRouter();
  const [isStartingInterview, setIsStartingInterview] = useState(false);
  const startInterviewLockRef = useRef(false);
  const applicationPhase = [
    "For CV Screening",
    "For AI Interview",
    "For AI Interview Review",
    "For Human Interview",
    "For Human Interview Review",
  ];
  const stepStatus = ["Completed", "Pending", "In Progress"];

  function processCurrentStep(interview) {
    const pipelineStages = interview?.pipelineStages || [];
    const pipelineStageSteps = pipelineStages?.map((stage) => stage.name);
    if (interview.currentStep == "Applied") {
      return pipelineStageSteps[0];
    }

    if (interview.currentStep == "Job Interview") {
      return "Human Interview";
    }

    if (pipelineStageSteps.includes(interview.currentStep)) {
      if (interview.currentStep == pipelineStageSteps[0]) {
        return interview.status ==
          pipelineStages
            .find((stage) => stage.name === pipelineStageSteps[1])
            ?.substages?.find(
              (substage) => substage.currentStep === pipelineStageSteps[0],
            )?.status
          ? pipelineStageSteps[1]
          : pipelineStageSteps[0];
      }

      if (interview.currentStep == pipelineStageSteps[1]) {
        return interview.status.toLowerCase().includes("review")
          ? `${pipelineStageSteps[1]} Review`
          : pipelineStageSteps[2];
      }

      if (interview.currentStep == "Human Interview") {
        const humanInterviewSubstage = pipelineStages
          .find((stage) => stage.name === "Human Interview")
          ?.substages?.find((substage) => substage.status === interview.status);
        if (humanInterviewSubstage) {
          return humanInterviewSubstage.name;
        }
        return interview.status.toLowerCase().includes("review")
          ? `Human Interview Review`
          : `Pending Job Offer`;
      }
    }

    if (
      interview.currentStep &&
      !pipelineStageSteps.includes(interview.currentStep)
    ) {
      return `Final Job Offer`;
    }

    if (!interview.currentStep) {
      if (interview.summary) {
        return pipelineStageSteps[1];
      }

      return pipelineStageSteps[0];
    }

    return interview.currentStep;
  }

  function resolveCurrentStageIndex(interview, pipelineStageSteps) {
    const pipelineStages = interview?.pipelineStages || [];

    if (interview?.stageId) {
      const stageIndex = pipelineStages.findIndex(
        (stage) => stage.id === interview.stageId,
      );
      if (stageIndex !== -1) {
        return stageIndex;
      }
    }

    const canonicalStep = processCurrentStep(interview);

    if (pipelineStageSteps.includes(canonicalStep)) {
      return pipelineStageSteps.indexOf(canonicalStep);
    }

    if (typeof canonicalStep === "string") {
      if (canonicalStep.endsWith(" Review")) {
        const baseStep = canonicalStep.replace(/ Review$/, "");
        const baseStepIndex = pipelineStageSteps.indexOf(baseStep);
        if (baseStepIndex !== -1) {
          return baseStepIndex;
        }
      }

      if (["Final Job Offer", "Pending Job Offer"].includes(canonicalStep)) {
        const jobOfferIndex = pipelineStageSteps.indexOf("Job Offer");
        if (jobOfferIndex !== -1) {
          return jobOfferIndex;
        }
      }
    }

    const substageStageIndex = pipelineStages.findIndex((stage) =>
      stage?.substages?.some(
        (substage) =>
          substage?.name === canonicalStep ||
          substage?.status === canonicalStep,
      ),
    );
    if (substageStageIndex !== -1) {
      return substageStageIndex;
    }

    return pipelineStageSteps.indexOf(interview.currentStep);
  }

  function processState(interview, step, isAdvance: boolean = false) {
    const pipelineStageSteps = interview?.pipelineStages?.map(
      (stage) => stage.name,
    );
    const stepIndex = pipelineStageSteps.indexOf(step);
    const currentStepIndex = resolveCurrentStageIndex(
      interview,
      pipelineStageSteps,
    );

    if (stepIndex === -1) {
      return stepStatus[1];
    }

    if (interview.currentStep == "Applied" && currentStepIndex == -1) {
      if (stepIndex == 0) {
        return isAdvance ? stepStatus[2] : stepStatus[1];
      }
    }

    if (interview.currentStep == "Job Interview" && currentStepIndex == -1) {
      const humanInterviewIndex = pipelineStageSteps.indexOf("Human Interview");
      if (stepIndex == humanInterviewIndex) {
        return stepStatus[2];
      }
      if (stepIndex > humanInterviewIndex) {
        return stepStatus[1];
      }
    }

    if (currentStepIndex != -1) {
      if (stepIndex < currentStepIndex) {
        return stepStatus[0];
      }

      if (stepIndex > currentStepIndex) {
        return stepStatus[1];
      }

      return interview.applicationStatus &&
        interview.applicationStatus != "Ongoing"
        ? stepStatus[0]
        : stepStatus[2];
    }

    if (
      interview.currentStep &&
      currentStepIndex == -1 &&
      interview.currentStep != "Applied"
    ) {
      return stepStatus[0];
    }

    return stepStatus[1];
  }

  function getStepStatus(step, interview) {
    const state = processState(interview, step.name);
    if (state === "Completed") return "completed";
    if (state === "In Progress") return "in_progress";
    return "pending";
  }

  function getCompletedStepsCount(interview) {
    const pipelineStages = getEnabledStages(interview?.pipelineStages || []);
    let count = 0;
    pipelineStages.forEach((step) => {
      const state = processState(interview, step.name);
      if (state === "Completed") count++;
    });
    return count;
  }

  function getActionButton(interview) {
    const currentStep = processCurrentStep(interview);

    if (
      interview.currentStep == "Applied" ||
      (!interview.currentStep && !interview.summary)
    ) {
      return {
        text: "Submit CV",
        icon: assetConstants.upload,
        onClick: () => {
          setModalType("loading");
          sessionStorage.setItem("selectedCareer", JSON.stringify(interview));
          window.location.href = pathConstants.uploadCV;
        },
      };
    }

    if (
      currentStep == "AI Interview" &&
      interview.status == applicationPhase[1]
    ) {
      return {
        text: isStartingInterview ? "Starting..." : "Start Interview",
        icon: assetConstants.arrowV3,
        disabled: isStartingInterview,
        onClick: () => {
          if (startInterviewLockRef.current) {
            return;
          }

          startInterviewLockRef.current = true;
          setIsStartingInterview(true);
          sessionStorage.setItem(
            "interviewRedirection",
            pathConstants.dashboard,
          );
          setModalType(null);
          router.push(`/interview/${interview.interviewID}`);
        },
      };
    }

    if (
      currentStep == "AI Interview Review" ||
      (currentStep == "AI Interview" && interview.status == applicationPhase[2])
    ) {
      return {
        text: "Request to Retake",
        icon: assetConstants.rotateCcw,
        onClick: () => {
          if (interview.interviewDuration < 5) {
            // retakeInterview(interview);
          } else {
            sessionStorage.setItem("selectedCareer", JSON.stringify(interview));
            setModalType("retake");
          }
        },
      };
    }

    return null;
  }

  const pipelineStages = getEnabledStages(interview?.pipelineStages || []);
  const completedSteps = getCompletedStepsCount(interview);
  const totalSteps = pipelineStages.length;
  const progressPercentage =
    totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const actionButton = getActionButton(interview);

  return (
    <div className={styles.journeyTrackerModal}>
      <div className={styles.journeyTrackerPanel}>
        <div className={styles.journeyTrackerHeader}>
          <div className={styles.journeyTrackerHeaderContent}>
            <div className={styles.journeyTrackerTitleRow}>
              <h2 className={styles.journeyTrackerTitle}>My Journey Tracker</h2>
              <button className={styles.journeyTrackerClose} onClick={onClose}>
                <img alt="close" src={assetConstants.x} />
              </button>
            </div>

            <div className={styles.candidateDetails}>
              <div className={styles.candidateInfo}>
                {interview.organization?.image && (
                  <img
                    alt="company"
                    className={styles.candidateAvatar}
                    src={interview.organization.image}
                  />
                )}
                <div className={styles.candidateText}>
                  <span className={styles.candidateJobTitle}>
                    {interview.jobTitle}
                  </span>
                  {interview.organization?.name && (
                    <span className={styles.candidateCompany}>
                      {interview.organization.name}
                    </span>
                  )}
                </div>
              </div>
              {actionButton && (
                <button
                  className={styles.candidateActionButton}
                  disabled={Boolean(actionButton.disabled)}
                  onClick={actionButton.onClick}
                >
                  {actionButton.icon && <img alt="" src={actionButton.icon} />}
                  <span>{actionButton.text}</span>
                </button>
              )}
            </div>

            <div className={styles.progressBarSection}>
              <div className={styles.progressBarContainer}>
                <div className={styles.progressBarBackground}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
              <span className={styles.progressText}>
                {completedSteps} of {totalSteps} steps completed
              </span>
            </div>
          </div>
        </div>

        <div className={styles.journeyTrackerContent}>
          {pipelineStages.map((step, index) => {
            const stepStatus = getStepStatus(step, interview);
            const isCompleted = stepStatus === "completed";
            const isInProgress = stepStatus === "in_progress";
            const currentStep = processCurrentStep(interview);
            const isLastStep = index === pipelineStages.length - 1;

            return (
              <div key={index} className={styles.journeyStep}>
                <div className={styles.journeyStepTimeline}>
                  <div className={styles.timelineIndicatorColumn}>
                    {isCompleted ? (
                      <div className={styles.timelineIndicatorCompleted}>
                        <img alt="check" src={assetConstants.completed} />
                      </div>
                    ) : (
                      <div className={styles.timelineIndicator}>
                        <div className={styles.timelineIndicatorOuter} />
                        {isInProgress && (
                          <div className={styles.timelineIndicatorInner} />
                        )}
                      </div>
                    )}
                    {/* {!isLastStep && (
                      <div className={`${styles.timelineConnector} ${isCompleted ? styles.completedConnector : ""}`} />
                    )} */}
                  </div>
                  <div className={styles.journeyStepContent}>
                    <div className={styles.journeyStepHeader}>
                      <span className={styles.journeyStepNumber}>
                        STEP {index + 1}
                      </span>
                      <div className={styles.journeyStepTitleRow}>
                        <span className={styles.journeyStepTitle}>
                          {step.alias || step.name}
                        </span>
                        <div
                          className={`${styles.journeyStepBadge} ${styles[stepStatus]}`}
                        >
                          {stepStatus === "completed" && "Completed"}
                          {stepStatus === "in_progress" && "In Progress"}
                          {stepStatus === "pending" && "Pending"}
                        </div>
                      </div>
                    </div>

                    {/* Banner for current/active step */}
                    {(() => {
                      // Check if this step should show a banner
                      const isHumanInterviewStep =
                        step.name === "Human Interview";
                      const isJobOfferStep =
                        step.name === "Job Offer" ||
                        step.name === "Final Job Offer";
                      const isHumanInterviewSubstage =
                        isHumanInterviewStep &&
                        [
                          "Human Interview",
                          "Waiting Schedule",
                          "Waiting Interview",
                          "For Review",
                        ].includes(currentStep);
                      const isJobOfferCurrent =
                        isJobOfferStep &&
                        (currentStep === "Job Offer" ||
                          currentStep === "Final Job Offer");
                      const shouldShowBanner =
                        isInProgress ||
                        currentStep === step.name ||
                        isHumanInterviewSubstage ||
                        isJobOfferCurrent;

                      if (!shouldShowBanner) return null;

                      // Determine banner text based on step type
                      let bannerText = "";
                      if (step.name === "CV Screening") {
                        bannerText =
                          "We're reviewing your CV to see how your experience aligns with the role. You'll get an update once the review is complete.";
                      } else if (step.name === "AI Interview") {
                        bannerText =
                          "After finishing your AI Interview, you'll get feedback from us within a few days.";
                      } else if (isHumanInterviewStep) {
                        // Human Interview - handle different substages
                        if (
                          (["Human Interview", "Waiting Schedule"].includes(
                            currentStep,
                          ) &&
                            interview.status == applicationPhase[3]) ||
                          (currentStep == "Waiting Interview" &&
                            interview.status == "For Interview")
                        ) {
                          bannerText =
                            "Our team will reach out via email with your interview schedule. Keep an eye on your inbox and confirm your slot once you receive it!";
                        } else if (
                          currentStep == "For Review" &&
                          interview.status == applicationPhase[4]
                        ) {
                          bannerText =
                            "Thanks for taking the time to chat with us! We're reviewing everything and will reach out soon with what's next.";
                        } else {
                          bannerText =
                            "You're now being scheduled for a Human Interview! Expect an email with your schedule soon.";
                        }
                      } else if (isJobOfferStep) {
                        // Job Offer - handle in progress vs completed
                        if (isCompleted) {
                          bannerText =
                            "Congratulations and welcome aboard! Check your email for your official offer documents and onboarding instructions.";
                        } else {
                          bannerText =
                            "Congratulations! You've reached the final stage. We'll email your official offer with details on next steps.";
                        }
                      }

                      return (
                        <div className={styles.journeyStepBanner}>
                          <img alt="help" src={assetConstants.helpCircle} />
                          <div className={styles.journeyStepBannerContent}>
                            <span className={styles.journeyStepBannerTitle}>
                              What happens next?
                            </span>
                            <span className={styles.journeyStepBannerText}>
                              {bannerText}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PreScreeningGuideModal({
  interview,
  user,
  onClose,
  setModalType,
  assetConstants,
  pathConstants,
}) {
  const router = useRouter();
  const [isStartingInterview, setIsStartingInterview] = useState(false);
  const startInterviewLockRef = useRef(false);
  // Priority: 1) career (interview), 2) org (from API), 3) english
  const hasLangFromCareer =
    interview?.walkthroughLanguage === "tagalog" ||
    interview?.walkthroughLanguage === "english";
  const defaultLang = hasLangFromCareer
    ? interview.walkthroughLanguage
    : "english";
  const [walkthroughLanguage, setWalkthroughLanguage] = useState<
    "english" | "tagalog"
  >(defaultLang);
  const [languageResolved, setLanguageResolved] = useState(hasLangFromCareer);
  const [videoSkeletonVisible, setVideoSkeletonVisible] = useState(true);

  useEffect(() => {
    if (!languageResolved) return;
    setVideoSkeletonVisible(true);
    const t = setTimeout(() => setVideoSkeletonVisible(false), 600);
    return () => clearTimeout(t);
  }, [languageResolved]);

  // Sync from interview when career has walkthroughLanguage set
  useEffect(() => {
    if (
      interview?.walkthroughLanguage === "tagalog" ||
      interview?.walkthroughLanguage === "english"
    ) {
      setWalkthroughLanguage(interview.walkthroughLanguage);
      setLanguageResolved(true);
    }
  }, [interview?.walkthroughLanguage]);

  // When career has no walkthroughLanguage, fetch resolved value (career → org → english) from API
  useEffect(() => {
    if (hasLangFromCareer) return;
    if (!interview?.id) {
      setWalkthroughLanguage("english");
      setLanguageResolved(true);
      return;
    }
    api
      .post("/api/career-data", {
        id: interview.id,
        orgID: interview.orgID ?? undefined,
      })
      .then((res) => {
        const lang: "english" | "tagalog" =
          res.data?.walkthroughLanguage === "tagalog" ? "tagalog" : "english";
        setWalkthroughLanguage(lang);
        setLanguageResolved(true);
      })
      .catch(() => {
        setWalkthroughLanguage("english");
        setLanguageResolved(true);
      });
  }, [interview?.id, interview?.orgID, hasLangFromCareer]);

  const interviewID =
    typeof interview?.interviewID === "string" ? interview.interviewID.trim() : "";
  const isTalentVaultSource = interview?.source === "talent-vault";
  const [resolvedInterviewID, setResolvedInterviewID] = useState(interviewID);
  const [isPreparingInterview, setIsPreparingInterview] = useState(false);
  const canStartInterview = resolvedInterviewID.length > 0;

  useEffect(() => {
    if (!isTalentVaultSource || resolvedInterviewID.length > 0) {
      return;
    }

    let cancelled = false;
    setIsPreparingInterview(true);

    api
      .patch("/api/talent-vault/profiles", {
        action: "ensure_ai_interview",
        payload: {},
      })
      .then((response) => {
        if (cancelled) return;

        const ensuredInterviewID = response?.data?.meta?.interviewID;
        if (
          typeof ensuredInterviewID === "string" &&
          ensuredInterviewID.trim().length > 0
        ) {
          const trimmedID = ensuredInterviewID.trim();
          setResolvedInterviewID(trimmedID);

          try {
            const stored = sessionStorage.getItem("selectedCareer");
            if (stored) {
              const parsed = JSON.parse(stored);
              parsed.interviewID = trimmedID;
              sessionStorage.setItem("selectedCareer", JSON.stringify(parsed));
            }
          } catch {}
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error preparing Talent Vault interview:", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreparingInterview(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isTalentVaultSource, resolvedInterviewID]);

  function handleStartInterview() {
    if (startInterviewLockRef.current || !canStartInterview) {
      return;
    }

    startInterviewLockRef.current = true;
    setIsStartingInterview(true);
    setModalType("loading");
    sessionStorage.setItem(
      "interviewRedirection",
      isTalentVaultSource ? pathConstants.talentVaultSetup : pathConstants.dashboard
    );
    router.push(`/interview/${resolvedInterviewID}`);
  }

  const faqItems = [
    {
      question: "What is a pre-screening interview?",
      answer:
        "It's Jia's AI-powered interview, designed to feel like a real conversation where you can share your skills and experience. The only difference is that you can complete it anytime, anywhere.",
    },
    {
      question: "How long does it take?",
      answer:
        "On average 20 minutes, but it may vary depending on the length of your answers.",
    },
    {
      question: "Can I ask for clarification?",
      answer:
        "Yes! You can ask Jia to repeat or rephrase a question, just like you would with a real interviewer.",
    },
    {
      question: "Can I answer in Taglish or Tagalog?",
      answer:
        "Absolutely! Jia can understand <b>English</b>, <b>Filipino</b>, and <b>Taglish</b>. Feel free to use the language that helps you express yourself best.\n\nHowever, please note that some employers prefer candidates who can speak fluent English, especially for roles that involve global communication or international clients.",
    },
    {
      question:
        "I noticed Jia sometimes takes a short pause before replying. Is that intentional?",
      answer:
        'Yes! Jia waits about 4 seconds of silence before replying. This gives you a moment to pause and think before moving on. However, noises like "uhms," background chatter, or even the sound of an electric fan can reset the 4-second timer, which then makes Jia respond slower.\n\nFor the best experience, be sure to stay in a quiet place and make sure electric fans aren\'t pointed at your microphone.',
    },
    {
      question: "When should I take the interview?",
      answer:
        "We encourage you to complete it as soon as possible. Candidates who take the interview earlier are often reviewed sooner, helping you move forward in the hiring process faster.\n\n<b>Important:</b> If you do not complete the interview within 3 days, the recruiters may mark your application as low intent.",
    },
    {
      question: "Do I need to prepare anything?",
      answer:
        "<ul><li>Find a quiet, well-lit space</li><li>Make sure you're connected to stable and fast internet</li><li>Use <b>Google Chrome</b> for best compatibility</li><li>Check that your camera and microphone are working properly</li></ul>",
    },
  ];

  const tips = [
    "<b>Be yourself.</b> Don't overthink it! Treat it like a real conversation and focus on sharing your experiences honestly.",
    "<b>Be clear and focused.</b> Listen carefully to each question and respond in an organized way. Staying on topic will help recruiters easily understand your strengths.",
    "<b>Be honest.</b> Don't exaggerate things because Jia will probe deep into your answers. Additionally, the video recording will be reviewed by human recruiters. Authenticity is key and leaves a positive impression.",
  ];

  return (
    <div className={styles.preScreeningGuideModal}>
      <div className={styles.preScreeningGuideContent}>
        <div className={styles.preScreeningGuideHeader}>
          <div className={styles.preScreeningGuideHeaderContent}>
            <div className={styles.preScreeningGuideTitleRow}>
              <div>
                <h2 className={styles.preScreeningGuideTitle}>
                  Pre-screening Interview Guide
                </h2>
                <p className={styles.preScreeningGuideSubtitle}>
                  Congratulations on passing the first stage! Now, here's how to
                  get ready for your next step.
                </p>
              </div>
              <button
                className={styles.preScreeningGuideClose}
                onClick={onClose}
              >
                <img alt="close" src={assetConstants.x} />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.preScreeningGuideBody}>
          <div className={styles.preScreeningGuideBanner}>
            <div className={styles.preScreeningGuideBannerContent}>
              <img alt="check" src={assetConstants.checkCircle} />
              <span>Ready for the next step? You've got this!</span>
            </div>
            <button
              className={styles.startInterviewButton}
              onClick={handleStartInterview}
              disabled={isStartingInterview || !canStartInterview}
            >
              <img alt="play" src={assetConstants.playCircle} />
              <span>
                {isStartingInterview
                  ? "Starting..."
                  : canStartInterview
                    ? "Start Interview"
                    : isPreparingInterview
                      ? "Preparing Interview..."
                      : "Interview Not Ready Yet"}
              </span>
            </button>
          </div>

          <div className={styles.preScreeningGuideSection}>
            <div className={styles.preScreeningGuideSectionHeader}>
              <h3 className={styles.preScreeningGuideSectionTitle}>
                Walkthrough
              </h3>
              {languageResolved ? (
                <div className={styles.preScreeningGuideSectionButton}>
                  <button
                    type="button"
                    className={`${styles.preScreeningGuideSectionButtonItem} ${walkthroughLanguage === "english" ? styles.active : ""}`}
                    onClick={() => setWalkthroughLanguage("english")}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    className={`${styles.preScreeningGuideSectionButtonItem} ${walkthroughLanguage === "tagalog" ? styles.active : ""}`}
                    onClick={() => setWalkthroughLanguage("tagalog")}
                  >
                    Tagalog
                  </button>
                </div>
              ) : (
                <span
                  style={{
                    fontSize: 14,
                    color: "#717680",
                    fontWeight: 500,
                  }}
                >
                  Loading...
                </span>
              )}
            </div>

            <div className={styles.preScreeningGuideSectionContent}>
              {!languageResolved || videoSkeletonVisible ? (
                <div
                  className={styles.preScreeningGuideVideoSkeleton}
                  aria-hidden="true"
                />
              ) : (
                <>
                  <div
                    className={
                      walkthroughLanguage === "english"
                        ? styles.preScreeningGuideVideoWrapper
                        : styles.preScreeningGuideVideoHidden
                    }
                  >
                    <VideoPlayer
                      src="/walkthrough/pre-interview-guide-english.mp4"
                      active={walkthroughLanguage === "english"}
                    />
                  </div>
                  <div
                    className={
                      walkthroughLanguage === "tagalog"
                        ? styles.preScreeningGuideVideoWrapper
                        : styles.preScreeningGuideVideoHidden
                    }
                  >
                    <VideoPlayer
                      src="/walkthrough/pre-interview-guide-tagalog.mp4"
                      active={walkthroughLanguage === "tagalog"}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={styles.preScreeningGuideSection}>
            <h3 className={styles.preScreeningGuideSectionTitle}>
              Frequently Asked Questions
            </h3>
            {faqItems.map((item, index) => (
              <div key={index} className={styles.faqItem}>
                <img
                  alt="gradient star"
                  src={assetConstants.gradientStar}
                  className={styles.gradientStarIcon}
                />
                <div className={styles.faqContent}>
                  <span className={styles.faqQuestion}>{item.question}</span>
                  <span
                    className={styles.faqAnswer}
                    dangerouslySetInnerHTML={{
                      __html: item.answer.replace(/\n\n/g, "<br /><br />"),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.preScreeningGuideDivider} />

          <div className={styles.preScreeningGuideSection}>
            <h3 className={styles.preScreeningGuideSectionTitle}>
              Tips to Ace Your Interview
            </h3>
            {tips.map((tip, index) => (
              <div key={index} className={styles.tipItem}>
                <img
                  alt="gradient star"
                  src={assetConstants.gradientStar}
                  className={styles.gradientStarIcon}
                />
                <div className={styles.faqContent}>
                  <span
                    className={styles.tipText}
                    dangerouslySetInnerHTML={{ __html: tip }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.preScreeningGuideDivider} />

          <div className={styles.preScreeningGuideFooter}>
            <h3 className={styles.preScreeningGuideSectionTitle}>
              Ready for the next step? You've got this!
            </h3>
            <button
              className={styles.startInterviewButton}
              onClick={handleStartInterview}
              disabled={isStartingInterview || !canStartInterview}
            >
              <img alt="play" src={assetConstants.playCircle} />
              <span>
                {isStartingInterview
                  ? "Starting..."
                  : canStartInterview
                    ? "Start Interview"
                    : isPreparingInterview
                      ? "Preparing Interview..."
                      : "Interview Not Ready Yet"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TroubleshootingGuideModal({
  onClose,
  setModalType,
  assetConstants,
  pathConstants,
}) {
  const [troubleshootDevice, setTroubleshootDevice] = useState("desktop");

  return (
    <>
      <div className={styles.troubleshootingGuideModal}>
        <div className={styles.troubleshootingGuideModalHeader}>
          <div className={styles.titleContent}>
            <div className={styles.icon}>
              <img
                src="/iconsV2/info-circle.svg"
                alt="info circle"
                width={24}
                height={24}
              />
            </div>
            <div className={styles.titleGroup}>
              <span className={styles.title}>Troubleshooting sign-in</span>
              <span className={styles.description}>
                Here are some tips to ensure you can sign-in to Jia without any
                issues.
              </span>
            </div>
          </div>
          <button
            className={styles.troubleshootingGuideClose}
            onClick={onClose}
          >
            <img alt="close" src={assetConstants.x} />
          </button>
        </div>

        <div className={styles.troubleshootingGuideModalBody}>
          <div className={styles.titleGroup}>
            <span className={styles.title}>Enabling pop-ups</span>
            <span className={styles.description}>
              Pop-ups must be enabled to complete the Jia sign-in process.
            </span>
          </div>

          <div className={styles.troubleshootingGuideSectionButton}>
            <button
              type="button"
              className={`${styles.troubleshootingGuideSectionButtonItem} ${troubleshootDevice === "desktop" ? styles.active : ""}`}
              onClick={() => setTroubleshootDevice("desktop")}
            >
              Desktop
            </button>
            <button
              type="button"
              className={`${styles.troubleshootingGuideSectionButtonItem} ${troubleshootDevice === "mobile" ? styles.active : ""}`}
              onClick={() => setTroubleshootDevice("mobile")}
            >
              Mobile
            </button>
          </div>

          {troubleshootingGuideModalData
            .filter((item) => item.device === troubleshootDevice)
            .map((item) => (
              <div
                key={`${item.device}-${item.title}`}
                className={styles.troubleshootingGuideModalItem}
              >
                <div className={styles.troubleshootingGuideModalItemHeader}>
                  <div className={styles.titleGroup}>
                    <div className={styles.troubleshootingGuideModalItemTitle}>
                      <img
                        alt="gradient star"
                        src={assetConstants.gradientStar}
                        className={styles.gradientStarIcon}
                      />
                      <span className={styles.title}>{item.title}</span>
                    </div>
                    <span
                      className={styles.description}
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  </div>
                </div>
                <div className={styles.troubleshootingGuideModalItemImage}>
                  <img
                    className={
                      troubleshootDevice === "mobile"
                        ? styles.mobile
                        : undefined
                    }
                    src={item.image}
                    alt={item.title}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
