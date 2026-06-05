export const FIGMA_DIMENSIONS = {
  SCREEN: {
    WIDTH: 1440,
  },
  // For tables in recruiter portal
  TABLE: {
    WIDTH: 1112,
  },
};

export const CREDIT_THRESHOLDS = {
  LOW_BALANCE: 50,
  INTERVIEW_COST: 10,
  INSUFFICIENT: 10,
};

export const EMPLOYER_GOOGLE_TRACKING_IDS = {
  measurementId: "GT-WPFKKQZG",
  adsId: "AW-17523605644"
}

export const APPLICANT_GOOGLE_TRACKING_IDS = {
  measurementId: "GT-T5R7HTHJ",
  adsId: "AW-17523605644"
}

export const COMPANY_SIZE_OPTIONS = [
  { name: "1 to 49 employees" },
  { name: "50 to 99 employees" },
  { name: "100 to 999 employees" },
  { name: "1000+ employees" },
];

export const MONTHLY_HIRING_VOLUME_OPTIONS = [
  { name: "1 to 9 new hires" },
  { name: "10 to 49 new hires" },
  { name: "50 to 99 new hires" },
  { name: "100+ new hires" },
];

export const REASON_FOR_INQUIRY_OPTIONS = [
  { name: "Book a Demo" },
  { name: "Pricing & Subscription Plans" },
  { name: "Technical Support" },
  { name: "Product Features & Capabilities" },
  { name: "Partnership Opportunities" },
  { name: "General Inquiry" },
  { name: "Account & Billing Issues" },
];

export const SYNCABLE_CAREER_FIELDS = [
  'jobTitle',
  'headcount',
  'description',
  'questions',
  'location',
  'workSetup',
  'screeningSetting',
  'requisitionId',
  'requireVideo',
  'salaryNegotiable',
  'minimumSalary',
  'maximumSalary',
  'country',
  'province',
  'employmentType',
  'pipelineStages',
  'voice',
] as const;

export const TERMINAL_APPLICATION_STATUSES = ["Dropped", "Cancelled"];

export const DEFAULT_JOB_PIPELINE = [
  {
      id: "1",
      name: "CV Screening",
      icon: "la la-user",
      substages: [
          {
              id: "1",
              core: true,
              name: "Waiting Submission",
              currentStep: "Applied",
              status: "For CV Upload"
          },
          {
              id: "2",
              core: true,
              name: "For Review",
              currentStep: "CV Screening",
              status: "For CV Screening"
          }
      ],
      type: "core",
      autoEndorse: "Good Fit and above",
      autoDrop: "Bad Fit and below",
  },
  {
      id: "2",
      name: "AI Interview",
      icon: "la la-microphone",
      substages: [
          {
            id: "1",
            name: "Waiting Interview",
            currentStep: "CV Screening",
            status: "For AI Interview"
          },
          {
            id: "2",
            name: "For Review",
            currentStep: "AI Interview",
            status: "For AI Interview Review"
          }
      ],
      type: "core",
      autoEndorse: "Good Fit and above",
      autoDrop: "None",
  },
  {
      id: "3",
      name: "Human Interview",
      icon: "la la-users",
      type: "core",
      stageEditable: true,
      substages: [
          {
            id: "1",
            name: "Waiting Schedule",
            currentStep: "Human Interview",
            status: "For Human Interview",
            stageEditable: true,
          },
          {
            id: "2",
            name: "Waiting Interview",
            currentStep: "Human Interview",
            status: "For Interview",
            stageEditable: true,
          },
          {
            id: "3",
            name: "For Review",
            currentStep: "Human Interview",
            status: "For Human Interview Review",
            stageEditable: true,
          }
      ],
      autoEndorse: "None",
      autoDrop: "None",
  },
  {
      id: "4",
      name: "Job Offer",
      icon: "la la-handshake",
      type: "core",
      substages: [
          {
            id: "1",
            name: "For Final Review",
            currentStep: "Job Offer",
            status: "For Final Review"
          },
          {
            id: "2",
            name: "Waiting Offer Acceptance",
            currentStep: "Job Offer",
            status: "Waiting Offer Acceptance"
          },
          {
            id: "3",
            name: "For Contract Signing",
            currentStep: "Job Offer",
            status: "Accepted"
          },
          {
            id: "4",
            name: "Hired",
            currentStep: "Contract Signed",
            status: "Accepted"
          },
      ],
      autoEndorse: "None",
      autoDrop: "None",
  },
];

export const CAREER_STATUS_OPTIONS = [
  {
      label: "Published Status",
      options: [
          {
              value: "active",
              label: "Published",
              icon: "/careers/published.svg",
              backgroundColor: "#ECFDF3",
              border: "1px solid #ABEFC6",
              disabledIcon: "/careers/published-disabled.svg",
              tooltipText: "Published",
          },
          {
              value: "inactive",
              label: "Unpublished",
              icon: "/careers/unpublished.svg",
              backgroundColor: "#FEF3F2",
              border: "1px solid #FECDCA",
              disabledIcon: "/careers/unpublished-disabled.svg",
              tooltipText: "Unpublished",
          },
          {
              value: "archived",
              label: "Archived",
              icon: "/careers/archived.svg",
              backgroundColor: "#F5F5F5",
              border: "1px solid #E9EAEB",
              disabledIcon: "/careers/archived.svg",
              tooltipText: "Archived",
          },
      ]
  },
  {
      label: "Activity Status",
      options: [
          {
              value: "Active",
              icon: "/careers/active.svg",
              backgroundColor: "#ECFDF3",
              border: "1px solid #ABEFC6",
              disabledIcon: "/careers/active-disabled.svg",
              tooltipText: "Active",
          },
          {
              value: "Inactive",
              icon: "/careers/inactive.svg",
              backgroundColor: "#FEF3F2",
              border: "1px solid #FECDCA",
              disabledIcon: "/careers/inactive-disabled.svg",
              tooltipText: "Inactive",
          },
          {
              value: "Pooling",
              icon: "/careers/pooling.svg",
              backgroundColor: "#FDF2FA",
              border: "1px solid #FCCEEE",
              disabledIcon: "/careers/pooling-disabled.svg",
              tooltipText: "Pooling",
          }
      ]
  }, 
  {
      label: "Subscription Plan",
      options: [
          {
              value: "premium",
              label: "Premium",
              icon: "/careers/premium-icon.svg",
              backgroundColor: "#FDF2FA",
              border: "1px solid #FCCEEE",
              disabledIcon: "/careers/premium-icon-disabled.svg",
              tooltipText: "Premium job posts have unlimited interviews and does not consume credits.",
          },
          {
              value: "credit-based",
              label: "Credit-based",
              icon: "/careers/credit-based-icon.svg",
              backgroundColor: "#F4F3FF",
              border: "1px solid #D9D6FE",
              disabledIcon: "/careers/credit-based-icon-disabled.svg",
              tooltipText: "Credit-based job posts consume 10 credits per AI interview.",
          }
      ]
  }
];