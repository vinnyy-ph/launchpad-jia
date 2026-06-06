"use client";

import { useState } from "react";
import { Field, Group, Tooltip } from "@/lib/components/ui";
import { MarkerPin01 } from "@untitledui/icons";
import { assetConstants } from "@/lib/utils/constantsV2";
import {
  type AddressParts,
  composeAddress,
  createEmptyAddressParts,
} from "@/lib/utils/addressFormat";
import {
  PHONE_COUNTRY_OPTIONS,
  type SupportedPhoneCountry,
  applyCountryDialCode,
  formatNationalNumber,
  inferPhoneCountry,
  maxNationalDigits,
  sanitizeInternationalPhoneInput,
} from "@/lib/utils/phoneInput";
import CountrySelect from "./CountrySelect";
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
  addressManual: boolean;
  addressParts: AddressParts;
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
    addressManual: false,
    addressParts: createEmptyAddressParts(),
  };
}

interface ContactInformationStepProps {
  value: ContactStepValue;
  onChange: (value: ContactStepValue) => void;
  /** When true the Google email is locked (read-only), matching the design. */
  lockEmail?: boolean;
  errors?: Record<string, string>;
  onFieldBlur?: (key: string) => void;
}

export default function ContactInformationStep({
  value,
  onChange,
  lockEmail = true,
  errors,
  onFieldBlur,
}: ContactInformationStepProps) {
  const [country, setCountry] = useState<SupportedPhoneCountry>(() =>
    inferPhoneCountry(value.phone),
  );
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [manualMode, setManualMode] = useState<boolean>(value.addressManual);
  const [addressParts, setAddressParts] = useState<AddressParts>(value.addressParts);

  function toggleManualMode() {
    const next = !manualMode;
    setManualMode(next);
    // Flip the persisted flag only; never recompose here so a freeform
    // address typed in the single line is not wiped on toggle.
    patch({ addressManual: next });
  }

  function updateAddressPart(key: keyof AddressParts, partValue: string) {
    const nextParts = { ...addressParts, [key]: partValue };
    setAddressParts(nextParts);
    patch({
      address: composeAddress(nextParts),
      addressParts: nextParts,
      addressManual: manualMode,
    });
  }

  function patch(partial: Partial<ContactStepValue>) {
    onChange({ ...value, ...partial });
  }

  // The dial code (e.g. +63) is a fixed, bold prefix driven by the country
  // selector; the editable input holds only the national number. The full
  // E.164 value is kept in value.phone for validation + submission.
  const dialCode =
    PHONE_COUNTRY_OPTIONS.find((option) => option.code === country)?.dialCode ?? "+63";
  const dialDigits = dialCode.replace(/^\+/, "");
  const phoneDigits = value.phone.replace(/\D/g, "");
  const nationalNumber = phoneDigits.startsWith(dialDigits)
    ? phoneDigits.slice(dialDigits.length)
    : phoneDigits;
  const emailTooltip = lockEmail
    ? "This is the email linked to your Google sign-in, so it can't be changed here."
    : "We'll use this email to keep your application linked to your account and to reach you.";

  function handleCountryChange(next: SupportedPhoneCountry) {
    setCountry(next);
    const nextPhone = applyCountryDialCode(value.phone, next);
    patch({
      phone: nextPhone,
      isPhoneVerified: value.isPhoneVerified && value.phone === nextPhone,
    });
  }

  const phoneCountrySection = (
    <span
      className={`${styles.phoneCountry}${
        value.isPhoneVerified ? ` ${styles.phoneCountryDisabled}` : ""
      }`}
    >
      <CountrySelect
        value={country}
        onChange={handleCountryChange}
        disabled={value.isPhoneVerified}
      />
      <span className={styles.phoneDial}>{dialCode}</span>
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
          size="sm"
          placeholder="First name"
          value={value.firstName}
          error={errors?.firstName}
          onBlur={() => onFieldBlur?.("firstName")}
          onChange={(event) => patch({ firstName: event.target.value })}
        />

        <Group grow gap={24} align="flex-start">
          <Field
            label="Last Name"
            withAsterisk
            size="sm"
            placeholder="Last name"
            value={value.lastName}
            error={errors?.lastName}
            onBlur={() => onFieldBlur?.("lastName")}
            onChange={(event) => patch({ lastName: event.target.value })}
          />
          <Field
            label="Middle Initial"
            withAsterisk
            size="sm"
            placeholder="M.I."
            value={value.middleInitial}
            error={errors?.middleInitial}
            onBlur={() => onFieldBlur?.("middleInitial")}
            onChange={(event) => patch({ middleInitial: event.target.value })}
          />
        </Group>

        <Group grow gap={24} align="flex-start">
          <Field
            label="Email"
            withAsterisk
            size="sm"
            type="email"
            placeholder="your.email@example.com"
            value={value.email}
            disabled={lockEmail}
            sectionRight={
              <Tooltip
                message={emailTooltip}
                position="top"
                width={248}
                align="end"
              />
            }
            sectionRightWidth={40}
            sectionRightPointerEvents="auto"
            error={errors?.email}
            onBlur={() => onFieldBlur?.("email")}
            onChange={(event) => patch({ email: event.target.value })}
          />
          <Field
            label="Mobile number"
            withAsterisk
            size="sm"
            type="tel"
            inputMode="numeric"
            placeholder="987 654 3210"
            value={formatNationalNumber(nationalNumber, country)}
            sectionLeft={phoneCountrySection}
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
            error={errors?.phone}
            onBlur={() => onFieldBlur?.("phone")}
            onChange={(event) => {
              const nationalDigits = event.target.value
                .replace(/\D/g, "")
                .slice(0, maxNationalDigits(country));
              const nextPhone = sanitizeInternationalPhoneInput(
                `${dialCode}${nationalDigits}`,
                country,
              );
              patch({
                phone: nextPhone,
                isPhoneVerified: value.isPhoneVerified && value.phone === nextPhone,
              });
            }}
          />
        </Group>

        <div className={styles.addressBlock}>
          {!manualMode ? (
            <Field
              label="Address"
              withAsterisk
              size="sm"
              placeholder="Search address"
              value={value.address}
              sectionLeft={<MarkerPin01 width={20} height={20} color="#717680" />}
              sectionWidth={40}
              error={errors?.address}
              onBlur={() => onFieldBlur?.("address")}
              onChange={(event) => patch({ address: event.target.value })}
            />
          ) : (
            <div className={styles.addressManualFields}>
              <Field
                label="Street Address"
                withAsterisk
                size="sm"
                placeholder="House/Unit no., street, barangay"
                value={addressParts.street}
                error={errors?.street}
                onBlur={() => onFieldBlur?.("street")}
                onChange={(event) => updateAddressPart("street", event.target.value)}
              />
              <Group grow align="flex-start">
                <Field
                  label="City / Municipality"
                  withAsterisk
                  size="sm"
                  placeholder="City"
                  value={addressParts.city}
                  error={errors?.city}
                  onBlur={() => onFieldBlur?.("city")}
                  onChange={(event) => updateAddressPart("city", event.target.value)}
                />
                <Field
                  label="Province / Region"
                  size="sm"
                  placeholder="Province"
                  value={addressParts.province}
                  onChange={(event) => updateAddressPart("province", event.target.value)}
                />
              </Group>
              <Group grow align="flex-start">
                <Field
                  label="Postal Code"
                  size="sm"
                  placeholder="Postal code"
                  value={addressParts.postal}
                  onChange={(event) => updateAddressPart("postal", event.target.value)}
                />
                <Field
                  label="Country"
                  withAsterisk
                  size="sm"
                  placeholder="Country"
                  value={addressParts.country}
                  error={errors?.country}
                  onBlur={() => onFieldBlur?.("country")}
                  onChange={(event) => updateAddressPart("country", event.target.value)}
                />
              </Group>
            </div>
          )}
          <button
            type="button"
            className={styles.manualAddressLink}
            onClick={toggleManualMode}
          >
            {manualMode ? "Use a single line instead" : "Enter address manually (optional)"}
          </button>
        </div>
      </div>
    </>
  );
}
