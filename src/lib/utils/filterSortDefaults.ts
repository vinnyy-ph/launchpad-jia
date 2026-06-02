export const FILTER_SORT_DEFAULTS_VERSION = 1;

export const FILTER_SORT_DEFAULTS_SCREENS = {
  careers: "careers_table_v2",
  recruiterDashboard: "recruiter_dashboard",
  pipelineReport: "pipeline_report",
} as const;

export type FilterSortDefaultsScreen =
  (typeof FILTER_SORT_DEFAULTS_SCREENS)[keyof typeof FILTER_SORT_DEFAULTS_SCREENS];

const CAREERS_SORT_OPTIONS = new Set([
  "Recent Activity",
  "Oldest Activity",
  "Date Created (Newest First)",
  "Date Created (Oldest First)",
  "Most Hired",
  "Least Hired",
  "Most Dropped",
  "Least Dropped",
  "Most Ongoing",
  "Least Ongoing",
  "Alphabetical (A-Z)",
  "Alphabetical (Z-A)",
]);

const DATE_FILTER_TYPES = new Set([
  "Custom",
  "Today",
  "7D",
  "30D",
  "3M",
  "6M",
  "12M",
  "All-time",
  "Default",
]);

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  values.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
}

function readEntityId(value: any) {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = value?.id ?? value?._id ?? value;
  if (raw === null || raw === undefined) {
    return "";
  }
  return String(raw);
}

function parsePositiveInt(value: any, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function isObjectIdLike(value: string) {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

function uniqueMemberIds(values: string[]) {
  return uniqueStrings(values).filter((value) => isObjectIdLike(value));
}

function normalizeDateOnlyString(value: any) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function dateToDateOnly(value: any) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface CareersDefaultsState {
  search: string;
  sortBy: string;
  page: number;
  filters: {
    jobOwners: string[];
    projects: string[];
    contributors: string[];
    publishedStatus: string[];
    activityStatus: string[];
    subscriptionPlan: string[];
    hiringManagers: string[];
  };
}

export interface RecruiterDashboardDefaultsState {
  dateFilter: {
    type: string;
    startDate: string | null;
    endDate: string | null;
  };
  filters: {
    careers: string[];
    projects: string[];
    jobOwners: string[];
    contributors: string[];
    hiringManagers: string[];
  };
}

export interface PipelineReportDefaultsState {
  page: number;
  limit: number;
  filters: {
    careers: string[];
    projects: string[];
    jobOwners: string[];
    contributors: string[];
    publishedStatus: string[];
    activityStatus: string[];
    subscriptionPlan: string[];
    hiringManagers: string[];
  };
}

export function emptyCareersDefaultsState(): CareersDefaultsState {
  return {
    search: "",
    sortBy: "Recent Activity",
    page: 1,
    filters: {
      jobOwners: [],
      projects: [],
      contributors: [],
      publishedStatus: [],
      activityStatus: [],
      subscriptionPlan: [],
      hiringManagers: [],
    },
  };
}

export function emptyRecruiterDashboardDefaultsState(): RecruiterDashboardDefaultsState {
  return {
    dateFilter: {
      type: "7D",
      startDate: null,
      endDate: null,
    },
    filters: {
      careers: [],
      projects: [],
      jobOwners: [],
      contributors: [],
      hiringManagers: [],
    },
  };
}

export function emptyPipelineReportDefaultsState(): PipelineReportDefaultsState {
  return {
    page: 1,
    limit: 20,
    filters: {
      careers: [],
      projects: [],
      jobOwners: [],
      contributors: [],
      publishedStatus: [],
      activityStatus: [],
      subscriptionPlan: [],
      hiringManagers: [],
    },
  };
}

export function sanitizeCareersDefaultsState(input: any): CareersDefaultsState {
  const base = emptyCareersDefaultsState();
  const search = typeof input?.search === "string" ? input.search : base.search;
  const sortBy =
    typeof input?.sortBy === "string" && CAREERS_SORT_OPTIONS.has(input.sortBy)
      ? input.sortBy
      : base.sortBy;

  return {
    search,
    sortBy,
    page: parsePositiveInt(input?.page, base.page),
    filters: {
      jobOwners: uniqueMemberIds(input?.filters?.jobOwners || []),
      projects: uniqueStrings(input?.filters?.projects || []),
      contributors: uniqueMemberIds(input?.filters?.contributors || []),
      publishedStatus: uniqueStrings(input?.filters?.publishedStatus || []),
      activityStatus: uniqueStrings(input?.filters?.activityStatus || []),
      subscriptionPlan: uniqueStrings(input?.filters?.subscriptionPlan || []),
      hiringManagers: uniqueMemberIds(input?.filters?.hiringManagers || []),
    },
  };
}

export function sanitizeRecruiterDashboardDefaultsState(
  input: any
): RecruiterDashboardDefaultsState {
  const base = emptyRecruiterDashboardDefaultsState();
  const requestedType = typeof input?.dateFilter?.type === "string" ? input.dateFilter.type : "";
  const type = DATE_FILTER_TYPES.has(requestedType) ? requestedType : base.dateFilter.type;
  const startDate = normalizeDateOnlyString(input?.dateFilter?.startDate);
  const endDate = normalizeDateOnlyString(input?.dateFilter?.endDate);

  return {
    dateFilter: {
      type,
      startDate: type === "Custom" ? startDate : null,
      endDate: type === "Custom" ? endDate : null,
    },
    filters: {
      careers: uniqueStrings(input?.filters?.careers || []),
      projects: uniqueStrings(input?.filters?.projects || []),
      jobOwners: uniqueMemberIds(input?.filters?.jobOwners || []),
      contributors: uniqueMemberIds(input?.filters?.contributors || []),
      hiringManagers: uniqueMemberIds(input?.filters?.hiringManagers || []),
    },
  };
}

export function sanitizePipelineReportDefaultsState(input: any): PipelineReportDefaultsState {
  const base = emptyPipelineReportDefaultsState();
  return {
    page: parsePositiveInt(input?.page, base.page),
    limit: parsePositiveInt(input?.limit, base.limit),
    filters: {
      careers: uniqueStrings(input?.filters?.careers || []),
      projects: uniqueStrings(input?.filters?.projects || []),
      jobOwners: uniqueMemberIds(input?.filters?.jobOwners || []),
      contributors: uniqueMemberIds(input?.filters?.contributors || []),
      publishedStatus: uniqueStrings(input?.filters?.publishedStatus || []),
      activityStatus: uniqueStrings(input?.filters?.activityStatus || []),
      subscriptionPlan: uniqueStrings(input?.filters?.subscriptionPlan || []),
      hiringManagers: uniqueMemberIds(input?.filters?.hiringManagers || []),
    },
  };
}

export function sanitizeDefaultsByScreen(screen: string, defaults: any) {
  if (screen === FILTER_SORT_DEFAULTS_SCREENS.careers) {
    return sanitizeCareersDefaultsState(defaults);
  }
  if (screen === FILTER_SORT_DEFAULTS_SCREENS.recruiterDashboard) {
    return sanitizeRecruiterDashboardDefaultsState(defaults);
  }
  if (screen === FILTER_SORT_DEFAULTS_SCREENS.pipelineReport) {
    return sanitizePipelineReportDefaultsState(defaults);
  }
  return null;
}

export function careersUiStateToDefaults(params: {
  search: string;
  sortBy: string;
  page: number;
  filterStatus: any;
}) {
  return sanitizeCareersDefaultsState({
    search: params.search,
    sortBy: params.sortBy,
    page: params.page,
    filters: {
      jobOwners: (params.filterStatus?.jobOwners || []).map((x: any) => readEntityId(x)),
      projects: (params.filterStatus?.projects || []).map((x: any) => readEntityId(x)),
      contributors: (params.filterStatus?.contributors || []).map((x: any) => readEntityId(x)),
      publishedStatus: params.filterStatus?.["Published Status"] || [],
      activityStatus: params.filterStatus?.["Activity Status"] || [],
      subscriptionPlan: params.filterStatus?.["Subscription Plan"] || [],
      hiringManagers: (params.filterStatus?.hiringManagers || []).map((x: any) => readEntityId(x)),
    },
  });
}

export function recruiterDashboardUiStateToDefaults(params: {
  dateFilter: any;
  filterOptions: any;
}) {
  return sanitizeRecruiterDashboardDefaultsState({
    dateFilter: {
      type: params.dateFilter?.type,
      startDate: dateToDateOnly(params.dateFilter?.startDate),
      endDate: dateToDateOnly(params.dateFilter?.endDate),
    },
    filters: {
      careers: (params.filterOptions?.careers || []).map((x: any) => readEntityId(x)),
      projects: (params.filterOptions?.projects || []).map((x: any) => readEntityId(x)),
      jobOwners: (params.filterOptions?.jobOwners || []).map((x: any) => readEntityId(x)),
      contributors: (params.filterOptions?.contributors || []).map((x: any) => readEntityId(x)),
      hiringManagers: (params.filterOptions?.hiringManagers || []).map((x: any) => readEntityId(x)),
    },
  });
}

export function pipelineReportUiStateToDefaults(params: {
  page: number;
  limit: number;
  filterStatus: any;
}) {
  return sanitizePipelineReportDefaultsState({
    page: params.page,
    limit: params.limit,
    filters: {
      careers: (params.filterStatus?.careers || []).map((x: any) => readEntityId(x)),
      projects: (params.filterStatus?.projects || []).map((x: any) => readEntityId(x)),
      jobOwners: (params.filterStatus?.jobOwners || []).map((x: any) => readEntityId(x)),
      contributors: (params.filterStatus?.contributors || []).map((x: any) => readEntityId(x)),
      publishedStatus: params.filterStatus?.["Published Status"] || [],
      activityStatus: params.filterStatus?.["Activity Status"] || [],
      subscriptionPlan: params.filterStatus?.["Subscription Plan"] || [],
      hiringManagers: (params.filterStatus?.hiringManagers || []).map((x: any) => readEntityId(x)),
    },
  });
}

export function hydrateMembersFromIds(
  ids: string[],
  members: any[],
  fallbackLabel = "Selected member"
) {
  const byId = new Map<string, any>();
  members.forEach((member) => {
    const id = readEntityId(member);
    if (id) {
      byId.set(id, member);
    }
  });

  return ids.map((id) => {
    const key = String(id || "");
    if (!key) {
      return null;
    }
    const member = byId.get(key);
    if (!member) {
      return null;
    }
    return {
      id: key,
      email: member?.email,
      name: member?.name || member?.email || fallbackLabel,
      image: member?.image,
    };
  }).filter(Boolean);
}

export function hydrateProjectsFromIds(ids: string[], projects: any[]) {
  const byId = new Map<string, any>();
  projects.forEach((project) => {
    const id = readEntityId(project);
    if (id) {
      byId.set(id, project);
    }
  });

  return ids.map((id) => {
    const key = String(id || "");
    if (!key) {
      return null;
    }
    const project = byId.get(key);
    if (!project) {
      return null;
    }
    return {
      _id: key,
      name: project?.name || "Selected project",
    };
  }).filter(Boolean);
}

export function hydrateCareersFromIds(ids: string[], careers: any[]) {
  const byId = new Map<string, any>();
  careers.forEach((career) => {
    const id = readEntityId(career);
    if (id) {
      byId.set(id, career);
    }
  });

  return ids.map((id) => {
    const key = String(id || "");
    if (!key) {
      return null;
    }
    const career = byId.get(key);
    if (!career) {
      return null;
    }
    return {
      id: key,
      jobTitle: career?.jobTitle || "Selected career",
    };
  }).filter(Boolean);
}
