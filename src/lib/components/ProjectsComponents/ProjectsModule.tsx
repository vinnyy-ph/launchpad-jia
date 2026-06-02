"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import AvatarImage from "../AvatarImage/AvatarImage";
import CustomDropdown from "../Dropdown/CustomDropdown";
import CreateProjectModal from "./CreateProjectModal";
import ManageMembersModal from "./ManageMembersModal";
import TransferOwnershipModal from "./TransferOwnershipModal";
import DeleteProjectModal from "./DeleteProjectModal";
import RenameProjectModal from "./RenameProjectModal";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Member, Project } from "@/lib/types/projects";
import { errorToast } from "@/lib/Utils";
import { Tooltip } from "react-tooltip";
import { Button } from "../ui";

type SortOption = "newest" | "oldest" | "a-z" | "z-a" | "most-careers" | "least-careers";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "a-z", label: "A-Z" },
  { value: "z-a", label: "Z-A" },
  { value: "most-careers", label: "Most Careers" },
  { value: "least-careers", label: "Least Careers" },
];

export default function ProjectsModule() {
  const { orgID, user } = useAppContext();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [isLoading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [isHiringManager, setIsHiringManager] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter and sort projects
  const filteredProjects = projects
    .filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "a-z":
          return a.name.localeCompare(b.name);
        case "z-a":
          return b.name.localeCompare(a.name);
        case "most-careers":
          return b.careers.length - a.careers.length;
        case "least-careers":
          return a.careers.length - b.careers.length;
        default:
          return 0;
      }
    });

  // Check if dropdown is open
  const isDropdownOpen = selectedProject && !showMembersModal && !showTransferModal && !showDeleteModal && !showRenameModal;

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
        setSelectedProject(null);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!orgID || !user?.email) return;

      setLoading(true);
      try {
        const response = await api.post("/api/projects/list", {
          orgID,
          userEmail: user.email
        });
        if (response.status === 200) {
          setProjects(response.data.projects || []);
        }
      } catch (error) {
        errorToast(error.message, 2500)
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [orgID, user?.email]);

  const handleOpenMembersModal = (project: Project) => {
    setSelectedProject(project);
    setShowMembersModal(true);
  };

  const handleCloseMembersModal = () => {
    setShowMembersModal(false);
    setSelectedProject(null);
  };

  const handleSaveMembers = (updatedMembers: Member[]) => {
    if (selectedProject) {
      // Update the project in the local state
      setProjects((prevProjects) =>
        prevProjects.map((p) =>
          p._id === selectedProject._id
            ? { ...p, members: updatedMembers }
            : p
        )
      );
    }
  };

  const handleToggleDropdown = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProject(selectedProject?._id === project._id ? null : project);
  };

  const handleTransferOwnership = () => {
    setShowTransferModal(true);
  };

  const handleCloseTransferModal = () => {
    setShowTransferModal(false);
    setSelectedProject(null);
  };

  const handleTransferComplete = (newOwner: Member) => {
    if (selectedProject) {
      // Update the project in the local state
      setProjects((prevProjects) =>
        prevProjects.map((p) => {
          if (p._id === selectedProject._id) {
            // Remove new owner from members list
            const updatedMembers = p.members.filter((m) => m.email !== newOwner.email);

            // Add previous owner as a member
            const previousOwner = updatedMembers.some(
              (m) => m.email === p.owner.email
            );

            if (!previousOwner) {
              updatedMembers.push({
                _id: p.owner._id,
                name: p.owner.name,
                email: p.owner.email,
                image: p.owner.image,
              });
            }

            return {
              ...p,
              owner: newOwner,
              members: updatedMembers,
            };
          }
          return p;
        })
      );
    }
  };

  const handleManageMembers = () => {
    setShowMembersModal(true);
  };

  const handleSettings = () => {
    if (!selectedProject?._id) return;

    setSelectedProject(null);

    const settingsUrl = orgID
      ? `/recruiter-dashboard/projects/manage/${selectedProject._id}/settings?orgID=${orgID}`
      : `/recruiter-dashboard/projects/manage/${selectedProject._id}/settings`;

    router.push(settingsUrl);
  };

  const handleRename = () => {
    setShowRenameModal(true);
  };

  const handleCloseRenameModal = () => {
    setShowRenameModal(false);
    setSelectedProject(null);
  };

  const handleRenameComplete = (newName: string) => {
    if (selectedProject) {
      setProjects((prevProjects) =>
        prevProjects.map((p) =>
          p._id === selectedProject._id ? { ...p, name: newName } : p
        )
      );
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedProject(null);
  };

  const handleDeleteComplete = () => {
    if (selectedProject) {
      setProjects((prevProjects) =>
        prevProjects.filter((p) => p._id !== selectedProject._id)
      );
    }
  };

  const handleProjectClick = (project: Project) => {
    router.push(`/recruiter-dashboard/projects/manage/${project._id}?orgID=${orgID}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <>
        <div className={`container-fluid mt--7 ${styles.projectsContainer}`}>
          <div className="row">
            <div className="col">
              <div className={styles.pageHeader}>
                <div className={styles.headerContent}>
                  <h1>Projects</h1>
                  <span>
                    Projects allow you to organize your careers into folders.
                  </span>
                </div>
                <div className={styles.headerActions}>
                  <Button
                    variant="primary"
                    disabled
                    style={{ opacity: 0.5, cursor: 'not-allowed' }}
                    label="Create new project"
                    icon="/icons/plus.svg"
                    onClick={() => {}}
                  >
                  </Button>
                  <div className={`table-search-bar ${styles.searchBar}`}>
                    <div className="icon mr-2">
                      <i className="la la-search"></i>
                    </div>
                    <input
                      id="projects-search"
                      type="search"
                      className="form-control ml-auto search-input"
                      placeholder="Search"
                      value=""
                      disabled
                      style={{ opacity: 0.5, cursor: 'not-allowed' }}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.projectsHeader}>
                <div className="skeleton-bar" style={{ width: '100px', height: '20px' }} />
                <div className="skeleton-bar" style={{ width: '150px', height: '20px' }} />
              </div>
              <div className="row">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="col-md-4 mb-4">
                    <div className={styles.projectCard}>
                      <div className={styles.projectCardHeader}>
                        <div>
                          <div className="skeleton-bar" style={{ width: '120px', height: '20px', marginBottom: '8px' }} />
                          <div className="skeleton-bar" style={{ width: '60px', height: '14px' }} />
                        </div>
                      </div>
                      <div className={styles.projectCardBody}>
                        <div className={styles.projectSection}>
                          <div className="skeleton-bar" style={{ width: '80px', height: '12px', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="skeleton-bar" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                            <div className="skeleton-bar" style={{ width: '100px', height: '14px' }} />
                          </div>
                        </div>
                        <div className={styles.projectSection}>
                          <div className="skeleton-bar" style={{ width: '70px', height: '12px', marginBottom: '8px' }} />
                          <div style={{ display: 'flex' }}>
                            {[...Array(3)].map((_, i) => (
                              <div
                                key={i}
                                className="skeleton-bar"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  marginLeft: i > 0 ? '-8px' : '0',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={`container-fluid mt--7 ${styles.projectsContainer}`}>
        <div className="row">
          <div className="col">
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1>Projects</h1>
                <span>
                  Projects allow you to organize your careers into folders.
                </span>
              </div>

              <div className={styles.headerActions}>
                {!isHiringManager && (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => !isGuest && setShowCreateModal(true)}
                      disabled={isGuest}
                      data-tooltip-id="create-project-tooltip"
                      data-tooltip-content="Guest users cannot create projects"
                      style={{
                        opacity: isGuest ? 0.6 : 1,
                        cursor: isGuest ? 'not-allowed' : 'pointer'
                      }}
                      label="Create new project"
                      icon="/icons/plus.svg"
                    >
                    </Button>
                    {isGuest && <Tooltip place="left" id="create-project-tooltip" />}
                  </>
                )}
                <div className={`table-search-bar ${styles.searchBar}`}>
                  <div className="icon mr-2">
                    <i className="la la-search"></i>
                  </div>
                  <input
                    type="search"
                    className="form-control ml-auto search-input"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {projects.length === 0 ? (
              // Empty projects state
              <>
                <div className={`card ${styles.emptyStateCard}`}>
                  <div className="card-body">
                    <div className={styles.emptyStateImage}>
                      <img src="/no-results.svg" alt="No project results icon" />
                    </div>
                    <h3 className={styles.emptyStateTitle}>No projects available</h3>
                    <p className={styles.emptyStateText}>
                      Start by creating a project to add existing careers
                    </p>
                  </div>
                </div>

                {showCreateModal && (
                  <CreateProjectModal
                    onClose={() => setShowCreateModal(false)}
                  />
                )}
              </>

            ) : (
              <div className={styles.projectsHeader}>
                <p className={styles.projectsCount}>
                  {filteredProjects.length} Project{filteredProjects.length !== 1 ? "s" : ""}
                  {searchQuery && ` (filtered from ${projects.length})`}
                </p>
                <CustomDropdown
                  value={sortOptions.find((opt) => opt.value === sortBy)?.label || "Newest First"}
                  setValue={(label: string) => {
                    const option = sortOptions.find((opt) => opt.label === label);
                    if (option) setSortBy(option.value);
                  }}
                  options={sortOptions.map((opt) => opt.label)}
                  icon="la-sort-amount-down"
                  valuePrefix="Sort by:"
                />
              </div>


            )}

            {projects.length > 0 && filteredProjects.length === 0 && searchQuery ? (
              <div className={styles.noSearchResults}>
                <p>No projects found matching "{searchQuery}"</p>
              </div>
            ) : (
              <div className="row">
                {filteredProjects.map((project) => (
                <div key={project._id} className="col-md-4 mb-4">
                  <div
                    className={styles.projectCard}
                    onClick={() => handleProjectClick(project)}
                  >
                    {/* Title */}
                    <div className={styles.projectCardHeader}>
                      <div>
                        <h3 className={styles.projectTitle}>
                          <a href={`/recruiter-dashboard/projects/manage/${project._id}?orgID=${orgID}`} 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/recruiter-dashboard/projects/manage/${project._id}?orgID=${orgID}`);
                          }}
                          style={{ color: "inherit", textDecoration: "none" }}
                          >
                          {project.name}
                          </a>
                        </h3>
                        <p className={styles.careersCount}>
                          {project.careers.length} careers
                        </p>
                      </div>
                      {!isHiringManager && !isGuest && (
                        <div
                          className={styles.dropdownContainer}
                          ref={selectedProject?._id === project._id ? dropdownRef : null}
                        >
                          <i
                            className="las la-ellipsis-v"
                            onClick={(e) => handleToggleDropdown(project, e)}
                          ></i>
                          {selectedProject?._id === project._id && isDropdownOpen && (
                            <>
                              <div className={styles.dropdownMenu}>
                                <div
                                  className={styles.dropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTransferOwnership();
                                  }}
                                >
                                  <i className="las la-exchange-alt"></i>
                                  <span>Transfer ownership</span>
                                </div>
                                <div
                                  className={styles.dropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleManageMembers();
                                  }}
                                >
                                  <i className="las la-users-cog"></i>
                                  <span>Manage members</span>
                                </div>
                                <div
                                  className={styles.dropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSettings();
                                  }}
                                >
                                  <i className="las la-cog"></i>
                                  <span>Settings</span>
                                </div>
                                <div
                                  className={styles.dropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRename();
                                  }}
                                >
                                  <i className="las la-font"></i>
                                  <span>Rename</span>
                                </div>
                                <div
                                  className={`${styles.dropdownItem} ${styles.deleteItem}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete();
                                  }}
                                >
                                  <i className="las la-trash-alt"></i>
                                  <span>Delete</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className={styles.projectCardBody}>
                      {/* Project Owner Section */}
                      <div className={styles.projectSection}>
                        <p className={styles.sectionLabel}>Project Owner</p>
                        <div className={styles.ownerInfo}>
                          <AvatarImage
                            src={project.owner.image}
                            alt={project.owner.name}
                          />
                          <span className={styles.ownerName}>
                            {project.owner.name}
                          </span>
                        </div>
                      </div>
                      {/* Members Section */}
                      <div
                        className={`${styles.projectSection} ${styles.membersClickable}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenMembersModal(project);
                        }}
                      >
                        <p className={styles.sectionLabel}>
                          {project.members.length} Members
                        </p>
                        <div className={styles.membersAvatars}>
                          {project.members.slice(0, 7).map((member, index) => (
                            <div
                              key={member.email}
                              className={`${styles.avatarWrapper} ${index > 0 ? styles.overlapping : ""
                                }`}
                            >
                              <AvatarImage
                                src={member.image}
                                alt={member.name}
                                className={styles.avatarBorder}
                              />
                            </div>
                          ))}
                          {project.members.length > 7 && (
                            <div className={styles.moreMembers}>
                              +{project.members.length - 7}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )}

            {showCreateModal && (
              <CreateProjectModal onClose={() => setShowCreateModal(false)} />
            )}

            {showMembersModal && selectedProject && (
              <ManageMembersModal
                project={selectedProject}
                onClose={handleCloseMembersModal}
                onSave={handleSaveMembers}
              />
            )}

            {showTransferModal && selectedProject && (
              <TransferOwnershipModal
                project={selectedProject}
                onClose={handleCloseTransferModal}
                onTransfer={handleTransferComplete}
              />
            )}

            {showDeleteModal && selectedProject && (
              <DeleteProjectModal
                project={selectedProject}
                onClose={handleCloseDeleteModal}
                onDelete={handleDeleteComplete}
              />
            )}

            {showRenameModal && selectedProject && (
              <RenameProjectModal
                project={selectedProject}
                onClose={handleCloseRenameModal}
                onRename={handleRenameComplete}
              />
            )}

          </div>
        </div>
      </div>
    </>
  );
}
