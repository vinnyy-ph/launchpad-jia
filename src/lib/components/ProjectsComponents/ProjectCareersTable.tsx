"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/AppContext";
import moment from "moment";
import CareerStatus from "../CareerComponents/CareerStatus";
import CustomDropdown from "../Dropdown/CustomDropdown";
import DeleteCareerModal from "./DeleteCareerModal";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import styles from "@/lib/styles/screens/manage-project.module.scss";
import { Career } from "@/lib/types/projects";
import { Tooltip } from "react-tooltip";
import CareerRowBadges from "@/lib/components/NotificationComponents/CareerRowBadges";
import { Button } from "../ui";
import { generateJobPortalUrl } from "@/lib/utils/subdomainUtils";
import { Organization } from "@/lib/types/organization";

interface ProjectCareersTableProps {
  projectId: string;
  orgID: string;
  refreshTrigger?: number;
  onCareersChange?: () => void;
  onAddCareers?: () => void;
}

export default function ProjectCareersTable({
  projectId,
  orgID,
  refreshTrigger,
  onCareersChange,
  onAddCareers,
}: ProjectCareersTableProps) {
  const { user } = useAppContext();
  const router = useRouter();
  const [careers, setCareers] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [sortBy, setSortBy] = useState("Recent Activity");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCareer, setSelectedCareer] = useState<Career | null>(null);
  const [isHiringManager, setIsHiringManager] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCareers, setTotalCareers] = useState(0);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const limit = 10;

  const filterStatusOptions = ["All Statuses", "Published", "Unpublished"];
  const sortByOptions: Record<string, { key: string | null; direction: string }> = {
    "Recent Activity": { key: null, direction: "ascending" },
    "Oldest Activity": { key: "lastActivityAt", direction: "ascending" },
    "Date Created (Newest)": { key: "createdAt", direction: "descending" },
    "Date Created (Oldest)": { key: "createdAt", direction: "ascending" },
  };

  // Check if user is hiring manager or guest
  useEffect(() => {
    try {
      const activeOrg = localStorage.getItem('activeOrg');
      if (activeOrg) {
        const orgData = JSON.parse(activeOrg);
        const role = orgData.role;
        setIsHiringManager(role === 'hiring_manager');
        setIsGuest(role === 'guest');
      }
    } catch (error) {
      console.error('Failed to check user role:', error);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    let skeletonTimer: NodeJS.Timeout;

    const fetchCareers = async () => {
      try {
        skeletonTimer = setTimeout(() => {
          setLoading(true);
        }, 200);

        const sortConfig = sortByOptions[sortBy];
        const response = await api.get("/api/get-careers", {
          params: {
            userEmail: user?.email,
            orgID,
            projectId,
            page: currentPage,
            limit,
            sortConfig: sortConfig.key ? JSON.stringify(sortConfig) : null,
            status: filterStatus,
            includeBadges: "true",
          },
        });

        clearTimeout(skeletonTimer);
        setCareers(response.data.careers);
        setTotalPages(response.data.totalPages);
        setTotalCareers(response.data.totalCareers);

        // Handle edge case: if current page exceeds total pages
        if (currentPage > response.data.totalPages && response.data.totalPages > 0) {
          setCurrentPage(1);
        }
      } catch (error) {
        errorToast(error.message, 2500)
      } finally {
        clearTimeout(skeletonTimer);
        setLoading(false);
      }
    };

    if (orgID && user?.email && projectId) {
      fetchCareers();
    }
  }, [orgID, user?.email, projectId, refreshTrigger, filterStatus, sortBy, currentPage]);

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!orgID) return;
      try {
        const response = await api.get("/api/admin/get-organization-details", {
          params: { id: orgID },
        });
        setOrganization(response.data);
      } catch (error) {
        console.error("Error fetching organization:", error);
      }
    };
    fetchOrganization();
  }, [orgID]);

  const handleRemoveFromProject = (career: Career) => {
    setSelectedCareer(career);
    setShowDeleteModal(true);
    setMenuOpen(null);
  };

  const handleDeleteComplete = () => {
    if (selectedCareer) {
      setCareers(prev => prev.filter(c => c._id !== selectedCareer._id));
      setTotalCareers(prev => prev - 1);

      const remainingCareersOnPage = careers.length - 1;
      if (remainingCareersOnPage === 0 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }

      onCareersChange?.();
    }
  };

  const handleCopyLink = (career: Career) => {
    let careerLink: string;
    
    if (organization?.brandedPortalEnabled && organization?.brandedJobPortalSubdomain) {
      careerLink = generateJobPortalUrl(organization.brandedJobPortalSubdomain, career._id);
    } else {
        const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
        careerLink = `${protocol}//${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}/job-openings/${career._id}`;
      }

    navigator.clipboard.writeText(careerLink);
    candidateActionToast(
      "Career Link Copied to Clipboard",
      1300,
      <i className="la la-link mr-1 text-info"></i>
    );
    setMenuOpen(null);
  };

  return (
    <div className={styles.projectCareersTableContainer}>
      {/* Table Header */}
      <div className={styles.tableHeader}>
        <div className={styles.tableTitle}>
          <span>List of Careers</span>
          <span className={styles.careerCount}>{totalCareers}</span>
        </div>
        <div className={styles.tableFilters}>
          <CustomDropdown
            value={filterStatus}
            setValue={(value: string) => {
              setFilterStatus(value);
              setCurrentPage(1);
            }}
            options={filterStatusOptions}
            icon="la-filter"
          />
          <CustomDropdown
            value={sortBy}
            setValue={(value: string) => {
              setSortBy(value);
              setCurrentPage(1);
            }}
            options={Object.keys(sortByOptions)}
            icon="la-sort-amount-down"
            valuePrefix="Sort by:"
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table align-items-center table-flush">
          <thead>
            <tr>
              <th scope="col" className={styles.tableHeaderCell} style={{ width: '25%' }}>Job Title</th>
              <th scope="col" className={styles.tableHeaderCell} style={{ width: '12%' }}>Status</th>
              <th scope="col" className={`${styles.tableHeaderCell} text-center`} style={{ width: '10%' }}>Ongoing</th>
              <th scope="col" className={`${styles.tableHeaderCell} text-center`} style={{ width: '10%' }}>Dropped</th>
              <th scope="col" className={`${styles.tableHeaderCell} text-center`} style={{ width: '10%' }}>Hired</th>
              <th scope="col" className={styles.tableHeaderCell} style={{ width: '13%' }}>Date Created</th>
              <th scope="col" className={styles.tableHeaderCell} style={{ width: '13%' }}>Last Updated</th>
              <th scope="col" style={{ width: '7%' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(limit)].map((_, index) => (
                <tr key={index}>
                  <td><div className="skeleton-bar" style={{ width: '150px' }} /></td>
                  <td><div className="skeleton-bar" style={{ width: '80px', height: '24px', borderRadius: '12px' }} /></td>
                  <td className="text-center"><div className="skeleton-bar mx-auto" style={{ width: '30px' }} /></td>
                  <td className="text-center"><div className="skeleton-bar mx-auto" style={{ width: '30px' }} /></td>
                  <td className="text-center"><div className="skeleton-bar mx-auto" style={{ width: '30px' }} /></td>
                  <td><div className="skeleton-bar" style={{ width: '90px' }} /></td>
                  <td><div className="skeleton-bar" style={{ width: '90px' }} /></td>
                  <td><div className="skeleton-bar" style={{ width: '20px' }} /></td>
                </tr>
              ))
            ) : careers.length === 0 ? (
              <tr className={styles.emptyStateRow}>
                <td colSpan={8} className="p-0">
                  {filterStatus !== "All Statuses" || sortBy !== "Recent Activity" ? (
                    <div className={styles.noResultsContainer}>
                      <div className={styles.noResultsIllustration}>
                        <img src="/no-results.svg" alt="No results" />
                      </div>
                      <h3 className={styles.noResultsHeading}>
                        No careers match your filters
                      </h3>
                      <p className={styles.noResultsDescription}>
                        Try adjusting your filter settings to see more results.
                      </p>
                    </div>
                  ) : (
                    <div className={styles.emptyStateContainer}>
                      <div className={styles.emptyStateIllustration}>
                        <img src="/no-results.svg" alt="No careers" />
                      </div>
                      <h3 className={styles.emptyStateHeading}>
                        This project doesn't have any careers yet.
                      </h3>
                      <p className={styles.emptyStateDescription}>
                        Organize similar careers by adding them to this project.
                      </p>
                      <Button
                        variant="primary"
                        onClick={() => !isGuest && onAddCareers()}
                        disabled={isGuest}
                        data-tooltip-id="empty-add-careers-tooltip"
                        data-tooltip-content="Guest users have view-only access"
                        style={{
                          opacity: isGuest ? 0.6 : 1,
                          cursor: isGuest ? 'not-allowed' : 'pointer'
                        }}
                        label="Add careers to this project"
                        icon="/icons/plus.svg"
                      />
                      {isGuest && <Tooltip place="bottom" id="empty-add-careers-tooltip" />}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              careers.map((career) => (
                <tr 
                  key={career._id}
                  onClick={(e) => {
                    if (e.defaultPrevented) return;
                    e.preventDefault();
                    router.push(`/recruiter-dashboard/careers/manage/${career._id}?orgID=${orgID}`);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td className={styles.jobTitleCell}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {career.jobTitle}
                      <CareerRowBadges
                        careerId={career._id}
                        showComments={true}
                        showActions={false}
                        precomputedBadges={career.badges}
                      />
                    </div>
                  </td>
                  <td>
                    <CareerStatus status={career.status} />
                  </td>
                  <td className="text-center">{career.interviewsInProgress || 0}</td>
                  <td className="text-center">{career.dropped || 0}</td>
                  <td className="text-center">{career.hired || 0}</td>
                  <td>{moment(career.createdAt).format("MMM D, YYYY")}</td>
                  <td>
                    {career.lastActivityAt
                      ? moment(career.lastActivityAt).format("MMM D, YYYY")
                      : "N/A"}
                  </td>
                  <td>
                    <div className="dropdown" ref={menuOpen === career._id ? dropdownRef : null}>
                      <button
                        className={styles.menuButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setMenuOpen(menuOpen === career._id ? null : career._id)
                        }}
                      >
                        <i className="la la-ellipsis-v"></i>
                      </button>
                      {menuOpen === career._id && (
                        <div className={`dropdown-menu dropdown-menu-right show ${styles.careerDropdownMenu}`}>
                          {!isHiringManager && !isGuest && (
                            <div
                              className="dropdown-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleRemoveFromProject(career)
                              }}
                            >
                              <i className="la la-minus-circle mr-2"></i>
                              <span>Remove from project</span>
                            </div>
                          )}
                          <div
                            className="dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleCopyLink(career)
                            }}
                          >
                            <i className="la la-link mr-2"></i>
                            <span>Copy career link</span>
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

        {/* Pagination */}
        {!loading && careers.length > 0 && (
          <div className="d-flex justify-content-between align-items-center border-top" style={{ padding: "15px 20px" }}>
            <button
              className={`btn btn-primary shadow-none ${currentPage === 1 ? "invisible" : ""}`}
              style={{
                backgroundColor: "white",
                color: "black",
                border: "1px solid lightgray",
                fontSize: "14px",
                fontWeight: 550,
                borderRadius: "60px"
              }}
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                }
              }}
            >
              <i className="la la-arrow-left"></i> Previous
            </button>

            <div>
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  className={`btn shadow-none ${currentPage === index + 1 ? "btn-primary" : ""}`}
                  style={{
                    backgroundColor: currentPage === index + 1 ? "#F8F8F8" : "white",
                    color: "black",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: 550,
                    borderRadius: "60px"
                  }}
                  onClick={() => {
                    setCurrentPage(index + 1);
                  }}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <button
              className={`btn btn-primary shadow-none ${currentPage >= totalPages ? "invisible" : ""}`}
              style={{
                backgroundColor: "white",
                color: "black",
                border: "1px solid lightgray",
                fontSize: "14px",
                fontWeight: 550,
                borderRadius: "60px"
              }}
              onClick={() => {
                if (currentPage < totalPages) {
                  setCurrentPage(currentPage + 1);
                }
              }}
            >
              Next <i className="la la-arrow-right"></i>
            </button>
          </div>
        )}
      </div>

      {showDeleteModal && selectedCareer && (
        <DeleteCareerModal
          career={{ _id: selectedCareer._id, jobTitle: selectedCareer.jobTitle }}
          projectId={projectId}
          orgID={orgID}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedCareer(null);
          }}
          onDelete={handleDeleteComplete}
        />
      )}
    </div>
  );
}
