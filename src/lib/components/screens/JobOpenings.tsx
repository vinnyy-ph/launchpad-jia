// TODO (Job Portal) - Check API

"use client";

import Loader from "@/lib/components/commonV2/Loader";
import styles from "@/lib/styles/screens/jobOpenings.module.scss";
import { useAppContext } from "@/lib/context/ContextV2";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import { processDate } from "@/lib/utils/helpersV2";
import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import Fuse from "fuse.js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { extractSubdomain } from "@/lib/utils/subdomainUtils";
import Badge from "@/lib/components/ui/badge/Badge";
import Button from "@/lib/components/ui/button/Button";
import Field from "@/lib/components/ui/field/Field";
import Group from "@/lib/components/ui/group/Group";
import Modal from "@/lib/components/ui/modal/Modal";
import Toggle from "@/lib/components/ui/toggle/Toggle";
import PhoneVerificationModal from "@/lib/components/PhoneVerification/PhoneVerificationModal";
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
  PlusCircle,
  SearchMd,
  Trash01,
} from "@untitledui/icons";
import { countryCodeMap, isUserInJobCountry } from "@/lib/utils/countryHelper";

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

type JobOpeningsProps = {
  forceDashboardLayout?: boolean;
  hideTopControls?: boolean;
};

export default function ({
  forceDashboardLayout = false,
  hideTopControls = false,
}: JobOpeningsProps = {}) {
  const pathname = usePathname();
  const buttonRef = useRef([]);
  const cardRef = useRef(null);
  const detailsRef = useRef(null);
  const defaultRef = useRef(null);
  const filterContainerRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsValue = searchParams.get("search");
  const [buttons, setButtons] = useState([
    {
      name: "Sort By",
      value: ["Newest"],
      list: ["Newest", "Most Relevant"],
      dropdownWidth: 164,
    },
    {
      name: "Date Posted",
      value: ["Any time"],
      list: ["Any time", "Past month", "Past week", "Past 24 hours"],
      dropdownWidth: 164,
    },
    {
      name: "Location",
      value: [],
      list: [
        "Philippines",
        "Australia",
        "Singapore",
        "United Kingdom",
        "United States of America",
      ],
      dropdownWidth: 255,
      placeholder: "Search location",
    },
    {
      name: "Experience Level",
      value: [],
      list: [
        "Internship",
        "Entry-level",
        "Associate",
        "Mid-Senior Level",
        "Director",
        "Executive",
      ],
      dropdownWidth: 177,
    },
    {
      name: "Company",
      value: [],
      list: [],
      dropdownWidth: 255,
      placeholder: "Search company",
    },
    {
      name: "Work Setup",
      value: [],
      list: ["Remote", "Onsite", "Hybrid"],
      dropdownWidth: 170,
    },
  ]);
  const [buttonPosition, setButtonPosition] = useState(null);
  const [careers, setCareers] = useState([]);
  // const [currentPage, setCurrentPage] = useState(1);
  const [deviceWidth, setDeviceWidth] = useState(0);
  const [dropdownIndex, setDropdownIndex] = useState(null);
  const [filteredCareers, setFilteredCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInputs, setSearchInputs] = useState({});
  const [selectedCareer, setSelectedCareer] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [viewDropdown, setViewdropdown] = useState(false);
  const [orgID, setOrgID] = useState(null);
  const [isNotFound, setIsNotFound] = useState(false);
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
  const isDashboardLayout =
    (pathname == pathConstants.dashboardJobOpenings || forceDashboardLayout) &&
    deviceWidth > 768;
  const {
    modalType,
    user,
    setModalType,
    setOrganizationBranding,
    setHideNavbar,
  } = useAppContext();
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
  // const itemPerPage = 10;

  function getFilteredList(button, indexButton) {
    const query = searchInputs[indexButton] ?? "";

    if (![2, 4].includes(indexButton) || !query.trim()) {
      return button.list;
    }

    const fuse = new Fuse(button.list, {
      threshold: 0.3,
      ignoreLocation: true,
    });
    const results = fuse.search(query);

    return results.map((result) => result.item);
  }

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

  function getCandidateMobileNumber(candidateUser) {
    const mobileNumber = sanitizeInternationalPhoneInput(
      `${candidateUser?.structuredCV?.contactInfo?.phone || ""}`.trim(),
    );
    return mobileNumber;
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

  function handleApply() {
    if (user != null) {
      applyJob();
    } else {
      sessionStorage.setItem("redirectionPath", pathname);
      setModalType("signIn");
    }
  }

  function handleCard(career) {
    if (deviceWidth < 768) {
      sessionStorage.setItem("selectedCareer", JSON.stringify(career));
      handleRedirection(`${pathConstants.jobOpenings}/${career._id}`);
      return null;
    }

    if (selectedCareer && career.id == selectedCareer.id) {
      return null;
    }

    sessionStorage.setItem("selectedCareer", JSON.stringify(career));
    setSelectedCareer(career);
    setViewdropdown(false);

    if (detailsRef.current) {
      detailsRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function handleClearFilter(indexButton) {
    const updatedButtons = [...buttons];
    updatedButtons[indexButton].value = [];

    updateQueryParams(
      updatedButtons[indexButton].name.toLowerCase().replace(" ", ""),
      ""
    );

    setButtons(updatedButtons);
    // setCurrentPage(1);
    setSelectedCareer(null);
    sessionStorage.removeItem("selectedCareer");

    if (defaultRef.current) {
      defaultRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function handleDropdownIndex(index) {
    setButtonPosition(null);
    setDropdownIndex((prev) => (prev == index ? null : index));

    const buttonElement = buttonRef.current[index];
    const filterElement = filterContainerRef.current;

    if (filterElement && buttonElement) {
      let offset = 16;

      if (
        (pathname == pathConstants.dashboardJobOpenings ||
          forceDashboardLayout) &&
        deviceWidth >= 768
      ) {
        offset = 272;
      }

      filterElement.scrollTo({
        left: buttonElement.offsetLeft - offset,
        behavior: "smooth",
      });

      setTimeout(() => {
        setButtonPosition({
          left: buttonElement.getBoundingClientRect().left,
        });
      }, 300);
    }
  }

  // function handlePagination(directionOrPage) {
  //   const totalPages = Math.ceil(filteredCareers.length / itemPerPage);

  //   if (typeof directionOrPage === "number") {
  //     setCurrentPage(directionOrPage);
  //   } else if (directionOrPage === "next" && currentPage < totalPages) {
  //     setCurrentPage((prev) => prev + 1);
  //   } else if (directionOrPage === "prev" && currentPage > 1) {
  //     setCurrentPage((prev) => prev - 1);
  //   }
  // }

  function handleRedirection(path) {
    if (path == pathConstants.whitecloak) {
      window.open(path, "_blank");
      return null;
    }

    window.location.href = path;
  }

  function handleResize() {
    setDeviceWidth(window.innerWidth);
  }

  function handleSelection(item, indexButton) {
    const updatedButtons = [...buttons];
    let currentValues = updatedButtons[indexButton].value;

    if (indexButton > 2) {
      const checboxElement = document.getElementById(item);

      if (checboxElement) {
        checboxElement.click();
      }

      if (currentValues.includes(item)) {
        currentValues = currentValues.filter((i) => i !== item);
      } else {
        currentValues = [...new Set([...currentValues, item])];
      }

      updatedButtons[indexButton].value = currentValues;
    } else {
      if (
        !(
          indexButton == 1 &&
          buttons[1].list[buttons[1].list.length - 1] == item
        )
      ) {
        setDropdownIndex(null);
        updatedButtons[indexButton].value = [item];
      }
    }

    if (indexButton == 2) {
      setSearchInputs((prev) => ({ ...prev, [indexButton]: "" }));
    }

    updateQueryParams(
      updatedButtons[indexButton].name.toLowerCase().replace(" ", ""),
      updatedButtons[indexButton].value.join(",")
    );

    setButtons(updatedButtons);
    // setCurrentPage(1);
    setSelectedCareer(null);
    sessionStorage.removeItem("selectedCareer");

    if (defaultRef.current) {
      defaultRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function updateQueryParams(key, value) {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);

    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.push(`${url.pathname}?${params.toString()}`);
  }

  useEffect(() => {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const subdomain = extractSubdomain(hostname);

    if (subdomain) {
      setOrgID(subdomain);
      fetchCareers(null, subdomain);
    } else {
      setOrgID(null);
      setOrganizationBranding(null);
      fetchCareers(null, null);
    }
    
    handleResize();

    if (user != null) {
      fetchInterviews();
    }

    if (searchParamsValue && searchParamsValue.trim()) {
      sessionStorage.removeItem("selectedCareer");
      setSearch(searchParamsValue.trim());
    } else {
      const storedSelecterCareer = sessionStorage.getItem("selectedCareer");

      if (storedSelecterCareer) {
        setSelectedCareer(JSON.parse(storedSelecterCareer));
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [searchParams]);

  // Auto-detect user's country via IP and set Location filter
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const locationParam = params.get("location");

    // Skip if location is already set via URL params
    if (locationParam) {
      setIsCountryLoading(false);
      return;
    }

    fetch("/api/geo")
      .then((res) => res.json())
      .then((data) => {
        if (data.country_code) {
          const countryCode = data.country_code;
          const updatedButtons = [...buttons];

          // Check if detected country code is in the mapping
          const matchedCountry = countryCodeMap[countryCode];

          // Store the user's country code for later use
          setUserCountryCode(countryCode);

          if (matchedCountry) {
            updatedButtons[2].value = [matchedCountry];
          } else {
            // Default to Philippines if country not in list
            updatedButtons[2].value = ["Philippines"];
          }

          setButtons(updatedButtons);
        }
      })
      .catch((err) => {
        console.error("Error detecting country:", err);
        // Default to Philippines on error
        const updatedButtons = [...buttons];
        updatedButtons[2].value = ["Philippines"];
        setButtons(updatedButtons);
      })
      .finally(() => {
        setIsCountryLoading(false);
      });
  }, []);

  useEffect(() => {
    setButtonPosition(null);
    setDropdownIndex(null);
  }, [deviceWidth]);

  useEffect(() => {
    if (!loading && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [loading]);

  useEffect(() => {
    const location = sessionStorage.getItem("location");

    if (location) {
      sessionStorage.removeItem("location");
      const updatedButtons = [...buttons];
      updatedButtons[2].value = [location];
      setButtons(updatedButtons);
      setDropdownIndex(null);
    }
  }, [modalType]);

  useEffect(() => {
    // Reset navbar visibility when not found state changes to false
    if (!isNotFound) {
      setHideNavbar(false);
    }
  }, [isNotFound]);

  useEffect(() => {
    // Cleanup: reset navbar visibility when component unmounts
    return () => {
      setHideNavbar(false);
    };
  }, []);

  useEffect(() => {
    const filters = {};
    let filteredCareers = [...careers];

    buttons.forEach((item) => {
      filters[item.name] = item.value;
    });

    if (search.trim()) {
      const fuse = new Fuse(filteredCareers, {
        threshold: 0.2,
        keys: ["jobTitle", "description"],
      });
      const searchResults = fuse.search(search.trim());

      filteredCareers = searchResults.map((res) => res.item);
    }

    if (filters[buttons[0].name][0] == buttons[0].list[0]) {
      filteredCareers.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    if (filters[buttons[0].name][0] == buttons[0].list[1]) {
      filteredCareers.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    if (
      filters[buttons[1].name].length > 0 &&
      filters[buttons[1].name][0] != buttons[1].list[0]
    ) {
      const now = new Date().getTime();
      const datePosted = filters[buttons[1].name][0];
      const datePostedFilters = buttons[1].list;

      let timeAgo = now;

      if (datePosted === datePostedFilters[1]) {
        timeAgo = now - 30 * 24 * 60 * 60 * 1000;
      }

      if (datePosted === datePostedFilters[2]) {
        timeAgo = now - 7 * 24 * 60 * 60 * 1000;
      }

      if (datePosted === datePostedFilters[3]) {
        timeAgo = now - 24 * 60 * 60 * 1000;
      }

      filteredCareers = filteredCareers.filter((career) => {
        const createdAt = new Date(career.createdAt).getTime();
        return createdAt >= timeAgo;
      });
    }

    if (filters[buttons[2].name].length > 0) {
      const selectedCountryName = filters[buttons[2].name][0];
      const selectedCountryCode = Object.keys(countryCodeMap).find(
        (key) => countryCodeMap[key] === selectedCountryName
      );

      filteredCareers = filteredCareers.filter((career) => {
        if (career.globalHiringEnabled) return true;

        if (selectedCountryCode && career.locationCountryCode) {
          const stored = career.locationCountryCode.trim().toUpperCase();
          const expected = selectedCountryCode.toUpperCase();
          if (stored === expected) return true;
          const resolvedKey = Object.keys(countryCodeMap).find(
            (k) =>
              k.toUpperCase() === stored ||
              countryCodeMap[k].toUpperCase() === stored
          );
          if (resolvedKey) return resolvedKey.toUpperCase() === expected;
        }

        if (selectedCountryName && career.country) {
          return career.country
            .toLowerCase()
            .includes(selectedCountryName.toLowerCase());
        }

        return false;
      });
    }

    if (filters[buttons[4].name].length > 0) {
      filteredCareers = filteredCareers.filter((career) =>
        filters[buttons[4].name].includes(career.organization.name)
      );
    }

    if (filters[buttons[5].name].length > 0) {
      filteredCareers = filteredCareers.filter((career) => {
        return filters[buttons[5].name].some(
          (setup) =>
            career.workSetup &&
            career.workSetup.toLowerCase().includes(setup.toLowerCase())
        );
      });
    }

    setFilteredCareers(filteredCareers);
  }, [buttons, careers, search]);

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

  function fetchCareers(orgIDParam = null, subdomainParam = null) {
    axios({
      method: "POST",
      url: "/api/job-portal/fetch-careers",
      data: { jobID: "all", orgID: orgIDParam, email: user?.email || null },
      headers: subdomainParam ? { 'x-org-subdomain': subdomainParam } : {},
    })
      .then((res) => {
        const result = res.data;
        
        if (result.error) {
           if (subdomainParam) {
              // DISABLED FOR OPERATIONAL SAFETY
              // setIsNotFound(true);
              // setHideNavbar(true);
              // return;
           }
        }

        const organization: any = [
          ...new Set(result.map((item) => item.organization.name)),
        ];
        const updatedButtons = [...buttons];
        updatedButtons[4].list = organization;

        if (subdomainParam && result.length > 0) {
          const firstCareer = result[0];
          
          if (firstCareer.organization?.brandedPortalEnabled && firstCareer.organization?.image) {
            setOrganizationBranding({
              enabled: true,
              logo: firstCareer.organization.image,
              name: firstCareer.organization.name,
            });
            document.title = `${firstCareer.organization.name} Job Portal`;
          } else {
            // DISABLED FOR OPERATIONAL SAFETY
            // setIsNotFound(true);
            // setHideNavbar(true);
            // return;
          }
        }

        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        const queryParams = {};
        const deleteKeys = [];

        for (const [key, value] of params.entries()) {
          if (queryParams[key]) {
            queryParams[key].push(...value.trim().split(","));
          } else {
            queryParams[key] = [...value.trim().split(",")];
          }
        }

        for (const key in queryParams) {
          if (
            Array.isArray(queryParams[key]) &&
            queryParams[key].length == 1 &&
            !queryParams[key][0].trim()
          ) {
            deleteKeys.push(key);
            delete queryParams[key];
          }
        }

        if (deleteKeys.length > 0) {
          deleteKeys.forEach((key) => {
            params.delete(key);
          });
        }

        router.replace(`${url.pathname}?${params.toString()}`);

        if (Object.keys(queryParams).length) {
          updatedButtons.forEach((button) => {
            const key = button.name.toLowerCase().replace(" ", "");
            const selectedValues = queryParams[key];

            if (selectedValues) {
              button.value = selectedValues;
            }
          });
        }

        setButtons(updatedButtons);
        setCareers(result);
        setFilteredCareers(result);
      })
      .catch((err) => {
        // Handle 404 explicitly if axios throws
        if (err.response && err.response.status === 404 && subdomainParam) {
           // DISABLED FOR OPERATIONAL SAFETY
           // setIsNotFound(true);
           // setHideNavbar(true);
           // return;
        }

        alert("Error on fetching careers.");
        console.log(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function fetchInterviews() {
    api.post("/api/job-portal/fetch-interviews", { 
      email: user.email, interviewID: "all"
    })
      .then((res) => {
        const result = res.data;

        setInterviews(result);
      })
      .catch((err) => {
        alert("Error fetching existing application.");
        console.log(err);
      });
  }

  // DISABLED FOR OPERATIONAL SAFETY
  // if (isNotFound) {
  //   return (
  //     <div className={styles.notFoundContainer}>
  //       <img 
  //         alt="Jia Logo" 
  //         src={assetConstants.jia} 
  //         onContextMenu={(e) => e.preventDefault()}
  //       />
  //       <h1>Organization Not Found</h1>
  //       <p>The organization you are looking for does not exist or the URL is incorrect.</p>
  //       <Button 
  //         label="Go to Job Portal"
  //         variant="primary"
  //         onClick={() => {
  //            const protocol = window.location.protocol;
  //            const port = window.location.port ? `:${window.location.port}` : '';
  //            const parts = window.location.hostname.split('.');
  //            if (parts.length > 1) {
  //               const newHost = parts.length > 2 ? parts.slice(1).join('.') : parts[parts.length-1];
  //               window.location.href = `${protocol}//${newHost}${port}/job-openings`;
  //            } else {
  //               window.location.href = '/job-openings';
  //            }
  //         }}
  //       />
  //     </div>
  //   );
  // }

  return (
    <div
      className={`${styles.jobOpeningsContainer} ${
        isDashboardLayout ? styles.dashboard : ""
      } ${hideTopControls ? styles.hideTopControls : ""}`}
    >
      <PhoneVerificationModal
        opened={
          isPhoneVerificationModalOpen &&
          (phoneVerificationStep === "phone" || phoneVerificationStep === "otp")
        }
        onClose={closePhoneVerificationModal}
        onBack={handleBackToPhone}
        step={phoneVerificationStep === "otp" ? "otp" : "phone"}
        organizationLogo={selectedCareer?.organization?.image}
        organizationName={selectedCareer?.organization?.name}
        mobileNumber={mobileNumber}
        mobileNumberError={mobileNumberError}
        onMobileNumberChange={(value) => {
          setMobileNumber(
            sanitizeInternationalPhoneInput(
              value,
              inferPhoneCountry(mobileNumber),
            ),
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
        opened={isPhoneVerificationModalOpen && phoneVerificationStep === "contact"}
        onClose={closePhoneVerificationModal}
        centered
        size={620}
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
            onClick={closePhoneVerificationModal}
            aria-label="Close mobile verification modal"
          >
            <span aria-hidden>×</span>
          </button>
          <>
            <div className={styles.phoneVerificationContactIntro}>
                <span className={styles.phoneVerificationContactHeading}>
                  Confirm Contact Details
                </span>
                <span className={styles.phoneVerificationContactSubtitle}>
                  Please confirm if your contact details are correct.
                </span>
              </div>

              <div className={styles.phoneVerificationContactSection}>
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

                <div className={styles.phoneVerificationContactBlock}>
                  {contactForm.additionalEmails.length > 0 ? (
                    <>
                      <div className={styles.phoneVerificationContactLabelRow}>
                        <span className={styles.phoneVerificationContactLabel}>
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
                      <div className={styles.phoneVerificationPrimaryToggleRow}>
                        <Toggle checked disabled onChange={() => {}} />
                        <span>Set as primary email</span>
                      </div>

                      {contactForm.additionalEmails.map((emailValue, index) => (
                        <div
                          key={`additional-email-${index}`}
                          className={styles.phoneVerificationSecondaryContactRow}
                        >
                          <div className={styles.phoneVerificationSecondaryContactBody}>
                            <div className={styles.phoneVerificationContactLabelRow}>
                              <span className={styles.phoneVerificationContactLabel}>
                                Email
                              </span>
                            </div>
                            <div className={styles.phoneVerificationSecondaryInputRow}>
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
                              className={styles.phoneVerificationPrimaryToggleRow}
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

                <div className={styles.phoneVerificationContactDivider} />

                <div className={styles.phoneVerificationContactBlock}>
                  {contactForm.additionalMobileNumbers.length > 0 ? (
                    <>
                      <div className={styles.phoneVerificationContactLabelRow}>
                        <span className={styles.phoneVerificationContactLabel}>
                          Mobile number
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
                        placeholder="+639876543210"
                        readOnly
                        sectionLeft={
                          <span className={styles.phoneVerificationCountryCode}>
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
                      <div className={styles.phoneVerificationPrimaryToggleRow}>
                        <Toggle checked disabled onChange={() => {}} />
                        <span>Set as primary number</span>
                      </div>

                      {contactForm.additionalMobileNumbers.map((mobileValue, index) => (
                        <div
                          key={`additional-mobile-${index}`}
                          className={styles.phoneVerificationSecondaryContactRow}
                        >
                          <div className={styles.phoneVerificationSecondaryContactBody}>
                            <div className={styles.phoneVerificationContactLabelRow}>
                              <span className={styles.phoneVerificationContactLabel}>
                                Phone number
                              </span>
                            </div>
                            <div className={styles.phoneVerificationSecondaryInputRow}>
                              <div className={styles.phoneVerificationSecondaryMobileField} style={{ flex: 1, minWidth: 0 }}>
                                <Field
                                  type="tel"
                                  inputMode="numeric"
                                  placeholder="+639876543210"
                                  section={
                                    <span className={styles.phoneVerificationCountryCode}>
                                      <select
                                        aria-label="Phone country"
                                        className={styles.phoneVerificationCountrySelect}
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
                                <div className={styles.phoneVerificationSecondaryMobileActions}>
                                  <button
                                    type="button"
                                    className={styles.phoneVerificationInlineActionButton}
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
                              className={styles.phoneVerificationPrimaryToggleRow}
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
                        <span className={styles.phoneVerificationCountryCode}>
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
                <span className={styles.phoneVerificationContactError}>
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
        </div>
      </Modal>

      {!hideTopControls && (
        <div className={styles.filterContainer} ref={filterContainerRef}>
          {buttons.map((button, indexBtn) => (
            <div
              className={styles.buttonContainer}
              key={indexBtn}
              ref={(e) => {
                buttonRef.current[indexBtn] = e;
              }}
              style={{ display: [3].includes(indexBtn) || (indexBtn === 4 && orgID) ? "none" : "" }}
            >
              <button
                className={`${
                  indexBtn > 0 && button.value.length > 0 ? "" : "secondaryBtn"
                }`}
                disabled={loading}
                onClick={() => handleDropdownIndex(indexBtn)}
              >
                {indexBtn == 0 && <img alt="" src={assetConstants.sort} />}

                <span>
                  {indexBtn == 0 && "Sort By: "}
                  {button.value.length > 0
                    ? button.value.join(", ")
                    : button.name}
                </span>

                {indexBtn > 0 && (
                  <img
                    alt=""
                    className={`${
                      button.value.length == 0 &&
                      dropdownIndex == indexBtn &&
                      indexBtn > 0
                        ? styles.rotate
                        : ""
                    }`}
                    src={
                      indexBtn > 0 && button.value.length > 0
                        ? assetConstants.xV3
                        : assetConstants.chevron
                    }
                    onClick={(e) => {
                      if (button.value.length > 0 && indexBtn > 0) {
                        e.stopPropagation();
                        handleClearFilter(indexBtn);
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                )}
              </button>

              {dropdownIndex == indexBtn && buttonPosition != null && (
                <div
                  className={styles.dropdownContainer}
                  style={{
                    width: button.dropdownWidth,
                    ...buttonPosition,
                  }}
                >
                  {[2, 4].includes(indexBtn) && (
                    <div className={styles.searchContainer}>
                      <Field
                        autoComplete="off"
                        className={styles.dropdownSearchField}
                        name={`job-openings-filter-search-${indexBtn}`}
                        section={<SearchMd />}
                        type="search"
                        placeholder={button.placeholder}
                        value={searchInputs[indexBtn] || ""}
                        onBlur={(e) =>
                          (e.target.placeholder = button.placeholder)
                        }
                        onChange={(e) =>
                          setSearchInputs((prev) => ({
                            ...prev,
                            [indexBtn]: e.target.value,
                          }))
                        }
                        onFocus={(e) =>
                          ((e.target as HTMLInputElement).placeholder = "")
                        }
                      />
                    </div>
                  )}

                  {getFilteredList(button, indexBtn).map((item, index) => (
                    <span
                      className={button.value.includes(item) ? styles.active : ""}
                      key={index}
                      onClick={() => handleSelection(item, indexBtn)}
                    >
                      {indexBtn > 2 && (
                        <input
                          id={item}
                          type="checkbox"
                          checked={button.value.includes(item)}
                          readOnly
                        />
                      )}
                      {item}
                      {button.value.includes(item) && indexBtn < 3 && (
                        <img alt="" src={assetConstants.checkV5} />
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!hideTopControls && (
        <div className={styles.filterResultContainer}>
          {!loading ? (
            <>
              <span className={styles.searchResult}>
                <span className={styles.bold}>
                  {search && search.trim() ? search.trim() : "All Job Openings"}
                </span>{" "}
                {buttons[2].value[0] ? `in ${buttons[2].value[0]}` : ""}{" "}
                <span className={styles.bold}>
                  {buttons[4].value.length > 0
                    ? `at ${buttons[4].value.join(", ")}`
                    : ""}
                </span>
              </span>
              <span className={styles.resultNumber}>
                {filteredCareers.length} jobs
              </span>
            </>
          ) : (
            <span className={styles.loading}></span>
          )}
        </div>
      )}

      <div className={styles.jobResultContainer}>
        <div className={styles.jobCardContainer} ref={defaultRef}>
          {loading && (
            <Loader loaderType={"career"} loaderData={{ length: 10 }} />
          )}

          {filteredCareers.length == 0 && !loading && (
            <span className={styles.emptyCards}>No jobs found</span>
          )}

          {filteredCareers.length > 0 &&
            !loading &&
            filteredCareers
              // .slice((currentPage - 1) * itemPerPage, currentPage * itemPerPage)
              .map((career, index) => (
                <div
                  className={`${styles.gradientContainer} ${
                    selectedCareer && selectedCareer.id == career.id
                      ? styles.active
                      : ""
                  }`}
                  key={index}
                  ref={
                    selectedCareer && selectedCareer.id == career.id
                      ? cardRef
                      : null
                  }
                >
                  <div
                    className={styles.cardContainer}
                    onClick={() => handleCard(career)}
                  >
                    <div className={styles.companyDetails}>
                      {career.organization && career.jobTitle && (
                        <>
                          {career.organization.image && (
                            <img alt="" src={career.organization.image} />
                          )}

                          <div className={styles.textContainer}>
                            <span className={styles.jobTitle}>
                              {typeof window !== "undefined" ? new DOMParser().parseFromString(career.jobTitle, "text/html").body.textContent : career.jobTitle}
                            </span>

                            {career.organization.name && (
                              <span className={styles.companyName}>
                                {career.organization.name}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {career.location && (
                      <span className={styles.details}>
                        <img alt="" src={assetConstants.mapPin} />
                        {career.location}
                      </span>
                    )}

                    {career.createdAt && (
                      <span className={styles.details}>
                        <img alt="" src={assetConstants.clock} />
                        {processDate(career.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}

          {/* {filteredCareers.length > 0 && (
            <div className={styles.paginationContainer}>
              <span
                className={`${styles.direction} ${styles.rotate}`}
                onClick={() => handlePagination("prev")}
              >
                <img alt="arrow" src={assetConstants.arrowV3} />
                Prev
              </span>

              {Array.from({
                length: Math.ceil(filteredCareers.length / itemPerPage),
              }).map((_, index) => (
                <span
                  key={index}
                  className={`${styles.index} ${
                    currentPage == index + 1 ? styles.active : ""
                  }`}
                  onClick={() => handlePagination(index + 1)}
                >
                  {index + 1}
                </span>
              ))}

              <span
                className={styles.direction}
                onClick={() => handlePagination("next")}
              >
                Next
                <img alt="arrow" src={assetConstants.arrowV3} />
              </span>
            </div>
          )} */}
        </div>

        {!selectedCareer && !loading && (
          <div className={`webView ${styles.emptyState}`}>
            <img alt="" src={assetConstants.arrowCircle} />
            Select a job to view details
          </div>
        )}

        {selectedCareer && !loading && (
          <div className={`webView ${styles.gradientContainer}`}>
            <div className={styles.jobDetailsContainer} ref={detailsRef}>
              {selectedCareer.jobTitle && (
                <div className={styles.titleContainer}>
                  <span>{typeof window !== "undefined" ? new DOMParser().parseFromString(selectedCareer.jobTitle, "text/html").body.textContent : selectedCareer.jobTitle}</span>
                  <img
                    alt=""
                    src={assetConstants.externalLink}
                    onClick={() =>
                      handleRedirection(
                        `${pathConstants.jobOpenings}/${selectedCareer._id}`
                      )
                    }
                    onContextMenu={(e) => e.preventDefault()}
                  />
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

              {selectedCareer.organization &&
                selectedCareer.organization.name && (
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
                  <img src={assetConstants.salary} />
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

              {interviews.some(
                (interview) => interview.id == selectedCareer.id
              ) ? (
                <div className={styles.appliedContainer}>
                  <span className={styles.applied}>
                    <img alt="" src={assetConstants.checkV4} />
                    Applied{" "}
                    {processDate(
                      interviews.find(
                        (interview) => interview.id == selectedCareer.id
                      ).createdAt
                    )}
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

                      {selectedCareer.organization.name.includes(
                        "White Cloak"
                      ) && (
                        <>
                          <span
                            className={`${styles.details} ${styles.withMargin}`}
                          >
                            Founded in 2014, White Cloak continues to be the
                            innovation partner of choice for many major
                            corporations, leveraging technology to take its
                            client’s business to the next level. This technical
                            superiority and commitment to our clients have
                            brought numerous recognition and awards to White
                            Cloak.
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
        )}
      </div>
    </div>
  );
}
