"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import { Project } from "@/lib/types/projects";

interface ProjectDropdownProps {
  selectedProject: string;
  selectedProjectId?: string;
  onSelectProject: (projectName: string, projectId: string) => void;
  orgID: string;
  userEmail?: string;
  error?: boolean;
}

export default function ProjectDropdown({
  selectedProject,
  onSelectProject,
  orgID,
  userEmail,
  error = false,
}: ProjectDropdownProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      if (!orgID) {
        setProjects([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.post("/api/projects/list", {
          orgID,
          userEmail
        });

        if (response.status === 200 && response.data.success) {
          setProjects(response.data.projects || []);
        } else {
          setApiError("Failed to load projects");
          setProjects([]);
        }
      } catch (err: any) {
        setApiError(err.message || "An error occurred");
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [orgID, userEmail]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Filter projects based on search
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;

    return projects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const handleSelectProject = (projectName: string, projectId: string) => {
    onSelectProject(projectName, projectId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleCreateNewProject = () => {
    setIsOpen(false);
    router.push(`/recruiter-dashboard/projects?orgID=${orgID}`);
  };

  return (
    <div
      ref={dropdownRef}
      className="dropdown w-100"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      {/* Trigger Button */}
      <button
        className="dropdown-btn fade-in-bottom"
        style={{
          width: "100%",
          height: "48px",
          color: "#181D27",
          border: error ? "2px solid #EF4444" : "2px solid #E9EAEB",
          backgroundColor: "#FFFFFF",
          borderRadius: "8px",
          padding: "0 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
      >
        <span style={{ color: selectedProject ? "#181D27" : "#717680" }}>
          {selectedProject || "Select project"}
        </span>
        <i className="la la-angle-down ml-10"></i>
      </button>

      {/* Validation Error */}
      <div
        style={{
          minHeight: error && !isOpen ? "18px" : "0",
          marginTop: error && !isOpen ? 4 : 0,
        }}
      >
        {error && !isOpen && (
          <span style={{ color: "#EF4444", fontSize: 12, fontWeight: 400 }}>
            This is a required field.
          </span>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="org-dropdown-anim show"
          style={{
            width: "350px",
            position: "absolute",
            top: "calc(48px + 4px)",
            left: "0",
            right: "0",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            maxHeight: "300px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search Input */}
          <div
            style={{ padding: "8px 12px", borderBottom: "1px solid #E9EAEB" }}
          >
            <div style={{ position: "relative" }}>
              <i
                className="la la-search"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#717680",
                  fontSize: "16px",
                }}
              />
              <input
                type="text"
                placeholder="Search projects"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 36px",
                  border: "1px solid #E9EAEB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Projects List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {isLoading ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#717680",
                }}
              >
                <i
                  className="la la-spinner la-spin"
                  style={{ fontSize: "20px" }}
                />
                <div style={{ marginTop: "8px", fontSize: "14px" }}>
                  Loading projects...
                </div>
              </div>
            ) : apiError ? (
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "6px",
                  margin: "8px 12px",
                  color: "#B42318",
                  fontSize: "14px",
                }}
              >
                <i
                  className="la la-exclamation-circle"
                  style={{ marginRight: "8px" }}
                />
                {apiError}
              </div>
            ) : filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <div
                  key={project._id}
                  onClick={() => handleSelectProject(project.name, project._id)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor:
                      selectedProject === project.name
                        ? "#F8F9FC"
                        : "transparent",
                    fontWeight: selectedProject === project.name ? 700 : 500,
                  }}
                >
                  <span style={{ color: "#414651", fontSize: "14px" }}>
                    {project.name}
                  </span>
                  <span
                    style={{
                      color: "#717680",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    {project.careers?.length || 0} careers
                  </span>
                </div>
              ))
            ) : searchQuery ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#717680",
                  fontSize: "14px",
                }}
              >
                No projects match "{searchQuery}"
              </div>
            ) : (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#717680",
                  fontSize: "14px",
                }}
              >
                No projects found
              </div>
            )}
          </div>

          <div style={{
            display: "flex",
            justifyContent: "end",
            borderTop: "1px solid #e9eaeb",
            padding: "16px 24px",
          }}>
            {/* Create New Project Button */}
            {!isLoading && !apiError && (
              <div
                onClick={handleCreateNewProject}
                style={{
                  width: "180px",
                  padding: "10px 12px",
                  border: "1px solid #D5D7DA",
                  borderRadius: "999px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#414651",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                <i className="la la-plus" style={{ fontSize: "16px" }} />
                <span>Create new project</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
