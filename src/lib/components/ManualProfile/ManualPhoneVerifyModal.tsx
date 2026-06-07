"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Modal } from "@/lib/components/ui";
import CountrySelect from "./CountrySelect";
import OtpInput from "./OtpInput";
import { usePasscodeValue } from "@/lib/hooks/usePasscodeValue";
import { assetConstants } from "@/lib/utils/constantsV2";
import {
  type SupportedPhoneCountry,
  applyCountryDialCode,
  buildPhoneFromNationalInput,
  extractNationalNumber,
  formatNationalNumber,
  getDialCode,
  inferPhoneCountry,
  isStrictInternationalPhone,
  sanitizeInternationalPhoneInput,
} from "@/lib/utils/phoneInput";
import { Phone01 } from "@untitledui/icons";
import styles from "./manual-profile.module.scss";

// Frontend-only mobile verification flow for the manual profile builder.
// No SMS / Firebase is involved: any 6-digit code is accepted. This intentionally
// mirrors the Figma flow (phone -> otp -> verifying -> confirm) without the paid
// verification backend.

type VerifyStep = "phone" | "otp" | "verifying" | "confirm";

const RESEND_SECONDS = 105;

interface ManualPhoneVerifyModalProps {
  opened: boolean;
  onClose: () => void;
  initialPhone?: string;
  onVerified: (verifiedPhone: string) => void;
}

function maskNumber(value: string) {
  const digits = `${value || ""}`.replace(/\D/g, "");
  if (digits.length < 4) return value;
  const last4 = digits.slice(-4);
  const countryLen = digits.length > 10 ? digits.length - 10 : 0;
  const prefix = countryLen ? `+${digits.slice(0, countryLen)} ` : "";
  return `${prefix}*** *** ${last4}`.trim();
}

function formatCountdown(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ManualPhoneVerifyModal({
  opened,
  onClose,
  initialPhone = "",
  onVerified,
}: ManualPhoneVerifyModalProps) {
  const [step, setStep] = useState<VerifyStep>("phone");
  const [country, setCountry] = useState<SupportedPhoneCountry>("PH");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const { passcode, onDigitChange, onComplete, reset } = usePasscodeValue();
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // (Re)initialise whenever the modal is opened.
  useEffect(() => {
    if (!opened) return;
    const normalized = sanitizeInternationalPhoneInput((initialPhone || "").trim());
    setPhone(normalized);
    setCountry(inferPhoneCountry(normalized));
    setPhoneError("");
    setCountdown(RESEND_SECONDS);
    setStep("phone");
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, initialPhone]);

  // Resend countdown, only while the OTP step is visible.
  useEffect(() => {
    if (!opened || step !== "otp" || countdown <= 0) return;
    const id = window.setTimeout(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [opened, step, countdown]);

  useEffect(() => {
    return () => {
      if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    };
  }, []);

  const isPhoneValid = isStrictInternationalPhone(phone.trim());
  const isOtpComplete = passcode.trim().length === 6;
  const sizeForStep = step === "otp" || step === "verifying" ? 448 : step === "confirm" ? 480 : 436;

  function handleClose() {
    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    onClose();
  }

  function handleNext() {
    if (!isPhoneValid) {
      setPhoneError("Enter a valid number with country code, e.g. +639223334444.");
      return;
    }
    setPhoneError("");
    setCountdown(RESEND_SECONDS);
    reset();
    setStep("otp");
  }

  function handleVerify() {
    // Frontend-only: accept any 6-digit code.
    if (!isOtpComplete) return;
    setStep("verifying");
    verifyTimerRef.current = setTimeout(() => {
      setStep("confirm");
    }, 1300);
  }

  function handleResend() {
    if (countdown > 0) return;
    setCountdown(RESEND_SECONDS);
    reset();
  }

  function handleProceed() {
    onVerified(phone.trim());
    handleClose();
  }

  // Dial code is a fixed bold prefix; the editable input holds only the national
  // number (auto-spaced + capped per country). Full E.164 stays in `phone`.
  const dialCode = getDialCode(country);
  const nationalNumber = extractNationalNumber(phone, country);

  function handleCountryChange(next: SupportedPhoneCountry) {
    setCountry(next);
    setPhone(applyCountryDialCode(phone, next));
  }

  const renderCountrySection = (disabled: boolean) => (
    <span className={styles.phoneCountry}>
      <CountrySelect value={country} onChange={handleCountryChange} disabled={disabled} />
      <span className={styles.phoneDial}>{dialCode}</span>
    </span>
  );

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      size={sizeForStep}
      radius={16}
      overlayProps={{ blur: 4, opacity: 0.5 }}
      withCloseButton={false}
    >
      <div className={styles.verifyForm}>
        <button
          type="button"
          className={styles.verifyClose}
          onClick={handleClose}
          aria-label="Close mobile verification"
        >
          <span aria-hidden>×</span>
        </button>

        <div className={styles.verifyIcon}>
          <Phone01 />
        </div>

        {step === "phone" && (
          <>
            <div className={styles.verifyCopy}>
              <span className={styles.verifyHeading}>
                Please enter and verify your Mobile Number
              </span>
            </div>
            <div className={styles.verifyFieldFull}>
              <Field
                label="Mobile Number"
                withAsterisk
                size="sm"
                type="tel"
                inputMode="numeric"
                placeholder="987 654 3210"
                value={formatNationalNumber(nationalNumber, country)}
                error={phoneError || undefined}
                sectionLeft={renderCountrySection(false)}
                sectionDivider
                sectionPointerEvents="auto"
                onChange={(event) => {
                  setPhone(buildPhoneFromNationalInput(event.target.value, country));
                  if (phoneError) setPhoneError("");
                }}
              />
            </div>
            <div className={styles.actionsRow}>
              <Button
                label="Cancel"
                variant="secondary"
                pill
                onClick={handleClose}
                style={{ width: "100%" }}
              />
              <Button
                label="Next"
                variant="primary"
                pill
                onClick={handleNext}
                disabled={!isPhoneValid}
                style={{ width: "100%" }}
              />
            </div>
          </>
        )}

        {(step === "otp" || step === "verifying") && (
          <>
            <div className={styles.verifyCopy}>
              <span className={styles.verifyHeading}>Verify your Mobile Number</span>
              <span className={styles.verifySub}>
                We&apos;ve sent a 6-digit verification code to{" "}
                <br />
                <span className={styles.verifyMasked}>{maskNumber(phone)}</span>
              </span>
            </div>

            {step === "verifying" ? (
              <div className={styles.sparkles} aria-hidden>
                <span>✦</span>
                <span>✦</span>
                <span>✦</span>
              </div>
            ) : (
              <>
                <OtpInput
                  onDigitChange={onDigitChange}
                  onComplete={onComplete}
                  placeholder="0"
                  autoFocus
                />
                <span className={styles.otpHint}>
                  It may take up to 2 minutes for the code to arrive.
                </span>
                <div className={styles.resendRow}>
                  <span>Didn&apos;t receive a code?</span>
                  {countdown > 0 ? (
                    <span className={styles.resendTimer}>
                      Resend in {formatCountdown(countdown)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.resendButton}
                      onClick={handleResend}
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </>
            )}

            <div className={styles.actionsRow}>
              <Button
                label={step === "verifying" ? "Verifying" : "Verify"}
                variant="primary"
                pill
                onClick={handleVerify}
                disabled={step === "verifying"}
                iconJsx={step === "verifying" ? <span className={styles.spinner} /> : undefined}
                style={{ width: "100%", height: 52 }}
              />
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className={styles.verifyCopy}>
              <span className={styles.verifyHeading}>Confirm Contact Details</span>
              <span className={styles.verifySub}>
                Please confirm if your contact details are correct.
              </span>
            </div>
            <div className={styles.verifyConfirmField}>
              <Field
                label="Mobile Number"
                withAsterisk
                size="sm"
                type="tel"
                value={formatNationalNumber(nationalNumber, country)}
                disabled
                sectionLeft={renderCountrySection(true)}
                sectionDivider
                sectionRight={
                  <img
                    className={styles.verifyConfirmBadge}
                    alt="Verified"
                    src={assetConstants.verifiedTick}
                  />
                }
                sectionRightWidth={44}
                readOnly
              />
            </div>
            <div className={styles.actionsRow}>
              <Button
                label="Proceed"
                variant="primary"
                pill
                onClick={handleProceed}
                style={{ width: "100%" }}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
