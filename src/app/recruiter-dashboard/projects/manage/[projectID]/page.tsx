"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, use } from "react";
import { api } from "@/lib/utils/apiClient";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import AddCareersModal from "@/lib/components/ProjectsComponents/AddCareersModal";
import styles from "@/lib/styles/screens/manage-project.module.scss";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import ShowCareersModal from "@/lib/components/ProjectsComponents/ShowCareersModal";
import ProjectCareersTable from "@/lib/components/ProjectsComponents/ProjectCareersTable";
import TransferOwnershipModal from "@/lib/components/ProjectsComponents/TransferOwnershipModal";
import ManageMembersModal from "@/lib/components/ProjectsComponents/ManageMembersModal";
import DeleteProjectModal from "@/lib/components/ProjectsComponents/DeleteProjectModal";
import RenameProjectModal from "@/lib/components/ProjectsComponents/RenameProjectModal";
import { Member, Project } from "@/lib/types/projects";
import { errorToast } from "@/lib/Utils";
import { Tooltip } from "react-tooltip";
import { Button } from "@/lib/components/ui";
import RecruiterPipelineReport from "@/lib/components/AnalyticsComponents/RecruiterPipelineReport";

interface ManageProjectPageProps {
  params: Promise<{ projectID: string }>
}

export default function ManageProjectPage({ params }: ManageProjectPageProps) {
  const { projectID } = use(params);
  const searchParams = useSearchParams();
  const orgID = searchParams.get("orgID");
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAddCareersModal, setShowAddCareersModal] = useState(false);
  const [showExistingCareersModal, setShowExistingCareersModal] = useState(false);
  const [refreshCareers, setRefreshCareers] = useState(0);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [isHiringManager, setIsHiringManager] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<any>("Overview");
  const tabs = [
    "Overview",
    "Pipeline Report"
  ]

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setShowOptionsMenu(false);
      }
    };

    if (showOptionsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showOptionsMenu]);

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

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectID || !orgID) return;

      try {
        setLoading(true);
        const response = await api.post("/api/projects/get", {
          projectId: projectID,
          orgID,
        });
        if (response.status === 200) {
          setProject(response.data.project);
        }
      } catch (error) {
        errorToast(error.message, 2500)
        router.push(`/recruiter-dashboard/projects?orgID=${orgID}&limit=1000`);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectID, orgID, router]);

  const handleAddCareers = () => {
    setShowAddCareersModal(true);
  };
  
  const handleSaveCareers = () => {
    setRefreshCareers(prev => prev + 1);
  }

  const handleSelectExisting = () => {
    setShowAddCareersModal(false);
    setShowExistingCareersModal(true);
  };

  const handleBackToAddCareers = () => {
    setShowExistingCareersModal(false);
    setShowAddCareersModal(true);
  };

  const handleSelectNew = () => {
    setShowAddCareersModal(false);
    router.push(`/recruiter-dashboard/careers/new-career?orgID=${orgID}&projectId=${projectID}&projectName=${encodeURIComponent(project.name)}`);
  };

  const handleTransferOwnership = () => {
    setShowOptionsMenu(false);
    setShowTransferModal(true);
  };

  const handleManageMembers = () => {
    setShowOptionsMenu(false);
    setShowManageMembersModal(true);
  };

  const handleDelete = () => {
    setShowOptionsMenu(false);
    setShowDeleteModal(true);
  };

  const handleRename = () => {
    setShowOptionsMenu(false);
    setShowRenameModal(true);
  };

  const handleSettings = () => {
    setShowOptionsMenu(false);
    const settingsUrl = orgID
      ? `/recruiter-dashboard/projects/manage/${projectID}/settings?orgID=${orgID}`
      : `/recruiter-dashboard/projects/manage/${projectID}/settings`;
    router.push(settingsUrl);
  };

  const handleRenameComplete = (newName: string) => {
    setProject(prev => prev ? { ...prev, name: newName } : null);
  };

  const handleTransferComplete = (newOwner: Member) => {
    if (!project) return;

    // Add previous owner as a member if not already in the list
    const updatedMembers = project.members.filter(
      (m) => m.email !== newOwner.email
    );

    const previousOwnerIsMember = updatedMembers.some(
      (m) => m.email === project.owner.email
    );

    if (!previousOwnerIsMember) {
      updatedMembers.push({
        _id: project.owner._id,
        name: project.owner.name,
        email: project.owner.email,
        image: project.owner.image,
      });
    }

    setProject(prev => prev ? { ...prev, owner: newOwner, members: updatedMembers } : null);
  };

  const handleMembersUpdate = (updatedMembers: Member[]) => {
    setProject(prev => prev ? { ...prev, members: updatedMembers } : null);
  };

  const handleDeleteComplete = () => {
    router.push("/recruiter-dashboard/projects");
  };

  if (loading || !project) {
    return (
      <>
        <HeaderBar
          activeLink="Projects"
          currentPage="Loading..."
          icon="la la-folder"
        />
        <div className={styles.manageProjectContainer}>
          {/* Skeleton Header */}
          <div className={styles.projectHeaderSection}>
            <div className={styles.projectHeaderLeft}>
              <div className={styles.projectTitleRow}>
                <div className="skeleton-bar" style={{ width: '200px', height: '28px' }}></div>
              </div>
              <div className={styles.projectMetaRow}>
                <div className="skeleton-bar" style={{ width: '100px' }}></div>
                <div className="skeleton-bar" style={{ width: '32px', height: '32px', borderRadius: '50%' }}></div>
                <div className="skeleton-bar" style={{ width: '80px' }}></div>
                <span className={styles.membersSeparator}>|</span>
                <div className="skeleton-bar" style={{ width: '80px' }}></div>
                <div className={styles.memberAvatarsSmall}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton-bar" style={{ width: '32px', height: '32px', borderRadius: '50%', marginLeft: i > 1 ? '-8px' : '0' }}></div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.projectHeaderRight}>
              <div className="skeleton-bar" style={{ width: '200px', height: '40px', borderRadius: '999px' }}></div>
            </div>
          </div>

          {/* Skeleton Table */}
          <div style={{ border: '1px solid #E9EAEB', borderRadius: '16px', overflow: 'hidden', flex: 1 }}>
            <div style={{ display: 'flex', gap: '16px', padding: '16px 24px', background: '#f9fafb', borderBottom: '1px solid #E9EAEB' }}>
              <div className="skeleton-bar" style={{ width: '150px' }}></div>
              <div className="skeleton-bar" style={{ width: '100px' }}></div>
              <div className="skeleton-bar" style={{ width: '100px' }}></div>
              <div className="skeleton-bar" style={{ width: '80px' }}></div>
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', padding: '16px 24px', borderBottom: i < 5 ? '1px solid #E9EAEB' : 'none' }}>
                <div className="skeleton-bar" style={{ width: '60%' }}></div>
                <div className="skeleton-bar" style={{ width: '15%' }}></div>
                <div className="skeleton-bar" style={{ width: '15%' }}></div>
                <div className="skeleton-bar" style={{ width: '10%' }}></div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderBar
        activeLink="Projects"
        currentPage={project.name}
        icon="la la-folder"
      />
      <div className={styles.manageProjectContainer}>
        {/* Project Header */}
        <div className={styles.projectHeaderSection}>
          <div className={styles.projectHeaderLeft}>
            <div className={styles.projectTitleRow}>
              <h1 className={styles.projectMainTitle}>{project?.name}</h1>
              {!isHiringManager && !isGuest && (
                <div className={styles.optionsMenuWrapper} ref={optionsMenuRef}>
                  <button
                    className={styles.moreOptionsButton}
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  >
                    <i className="las la-ellipsis-v"></i>
                  </button>
                  {showOptionsMenu && (
                    <div className={styles.optionsDropdownMenu}>
                      <button className={styles.optionsMenuItem} onClick={handleTransferOwnership}>
                        <i className="las la-exchange-alt"></i>
                        Transfer ownership
                      </button>
                      <button className={styles.optionsMenuItem} onClick={handleManageMembers}>
                        <i className="las la-users"></i>
                        Manage members
                      </button>
                      <button className={styles.optionsMenuItem} onClick={handleSettings}>
                        <i className="las la-cog"></i>
                        Settings
                      </button>
                      <button className={styles.optionsMenuItem} onClick={handleRename}>
                        <i className="las la-font"></i>
                        Rename
                      </button>
                      <button className={styles.optionsMenuItem} onClick={handleDelete}>
                        <i className="las la-trash"></i>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={styles.projectMetaRow}>
              <span className={styles.projectOwnerLabel}>Project Owner:</span>
              <div className={styles.projectOwnerInfo}>
                <AvatarImage
                  src={project?.owner?.image}
                  alt={project?.owner?.name}
                />
                <span>{project?.owner?.name}</span>
              </div>
              <span className={styles.membersSeparator}>|</span>
              <span className={styles.membersCount}>
                {project?.members?.length || 0} Members:
              </span>
              <div className={styles.memberAvatarsSmall}>
                {project?.members?.slice(0, 5).map((member, index) => (
                  <div
                    key={member._id || member.email}
                    className={`${styles.avatarWrapperSmall} ${
                      index > 0 ? styles.overlappingSmall : ""
                    }`}
                  >
                    <AvatarImage
                      src={member.image}
                      alt={member.name}
                      className={styles.avatarBorderSmall}
                    />
                  </div>
                ))}
                {(project?.members?.length || 0) > 5 && (
                  <div className={styles.moreMembersSmall}>
                    +{(project?.members?.length || 0) - 5}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className={styles.projectHeaderRight}>
            <Button
              variant="primary"
              onClick={() => !isGuest && handleAddCareers()}
              disabled={isGuest}
              data-tooltip-id="add-careers-tooltip"
              data-tooltip-content="Guest users have view-only access"
              style={{
                opacity: isGuest ? 0.6 : 1,
                cursor: isGuest ? 'not-allowed' : 'pointer'
              }}
              label="Add careers to this project"
              icon="/icons/plus.svg"
            >
            </Button>
            {isGuest && <Tooltip place="left" id="add-careers-tooltip" />}
          </div>
        </div>

                {/* Tabs */}
                <div className={styles.dashboardTabContainer}>
            {tabs.map((tab: string, index: number) => (
              <div
                key={index}
                className={`${activeTab === tab ? styles.dashboardActiveTabItem : styles.dashboardTabItem}`}
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                onClick={() => {
                  setActiveTab(tab);
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>{tab}</span>
                </span>
              </div>
            ))}
          </div>
        {/* Careers Table */}
        {activeTab === "Overview" && <ProjectCareersTable
          projectId={projectID as string}
          orgID={orgID as string}
          refreshTrigger={refreshCareers}
          onCareersChange={handleSaveCareers}
          onAddCareers={handleAddCareers}
        />}
        {activeTab === "Pipeline Report" && <RecruiterPipelineReport projectId={projectID as string} />}
      </div>

      {showAddCareersModal && (
        <AddCareersModal
          onClose={() => setShowAddCareersModal(false)}
          onSelectExisting={handleSelectExisting}
          onSelectNew={handleSelectNew}
        />
      )}

      {showExistingCareersModal && (
        <ShowCareersModal
          onClose={() => setShowExistingCareersModal(false)}
          onBack={handleBackToAddCareers}
          projectId={projectID as string}
          onSave={handleSaveCareers}
        />
      )}

      {showTransferModal && project && (
        <TransferOwnershipModal
          project={project}
          onClose={() => setShowTransferModal(false)}
          onTransfer={handleTransferComplete}
        />
      )}

      {showManageMembersModal && project && (
        <ManageMembersModal
          project={project}
          onClose={() => setShowManageMembersModal(false)}
          onSave={handleMembersUpdate}
        />
      )}

      {showDeleteModal && project && (
        <DeleteProjectModal
          project={project}
          onClose={() => setShowDeleteModal(false)}
          onDelete={handleDeleteComplete}
        />
      )}

      {showRenameModal && project && (
        <RenameProjectModal
          project={project}
          onClose={() => setShowRenameModal(false)}
          onRename={handleRenameComplete}
        />
      )}
    </>
  );
}
