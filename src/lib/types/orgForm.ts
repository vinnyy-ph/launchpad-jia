/**
 * Types for the Segmented Organization Form
 */

export interface OrgFormMember {
  email: string;
  role: string;
  error?: string;
}

export interface OrgFormDocuments {
  companyRegistration: File | string | null;
  businessPermit: File | string | null;
}

export interface OrgFormLocation {
  country: string;
  province?: string;
  city?: string;
  address: string;
  location: string;
  latitude?: number;
  longitude?: number;
  isHQ: boolean;
  isGPS?: boolean;
}

export interface OrgFormState {
  // Step 1: Organization Details
  name: string;
  description: string;
  image: File | string | null;
  coverImage: File | string | null;
  country: string;
  province: string;
  city: string;
  address: string;
  locations: OrgFormLocation[];
  companySlug: string;
  emailDomains: string[];
  documents: OrgFormDocuments;
  defaultCurrency: string;
  defaultSalaryUnit: string;

  // Step 2: Plan and Usage
  accessEnabled: boolean;
  planId: string | null;
  planStartDate: Date | null;
  planEndDate: Date | null;

  // Direct feature flags (no nested object)
  projectsEnabled: boolean;
  guestPortalEnabled: boolean;
  brandedPortalEnabled: boolean;
  brandedJobPortalSubdomain?: string;
  globalHiringEnabled: boolean;
  linkedCareersEnabled: boolean;

  // Step 3: Members
  members: OrgFormMember[];
}

export interface OrgFormStep {
  name: string;
  completed: boolean;
}

export const ORG_FORM_STEPS: OrgFormStep[] = [
  { name: "Organization Details", completed: false },
  { name: "Plan and Usage", completed: false },
  { name: "Members", completed: false },
  { name: "Review", completed: false },
];

export const INITIAL_ORG_FORM_STATE: OrgFormState = {
  // Step 1: Organization Details
  name: "",
  description: "",
  image: null,
  coverImage: null,
  country: "Philippines",
  province: "",
  city: "",
  address: "",
  locations: [{ country: "Philippines", address: "", location: "", isHQ: true, isGPS: true }],
  companySlug: "",
  emailDomains: [""],
  documents: {
    companyRegistration: null,
    businessPermit: null,
  },
  defaultCurrency: "PHP",
  defaultSalaryUnit: "Monthly",

  // Step 2: Plan and Usage
  accessEnabled: true,
  planId: null,
  planStartDate: null,
  planEndDate: null,

  // Direct feature flags
  projectsEnabled: true,
  guestPortalEnabled: false,
  brandedPortalEnabled: false,
  brandedJobPortalSubdomain: "",
  globalHiringEnabled: false,
  linkedCareersEnabled: false,

  // Step 3: Members
  members: [{ email: "", role: "" }],
};


export const MEMBER_ROLE_OPTIONS = [
  { name: "hiring_manager" },
  { name: "admin" },
  { name: "super_admin" },
];

export const COUNTRY_OPTIONS = [
  { name: "Philippines", key: "PH" },
  { name: "Australia", key: "AU" },
  { name: "Singapore", key: "SG" },
  { name: "United Kingdom", key: "UK" },
  { name: "United States of America", key: "US" },
];

export const COUNTRY_SALARY_UNIT_MAP: { [key: string]: string } = {
  "Philippines": "Monthly",
  "Singapore": "Monthly",
  "Australia": "Annual",
  "United Kingdom": "Annual",
  "United States": "Annual",
  "United States of America": "Annual",
};

export const COUNTRY_CURRENCY_MAP: { [key: string]: string } = {
  "Philippines": "PHP",
  "Australia": "AUD",
  "Singapore": "SGD",
  "United Kingdom": "GBP",
  "United States": "USD",
  "United States of America": "USD",
};

