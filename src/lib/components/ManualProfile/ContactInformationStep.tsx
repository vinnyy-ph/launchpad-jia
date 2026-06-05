"use client";

import { useState } from "react";
import { Field, Group } from "@/lib/components/ui";
import { MarkerPin01 } from "@untitledui/icons";
import { assetConstants } from "@/lib/utils/constantsV2";
import {
  PHONE_COUNTRY_OPTIONS,
  type SupportedPhoneCountry,
  applyCountryDialCode,
  inferPhoneCountry,
  sanitizeInternationalPhoneInput,
} from "@/lib/utils/phoneInput";
import ManualPhoneVerifyModal from "./ManualPhoneVerifyModal";
import styles from "./manual-profile.module.scss";

export interface ContactStepValue {
  firstName: string;
  lastName: string;
  middleInitial: string;
  email: string;
  phone: string;
  isPhoneVerified: boolean;
  address: string;
}

export function createEmptyContact(email = ""): ContactStepValue {
  return {
    firstName: "",
    lastName: "",
    middleInitial: "",
    email,
    phone: "",
    isPhoneVerified: false,
    address: "",
  };
}

interface ContactInformationStepProps {
  value: ContactStepValue;
  onChange: (value: ContactStepValue) => void;
  /** When true the Google email is locked (read-only), matching the design. */
  lockEmail?: boolean;
}

export default function ContactInformationStep({
  value,
  onChange,
  lockEmail = true,
}: ContactInformationStepProps) {
  const [country, setCountry] = useState<SupportedPhoneCountry>(() =>
    inferPhoneCountry(value.phone),
  );
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);

  function patch(partial: Partial<ContactStepValue>) {
    onChange({ ...value, ...partial });
  }

  const phoneCountrySection = (
    <span className={styles.phoneCountry}>
      <select
        aria-label="Phone country"
        value={country}
        onChange={(event) => {
          const next = event.target.value as SupportedPhoneCountry;
          setCountry(next);
          const nextPhone = applyCountryDialCode(value.phone, next);
          patch({
            phone: nextPhone,
            isPhoneVerified: value.isPhoneVerified && value.phone === nextPhone,
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
  );

  return (
    <>
      <ManualPhoneVerifyModal
        opened={isVerifyOpen}
        onClose={() => setIsVerifyOpen(false)}
        initialPhone={value.phone}
        onVerified={(verifiedPhone) => {
          const normalized = sanitizeInternationalPhoneInput(verifiedPhone);
          setCountry(inferPhoneCountry(normalized));
          patch({ phone: normalized, isPhoneVerified: true });
        }}
      />

      <div className={styles.fields}>
        <Field
          label="First Name"
          withAsterisk
          placeholder="First name"
          value={value.firstName}
          onChange={(event) => patch({ firstName: event.target.value })}
        />

        <Group grow align="flex-start">
          <Field
            label="Last Name"
            withAsterisk
            placeholder="Last name"
            value={value.lastName}
            onChange={(event) => patch({ lastName: event.target.value })}
          />
          <Field
            label="Middle Initial"
            withAsterisk
            placeholder="M.I."
            value={value.middleInitial}
            onChange={(event) => patch({ middleInitial: event.target.value })}
          />
        </Group>

        <Group grow align="flex-start">
          <Field
            label={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Email
                <img
                  alt=""
                  src="/icons/help-circle.svg"
                  style={{ width: 16, height: 16 }}
                />
              </span>
            }
            withAsterisk
            type="email"
            placeholder="your.email@example.com"
            value={value.email}
            disabled={lockEmail}
            onChange={(event) => patch({ email: event.target.value })}
          />
          <Field
            label="Mobile Number"
            type="tel"
            inputMode="numeric"
            placeholder="+63 987 654 3210"
            value={value.phone}
            sectionLeft={phoneCountrySection}
            sectionDivider
            sectionWidth={68}
            sectionPointerEvents="auto"
            sectionRight={
              value.isPhoneVerified ? (
                <img
                  className={styles.verifiedTick}
                  alt="Verified"
                  src={assetConstants.verifiedTick}
                />
              ) : (
                <button
                  type="button"
                  className={styles.verifyButton}
                  onClick={() => setIsVerifyOpen(true)}
                >
                  Verify
                </button>
              )
            }
            sectionRightPointerEvents="auto"
            sectionRightWidth={value.isPhoneVerified ? 44 : 96}
            disabled={value.isPhoneVerified}
            onChange={(event) => {
              const nextPhone = sanitizeInternationalPhoneInput(
                event.target.value,
                country,
              );
              setCountry(inferPhoneCountry(nextPhone));
              patch({
                phone: nextPhone,
                isPhoneVerified: value.isPhoneVerified && value.phone === nextPhone,
              });
            }}
          />
        </Group>

        <div>
          <Field
            label="Address"
            withAsterisk
            placeholder="123 Street, City, Country"
            value={value.address}
            sectionLeft={<MarkerPin01 width={18} height={18} color="#717680" />}
            sectionWidth={40}
            onChange={(event) => patch({ address: event.target.value })}
          />
          <button type="button" className={styles.manualAddressLink}>
            Enter address manually (optional)
          </button>
        </div>
      </div>
    </>
  );
}
