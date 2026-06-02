"use client";

import TableLoader from "@/lib/Loader/TableLoader";
import moment from "moment";
import React, { useState, useEffect, useRef, useCallback } from "react";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/AppContext";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useDebounce from "../../hooks/useDebounceHook";
import CareerStatus from "../CareerComponents/CareerStatus";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { deleteCareer } from "@/lib/utils/careerDelete";
import CustomDropdown from "../Dropdown/CustomDropdown";
import { Tooltip } from "react-tooltip";
import CareerActionModal from "../CareerComponents/CareerActionModal";
import FullScreenLoadingAnimation from "../CareerComponents/FullScreenLoadingAnimation";
import CareerRowBadges from "@/lib/components/NotificationComponents/CareerRowBadges";
import { Button } from "../ui";
import JobPostTypeBadge from "../CareerComponents/JobPostTypeBadge";
// import JobPostUsageSummary from "../CareerComponents/JobPostUsageSummary";
import TablePagination from "../ui/pagination/TablePagination";
import { generateJobPortalUrl } from "@/lib/utils/subdomainUtils";
import AvatarImage from "../AvatarImage/AvatarImage";
import CareerStatusBadges from "../CareerComponents/CareerStatusBadge";
import CareerStatusModal from "../CareerComponents/CareerStatusModal";
import MultiFilterDropdown from "../Dropdown/MultiFilterDropdown";
import { useCareersViewPreferences } from "@/lib/hooks/filterSortDefaults/useCareersViewPreferences";

const tableHeaderStyle: any = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#717680",
  textTransform: "none",
}

export default function CareersV2Table() {
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgID = searchParams.get("orgID");
  const pageFromUrl = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const currentPage = pageFromUrl;
  const [totalPages, setTotalPages] = useState(1);
  const [hasFetchedCareersMeta, setHasFetchedCareersMeta] = useState(false);
  const [totalCareers, setTotalCareers] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const limit = 10;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "ascending" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCareer, setSelectedCareer] = useState(null);
  const [filterStatus, setFilterStatus] = useState({
    jobOwners: [],
    projects: [],
    "Published Status": [],
    "Activity Status": [],
    "Subscription Plan": [],
    contributors: [],
    hiringManagers: [],
    // TODO: Add deal status filter
  });
  // const filterStatusOptions = ["All Statuses", "Published", "Unpublished"];
  const [sortBy, setSortBy] = useState("Recent Activity");
  const sortByOptions = {
    // Default sort
    "Recent Activity": {
      key: null,
      direction: "ascending",
    },
    "Oldest Activity": {
      key: "lastActivityAt",
      direction: "ascending",
    },
    "Date Created (Newest First)": {
      key: "createdAt",
      direction: "descending",
    },
    "Date Created (Oldest First)": {
      key: "createdAt",
      direction: "ascending",
    },
    "Most Hired": {
      key: "hired",
      direction: "descending",
    },
    "Least Hired": {
      key: "hired",
      direction: "ascending",
    },
    "Most Dropped": {
      key: "dropped",
      direction: "descending",
    },
    "Least Dropped": {
      key: "dropped",
      direction: "ascending",
    },
    "Most Ongoing": {
      key: "interviewsInProgress",
      direction: "descending",
    },
    "Least Ongoing": {
      key: "interviewsInProgress",
      direction: "ascending",
    },
    "Alphabetical (A-Z)": {
      key: "jobTitle",
      direction: "ascending",
    },
    "Alphabetical (Z-A)": {
      key: "jobTitle",
      direction: "descending",
    },
  };
  const [showSaveModal, setShowSaveModal] = useState("");
  const [isSavingCareer, setIsSavingCareer] = useState(false);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);

  const navigateToPage = useCallback((page: number, mode: "push" | "replace" = "push") => {
    const nextPage = Math.max(1, Math.floor(page));

    const params = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    if (nextUrl === currentUrl) {
      return;
    }

    if (mode === "replace") {
      router.replace(nextUrl, { scroll: false });
      return;
    }

    router.push(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  const {
    isViewStateReady,
    isSetAsDefault,
    isSetAsDefaultLoading,
    handleSetAsDefaultChange,
  } = useCareersViewPreferences({
    orgID,
    userEmail: user?.email,
    search,
    sortBy,
    filterStatus,
    sortByOptions,
    setSearch,
    setSortBy,
    setSortConfig,
    setFilterStatus,
  });

  // Job post usage state
  const [jobPostUsage, setJobPostUsage] = useState<{
    premium: { used: number; max: number | null };
    creditBased: { used: number; max: number | null };
    hasPremiumPlan: boolean;
    hasCreditBasedPlan: boolean;
  }>({
    premium: { used: 0, max: 0 },
    creditBased: { used: 0, max: 0 },
    hasPremiumPlan: false,
    hasCreditBasedPlan: false,
  });
  const [hasPlan, setHasPlan] = useState(false);
  const [organization, setOrganization] = useState<any>(null);

  // Fetch job post usage data and plan status
  useEffect(() => {
    const fetchJobPostUsage = async () => {
      try {
        const response = await api.get("/api/pricing-plan/get-job-post-usage", {
          params: { orgID },
        });
        const { premium, creditBased, availableTypes } = response.data;
        setJobPostUsage({
          premium: { used: premium?.used || 0, max: premium?.max !== undefined ? premium.max : 0 },
          creditBased: { used: creditBased?.used || 0, max: creditBased?.max !== undefined ? creditBased.max : 0 },
          hasPremiumPlan: availableTypes?.includes("premium") || false,
          hasCreditBasedPlan: availableTypes?.includes("credit-based") || false,
        });
      } catch (error) {
        console.error("Error fetching job post usage:", error);
      }
    };

    const fetchPlanStatus = async () => {
      try {
        const response = await api.get("/api/pricing-plan/get-plan-details", {
          params: { orgID },
        });
        setHasPlan(response.data.hasPlan || false);
      } catch (error) {
        console.error("Error fetching plan status:", error);
      }
    };

    const fetchOrganization = async () => {
      try {
        const response = await api.get("/api/admin/get-organization-details", {
          params: { id: orgID },
        });
        setOrganization(response.data);
      } catch (error) {
        console.error("Error fetching organization:", error);
      }
    };

    if (orgID) {
      fetchJobPostUsage();
      fetchPlanStatus();
      fetchOrganization();
    }
  }, [orgID, careers]);

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
    navigateToPage(1, "replace");
  }

  const getDisplayedCareerTitle = (career: any) => {
    const hasResolvedParentCareer =
      organization?.linkedCareersEnabled && career.parentCareerTitle;

    return hasResolvedParentCareer
      ? career.childTitle || career.jobTitle
      : career.jobTitle;
  };

  useEffect(() => {
    const fetchCareers = async () => {
      try {
        setLoading(true);
        const response = await api.get("/api/get-careers", {
          params: {
            userEmail: user?.email,
            orgID,
            page: currentPage,
            limit,
            search: debouncedSearch,
            sortConfig: sortConfig.key ? JSON.stringify(sortConfig) : null,
            status: filterStatus["Published Status"].join(","),
            projectIds: filterStatus.projects.map((p) => p._id).join(","),
            activityStatus: filterStatus["Activity Status"].join(","),
            jobPostType: filterStatus["Subscription Plan"].join(","),
            includeBadges: "true",
            jobOwners: filterStatus.jobOwners.map((j) => j.email).filter(Boolean).join(","),
            contributors: filterStatus.contributors.map((c) => c.email).filter(Boolean).join(","),
            hiringManagers: filterStatus.hiringManagers.map((h) => h.email).filter(Boolean).join(","),
          },
        });
        setCareers(response.data.careers);
        setTotalPages(response.data.totalPages);
        setTotalCareers(response.data.totalCareers);
        setHasFetchedCareersMeta(true);
      } catch (error) {
        console.error("Error fetching careers:", error);
        setHasFetchedCareersMeta(false);
      } finally {
        setLoading(false);
      }
    };
    if (!isViewStateReady) {
      return;
    }
    if (orgID && user?.email) {
      setHasFetchedCareersMeta(false);
      fetchCareers();
    } else {
      setLoading(false);
      setHasFetchedCareersMeta(false);
    }
  }, [isViewStateReady, orgID, user?.email, currentPage, debouncedSearch, sortConfig, filterStatus]);

  useEffect(() => {
    if (!hasFetchedCareersMeta) {
      return;
    }

    if (totalPages > 0 && currentPage > totalPages) {
      navigateToPage(totalPages, "replace");
    }
  }, [currentPage, hasFetchedCareersMeta, navigateToPage, totalPages]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  async function handleUpdateCareer(action: string) {
    setShowSaveModal("");
    if (action === "unpublish" || action === "publish") {
      try {
        setIsSavingCareer(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const response = await api.post("/api/update-career", {
          _id: selectedCareer._id,
          status: action === "unpublish" ? "inactive" : "active",
          updatedAt: Date.now(),
          lastEditedBy: {
            image: user.image,
            name: user.name,
            email: user.email,
          },
        });
        if (response.status === 200) {
          candidateActionToast(
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Career {action === "unpublish" ? "unpublished" : "published"}</span>
            </div>,
            1300,
            <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>)
          setCareers(prevCareers => prevCareers.map(career => career._id === selectedCareer._id ? { ...career, status: action === "unpublish" ? "inactive" : "active" } : career));
        }
      } catch (error: any) {
        console.error("Error updating career:", error);
        const errorMessage = error.response?.data?.error || "Error updating career";
        errorToast(errorMessage, 1500);
      } finally {
        setIsSavingCareer(false);
      }
    }
  }

  // Plan capacity helpers based on per-plan job post limits
  // If max is null, the plan is unlimited and always has capacity
  const hasPremiumCapacity =
    jobPostUsage.hasPremiumPlan &&
    (jobPostUsage.premium.max === null || jobPostUsage.premium.used < jobPostUsage.premium.max);

  const hasCreditBasedCapacity =
    jobPostUsage.hasCreditBasedPlan &&
    (jobPostUsage.creditBased.max === null || jobPostUsage.creditBased.used < jobPostUsage.creditBased.max);

  const hasAnyPlan = jobPostUsage.hasPremiumPlan || jobPostUsage.hasCreditBasedPlan;
  const hasAnyCapacity = hasAnyPlan ? hasPremiumCapacity || hasCreditBasedCapacity : true;
  const isAtPlanCapacity = hasAnyPlan && !hasAnyCapacity;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: "35px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}>Careers</h1>
          <span style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}>View all your company’s careers here.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
          <div
            data-tooltip-id="add-career-tooltip"
            data-tooltip-html={!hasPlan ? `This organization does not have an active plan. Please contact your administrator to assign a plan.` : isAtPlanCapacity ? `You have reached the maximum number of jobs for your plan. Please upgrade your plan to add more jobs.` : ""}
            style={{
              display: "inline-block",
            }}
          >
            <a
              href={hasPlan ? `/recruiter-dashboard/careers/new-career?orgID=${orgID}` : undefined}
              style={{
                pointerEvents: hasPlan ? "auto" : "none",
                cursor: hasPlan ? "pointer" : "not-allowed",
                display: "inline-block",
              }}
            >
              <Button
                onClick={() => { }}
                variant="primary"
                style={{
                  opacity: hasPlan ? 1 : 0.5,
                  cursor: hasPlan ? "pointer" : "not-allowed",
                }}
                label="Add new career"
                icon="/icons/plus.svg"
              >
              </Button>
            </a>
          </div>
          <div className="table-search-bar" style={{ minWidth: "300px" }}>
            <div className="icon mr-2">
              <i className="la la-search"></i>
            </div>
              <input
                type="search"
                className="form-control ml-auto search-input"
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  navigateToPage(1, "replace");
                }}
              />
          </div>

        </div>
      </div>
      <div className="row" style={{ marginBottom: "30px" }}>
        <div className="col">
          <div className="layered-card-outer">
            <div className="layered-card-content" style={{ padding: 0 }}>
              {/* Card header */}
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "15px 20px" }}>
                <div className="mb-0 d-flex align-items-center" style={{ gap: "10px" }}>
                  <div style={{ fontSize: "18px", fontWeight: 550, color: "#111827" }}>
                    List of Careers
                  </div>
                  <div style={{ borderRadius: "20px", border: "1px solid #C7D7FE", backgroundColor: "#EEF4FF", color: "#3538CD", fontSize: "12px", padding: "0 10px", fontWeight: 500 }}>{totalCareers} careers</div>
                  {/* {!hasPlan && (
                    <div style={{
                      borderRadius: "20px",
                      border: "1px solid #FEF3F2",
                      backgroundColor: "#FEE4E2",
                      color: "#B42318",
                      fontSize: "12px",
                      padding: "0 10px",
                      fontWeight: 500
                    }}>
                      No Plan
                    </div>
                  )} */}
                </div>
                <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                  {/* Status button */}
                  <MultiFilterDropdown
                  filterTypes={["careerStatuses", "jobOwners", "projects", "contributors", "hiringManagers"]}
                  options={filterStatus}
                  showSetAsDefaultToggle
                  iconJsx={<img src="/iconsV3/filter.svg" alt="Filter" style={{ width: 16, height: 16 }} />}
                  iconPosition="left"
                  valuePrefix="Filters"
                  setOptions={(value) => {
                    setFilterStatus(value);
                    navigateToPage(1, "replace");
                  }}
                  isSetAsDefault={isSetAsDefault}
                  isSetAsDefaultLoading={isSetAsDefaultLoading}
                  onSetAsDefaultChange={handleSetAsDefaultChange}
                  />
                  {/* Sort by button */}
                  <CustomDropdown value={sortBy} setValue={(value) => {
                    setSortBy(value);
                    setSortConfig({ key: sortByOptions[value].key, direction: sortByOptions[value].direction });
                    navigateToPage(1, "replace");
                  }} 
                  options={Object.keys(sortByOptions)}
                  suffixIconJsx={<img src="/iconsV3/chevron-down.svg" alt="Chevron down" style={{ width: 12, height: 7 }} />}
                  iconJsx={<img src="/iconsV3/sortV2.svg" alt="Sort" style={{ width: 16, height: 16 }} />} valuePrefix="Sort by:" 
                  />
                </div>
              </div>
              {/* Job Post Usage Summary (temporarily hidden)
              {(jobPostUsage.hasPremiumPlan || jobPostUsage.hasCreditBasedPlan) && (
                <JobPostUsageSummary
                  premiumUsed={jobPostUsage.premium.used}
                  premiumMax={jobPostUsage.premium.max}
                  creditBasedUsed={jobPostUsage.creditBased.used}
                  creditBasedMax={jobPostUsage.creditBased.max}
                  hasPremiumPlan={jobPostUsage.hasPremiumPlan}
                  hasCreditBasedPlan={jobPostUsage.hasCreditBasedPlan}
                />
              )} */}
              {/* Light table */}
              <div className="table-responsive">
                {loading ? (
                  <table className="table align-items-center table-flush">
                    <thead>
                      <tr>
                        <th scope="col" className="sort" data-sort="name" style={tableHeaderStyle}>
                          Job Title
                        </th>
                        <th scope="col" style={tableHeaderStyle}>Job Owner</th>
                        <th scope="col" style={tableHeaderStyle}>Project</th>
                        <th scope="col" style={tableHeaderStyle}>Status</th>
                        <th scope="col" style={tableHeaderStyle}>Ongoing</th>
                        <th scope="col" style={tableHeaderStyle}>Dropped</th>
                        <th scope="col" style={tableHeaderStyle}>Hired</th>
                        <th scope="col"></th>
                      </tr>
                    </thead>
                    <tbody className="list">
                      <TableLoader type="careers-v2" />
                    </tbody>
                  </table>
                ) : (
                  <table className="table align-items-center table-flush">
                    <thead>
                      <tr>
                        <th scope="col" className="sort" data-sort="name" style={tableHeaderStyle}>
                          {/* <SortColumnButton columnName="jobTitle" sortConfig={sortConfig} requestSort={requestSort} /> */}
                          Job Title
                        </th>
                        <th scope="col" style={tableHeaderStyle}>
                          Job Owner
                        </th>
                        <th scope="col" style={tableHeaderStyle}>
                          Project
                        </th>
                        <th scope="col" style={tableHeaderStyle}>
                          Status
                        </th>
                        <th scope="col" style={{ ...tableHeaderStyle, textAlign: "center" }}>
                          {/* <SortColumnButton columnName="interviewsInProgress" sortConfig={sortConfig} requestSort={requestSort} /> */}
                          Ongoing
                        </th>

                        <th scope="col" style={{ ...tableHeaderStyle, textAlign: "center" }}>
                          {/* <SortColumnButton columnName="dropped" sortConfig={sortConfig} requestSort={requestSort} /> */}
                          Dropped
                        </th>

                        <th scope="col" style={{ ...tableHeaderStyle, textAlign: "center" }}>
                          {/* <SortColumnButton columnName="hired" sortConfig={sortConfig} requestSort={requestSort} /> */}
                          Hired
                        </th>
                        <th scope="col"></th>
                      </tr>
                    </thead>
                    <tbody className="list">
                      {careers.length === 0 ? (
                        <tr style={{ cursor: "default", pointerEvents: "none" }}>
                          <td colSpan={9} className="text-center py-4" style={{ verticalAlign: "middle", height: "200px" }}>
                            <div className="d-flex justify-content-center align-items-center w-100 h-100" style={{ minHeight: "100px" }}>
                              No job titles found
                            </div>
                          </td>
                        </tr>
                      ) : (
                        careers.map((item) => (
                          <tr
                            key={item._id}
                            onClick={(e) => {
                              if (e.defaultPrevented) return;
                              e.preventDefault();
                              router.push(`/recruiter-dashboard/careers/manage/${item._id}?orgID=${orgID}`);
                            }}
                          >
                            <th scope="row" style={{ maxWidth: "250px", whiteSpace: "initial" }}>
                              <div className="media align-items-center">
                                <div className="media-body">
                                  <h3 className="name mb-0 text-sm" style={{ fontSize: "16px", fontWeight: 550, color: organization?.linkedCareersEnabled && item.parentCareerTitle ? "#717680" : "#111827", display: "flex", alignItems: "flex-start" }}>
                                    <a
                                      href={`/recruiter-dashboard/careers/manage/${item._id}?orgID=${orgID}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        router.push(`/recruiter-dashboard/careers/manage/${item._id}?orgID=${orgID}`);
                                      }}
                                      style={{ color: "inherit", textDecoration: "none", display: "flex", flexDirection: "column" }}
                                    >
                                      {organization?.linkedCareersEnabled && item.parentCareerTitle && (
                                        <span className="text-sm" style={{ fontWeight: 550, color: "#111827", lineHeight: "1.4" }}>
                                          {typeof window !== "undefined" ? new DOMParser().parseFromString(item.parentCareerTitle, "text/html").body.textContent : item.parentCareerTitle}
                                        </span>
                                      )}
                                      <span>{typeof window !== "undefined" ? new DOMParser().parseFromString(getDisplayedCareerTitle(item), "text/html").body.textContent : getDisplayedCareerTitle(item)}</span>
                                    </a>
                                    <CareerRowBadges careerId={item._id} showComments={true} showActions={false} precomputedBadges={item.badges} />
                                  </h3>
                                </div>
                              </div>
                            </th>
                            <td>
                              <JobOwner career={item} />
                            </td>
                            <td>
                              <span>{item.projectName || "-"}</span>
                            </td>
                            <td>
                              <CareerStatusBadges career={item} />
                            </td>
                            <td>
                              <div className="d-flex justify-content-center align-items-center">
                                <span>
                                  {item.interviewsInProgress || 0}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="d-flex justify-content-center align-items-center">
                                <span>
                                  {item.dropped || 0}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="d-flex justify-content-center align-items-center">
                                <span>
                                  {item.hired || 0}
                                </span>
                              </div>
                            </td>

                            {/* <td style={{ textAlign: "center" }}>
                              <div className="d-flex justify-content-center align-items-center">
                                <div
                                  style={{
                                    width: "24px",
                                    height: "24px",
                                    borderRadius: "50%",
                                    border: `1.5px solid ${item.status === "active" ? "#6CE9A6" : "#D0D5DD"}`,
                                    backgroundColor: item.status === "active" ? "#D1FADF" : "#F2F4F7",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "all 0.2s ease-in-out",
                                  }}
                                >
                                  {item.status === "active" ? (
                                    <i className="la la-check" style={{ fontSize: "14px", color: "#027A48", fontWeight: 700 }}></i>
                                  ) : (
                                    <i className="la la-times" style={{ fontSize: "14px", color: "#667085", fontWeight: 700 }}></i>
                                  )}
                                </div>
                              </div>
                            </td> */}
                            <td>
                              <div className="dropdown" ref={selectedCareer?._id === item._id && menuOpen ? dropdownRef : null}>
                                <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={(e) => {
                                  if (e.defaultPrevented) return;
                                  e.preventDefault();
                                  setSelectedCareer(item);
                                  setMenuOpen(!menuOpen);
                                }}>
                                  <i className="la la-ellipsis-h" style={{ fontSize: 16, color: "#787486" }}></i>
                                </button>
                                {menuOpen && selectedCareer?._id === item._id && (
                                  <div
                                    className={`dropdown-menu dropdown-menu-right w-100 mt-1 org-dropdown-anim${menuOpen ? " show" : ""
                                      }`}
                                    style={{
                                      padding: "10px 15px"
                                    }}
                                  >
                                    <div className="dropdown-item" onClick={(e) => {
                                      if (e.defaultPrevented) return;
                                      e.preventDefault();
                                      setMenuOpen(false);
                                      router.push(`/recruiter-dashboard/careers/edit-career/${item._id}?orgID=${orgID}`);
                                    }}>
                                      <span>Edit Career</span>
                                    </div>

                                    <div className="dropdown-item" onClick={(e) => {
                                      if (e.defaultPrevented) return;
                                      e.preventDefault();
                                      setMenuOpen(false);
                                      
                                      let careerLink: string;
                                      if (organization?.brandedPortalEnabled && organization?.brandedJobPortalSubdomain) {
                                        careerLink = generateJobPortalUrl(organization.brandedJobPortalSubdomain, item._id);
                                      } else {
                                        const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
                                        careerLink = `${protocol}//${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}/job-openings/${item._id}`;
                                      }
                                      
                                      navigator.clipboard.writeText(careerLink);
                                      candidateActionToast(
                                        "Career Link Copied to Clipboard",
                                        1300,
                                        <i className="la la-link mr-1 text-info"></i>
                                      );
                                    }}>
                                      <span>Copy Career Link</span>
                                    </div>

                                    {item.status === "inactive" ? (
                                      <div
                                        className="dropdown-item"
                                        style={{
                                          color: (item.jobPostType === "premium" && !hasPremiumCapacity) || (item.jobPostType === "credit-based" && !hasCreditBasedCapacity)
                                            ? "#D0D5DD"
                                            : "#027948",
                                          cursor: (item.jobPostType === "premium" && !hasPremiumCapacity) || (item.jobPostType === "credit-based" && !hasCreditBasedCapacity)
                                            ? "not-allowed"
                                            : "pointer",
                                        }}
                                        onClick={(e) => {
                                          if (e.defaultPrevented) return;
                                          e.preventDefault();

                                          const isPremium = item.jobPostType === "premium";
                                          const hasPlanForType = isPremium
                                            ? jobPostUsage.hasPremiumPlan
                                            : jobPostUsage.hasCreditBasedPlan;
                                          const hasCapacityForType = isPremium
                                            ? hasPremiumCapacity
                                            : hasCreditBasedCapacity;

                                          if (!hasPlanForType) {
                                            errorToast(
                                              `This organization does not have an active ${item.jobPostType} plan. Please assign a plan to publish job posts.`,
                                              3000
                                            );
                                            return;
                                          }

                                          if (!hasCapacityForType) {
                                            errorToast(
                                              `You have reached the maximum number of ${item.jobPostType} job posts for your plan`,
                                              3000
                                            );
                                            return;
                                          }

                                          setMenuOpen(false);
                                          setShowSaveModal("publish");
                                        }}
                                      >
                                        <span>Publish Career</span>
                                      </div>
                                    ) : (
                                      <div
                                        className="dropdown-item"
                                        style={{ color: "#B42318" }}
                                        onClick={(e) => {
                                          if (e.defaultPrevented) return;
                                          e.preventDefault();
                                          setMenuOpen(false);
                                          setShowSaveModal("unpublish");
                                        }}
                                      >
                                        <span>Unpublish Career</span>
                                      </div>
                                    )}

                                    <div className="dropdown-item"
                                        // style={{ color: "#B42318" }}
                                        onClick={(e) => {
                                          if (e.defaultPrevented) return;
                                          e.preventDefault();
                                          setMenuOpen(false);
                                          setShowUpdateStatusModal(true);
                                        }}
                                      >
                                        <span>Update Status</span>
                                      </div>

                                    <div className="dropdown-divider"></div>

                                    <div className="dropdown-item" style={{ color: "#B42318" }} onClick={(e) => {
                                      if (e.defaultPrevented) return;
                                      e.preventDefault();
                                      setMenuOpen(false);
                                      deleteCareer(item._id, { orgID });
                                    }}>
                                      <span>Delete Career</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
                {/* Pagination */}
                <div className="d-flex justify-content-between align-items-center border-top" style={{ padding: "15px 20px" }}>
                  <Button
                    variant="secondary"
                    disabled={currentPage === 1}
                    onClick={() => {
                      if (currentPage > 1) {
                        navigateToPage(currentPage - 1);
                      }
                    }}
                    label="Previous"
                    icon="/icons/arrow.svg"
                  >
                  </Button>

                  <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={(page) => navigateToPage(page)} />

                  <Button
                    variant="secondary"
                    disabled={currentPage >= totalPages}
                    onClick={() => {
                      if (currentPage < totalPages) {
                        navigateToPage(currentPage + 1);
                      }
                    }}
                    label="Next"
                    icon="/icons/arrow.svg"
                    iconStyle={{ transform: "rotate(180deg)" }}
                    iconPosition="right"
                  >
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div >
      {
        (isAtPlanCapacity || !hasPlan) && <Tooltip className="career-fit-tooltip fade-in" id="add-career-tooltip" />
      }
      {showSaveModal && <CareerActionModal action={showSaveModal} onAction={(action) => handleUpdateCareer(action)} />}
      {
        isSavingCareer && (
          <FullScreenLoadingAnimation title={"Updating career..."} subtext={"Please wait while we are updating the career"} />
        )
      }
      {showUpdateStatusModal && (
          <CareerStatusModal
            formData={selectedCareer}
            action="update-status"
            onConfirm={(updatedCareer) => {
              setCareers(prevCareers => prevCareers.map(career => career._id === selectedCareer._id ? { ...career, ...updatedCareer} : career));
              setShowUpdateStatusModal(false);
            }}
            onCancel={() => setShowUpdateStatusModal(false)}
          />
        )}
    </>
  );
}

function SortColumnButton({ columnName, sortConfig, requestSort }: { columnName: string, sortConfig: any, requestSort: (key: string) => void }) {
  return (
    <button
      className={`btn btn-sm ${sortConfig.key === columnName ? "btn-primary" : "btn-white"} mr-1`}
      onClick={() => requestSort(columnName)}
    >
      <i className={`la la-sort${sortConfig.key === columnName ? sortConfig.direction === "ascending" ? "-up" : "-down" : ""}`}></i>
    </button>
  )
}

export function JobOwner({ career }: { career: any }) {
  const jobOwner = career.teamMembers?.find((member: any) => member.role === "Job Owner") || career.createdBy;
  return (
    <div className="d-flex justify-content-flex-start align-items-center">
      {jobOwner ?
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <AvatarImage src={jobOwner?.image} alt={jobOwner?.name} style={{ width: 24, height: 24, borderRadius: "50%" }} />
      <span>{jobOwner?.name}</span> 
      </div>
      : <span>-</span>}
    </div>
  )
}
