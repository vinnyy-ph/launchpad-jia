"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Group, Modal, Select } from "@/lib/components/ui";
import { useDisclosure } from "@/lib/components/ui/hooks";
import styles from "./form-modal.module.scss";
import { MarkerPin01, PlusCircle, Trash01 } from "@untitledui/icons";
import { assetConstants } from "@/lib/utils/constantsV2";
import Tooltip from "@/lib/components/ui/tooltip/Tooltip";
import PhoneVerificationModal from "@/lib/components/PhoneVerification/PhoneVerificationModal";
import { usePasscodeValue } from "@/lib/hooks/usePasscodeValue";
import { usePhoneVerificationFlow } from "@/lib/hooks/usePhoneVerificationFlow";
import { useAppContext } from "@/lib/context/ContextV2";
import {
  PHONE_COUNTRY_OPTIONS,
  type SupportedPhoneCountry,
  applyCountryDialCode,
  inferPhoneCountry,
  sanitizeInternationalPhoneInput,
} from "@/lib/utils/phoneInput";

interface ContactInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contactInfo: ContactInfoData) => void;
  initialData?: ContactInfoData;
  lockedEmail?: string;
  disableEmailEdit?: boolean;
}

interface ContactInfoData {
  email: string;
  phone: string;
  isPhoneVerified?: boolean;
  countryCode: string;
  address: string;
  linkedin: string;
  websites: Website[];
}

interface Website {
  id: string;
  url: string;
  type: string;
}

interface PhotonFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    city?: string;
    country?: string;
    name?: string;
    state?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

interface LocationSuggestion {
  id: string;
  name: string;
  displayName: string;
}

const PHONE_VERIFICATION_RECAPTCHA_ID = "contact-info-modal-recaptcha-container";
const VERIFY_TOOLTIP_MESSAGE =
  "Some employers require a verified mobile number to proceed with the application.";
const VERIFIED_PHONE_FOCUS_MESSAGE =
  "This number has been verified. Changing it will require you to verify the new number again.";

const websiteTypes = [
  "Portfolio",
  "Blog",
  "GitHub",
  "Personal Website",
  "Company Website",
  "Other",
];

function createEmptyWebsite(id = Date.now().toString()): Website {
  return { id, url: "", type: "" };
}

function buildContactInfo(initialData?: ContactInfoData, lockedEmail?: string): ContactInfoData {
  const normalizedLockedEmail =
    typeof lockedEmail === "string" ? lockedEmail.trim() : "";

  return {
    email: normalizedLockedEmail || initialData?.email || "",
    phone: sanitizeInternationalPhoneInput(initialData?.phone || ""),
    isPhoneVerified: initialData?.isPhoneVerified === true,
    countryCode: "",
    address: initialData?.address || "",
    linkedin: initialData?.linkedin || "",
    websites:
      initialData?.websites && initialData.websites.length > 0
        ? initialData.websites
        : [createEmptyWebsite("1")],
  };
}

function normalizeLinkedIn(value: string) {
  return value.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "");
}

export default function ContactInfoModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  lockedEmail,
  disableEmailEdit = false,
}: ContactInfoModalProps) {
  const { user } = useAppContext();
  const [opened, { close, open }] = useDisclosure(isOpen);
  const [showEmailTooltip, setShowEmailTooltip] = useState(false);
  const [isPhoneFieldFocused, setIsPhoneFieldFocused] = useState(false);
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<SupportedPhoneCountry>("PH");
  const [contactInfo, setContactInfo] = useState<ContactInfoData>(() =>
    buildContactInfo(initialData, lockedEmail),
  );
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileNumberError, setMobileNumberError] = useState("");
  const [isPhoneVerificationModalOpen, setIsPhoneVerificationModalOpen] =
    useState(false);
  const [phoneVerificationStep, setPhoneVerificationStep] = useState<"phone" | "otp" | "contact">(
    "phone",
  );
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [maskedMobileNumber, setMaskedMobileNumber] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(105);
  const { passcode, onDigitChange, onComplete, reset } = usePasscodeValue();
  const websiteTypeOptions = useMemo(
    () =>
      websiteTypes.map((type) => ({
        value: type,
        label: type,
      })),
    [],
  );
  const addressContainerRef = useRef<HTMLDivElement>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<LocationSuggestion[]>([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isAddressSelectionLocked, setIsAddressSelectionLocked] = useState(false);

  useEffect(() => {
    if (isOpen) {
      open();
      return;
    }

    close();
  }, [close, isOpen, open]);

  useEffect(() => {
    if (!isOpen) return;
    setContactInfo(buildContactInfo(initialData, lockedEmail));
    setAddressSuggestions([]);
    setIsAddressDropdownOpen(false);
    setIsAddressFocused(false);
    setIsAddressSelectionLocked(false);
    const normalizedPhone = sanitizeInternationalPhoneInput((initialData?.phone || "").trim());
    setSelectedPhoneCountry(inferPhoneCountry(normalizedPhone));
    setMobileNumber(normalizedPhone);
    setMobileNumberError("");
    setOtpError(null);
    setOtpCountdown(105);
    setMaskedMobileNumber("");
    setPhoneVerificationStep("phone");
    setIsPhoneVerificationModalOpen(false);
    reset();
  }, [initialData, isOpen, lockedEmail]);

  const updateStoredUser = (nextUser: any) => {
    localStorage.setItem("user", JSON.stringify(nextUser));
    window.dispatchEvent(
      new CustomEvent("localStorageChange", {
        detail: { key: "user", value: nextUser },
      }),
    );
  };

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
      setMobileNumber(sanitizeInternationalPhoneInput(nextMobileNumber));
    },
    onVerificationApproved: (updatedUser, verifiedMobileNumber) => {
      const nextUser = {
        ...updatedUser,
        structuredCV: {
          ...updatedUser?.structuredCV,
          contactInfo: {
            ...(updatedUser?.structuredCV?.contactInfo || {}),
            phone: verifiedMobileNumber,
            isPhoneVerified: true,
          },
        },
      };
      updateStoredUser(nextUser);
      setContactInfo((current) => ({
        ...current,
        phone: sanitizeInternationalPhoneInput(verifiedMobileNumber),
        isPhoneVerified: true,
      }));
      setSelectedPhoneCountry(inferPhoneCountry(verifiedMobileNumber));
      closePhoneVerificationModal();
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

  useEffect(() => {
    if (!opened || !isAddressFocused || isAddressSelectionLocked) return;

    const trimmedAddress = contactInfo.address.trim();
    if (trimmedAddress.length < 2) {
      setAddressSuggestions([]);
      setIsAddressDropdownOpen(false);
      setIsAddressLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsAddressLoading(true);
      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmedAddress)}&limit=5`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as PhotonResponse;

        const suggestions: LocationSuggestion[] = (data.features || [])
          .map((feature, index) => {
            const props = feature.properties || {};
            const coords = feature.geometry?.coordinates;
            const parts = [props.name, props.city, props.state, props.country].filter(Boolean);

            return {
              id: `${index}-${coords?.[0] || 0}-${coords?.[1] || 0}`,
              name: props.name || "",
              displayName: parts.length > 0 ? parts.join(", ") : props.name || "",
            };
          })
          .filter((item) => item.displayName);

        setAddressSuggestions(suggestions);
        setIsAddressDropdownOpen(suggestions.length > 0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setAddressSuggestions([]);
          setIsAddressDropdownOpen(false);
        }
      } finally {
        setIsAddressLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [contactInfo.address, isAddressFocused, isAddressSelectionLocked, opened]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        addressContainerRef.current &&
        !addressContainerRef.current.contains(event.target as Node)
      ) {
        setIsAddressDropdownOpen(false);
        setIsAddressFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleClose() {
    closePhoneVerificationModal();
    close();
    onClose();
  }

  function openPhoneVerificationModal() {
    resetVerificationSession();
    setMobileNumber(sanitizeInternationalPhoneInput((contactInfo.phone || "").trim()));
    setMobileNumberError("");
    setOtpError(null);
    setOtpCountdown(105);
    setMaskedMobileNumber("");
    reset();
    setPhoneVerificationStep("phone");
    setIsPhoneVerificationModalOpen(true);
  }

  function closePhoneVerificationModal() {
    resetVerificationSession();
    setMobileNumberError("");
    setOtpError(null);
    setOtpCountdown(105);
    setMaskedMobileNumber("");
    reset();
    setPhoneVerificationStep("phone");
    setIsPhoneVerificationModalOpen(false);
  }

  function handleSave() {
    const normalizedLockedEmail =
      typeof lockedEmail === "string" ? lockedEmail.trim() : "";
    const nextContactInfo =
      disableEmailEdit && normalizedLockedEmail
        ? { ...contactInfo, email: normalizedLockedEmail, countryCode: "" }
        : { ...contactInfo, countryCode: "" };

    onSave(nextContactInfo);
    handleClose();
  }

  function addWebsite() {
    setContactInfo((current) => ({
      ...current,
      websites: [...current.websites, createEmptyWebsite()],
    }));
  }

  function removeWebsite(id: string) {
    setContactInfo((current) => ({
      ...current,
      websites: current.websites.filter((website) => website.id !== id),
    }));
  }

  function updateWebsite(id: string, field: keyof Website, value: string) {
    setContactInfo((current) => ({
      ...current,
      websites: current.websites.map((website) =>
        website.id === id ? { ...website, [field]: value } : website,
      ),
    }));
  }

  return (
    <>
      <PhoneVerificationModal
        opened={
          isPhoneVerificationModalOpen &&
          (phoneVerificationStep === "phone" || phoneVerificationStep === "otp")
        }
        onClose={closePhoneVerificationModal}
        onBack={handleBackToPhone}
        step={phoneVerificationStep === "otp" ? "otp" : "phone"}
        organizationLogo={assetConstants.jiaLogo2}
        showRequirementSubtitle={false}
        mobileNumber={mobileNumber}
        mobileNumberError={mobileNumberError}
        onMobileNumberChange={(value) => {
          setMobileNumber(
            sanitizeInternationalPhoneInput(value, selectedPhoneCountry),
          );
          if (mobileNumberError) {
            setMobileNumberError("");
          }
        }}
        isRequestingOtp={isRequestingOtp}
        onNext={handlePhoneVerificationNext}
        maskedMobileNumber={maskedMobileNumber}
        otpError={otpError}
        otpCountdown={otpCountdown}
        onOtpDigitChange={handleOtpDigitChange}
        onOtpComplete={onComplete}
        onResendOtp={handleResendOtp}
        isVerifyingOtp={isVerifyingOtp}
        onVerifyOtp={handleVerifyOtp}
      />
      <Modal
        opened={opened}
        onClose={handleClose}
        size={800}
        radius={16}
        classNames={{
          body: styles.modalBody,
          content: styles.modalContent,
          header: styles.modalHeader,
          title: styles.modalTitle,
        }}
        title={
          <span className={styles.titleBlock}>
            <span className={styles.heading}>Contact Information</span>
            <span className={styles.subtitle}>
              Add your contact details so recruiters can easily reach you.
            </span>
          </span>
        }
        closeButtonLabel="Close contact information modal"
      >
        <div className={styles.formLayout}>
        <div className={styles.fields}>
          <Group grow align="flex-start">
            <Field
              label={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Email
                  <span
                    style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
                    onMouseEnter={() => setShowEmailTooltip(true)}
                    onMouseLeave={() => setShowEmailTooltip(false)}
                  >
                    <img
                      alt=""
                      src="/icons/help-circle.svg"
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    {showEmailTooltip && (
                      <span
                        style={{
                          position: "absolute",
                          left: "calc(100% + 8px)",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "#181D27",
                          color: "#FFFFFF",
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          lineHeight: "16px",
                          width: 250,
                          zIndex: 20,
                          boxSizing: "border-box",
                        }}
                      >
                        This is your primary email associated with your Google account.
                      </span>
                    )}
                  </span>
                </span>
              }
              type="email"
              placeholder="your.email@example.com"
              value={contactInfo.email}
              disabled={disableEmailEdit}
              // inputStyle={fieldInputStyle}
              onChange={(event) =>
                setContactInfo((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
            <Field
              className={styles.phoneField}
              label="Phone Number"
              inputWrapperOrder={["label", "input", "description", "error"]}
              description={
                isPhoneFieldFocused && contactInfo.isPhoneVerified
                  ? VERIFIED_PHONE_FOCUS_MESSAGE
                  : undefined
              }
              type="tel"
              inputMode="numeric"
              placeholder="+639876543210"
              value={contactInfo.phone}
              sectionLeft={
                <span className={styles.phoneCountrySection}>
                  <select
                    aria-label="Phone country"
                    className={styles.phoneCountrySelect}
                    value={selectedPhoneCountry}
                    onChange={(event) => {
                      const nextCountry = event.target.value as SupportedPhoneCountry;
                      setSelectedPhoneCountry(nextCountry);
                      setContactInfo((current) => {
                        const nextPhone = applyCountryDialCode(current.phone, nextCountry);
                        return {
                          ...current,
                          phone: nextPhone,
                          isPhoneVerified:
                            current.isPhoneVerified && current.phone === nextPhone
                              ? current.isPhoneVerified
                              : false,
                        };
                      });
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
              sectionLeftDivider
              sectionLeftPointerEvents="auto"
              sectionLeftWidth={78}
              sectionRight={
                contactInfo.isPhoneVerified ? (
                  <img
                    alt="Verified"
                    src={assetConstants.verifiedTick}
                    style={{ width: 20, height: 20 }}
                  />
                ) : (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={openPhoneVerificationModal}
                      style={{
                        border: "1px solid #D5D7DA",
                        borderRadius: "999px",
                        background: "#FFFFFF",
                        color: "#344054",
                        fontSize: 12,
                        fontWeight: 600,
                        height: 26,
                        padding: "0 12px",
                        lineHeight: 1,
                        cursor: "pointer",
                      }}
                    >
                      Verify
                    </button>
                    <Tooltip
                      message={VERIFY_TOOLTIP_MESSAGE}
                      position="top"
                      width={360}
                      align="end"
                    />
                  </div>
                )
              }
              sectionRightPointerEvents="auto"
              sectionRightWidth={contactInfo.isPhoneVerified ? 44 : 120}
              // inputStyle={fieldInputStyle}
              onFocus={() => setIsPhoneFieldFocused(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  const activeElement = document.activeElement as HTMLElement | null;
                  if (
                    activeElement?.classList?.contains(styles.phoneCountrySelect) ||
                    activeElement?.closest?.(`.${styles.phoneCountrySection}`)
                  ) {
                    return;
                  }

                  setIsPhoneFieldFocused(false);
                }, 0);
              }}
              onChange={(event) => {
                const nextPhone = sanitizeInternationalPhoneInput(
                  event.target.value,
                  selectedPhoneCountry,
                );
                setSelectedPhoneCountry(inferPhoneCountry(nextPhone));
                setContactInfo((current) => ({
                  ...current,
                  phone: nextPhone,
                  isPhoneVerified:
                    current.isPhoneVerified && current.phone === nextPhone
                      ? current.isPhoneVerified
                      : false,
                }));
              }}
            />
          </Group>

          <div className={styles.addressAutocomplete} ref={addressContainerRef}>
            <Field
              label="Address"
              type="text"
              placeholder="City, Country"
              value={contactInfo.address}
              section={<MarkerPin01 />}
              sectionPosition="left"
              onFocus={() => {
                setIsAddressFocused(true);
                if (
                  !isAddressSelectionLocked &&
                  addressSuggestions.length > 0 &&
                  contactInfo.address.trim().length >= 2
                ) {
                  setIsAddressDropdownOpen(true);
                }
              }}
              onChange={(event) =>
                setContactInfo((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              onInput={() => {
                setIsAddressSelectionLocked(false);
              }}
            />
            {isAddressDropdownOpen && (
              <div className={styles.addressDropdown}>
                {isAddressLoading ? (
                  <div className={styles.addressDropdownState}>Searching locations...</div>
                ) : addressSuggestions.length > 0 ? (
                  addressSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className={styles.addressSuggestion}
                      onClick={() => {
                        setContactInfo((current) => ({
                          ...current,
                          address: suggestion.displayName,
                        }));
                        setIsAddressSelectionLocked(true);
                        setIsAddressDropdownOpen(false);
                      }}
                    >
                      <span className={styles.addressSuggestionFull}>
                        {suggestion.displayName}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className={styles.addressDropdownState}>No locations found.</div>
                )}
              </div>
            )}
          </div>

          <Field
            label="LinkedIn"
            type="text"
            placeholder="your-profile"
            value={normalizeLinkedIn(contactInfo.linkedin)}
            section={
              <span className={styles.linkedinPrefix}>https://linkedin.com/in/</span>
            }
            sectionPosition="left"
            sectionDivider
            // inputStyle={fieldInputStyle}
            onChange={(event) =>
              setContactInfo((current) => ({
                ...current,
                linkedin: event.target.value,
              }))
            }
          />

          <div className={styles.websitesSection}>
            <p className={styles.groupLabel}>Websites</p>

            <div className={styles.websiteList}>
              {contactInfo.websites.map((website, index) => (
                <div key={website.id} className={styles.websiteRow}>
                  <Field
                    label={index === 0 ? "URL" : undefined}
                    type="url"
                    placeholder="https://example.com"
                    value={website.url}
                    // inputStyle={fieldInputStyle}
                    onChange={(event) =>
                      updateWebsite(website.id, "url", event.target.value)
                    }
                  />
                  <Select
                    label={index === 0 ? "Type" : undefined}
                    data={websiteTypeOptions}
                    placeholder="Select type"
                    value={website.type || null}
                    onChange={(value) => updateWebsite(website.id, "type", value || "")}
                  />
                  {contactInfo.websites.length > 1 ? (
                    <div className={styles.removeAction}>
                      <Button
                        label={undefined}
                        variant="secondary"
                        iconJsx={<Trash01 color="#667085"/>}
                        onClick={() => removeWebsite(website.id)}
                      />
                    </div>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>

            <Button
              label="Add website"
              variant="secondary"
              iconJsx={<PlusCircle color="#667085" />}
              onClick={addWebsite}
              style={{ alignSelf: "flex-start" }}
              pill
            />
          </div>
        </div>

        <div className={`${styles.footer} ${styles.footerRight}`}>
          <div className={styles.actions}>
            <Button
              label="Cancel"
              variant="secondary"
              pill
              onClick={handleClose}
            />
            <Button label="Save" variant="primary" pill onClick={handleSave} />
          </div>
        </div>
      </div>
      </Modal>
    </>
  );
}
