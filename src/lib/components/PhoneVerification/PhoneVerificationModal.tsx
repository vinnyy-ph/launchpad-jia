"use client";

import { useEffect, useState } from "react";
import PasscodeInput from "@/lib/components/CandidateProfileComponents/PasscodeInput";
import Button from "@/lib/components/ui/button/Button";
import Field from "@/lib/components/ui/field/Field";
import Modal from "@/lib/components/ui/modal/Modal";
import styles from "@/lib/styles/screens/jobOpenings.module.scss";
import { assetConstants } from "@/lib/utils/constantsV2";
import {
  PHONE_COUNTRY_OPTIONS,
  type SupportedPhoneCountry,
  applyCountryDialCode,
  inferPhoneCountry,
  sanitizeInternationalPhoneInput,
} from "@/lib/utils/phoneInput";
import { Phone01 } from "@untitledui/icons";

type PhoneVerificationStep = "phone" | "otp";

type PhoneVerificationModalProps = {
  opened: boolean;
  onClose: () => void;
  onBack?: () => void;
  step: PhoneVerificationStep;
  organizationLogo?: string | null;
  organizationName?: string | null;
  showRequirementSubtitle?: boolean;
  mobileNumber: string;
  mobileNumberError?: string;
  onMobileNumberChange: (value: string) => void;
  isRequestingOtp: boolean;
  onNext: () => void;
  maskedMobileNumber: string;
  otpError: string | null;
  otpCountdown: number;
  onOtpDigitChange: (index: number, digit: string) => void;
  onOtpComplete: (code: string) => void;
  onResendOtp: () => void;
  isVerifyingOtp: boolean;
  onVerifyOtp: () => void;
};

function formatOtpCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getMaskedMobileNumber(number: string) {
  const trimmedNumber = `${number || ""}`.trim();
  const visibleDigits = trimmedNumber.replace(/\D/g, "");

  if (visibleDigits.length < 4) {
    return trimmedNumber;
  }

  const lastFourDigits = visibleDigits.slice(-4);
  const hasPlusPrefix = trimmedNumber.startsWith("+");
  const countryCodeLength = visibleDigits.length > 10 ? visibleDigits.length - 10 : 0;
  const countryCodePrefix = hasPlusPrefix
    ? `+${visibleDigits.slice(0, countryCodeLength)}`.trim()
    : "";

  return `${countryCodePrefix ? `${countryCodePrefix} ` : ""}*** *** ${lastFourDigits}`.trim();
}

export default function PhoneVerificationModal({
  opened,
  onClose,
  onBack,
  step,
  organizationLogo,
  organizationName,
  showRequirementSubtitle = true,
  mobileNumber,
  mobileNumberError = "",
  onMobileNumberChange,
  isRequestingOtp,
  onNext,
  maskedMobileNumber,
  otpError,
  otpCountdown,
  onOtpDigitChange,
  onOtpComplete,
  onResendOtp,
  isVerifyingOtp,
  onVerifyOtp,
}: PhoneVerificationModalProps & { onBack?: () => void }) {
  const [selectedCountry, setSelectedCountry] = useState<SupportedPhoneCountry>("PH");

  useEffect(() => {
    setSelectedCountry(inferPhoneCountry(mobileNumber));
  }, [mobileNumber]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size={step === "otp" ? 520 : 436}
      radius={24}
      overlayProps={{ blur: 6, opacity: 0.2 }}
      withCloseButton={false}
      classNames={{
        body: styles.phoneVerificationModalBody,
        content: styles.phoneVerificationModalContent,
      }}
    >
      <div className={styles.phoneVerificationForm}>
        <button
          type="button"
          className={styles.phoneVerificationModalCloseButton}
          onClick={onClose}
          aria-label="Close mobile verification modal"
        >
          <span aria-hidden>×</span>
        </button>

        {step === "phone" ? (
          <>
            <div className={styles.phoneVerificationIntro}>
              <div className={styles.phoneVerificationLogo}>
                <img alt="" src={organizationLogo || assetConstants.jiaLogo2} />
              </div>

              <div className={styles.phoneVerificationCopy}>
                <span className={styles.phoneVerificationHeading}>
                  Please enter and verify your mobile number
                </span>
                {showRequirementSubtitle ? (
                  <span className={styles.phoneVerificationSubtitle}>
                    {(`${organizationName || "This company"}` +
                      " requires all its applicants to have a verified mobile number.")}
                  </span>
                ) : null}
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
                <span className={styles.phoneVerificationCountryCode}>
                  <select
                    aria-label="Phone country"
                    className={styles.phoneVerificationCountrySelect}
                    value={selectedCountry}
                    onChange={(event) => {
                      const nextCountry = event.target.value as SupportedPhoneCountry;
                      setSelectedCountry(nextCountry);
                      onMobileNumberChange(
                        applyCountryDialCode(mobileNumber, nextCountry),
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
              onChange={(event) => {
                onMobileNumberChange(
                  sanitizeInternationalPhoneInput(
                    event.target.value,
                    selectedCountry,
                  ),
                );
              }}
            />
            <div className={styles.phoneVerificationActions}>
              <Button
                label="Cancel"
                variant="secondary"
                pill
                onClick={onClose}
                disabled={isRequestingOtp}
                style={{ width: "100%" }}
              />
              <Button
                label={isRequestingOtp ? "Sending..." : "Next"}
                variant="primary"
                pill
                onClick={onNext}
                disabled={isRequestingOtp}
                style={{ width: "100%" }}
              />
            </div>
          </>
        ) : (
          <>
            <div className={styles.phoneVerificationOtpIntro}>
              <div className={styles.phoneVerificationIcon}>
                <Phone01 />
              </div>

              <div className={styles.phoneVerificationCopy}>
                <span className={styles.phoneVerificationHeading}>
                  Verify your mobile number
                </span>
                <span className={styles.phoneVerificationSubtitle}>
                  We&apos;ve sent a 6-digit verification code to{" "}
                  <br />
                  <span className={styles.phoneVerificationMaskedNumber}>
                    {maskedMobileNumber || getMaskedMobileNumber(mobileNumber)}
                  </span>
                </span>
              </div>
            </div>

            <div className={styles.phoneVerificationOtpSection}>
              <div className={styles.phoneVerificationOtpInputs}>
                <PasscodeInput
                  error={otpError || undefined}
                  onDigitChange={onOtpDigitChange}
                  onComplete={onOtpComplete}
                  placeholder="0"
                />
              </div>

              <span className={styles.phoneVerificationOtpHint}>
                It may take up to 2 minutes for the code to arrive.
              </span>

              {otpError && (
                <span className={styles.phoneVerificationOtpError}>{otpError}</span>
              )}

              <div className={styles.phoneVerificationResend}>
                <span>Didn&apos;t receive a code?</span>
                {otpCountdown > 0 ? (
                  <span className={styles.phoneVerificationResendTimer}>
                    Resend in {formatOtpCountdown(otpCountdown)}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.phoneVerificationResendButton}
                    onClick={onResendOtp}
                    disabled={isRequestingOtp}
                  >
                    {isRequestingOtp ? "Sending..." : "Resend code"}
                  </button>
                )}
              </div>
            </div>

            <div className={styles.phoneVerificationActions}>
              {onBack && (
                <Button
                  label="Back"
                  variant="secondary"
                  pill
                  onClick={onBack}
                  disabled={isVerifyingOtp}
                  style={{ width: "100%" }}
                />
              )}
              <Button
                label={isVerifyingOtp ? "Verifying..." : "Verify"}
                variant="primary"
                pill
                onClick={onVerifyOtp}
                disabled={isVerifyingOtp}
                style={{ width: "100%" }}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
