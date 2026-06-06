// TODO (Job Portal) - Check API

"use client";

import Loader from "@/lib/components/commonV2/Loader";
import styles from "@/lib/styles/screens/jobDetails.module.scss";
import modalStyles from "@/lib/styles/screens/jobOpenings.module.scss";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import { useAppContext } from "@/lib/context/ContextV2";
import { processDate } from "@/lib/utils/helpersV2";
import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { extractSubdomain } from "@/lib/utils/subdomainUtils";
import { isUserInJobCountry } from "@/lib/utils/countryHelper";
import Badge from "@/lib/components/ui/badge/Badge";
import Button from "@/lib/components/ui/button/Button";
import Field from "@/lib/components/ui/field/Field";
import Group from "@/lib/components/ui/group/Group";
import Modal from "@/lib/components/ui/modal/Modal";
import Toggle from "@/lib/components/ui/toggle/Toggle";
import PasscodeInput from "@/lib/components/CandidateProfileComponents/PasscodeInput";
import { usePasscodeValue } from "@/lib/hooks/usePasscodeValue";
import { usePhoneVerificationFlow } from "@/lib/hooks/usePhoneVerificationFlow";
import {
  PHONE_COUNTRY_OPTIONS,
  type SupportedPhoneCountry,
  applyCountryDialCode,
  inferPhoneCountry,
  sanitizeInternationalPhoneInput,
} from "@/lib/utils/phoneInput";
import {
  ArrowRight,
  HelpCircle,
  Phone01,
  PlusCircle,
  Trash01,
} from "@untitledui/icons";

interface ContactConfirmationState {
  additionalEmails: string[];
  additionalMobileNumbers: string[];
  firstName: string;
  lastName: string;
  primaryEmail: string;
  primaryMobileNumber: string;
}

interface AdditionalEmailEntry {
  email: string;
  isPrimary: boolean;
}

const PHONE_VERIFICATION_RECAPTCHA_ID = "global-recaptcha-container";

export default function ({ params }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [interview, setInterview] = useState(null);
  const [selectedCareer, setSelectedCareer] = useState(null);
  const [viewDropdown, setViewdropdown] = useState(false);
  const [userCountryCode, setUserCountryCode] = useState<string | null>(null);
  const [isCountryLoading, setIsCountryLoading] = useState(true);
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileNumberError, setMobileNumberError] = useState("");
  const [isPhoneVerificationModalOpen, setIsPhoneVerificationModalOpen] =
    useState(false);
  const [phoneVerificationStep, setPhoneVerificationStep] = useState<
    "phone" | "otp" | "contact"
  >("phone");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSavingContactDetails, setIsSavingContactDetails] = useState(false);
  const [maskedMobileNumber, setMaskedMobileNumber] = useState("");
  const [contactFormError, setContactFormError] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(105);
  const { user, setModalType, setOrganizationBranding } = useAppContext();
  const { passcode, onDigitChange, onComplete, reset } = usePasscodeValue();
  const [contactForm, setContactForm] = useState<ContactConfirmationState>(() =>
    buildContactConfirmationState(user, ""),
  );

  const dropdown = [
    {
      name: "Share Job",
      onClick: () => {
        setModalType("share");
        setViewdropdown(false);
      },
    },
    {
      name: "Report Job",
      onClick: () => {
        setModalType("report");
        setViewdropdown(false);
      },
    },
  ];

  function parseNameParts(fullName) {
    const trimmedName = `${fullName || ""}`.trim();

    if (!trimmedName) {
      return { firstName: "", lastName: "" };
    }

    const nameParts = trimmedName.split(/\s+/);

    if (nameParts.length === 1) {
      return { firstName: nameParts[0], lastName: "" };
    }

    return {
      firstName: nameParts.slice(0, -1).join(" "),
      lastName: nameParts[nameParts.length - 1],
    };
  }

  function getCandidateMobileNumber(candidateUser) {
    const mobileNumber = sanitizeInternationalPhoneInput(
      `${candidateUser?.structuredCV?.contactInfo?.phone || ""}`.trim(),
    );
    return mobileNumber;
  }

  function buildContactConfirmationState(sourceUser, verifiedMobileNumber) {
    const additionalInfo = sourceUser?.additionalInfo || {};
    const parsedName = parseNameParts(sourceUser?.name);
    const primaryEmail = `${sourceUser?.primaryContactEmail || sourceUser?.email || ""}`.trim();
    const primaryMobile = sanitizeInternationalPhoneInput(
      `${sourceUser?.primaryContactMobileNumber || verifiedMobileNumber || getCandidateMobileNumber(sourceUser) || ""}`.trim(),
    );
    const storedAdditionalEmailEntries = Array.isArray(additionalInfo?.additionalEmails)
      ? additionalInfo.additionalEmails
          .map((value): AdditionalEmailEntry | null => {
            if (typeof value === "string") {
              const email = value.trim();
              return email ? { email, isPrimary: false } : null;
            }

            if (value && typeof value === "object") {
              const email = `${value.email || ""}`.trim();
              if (!email) return null;

              return {
                email,
                isPrimary: value.isPrimary === true,
              };
            }

            return null;
          })
          .filter(Boolean)
      : null;
    const resolvedPrimaryEmail =
      storedAdditionalEmailEntries?.find((entry) => entry?.isPrimary)?.email ||
      primaryEmail;
    const storedContactEmails = storedAdditionalEmailEntries
      ? storedAdditionalEmailEntries.map((entry) => entry!.email)
      : Array.isArray(sourceUser?.contactEmails)
        ? sourceUser.contactEmails
        : Array.isArray(sourceUser?.secondaryEmails)
          ? [resolvedPrimaryEmail, ...sourceUser.secondaryEmails]
          : Array.isArray(sourceUser?.additionalEmails)
            ? [resolvedPrimaryEmail, ...sourceUser.additionalEmails]
            : [];
    const storedContactMobiles = Array.isArray(sourceUser?.contactMobileNumbers)
      ? sourceUser.contactMobileNumbers
      : Array.isArray(sourceUser?.secondaryMobileNumbers)
        ? [primaryMobile, ...sourceUser.secondaryMobileNumbers]
        : Array.isArray(sourceUser?.additionalMobileNumbers)
          ? [primaryMobile, ...sourceUser.additionalMobileNumbers]
          : [];

    return {
      additionalEmails: storedContactEmails
        .map((value) => `${value || ""}`.trim())
        .filter((value) => value && value !== resolvedPrimaryEmail),
      additionalMobileNumbers: storedContactMobiles
        .map((value) => sanitizeInternationalPhoneInput(`${value || ""}`.trim()))
        .filter((value) => value && value !== primaryMobile),
      firstName: `${sourceUser?.firstName || parsedName.firstName || ""}`.trim(),
      lastName: `${sourceUser?.lastName || parsedName.lastName || ""}`.trim(),
      primaryEmail: resolvedPrimaryEmail,
      primaryMobileNumber: primaryMobile,
    };
  }

  function updateStoredUser(nextUser) {
    localStorage.setItem("user", JSON.stringify(nextUser));
    window.dispatchEvent(
      new CustomEvent("localStorageChange", {
        detail: { key: "user", value: nextUser },
      }),
    );
  }

  const {
    handleBackToPhone,
    handleOtpDigitChange,
    handlePhoneVerificationNext,
    handleResendOtp,
    handleVerifyOtp,
    resetVerificationSession,
  } = usePhoneVerificationFlow({
    isPhoneVerificationModalOpen,
    mobileNumber,
    onDigitChange,
    onRequestMobileApplied: (nextMobileNumber) => {
      setContactForm((current) => ({
        ...current,
        primaryMobileNumber: sanitizeInternationalPhoneInput(nextMobileNumber),
      }));
    },
    onVerificationApproved: (updatedUser, verifiedMobileNumber) => {
      setContactForm(
        buildContactConfirmationState(updatedUser, verifiedMobileNumber),
      );
      setContactFormError("");
    },
    otpCountdown,
    passcode,
    phoneVerificationStep,
    recaptchaContainerId: PHONE_VERIFICATION_RECAPTCHA_ID,
    resetPasscode: reset,
    setIsRequestingOtp,
    setIsVerifyingOtp,
    setMaskedMobileNumber,
    setMobileNumber,
    setMobileNumberError,
    setOtpCountdown,
    setOtpError,
    setPhoneVerificationStep,
    updateStoredUser,
    user,
  });

  function getMaskedMobileNumber(number) {
    const trimmedNumber = number.trim();
    const visibleDigits = trimmedNumber.replace(/\D/g, "");

    if (visibleDigits.length < 4) {
      return trimmedNumber;
    }

    const lastFourDigits = visibleDigits.slice(-4);
    const hasPlusPrefix = trimmedNumber.startsWith("+");
    const countryCodeLength =
      visibleDigits.length > 10 ? visibleDigits.length - 10 : 0;
    const countryCodePrefix = hasPlusPrefix
      ? `+${visibleDigits.slice(0, countryCodeLength)}`.trim()
      : "";

    return `${countryCodePrefix ? `${countryCodePrefix} ` : ""}*** *** ${lastFourDigits}`.trim();
  }

  function formatOtpCountdown(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function openPhoneVerificationModal() {
    resetVerificationSession();
    setMobileNumber((current) =>
      sanitizeInternationalPhoneInput(current || getCandidateMobileNumber(user)),
    );
    setMaskedMobileNumber("");
    setContactForm(buildContactConfirmationState(user, getCandidateMobileNumber(user)));
    setContactFormError("");
    setMobileNumberError("");
    setOtpError(null);
    setOtpCountdown(105);
    reset();
    setPhoneVerificationStep("phone");
    setIsPhoneVerificationModalOpen(true);
  }

  function closePhoneVerificationModal() {
    resetVerificationSession();
    setMobileNumberError("");
    setMaskedMobileNumber("");
    setContactForm(buildContactConfirmationState(user, getCandidateMobileNumber(user)));
    setContactFormError("");
    setOtpError(null);
    setOtpCountdown(105);
    reset();
    setPhoneVerificationStep("phone");
    setIsPhoneVerificationModalOpen(false);
  }

  function addAdditionalEmailField() {
    setContactForm((current) => ({
      ...current,
      additionalEmails: [...current.additionalEmails, ""],
    }));
  }

  function addAdditionalMobileField() {
    setContactForm((current) => ({
      ...current,
      additionalMobileNumbers: [...current.additionalMobileNumbers, ""],
    }));
  }

  function updateAdditionalEmail(index, value) {
    setContactForm((current) => ({
      ...current,
      additionalEmails: current.additionalEmails.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  }

  function updateAdditionalMobile(index, value) {
    setContactForm((current) => ({
      ...current,
      additionalMobileNumbers: current.additionalMobileNumbers.map(
        (item, itemIndex) =>
          itemIndex === index ? sanitizeInternationalPhoneInput(value) : item,
      ),
    }));
  }

  function removeAdditionalEmail(index) {
    setContactForm((current) => ({
      ...current,
      additionalEmails: current.additionalEmails.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  }

  function removeAdditionalMobile(index) {
    setContactForm((current) => ({
      ...current,
      additionalMobileNumbers: current.additionalMobileNumbers.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  }

  function setEmailAsPrimary(index) {
    setContactForm((current) => {
      const nextPrimaryEmail = current.additionalEmails[index];

      if (!nextPrimaryEmail) {
        return current;
      }

      return {
        ...current,
        additionalEmails: current.additionalEmails.map((item, itemIndex) =>
          itemIndex === index ? current.primaryEmail : item,
        ),
        primaryEmail: nextPrimaryEmail,
      };
    });
  }

  function setMobileAsPrimary(index) {
    setContactForm((current) => {
      const nextPrimaryMobileNumber = current.additionalMobileNumbers[index];

      if (!nextPrimaryMobileNumber) {
        return current;
      }

      return {
        ...current,
        additionalMobileNumbers: current.additionalMobileNumbers.map(
          (item, itemIndex) =>
            itemIndex === index ? current.primaryMobileNumber : item,
        ),
        primaryMobileNumber: nextPrimaryMobileNumber,
      };
    });
  }

  function handleApply() {
    if (user != null) {
      applyJob();
    } else {
      sessionStorage.setItem("redirectionPath", pathname);
      setModalType("signIn");
    }
  }

  async function handleProceedAfterContactConfirmation() {
    const firstName = contactForm.firstName.trim();
    const lastName = contactForm.lastName.trim();

    if (!firstName || !lastName) {
      setContactFormError("First name and last name are required.");
      return;
    }

    setIsSavingContactDetails(true);
    setContactFormError("");

    try {
      const response = await api.patch("/api/job-portal/contact-details", {
        additionalEmails: contactForm.additionalEmails,
        additionalMobileNumbers: contactForm.additionalMobileNumbers,
        firstName,
        lastName,
        primaryEmail: contactForm.primaryEmail,
        primaryMobileNumber: contactForm.primaryMobileNumber,
      });
      const updatedUser = {
        ...user,
        ...response.data?.applicant,
      };

      updateStoredUser(updatedUser);
      const applyResponse = await api.post("/api/whitecloak/apply-job", {
        selectedCareer,
      });

      if (applyResponse?.data?.error === "phone_verification_required") {
        setContactFormError("Phone verification is still required.");
        return;
      }

      if (applyResponse?.data?.error) {
        setContactFormError(
          applyResponse.data.message || "Unable to apply for job.",
        );
        return;
      }

      triggerJobAppliedEvent(selectedCareer);
      window.location.href = "/dashboard/upload-cv";
    } catch (error: any) {
      setContactFormError(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Unable to continue. Please try again.",
      );
    } finally {
      setIsSavingContactDetails(false);
    }
  }

  function handleRedirection(path?) {
    if (path == pathConstants.whitecloak) {
      window.open(path, "_blank");
      return null;
    }

    if (path) {
      window.location.href = path;
    } else {
      if (user == null) {
        window.location.href = pathConstants.jobOpenings;
      } else {
        history.back();
      }
    }
  }

  useEffect(() => {
    const jobID = params.jobID;

    if (jobID) {
      fetchCareer(jobID);
    }

    // Auto-detect user's country via IP
    fetch("/api/geo")
      .then((res) => res.json())
      .then((data) => {
        if (data.country_code) {
          setUserCountryCode(data.country_code);
        }
      })
      .catch((err) => {
        console.error("Error detecting country:", err);
      })
      .finally(() => {
        setIsCountryLoading(false);
      });
  }, []);

  function applyJob() {
    setModalType("loading");

    api.post("/api/whitecloak/apply-job", { selectedCareer })
      .then((res) => {
        if (res?.data?.error === "phone_verification_required") {
          setModalType(null);
          openPhoneVerificationModal();
          return;
        }

        if (res.data.error) {
          alert(res.data.message);
          setModalType(null);
        } else {
          setModalType(null);
          triggerJobAppliedEvent(selectedCareer);
          window.location.href = "/dashboard/upload-cv";
        }
      })
      .catch((err) => {
        if (err?.response?.data?.error === "phone_verification_required") {
          setModalType(null);
          openPhoneVerificationModal();
          return;
        }

        alert(err?.response?.data?.message || "Error applying for job");
        setModalType(null);
        console.log(err);
      });
  }

  function triggerJobAppliedEvent(jobDetails: any) {
    try {
      if (typeof window !== "undefined" && typeof (window as any)?.gtag === "function") {
        (window as any)?.gtag?.('event', 'start_job_application', {
          'job_title': jobDetails.jobTitle,
        });
        if (jobDetails._id === "68b4ec4da751b538ecf6ee2e") {
          (window as any)?.gtag?.('event', 'conversion', {
            'send_to': 'AW-17523605644/0zQOCMThhZsbEIyB9KNB',
          });
        }
      }
    } catch (error) {
      console.error("Error triggering job applied event", error);
    }
  }

  function fetchCareer(jobID) {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const subdomain = extractSubdomain(hostname);

    axios({
      method: "POST",
      url: "/api/job-portal/fetch-careers",
      data: { jobID },
      headers: subdomain ? { 'x-org-subdomain': subdomain } : {},
    })
      .then((res) => {
        const result = res.data;

        if (result.error) {
          alert(result.error);
          handleRedirection();
        } else {
          const career = result[0];
          sessionStorage.setItem("selectedCareer", JSON.stringify(career));
          document.title = `${career.jobTitle} - JIA Job Portal`;

          if (subdomain) {
            if (career.organization?.brandedPortalEnabled && career.organization?.image) {
              
              if (career.organization?.brandedJobPortalSubdomain !== subdomain) {
                 setOrganizationBranding(null);
              } else {
                 setOrganizationBranding({
                  enabled: true,
                  logo: career.organization.image,
                  name: career.organization.name,
                });
                document.title = `${career.organization.name} Job Portal`;
              }
            } else {
               const newUrl = window.location.pathname;
               window.history.replaceState({}, '', newUrl);
               setOrganizationBranding(null);
            }
          } else {
             setOrganizationBranding(null);
          }

          if (user != null) {
            fetchInterview(career);
          } else {
            setSelectedCareer(career);
          }
        }
      })
      .catch((err) => {
        alert("Error on fetching careers.");
        console.log(err);
      });
  }

  function fetchInterview(career) {
    api.post("/api/job-portal/fetch-interviews", { 
      email: user.email, interviewID: career.id
    })
      .then((res) => {
        const result = res.data;

        if (result.length > 0) {
          setInterview(result[0]);
        }
      })
      .catch((err) => {
        alert("Error fetching existing application.");
        console.log(err);
      })
      .finally(() => {
        setSelectedCareer(career);
      });
  }

  return selectedCareer ? (
    <div className={styles.contentContainer}>
      <Modal
        opened={isPhoneVerificationModalOpen}
        onClose={closePhoneVerificationModal}
        centered
        size={
          phoneVerificationStep === "contact"
            ? 620
            : phoneVerificationStep === "otp"
              ? 520
              : 436
        }
        radius={24}
        overlayProps={{ blur: 6, opacity: 0.2 }}
        withCloseButton={false}
        classNames={{
          body: modalStyles.phoneVerificationModalBody,
          content: modalStyles.phoneVerificationModalContent,
        }}
      >
        <div className={modalStyles.phoneVerificationForm}>
          <button
            type="button"
            className={modalStyles.phoneVerificationModalCloseButton}
            onClick={closePhoneVerificationModal}
            aria-label="Close mobile verification modal"
          >
            <span aria-hidden>×</span>
          </button>

          {phoneVerificationStep === "phone" ? (
            <>
              <div className={modalStyles.phoneVerificationIntro}>
                <div className={modalStyles.phoneVerificationLogo}>
                  <img
                    alt=""
                    src={selectedCareer?.organization?.image || assetConstants.jiaLogo2}
                  />
                </div>

                <div className={modalStyles.phoneVerificationCopy}>
                  <span className={modalStyles.phoneVerificationHeading}>
                    Please enter and verify your mobile number
                  </span>
                  <span className={modalStyles.phoneVerificationSubtitle}>
                    {(selectedCareer?.organization?.name || "This company") +
                      " requires all its applicants to have a verified mobile number."}
                  </span>
                </div>
              </div>

              <Field
                label="Mobile Number"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="+639876543210"
                value={mobileNumber}
                error={mobileNumberError}
                section={
                  <span className={modalStyles.phoneVerificationCountryCode}>
                    <select
                      aria-label="Phone country"
                      className={modalStyles.phoneVerificationCountrySelect}
                      value={inferPhoneCountry(mobileNumber)}
                      onChange={(event) => {
                        const nextCountry = event.target.value as SupportedPhoneCountry;
                        setMobileNumber(
                          applyCountryDialCode(mobileNumber, nextCountry),
                        );
                        if (mobileNumberError) {
                          setMobileNumberError("");
                        }
                      }}
                    >
                      {PHONE_COUNTRY_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.code}
                        </option>
                      ))}
                    </select>
                    <img alt="" src={assetConstants.chevron} />
                  </span>
                }
                sectionDivider
                sectionWidth={68}
                sectionPointerEvents="auto"
                onChange={(event) => {
                  setMobileNumber(
                    sanitizeInternationalPhoneInput(
                      event.target.value,
                      inferPhoneCountry(mobileNumber),
                    ),
                  );
                  if (mobileNumberError) {
                    setMobileNumberError("");
                  }
                }}
              />
              <div className={modalStyles.phoneVerificationActions}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  pill
                  onClick={closePhoneVerificationModal}
                  disabled={isRequestingOtp}
                  style={{ width: "100%" }}
                />
                <Button
                  label={isRequestingOtp ? "Sending..." : "Next"}
                  variant="primary"
                  pill
                  onClick={handlePhoneVerificationNext}
                  disabled={isRequestingOtp}
                  style={{ width: "100%" }}
                />
              </div>
            </>
          ) : phoneVerificationStep === "otp" ? (
            <>
              <div className={modalStyles.phoneVerificationOtpIntro}>
                <div className={modalStyles.phoneVerificationIcon}>
                  <Phone01 />
                </div>

                <div className={modalStyles.phoneVerificationCopy}>
                  <span className={modalStyles.phoneVerificationHeading}>
                    Verify your mobile number
                  </span>
                  <span className={modalStyles.phoneVerificationSubtitle}>
                    We&apos;ve sent a 6-digit verification code to{" "}
                    <br />
                    <span className={modalStyles.phoneVerificationMaskedNumber}>
                      {maskedMobileNumber || getMaskedMobileNumber(mobileNumber)}
                    </span>
                  </span>
                </div>
              </div>

              <div className={modalStyles.phoneVerificationOtpSection}>
                <div className={modalStyles.phoneVerificationOtpInputs}>
                  <PasscodeInput
                    error={otpError || undefined}
                    onDigitChange={handleOtpDigitChange}
                    onComplete={onComplete}
                    placeholder="0"
                  />
                </div>

                <span className={modalStyles.phoneVerificationOtpHint}>
                  It may take up to 2 minutes for the code to arrive.
                </span>

                {otpError && (
                  <span className={modalStyles.phoneVerificationOtpError}>
                    {otpError}
                  </span>
                )}

                <div className={modalStyles.phoneVerificationResend}>
                  <span>Didn&apos;t receive a code?</span>
                  {otpCountdown > 0 ? (
                    <span className={modalStyles.phoneVerificationResendTimer}>
                      Resend in {formatOtpCountdown(otpCountdown)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={modalStyles.phoneVerificationResendButton}
                      onClick={handleResendOtp}
                      disabled={isRequestingOtp}
                    >
                      {isRequestingOtp ? "Sending..." : "Resend code"}
                    </button>
                  )}
                </div>
              </div>

              <div className={modalStyles.phoneVerificationActions}>
                <Button
                  label="Back"
                  variant="secondary"
                  pill
                  onClick={handleBackToPhone}
                  disabled={isVerifyingOtp}
                  style={{ width: "100%" }}
                />
                <Button
                  label={isVerifyingOtp ? "Verifying..." : "Verify"}
                  variant="primary"
                  pill
                  onClick={handleVerifyOtp}
                  disabled={isVerifyingOtp}
                  style={{ width: "100%" }}
                />
              </div>
            </>
          ) : (
            <>
              <div className={modalStyles.phoneVerificationContactIntro}>
                <span className={modalStyles.phoneVerificationContactHeading}>
                  Confirm Contact Details
                </span>
                <span className={modalStyles.phoneVerificationContactSubtitle}>
                  Please confirm if your contact details are correct.
                </span>
              </div>

              <div className={modalStyles.phoneVerificationContactSection}>
                <Group grow align="flex-start" gap={16}>
                  <Field
                    label="First Name"
                    withAsterisk
                    placeholder="Enter first name"
                    value={contactForm.firstName}
                    onChange={(event) => {
                      setContactFormError("");
                      setContactForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }));
                    }}
                  />
                  <Field
                    label="Last Name"
                    withAsterisk
                    placeholder="Enter last name"
                    value={contactForm.lastName}
                    onChange={(event) => {
                      setContactFormError("");
                      setContactForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }));
                    }}
                  />
                </Group>

                <div className={modalStyles.phoneVerificationContactBlock}>
                  {contactForm.additionalEmails.length > 0 ? (
                    <>
                      <div className={modalStyles.phoneVerificationContactLabelRow}>
                        <span className={modalStyles.phoneVerificationContactLabel}>
                          Email
                        </span>
                        <Badge
                          size="lg"
                          radius="md"
                          backgroundColor="#ecfdf3"
                          textColor="#027a48"
                        >
                          Primary
                        </Badge>
                      </div>
                      <Field
                        placeholder="your.email@example.com"
                        readOnly
                        section={<HelpCircle />}
                        sectionPosition="right"
                        value={contactForm.primaryEmail}
                      />
                      <div className={modalStyles.phoneVerificationPrimaryToggleRow}>
                        <Toggle checked disabled onChange={() => {}} />
                        <span>Set as primary email</span>
                      </div>

                      {contactForm.additionalEmails.map((emailValue, index) => (
                        <div
                          key={`additional-email-${index}`}
                          className={modalStyles.phoneVerificationSecondaryContactRow}
                        >
                          <div className={modalStyles.phoneVerificationSecondaryContactBody}>
                            <div className={modalStyles.phoneVerificationContactLabelRow}>
                              <span className={modalStyles.phoneVerificationContactLabel}>
                                Email
                              </span>
                            </div>
                            <div className={modalStyles.phoneVerificationSecondaryInputRow}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Field
                                  placeholder="Add another email"
                                  type="email"
                                  value={emailValue}
                                  onChange={(event) => {
                                    setContactFormError("");
                                    updateAdditionalEmail(index, event.target.value);
                                  }}
                                />
                              </div>
                              <Button
                                label={undefined}
                                variant="secondary"
                                iconJsx={<Trash01 color="#667085" />}
                                onClick={() => removeAdditionalEmail(index)}
                              />
                            </div>
                            <label
                              className={modalStyles.phoneVerificationPrimaryToggleRow}
                              style={{
                                cursor: emailValue.trim() ? "pointer" : "not-allowed",
                                opacity: emailValue.trim() ? 1 : 0.5,
                              }}
                            >
                              <Toggle
                                checked={false}
                                disabled={!emailValue.trim()}
                                onChange={(checked) => {
                                  if (checked) {
                                    setEmailAsPrimary(index);
                                  }
                                }}
                              />
                              <span>Set as primary email</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <Field
                      label="Email"
                      placeholder="your.email@example.com"
                      readOnly
                      section={<HelpCircle />}
                      sectionPosition="right"
                      value={contactForm.primaryEmail}
                    />
                  )}

                  <Button
                    label="Add another email"
                    variant="secondary"
                    pill
                    iconJsx={<PlusCircle color="#667085" />}
                    onClick={addAdditionalEmailField}
                    style={{ width: "fit-content" }}
                  />
                </div>

                <div className={modalStyles.phoneVerificationContactDivider} />

                <div className={modalStyles.phoneVerificationContactBlock}>
                  {contactForm.additionalMobileNumbers.length > 0 ? (
                    <>
                      <div className={modalStyles.phoneVerificationContactLabelRow}>
                        <span className={modalStyles.phoneVerificationContactLabel}>
                          Mobile number
                        </span>
                        <img
                          alt="Verified"
                          src={assetConstants.verifiedTick}
                          style={{ width: 20, height: 20 }}
                        />
                      </div>
                      <Field
                        placeholder="+639876543210"
                        readOnly
                        sectionLeft={
                          <span className={modalStyles.phoneVerificationCountryCode}>
                            <span>PH</span>
                            <img alt="" src={assetConstants.chevron} />
                          </span>
                        }
                        sectionLeftDivider
                        sectionLeftWidth={68}
                        sectionRight={
                          <img
                            alt="Verified"
                            src={assetConstants.verifiedTick}
                            style={{ width: 20, height: 20 }}
                          />
                        }
                        sectionRightWidth={40}
                        value={contactForm.primaryMobileNumber}
                      />
                      <div className={modalStyles.phoneVerificationPrimaryToggleRow}>
                        <Toggle checked disabled onChange={() => {}} />
                        <span>Set as primary number</span>
                      </div>

                      {contactForm.additionalMobileNumbers.map((mobileValue, index) => (
                        <div
                          key={`additional-mobile-${index}`}
                          className={modalStyles.phoneVerificationSecondaryContactRow}
                        >
                          <div className={modalStyles.phoneVerificationSecondaryContactBody}>
                            <div className={modalStyles.phoneVerificationContactLabelRow}>
                              <span className={modalStyles.phoneVerificationContactLabel}>
                                Phone number
                              </span>
                            </div>
                            <div className={modalStyles.phoneVerificationSecondaryInputRow}>
                              <div
                                className={modalStyles.phoneVerificationSecondaryMobileField}
                                style={{ flex: 1, minWidth: 0 }}
                              >
                                <Field
                                  type="tel"
                                  inputMode="numeric"
                                  placeholder="+639876543210"
                                  section={
                                    <span className={modalStyles.phoneVerificationCountryCode}>
                                      <select
                                        aria-label="Phone country"
                                        className={modalStyles.phoneVerificationCountrySelect}
                                        value={inferPhoneCountry(mobileValue)}
                                        onChange={(event) => {
                                          const nextCountry =
                                            event.target.value as SupportedPhoneCountry;
                                          setContactFormError("");
                                          updateAdditionalMobile(
                                            index,
                                            applyCountryDialCode(mobileValue, nextCountry),
                                          );
                                        }}
                                      >
                                        {PHONE_COUNTRY_OPTIONS.map((option) => (
                                          <option key={option.code} value={option.code}>
                                            {option.code}
                                          </option>
                                        ))}
                                      </select>
                                      <img alt="" src={assetConstants.chevron} />
                                    </span>
                                  }
                                  sectionDivider
                                  sectionWidth={68}
                                  sectionPointerEvents="auto"
                                  value={mobileValue}
                                  onChange={(event) => {
                                    setContactFormError("");
                                    updateAdditionalMobile(
                                      index,
                                      sanitizeInternationalPhoneInput(
                                        event.target.value,
                                        inferPhoneCountry(mobileValue),
                                      ),
                                    );
                                  }}
                                />
                                <div className={modalStyles.phoneVerificationSecondaryMobileActions}>
                                  <button
                                    type="button"
                                    className={modalStyles.phoneVerificationInlineActionButton}
                                  >
                                    Verify
                                  </button>
                                  <HelpCircle />
                                  </div>
                              </div>
                              <Button
                                label={undefined}
                                variant="secondary"
                                iconJsx={<Trash01 color="#667085" />}
                                onClick={() => removeAdditionalMobile(index)}
                              />
                            </div>
                            <label
                              className={modalStyles.phoneVerificationPrimaryToggleRow}
                              style={{
                                cursor: mobileValue.trim() ? "pointer" : "not-allowed",
                                opacity: mobileValue.trim() ? 1 : 0.5,
                              }}
                            >
                              <Toggle
                                checked={false}
                                disabled={!mobileValue.trim()}
                                onChange={(checked) => {
                                  if (checked) {
                                    setMobileAsPrimary(index);
                                  }
                                }}
                              />
                              <span>Set as primary number</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <Field
                      label="Mobile number"
                      placeholder="+639876543210"
                      readOnly
                      sectionLeft={
                        <span className={modalStyles.phoneVerificationCountryCode}>
                          <span>PH</span>
                          <img alt="" src={assetConstants.chevron} />
                        </span>
                      }
                      sectionLeftDivider
                      sectionLeftWidth={68}
                      sectionRight={
                        <img
                          alt="Verified"
                          src={assetConstants.verifiedTick}
                          style={{ width: 20, height: 20 }}
                        />
                      }
                      sectionRightWidth={40}
                      value={contactForm.primaryMobileNumber}
                    />
                  )}

                  {/* Disabled for now because firebase can only link one phone number */}
                  {/* <Button
                    label="Add another mobile number"
                    variant="secondary"
                    pill
                    iconJsx={<PlusCircle color="#667085" />}
                    onClick={addAdditionalMobileField}
                    style={{ width: "fit-content" }}
                  /> */}
                </div>
              </div>

              {contactFormError && (
                <span className={modalStyles.phoneVerificationContactError}>
                  {contactFormError}
                </span>
              )}

              <Button
                label={isSavingContactDetails ? "Saving..." : "Proceed"}
                variant="primary"
                pill
                iconJsx={<ArrowRight color="#ffffff" />}
                iconPosition="right"
                onClick={handleProceedAfterContactConfirmation}
                disabled={isSavingContactDetails}
                style={{ width: "100%" }}
              />
            </>
          )}
        </div>
      </Modal>

      <div className={styles.backContainer}>
        <span onClick={() => handleRedirection()}>
          <img alt="" src={assetConstants.chevronV2} />
          Back to Openings
        </span>
      </div>

      <div className={styles.gradientContainer}>
        <div className={styles.jobDetailsContainer}>
          {selectedCareer.jobTitle && (
            <div className={styles.titleContainer}>
              <span>{typeof window !== "undefined" ? new DOMParser().parseFromString(selectedCareer.jobTitle, "text/html").body.textContent : selectedCareer.jobTitle}</span>
              <img
                alt=""
                src={assetConstants.ellipsis}
                onClick={() => setViewdropdown(!viewDropdown)}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          )}

          {viewDropdown && (
            <div className={styles.dropdownContainer}>
              {dropdown.map((item, index) => (
                <span key={index} onClick={item.onClick}>
                  {item.name}
                </span>
              ))}
            </div>
          )}

          {selectedCareer.organization && selectedCareer.organization.name && (
            <span className={styles.companyName}>
              {selectedCareer.organization.name}
            </span>
          )}

          {selectedCareer.location && (
            <span className={`${styles.details} ${styles.withMargin}`}>
              <img alt="" src={assetConstants.mapPin} />
              {selectedCareer.location}
            </span>
          )}

          {selectedCareer.showSalaryToApplicants && (
            <span className={`${styles.details} ${styles.withMargin}`}>
              <img src={assetConstants.salary} alt="" />
              {selectedCareer.salaryCurrency || selectedCareer.currency || "PHP"} {selectedCareer.minimumSalary ? Number(selectedCareer.minimumSalary).toLocaleString() : "0"} - {selectedCareer.maximumSalary ? Number(selectedCareer.maximumSalary).toLocaleString() : "0"} per {((selectedCareer.salaryUnit || "Monthly") === "Annual" ? "year" : (selectedCareer.salaryUnit || "Monthly") === "Hourly" ? "hour" : "month")}
            </span>
          )}

          {selectedCareer.createdAt && (
            <span className={styles.details}>
              <img alt="" src={assetConstants.clock} />
              {processDate(selectedCareer.createdAt)}
            </span>
          )}

          <div className={styles.tagContainer}>
            {selectedCareer.employmentType && (
              <span>{selectedCareer.employmentType}</span>
            )}
            {selectedCareer.workSetup && (
              <span>{selectedCareer.workSetup}</span>
            )}
            {selectedCareer.globalHiringEnabled && (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img src={assetConstants.globe} alt="" style={{ width: 14, height: 14 }} />
                Hiring Globally
              </span>
            )}
            {!selectedCareer.globalHiringEnabled && !isUserInJobCountry(userCountryCode, selectedCareer.country, selectedCareer.locationCountryCode) && (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img src={assetConstants.localHiring} alt="" style={{ width: 14, height: 14 }} />
                Hiring Locally Only
              </span>
            )}
          </div>

          {selectedCareer.globalHiringEnabled && (
            <span style={{ fontSize: 13, color: '#667085', marginTop: 16, display: 'block' }}>
              International candidates are welcome to apply.
            </span>
          )}

          {!selectedCareer.globalHiringEnabled && !isUserInJobCountry(userCountryCode, selectedCareer.country, selectedCareer.locationCountryCode) && (
            <span style={{ fontSize: 13, color: '#667085', marginTop: 16, display: 'block' }}>
              Only candidates within the employer's country are eligible to apply.
            </span>
          )}

          {interview && interview.id == selectedCareer.id ? (
            <div className={styles.appliedContainer}>
              <span className={styles.applied}>
                <img alt="" src={assetConstants.checkV4} />
                Applied {processDate(interview.createdAt)}
              </span>

              <hr />
              <span
                className={styles.viewApplication}
                onClick={() => handleRedirection(pathConstants.dashboard)}
              >
                View Application {">"}
              </span>
            </div>
          ) : (
            <button
              id="apply-now-button"
              className={styles.btnApply}
              name="btn-apply"
              onClick={handleApply}
              disabled={isCountryLoading || (!selectedCareer.globalHiringEnabled && !isUserInJobCountry(userCountryCode, selectedCareer.country, selectedCareer.locationCountryCode))}
              style={(isCountryLoading || (!selectedCareer.globalHiringEnabled && !isUserInJobCountry(userCountryCode, selectedCareer.country, selectedCareer.locationCountryCode))) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              Apply Now
            </button>
          )}

          <hr />

          <p
            className={styles.jobDescription}
            dangerouslySetInnerHTML={{ __html: selectedCareer.description }}
          />

          {selectedCareer.organization && (
            <>
              <hr />

              <span className={styles.footerTitle}>About The Company</span>

              <div className={styles.footerContent}>
                {selectedCareer.organization.image && (
                  <img
                    alt=""
                    className={styles.companyLogo}
                    src={selectedCareer.organization.image}
                  />
                )}

                <div className={styles.footerDetails}>
                  {selectedCareer.organization.name && (
                    <span className={styles.footerCompanyName}>
                      {selectedCareer.organization.name}
                    </span>
                  )}

                  {selectedCareer.location && (
                    <span className={styles.details}>
                      {selectedCareer.location}
                    </span>
                  )}

                  {selectedCareer.organization.name.includes("White Cloak") && (
                    <>
                      <span
                        className={`${styles.details} ${styles.withMargin}`}
                      >
                        Founded in 2014, White Cloak continues to be the
                        innovation partner of choice for many major
                        corporations, leveraging technology to take its client’s
                        business to the next level. This technical superiority
                        and commitment to our clients have brought numerous
                        recognition and awards to White Cloak.
                      </span>

                      <button
                        className="secondaryBtn"
                        onClick={() =>
                          handleRedirection(pathConstants.whitecloak)
                        }
                      >
                        Learn More
                        <img alt="" src={assetConstants.arrowV3} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  ) : (
    <Loader loaderData={""} loaderType={""} />
  );
}
