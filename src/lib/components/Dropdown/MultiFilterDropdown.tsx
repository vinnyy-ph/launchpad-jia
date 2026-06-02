"use client"
import useDebounce from "@/lib/hooks/useDebounceHook";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import { useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import { CAREER_STATUS_OPTIONS } from "@/lib/utils/constants";

interface MultiFilterDropdownProps {
    options: any;
    setOptions: (options: any) => void;
    filterTypes: ("jobOwners" | "projects" | "careers" | "contributors" | "careerStatuses" | "hiringManagers")[];
    icon?: string;
    iconJsx?: React.ReactNode;
    iconPosition?: "left" | "right";
    valuePrefix?: string;
    projectId?: string;
    showSetAsDefaultToggle?: boolean;
    isSetAsDefault?: boolean;
    isSetAsDefaultLoading?: boolean;
    onSetAsDefaultChange?: (checked: boolean) => void;
}

function getEntityIdentifier(value: any) {
  return String(value?.id || value?._id || value?.email || "");
}

export default function MultiFilterDropdown({
    options,
    setOptions,
    filterTypes,
    icon,
    iconJsx,
    iconPosition = "left",
    valuePrefix,
    projectId,
    showSetAsDefaultToggle = false,
    isSetAsDefault,
    isSetAsDefaultLoading = false,
    onSetAsDefaultChange,
  }: MultiFilterDropdownProps) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [localSetAsDefault, setLocalSetAsDefault] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [activeOrg] = useLocalStorage("activeOrg", null);
    const isSetAsDefaultControlled = typeof isSetAsDefault === "boolean";
    const setAsDefaultChecked = isSetAsDefaultControlled
      ? (isSetAsDefault as boolean)
      : localSetAsDefault;
  
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setDropdownOpen(false);
        }
      };
  
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);
  
    const renderIcon = () => {
      if (iconJsx) return iconJsx;
      if (icon) return <i className={`la ${icon}`} style={{ fontSize: 16 }} />;
      return null;
    };
  
    const getFilterCount = (options: any, type: "jobOwners" | "projects" | "careers" | "contributors" | "careerStatuses" | "total") => {
      let jobOwnersCount = 0;
      let projectsCount = 0;
      let careersCount = 0;
      let contributorsCount = 0;
      let statusCount = 0;
      
      if (options.jobOwners?.length > 0) {
        jobOwnersCount += options.jobOwners.length;
      }

      if (options.careers?.length > 0) {
        careersCount += options.careers.length;
      }

      if (options.contributors?.length > 0) {
        contributorsCount += options.contributors.length;
      }
      
      if (options.projects?.length > 0) {
        projectsCount += options.projects.length;
      }

      if (options["Subscription Plan"]?.length > 0) {
        statusCount += 1;
      }
  
      if (options["Published Status"]?.length > 0) {
        statusCount += 1;
      }
  
      if (options["Activity Status"]?.length > 0) {
        statusCount += 1;
      }
  
      if (type === "jobOwners") {
        return jobOwnersCount;
      }
      if (type === "projects") {
        return projectsCount;
      }
      if (type === "careers") {
        return careersCount;
      }
      if (type === "contributors") {
        return contributorsCount;
      }
      if (type === "careerStatuses") {
        return statusCount;
      }
      return careersCount + jobOwnersCount + projectsCount + contributorsCount + statusCount;
    }
  
    return (
       <div ref={dropdownRef} className="dropdown">
              <div
          className="button-v2 secondary"
          style={{
            minWidth: "180px",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: "8px",
          }}
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          {(iconPosition === "left") && renderIcon()}
          <span>
            {valuePrefix || ""} {getFilterCount(options, "total") > 0 ? `(${getFilterCount(options, "total")})` : ""}
          </span>
          {iconPosition === "right" && renderIcon()}
          <img src="/iconsV3/chevron-down.svg" alt="Chevron down" style={{ width: 12, height: 7 }} />
        </div>
  
        {dropdownOpen && (
          <div
            className={`dropdown-menu dropdown-menu-right mt-1 org-dropdown-anim${
              dropdownOpen ? " show" : ""
            }`}
          >
            {showSetAsDefaultToggle && (
              <>
                <div
                  className="multi-filter-default-toggle-row"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="multi-filter-default-toggle-label">Set as Default</span>
                  <label className="multi-filter-default-toggle-switch">
                    <input
                      type="checkbox"
                      aria-label="Set current filters as default"
                      disabled={isSetAsDefaultLoading}
                      checked={setAsDefaultChecked}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (!isSetAsDefaultControlled) {
                          setLocalSetAsDefault(checked);
                        }
                        onSetAsDefaultChange?.(checked);
                      }}
                    />
                    <span className="multi-filter-default-toggle-slider" />
                  </label>
                </div>
                <div className="dropdown-divider" />
              </>
            )}
            {filterTypes.includes("careers") && <CareerFilterDropdownItem options={options} setOptions={setOptions} projectId={projectId} />}
            {filterTypes.includes("jobOwners") && <JobOwnerFilterDropdownItem options={options} setOptions={setOptions} projectId={projectId} />}
            {filterTypes.includes("hiringManagers") && <HiringManagerFilterDropdownItem options={options} setOptions={setOptions} />}
            {filterTypes.includes("contributors") && <JobContributorFilterDropdownItem options={options} setOptions={setOptions} projectId={projectId} />}
            {activeOrg?.projectsEnabled && filterTypes.includes("projects") && !projectId && <ProjectFilterDropdownItem options={options} setOptions={setOptions} />}
            {filterTypes.includes("careerStatuses") && <CareerStatusFilterDropdownItem options={options} setOptions={setOptions} />}
          </div>
        )}
       </div>
    )
}

function CareerFilterDropdownItem({ options, setOptions, projectId }: { options: {careers: {id?: string, _id?: string, jobTitle: string}[]}, setOptions: (options: {careers: {id?: string, _id?: string, jobTitle: string}[]}) => void, projectId?: string }) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [search, setSearch] = useState<string>("");
    const debouncedSearch = useDebounce(search, 500);
    const [careers, setCareers] = useState<any[]>([]);
    const [filterOptionOpen, setFilterOptionOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const isLoadingRef = useRef(null);

    const fuseOptions = {
        keys: ["jobTitle"],
        threshold: 0.3,
      };
    
      const filteredCareers = useMemo(() => {
        if (!search) return careers;
        const fuse = new Fuse(careers, fuseOptions);
        return fuse.search(search).map((result) => result.item);
      }, [search, careers]);
      
      useEffect(() => {
          const fetchCareerFilters = async () => {
              if (isLoadingRef.current) return;
              isLoadingRef.current = true;
  
              try {
                  setIsLoading(true);
                  const response = await api.post("/api/fetch-careers", { 
                      orgID,
                      projectId,
                  });
                  setCareers(response.data);
              } catch (error) {
                  errorToast("Error fetching Careers", 1300);
              } finally {
                  setIsLoading(false);
                  isLoadingRef.current = false;
              }
          }
          if (orgID) {
              fetchCareerFilters();
          }
       }, [orgID, projectId]);


    return (
        <div className="dropdown-item" 
        onMouseOver={() => setFilterOptionOpen(true)}
        onMouseOut={() => setFilterOptionOpen(false)}
        onClick={(e) => {
            e.stopPropagation();               
        }}>
          <div className="dropdown" style={{ width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>By career {options.careers.length > 0 ? `(${options.careers.length})` : ""}</span>
                <i className="la la-angle-right" style={{ fontSize: 16, color: "#787486" }}></i>
          </div>
          {filterOptionOpen && (
                <div 
                className={`dropdown-menu mt-1 org-dropdown-anim show`}
                style={{
                    left: "110%",
                    right: "auto",
                    top: "-20px",
                    maxHeight: "279px",
                    overflowY: "auto",
                    width: "248px",
                }}
                >
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0px 10px" }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>Filter by career</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#717680", cursor: "pointer" }} onClick={() => setOptions({ ...options, careers: [] })}>Clear</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div style={{ padding: "8px 12px", width: "100%" }}>
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                    <i
                      className="la la-search"
                      style={{
                        position: "absolute",
                        left: "12px",
                        fontSize: 16,
                        color: "#9CA3AF",
                        zIndex: 1,
                      }}
                    ></i>
                    <input
                    type="text"
                    placeholder="Search"
                    style={{ width: "100%", padding: "10px 12px 10px 40px", borderRadius: "8px", border: "1px solid #D5D7DA" }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  </div>
                  </div>
                  {options.careers.length > 0 && <div style={{ display: "flex", width: "100%", gap: "8px", flexWrap: "wrap", padding: "0px 12px" }}>
                    {options.careers.map((career) => (
                      <div key={getEntityIdentifier(career)} style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", border: "1px solid #D5D7DA", borderRadius: "8px", padding: "4px", width: "fit-content", maxWidth: "100%" }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{career.jobTitle}</span>
                        <i className="la la-times" onClick={() => {
                          const selectedId = getEntityIdentifier(career);
                          setOptions({ ...options, careers: options.careers.filter((c) => getEntityIdentifier(c) !== selectedId) });
                        }} style={{ fontSize: 16, color: "#787486", cursor: "pointer" }}></i>
                      </div>
                    ))}
                  </div>}
                  <div className="dropdown-divider"></div>
                    {isLoading ? (
                      <div className="dropdown-item" onClick={() => {}}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>Loading...</span>
                      </div>
                    ) : (
                      filteredCareers.length > 0 ? filteredCareers.map((career) => (
                        <div className="dropdown-item" key={getEntityIdentifier(career)} onClick={() => {}}>
                          <div
                          style={{
                            width: "100%",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: "0px",
                          }}
                          >
                          <input
                            type="checkbox"
                            className="custom-checkbox"
                          checked={options.careers.some((c) => getEntityIdentifier(c) === getEntityIdentifier(career))}
                          onChange={(e) => {
                            const selectedId = getEntityIdentifier(career);
                            if (!selectedId) {
                              return;
                            }
                            const selectedCareer = {
                              ...career,
                              id: selectedId,
                              jobTitle: career?.jobTitle || "Untitled career",
                              };
                              if (e.target.checked) {
                                setOptions({ ...options, careers: [...options.careers, selectedCareer] });
                              } else {
                                setOptions({ ...options, careers: options.careers.filter((c) => getEntityIdentifier(c) !== selectedId) });
                              }
                            }}
                          />
                          <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{career.jobTitle}</span>
                          </div>
                        </div>
                    )) : (
                      <div className="dropdown-item" onClick={() => {}}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>No careers found</span>
                    </div>
                  ))}
                </div>
            )}
          </div>
    </div>
      )
  }
  
  function JobOwnerFilterDropdownItem({ options, setOptions, projectId }: { options: {jobOwners: {id?: string, email?: string, name: string}[]}, setOptions: (options: {jobOwners: {id?: string, email?: string, name: string}[]}) => void, projectId?: string }) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [search, setSearch] = useState<string>("");
    const debouncedSearch = useDebounce(search, 500);
    const [jobOwners, setJobOwners] = useState<any[]>([]);
    const [filterOptionOpen, setFilterOptionOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
  
    useEffect(() => {
      const fetchJobOwners = async () => {
        setIsLoading(true);
        try {
          const response = await api.get("/api/get-job-members", {
            params: { orgID, search: debouncedSearch, memberRole: "Job Owner", projectId },
          });
          setJobOwners(response.data);
        } catch (error) {
          console.error("Error fetching job owners:", error);
        } finally {
          setIsLoading(false);
        }
      };
      if (orgID) {
        fetchJobOwners();
      }
    }, [orgID, debouncedSearch, projectId]);
  
    return (
      <div className="dropdown-item" 
      onMouseOver={() => setFilterOptionOpen(true)}
      onMouseOut={() => setFilterOptionOpen(false)}
      onClick={(e) => {
          e.stopPropagation();               
      }}>
        <div className="dropdown" style={{ width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>By job owner {options.jobOwners.length > 0 ? `(${options.jobOwners.length})` : ""}</span>
              <i className="la la-angle-right" style={{ fontSize: 16, color: "#787486" }}></i>
        </div>
        {filterOptionOpen && (
              <div 
              className={`dropdown-menu mt-1 org-dropdown-anim show`}
              style={{
                  left: "110%",
                  right: "auto",
                  top: "-20px",
                  maxHeight: "279px",
                  overflowY: "auto",
                  width: "248px",
              }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0px 10px" }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>Filter by job owner</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#717680", cursor: "pointer" }} onClick={() => setOptions({ ...options, jobOwners: [] })}>Clear</span>
                </div>
                <div className="dropdown-divider"></div>
                <div style={{ padding: "8px 12px", width: "100%" }}>
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                  <i
                    className="la la-search"
                    style={{
                      position: "absolute",
                      left: "12px",
                      fontSize: 16,
                      color: "#9CA3AF",
                      zIndex: 1,
                    }}
                  ></i>
                  <input
                  type="text"
                  placeholder="Search"
                  style={{ width: "100%", padding: "10px 12px 10px 40px", borderRadius: "8px", border: "1px solid #D5D7DA" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                </div>
                </div>
                {options.jobOwners.length > 0 && <div style={{ display: "flex", width: "100%", gap: "8px", flexWrap: "wrap", padding: "0px 12px" }}>
                    {options.jobOwners.map((jobOwner) => (
                      <div key={getEntityIdentifier(jobOwner)} style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", border: "1px solid #D5D7DA", borderRadius: "8px", padding: "4px", width: "fit-content", maxWidth: "100%" }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{jobOwner.name}</span>
                        <i className="la la-times" onClick={() => {
                          const selectedId = getEntityIdentifier(jobOwner);
                          setOptions({ ...options, jobOwners: options.jobOwners.filter((j) => getEntityIdentifier(j) !== selectedId) });
                        }} style={{ fontSize: 16, color: "#787486", cursor: "pointer" }}></i>
                      </div>
                    ))}
                  </div>}
                <div className="dropdown-divider"></div>
                  {isLoading ? (
                    <div className="dropdown-item" onClick={() => {}}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>Loading...</span>
                    </div>
                  ) : (
                    jobOwners.length > 0 ? jobOwners.map((owner) => (
                      <div className="dropdown-item" key={getEntityIdentifier(owner)} onClick={() => {}}>
                        <div
                        style={{
                          width: "100%",
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: "0px",
                        }}
                        >
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={options.jobOwners.some((j) => getEntityIdentifier(j) === getEntityIdentifier(owner))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setOptions({ ...options, jobOwners: [...options.jobOwners, owner] });
                            } else {
                              const selectedId = getEntityIdentifier(owner);
                              setOptions({ ...options, jobOwners: options.jobOwners.filter((j) => getEntityIdentifier(j) !== selectedId) });
                            }
                          }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{owner.name}</span>
                        </div>
                      </div>
                  )) : (
                    <div className="dropdown-item" onClick={() => {}}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>No job owners found</span>
                    </div>
                  ))}
              </div>
          )}
        </div>
  </div>
    )
  }

    
  function JobContributorFilterDropdownItem({ options, setOptions, projectId }: { options: {contributors: {id?: string, email?: string, name: string}[]}, setOptions: (options: {contributors: {id?: string, email?: string, name: string}[]}) => void, projectId?: string }) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [search, setSearch] = useState<string>("");
    const debouncedSearch = useDebounce(search, 500);
    const [contributors, setContributors] = useState<any[]>([]);
    const [filterOptionOpen, setFilterOptionOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    useEffect(() => {
      const fetchContributors = async () => {
        setIsLoading(true);
        try {
          const response = await api.get("/api/get-job-members", {
            params: { orgID, search: debouncedSearch, memberRole: "Contributor", projectId },
          });
          setContributors(response.data);
        } catch (error) {
          console.error("Error fetching contributors:", error);
        } finally {
          setIsLoading(false);
        }
      };
      if (orgID) {
        fetchContributors();
      }
    }, [orgID, debouncedSearch, projectId]);
  
    return (
      <div className="dropdown-item" 
      onMouseOver={() => setFilterOptionOpen(true)}
      onMouseOut={() => setFilterOptionOpen(false)}
      onClick={(e) => {
          e.stopPropagation();               
      }}>
        <div className="dropdown" style={{ width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>By contributor {options.contributors.length > 0 ? `(${options.contributors.length})` : ""}</span>
              <i className="la la-angle-right" style={{ fontSize: 16, color: "#787486" }}></i>
        </div>
        {filterOptionOpen && (
              <div 
              className={`dropdown-menu mt-1 org-dropdown-anim show`}
              style={{
                  left: "110%",
                  right: "auto",
                  top: "-20px",
                  maxHeight: "279px",
                  overflowY: "auto",
                  width: "248px",
              }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0px 10px" }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>Filter by contributor</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#717680", cursor: "pointer" }} onClick={() => setOptions({ ...options, contributors: [] })}>Clear</span>
                </div>
                <div className="dropdown-divider"></div>
                <div style={{ padding: "8px 12px", width: "100%" }}>
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                  <i
                    className="la la-search"
                    style={{
                      position: "absolute",
                      left: "12px",
                      fontSize: 16,
                      color: "#9CA3AF",
                      zIndex: 1,
                    }}
                  ></i>
                  <input
                  type="text"
                  placeholder="Search"
                  style={{ width: "100%", padding: "10px 12px 10px 40px", borderRadius: "8px", border: "1px solid #D5D7DA" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                </div>
                </div>
                {options.contributors.length > 0 && <div style={{ display: "flex", width: "100%", gap: "8px", flexWrap: "wrap", padding: "0px 12px" }}>
                    {options.contributors.map((contributor) => (
                      <div key={getEntityIdentifier(contributor)} style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", border: "1px solid #D5D7DA", borderRadius: "8px", padding: "4px", width: "fit-content", maxWidth: "100%" }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contributor.name}</span>
                        <i className="la la-times" onClick={() => {
                          const selectedId = getEntityIdentifier(contributor);
                          setOptions({ ...options, contributors: options.contributors.filter((c) => getEntityIdentifier(c) !== selectedId) });
                        }} style={{ fontSize: 16, color: "#787486", cursor: "pointer" }}></i>
                      </div>
                    ))}
                  </div>}
                <div className="dropdown-divider"></div>
                  {isLoading ? (
                    <div className="dropdown-item" onClick={() => {}}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>Loading...</span>
                    </div>
                  ) : (
                    contributors.length > 0 ? contributors.map((contributor) => (
                      <div className="dropdown-item" key={getEntityIdentifier(contributor)} onClick={() => {}}>
                        <div
                        style={{
                          width: "100%",
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: "0px",
                        }}
                        >
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={options.contributors.some((c) => getEntityIdentifier(c) === getEntityIdentifier(contributor))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setOptions({ ...options, contributors: [...options.contributors, contributor] });
                            } else {
                              const selectedId = getEntityIdentifier(contributor);
                              setOptions({ ...options, contributors: options.contributors.filter((c) => getEntityIdentifier(c) !== selectedId) });
                            }
                          }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contributor.name}</span>
                        </div>
                      </div>
                  )) : (
                    <div className="dropdown-item" onClick={() => {}}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>No contributors found</span>
                    </div>
                  ))}
              </div>
          )}
        </div>
  </div>
    )
  }
  
  function ProjectFilterDropdownItem({ options, setOptions }: { options: {projects: {_id: string, name: string}[]}, setOptions: (options: {projects: {_id: string, name: string}[]}) => void }) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [filterOptionOpen, setFilterOptionOpen] = useState<boolean>(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [search, setSearch] = useState<string>("");
    const debouncedSearch = useDebounce(search, 500);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    useEffect(() => {
      const fetchProjects = async () => {
        setIsLoading(true);
        try {
          const response = await api.post("/api/projects/list", {
            orgID,
            search: debouncedSearch,
          });
          setProjects(response.data.projects);
        } catch (error) {
          console.error("Error fetching projects:", error);
        } finally {
          setIsLoading(false);
        }
      };
      if (orgID) {
        fetchProjects();
      }
    }, [orgID, debouncedSearch]);
    
    return (
      <div className="dropdown-item" 
      onMouseOver={() => setFilterOptionOpen(true)}
      onMouseOut={() => setFilterOptionOpen(false)}
      onClick={(e) => {
          e.stopPropagation();               
      }}>
        <div className="dropdown" style={{ width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>By project {options.projects.length > 0 ? `(${options.projects.length})` : ""}</span>
              <i className="la la-angle-right" style={{ fontSize: 16, color: "#787486" }}></i>
        </div>
        {filterOptionOpen && (
              <div 
              className={`dropdown-menu mt-1 org-dropdown-anim show`}
              style={{
                left: "110%",
                right: "auto",
                top: "-20px",
                maxHeight: "279px",
                overflowY: "auto",
                width: "248px",
              }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0px 10px" }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>Filter by project</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#717680", cursor: "pointer" }} onClick={() => setOptions({ ...options, projects: [] })}>Clear</span>
                </div>
                <div className="dropdown-divider"></div>
                <div style={{ padding: "8px 12px", width: "100%" }}>
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                  <i
                    className="la la-search"
                    style={{
                      position: "absolute",
                      left: "12px",
                      fontSize: 16,
                      color: "#9CA3AF",
                      zIndex: 1,
                    }}
                  ></i>
                  <input
                  type="text"
                  placeholder="Search"
                  style={{ width: "100%", padding: "10px 12px 10px 40px", borderRadius: "8px", border: "1px solid #D5D7DA" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                </div>
                </div>
                {options.projects.length > 0 && <div style={{ display: "flex", width: "100%", gap: "8px", flexWrap: "wrap", padding: "0px 12px" }}>
                    {options.projects.map((project) => (
                      <div key={getEntityIdentifier(project)} style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", border: "1px solid #D5D7DA", borderRadius: "8px", padding: "4px", width: "fit-content", maxWidth: "100%" }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.name}</span>
                        <i className="la la-times" onClick={() => {
                          const selectedId = getEntityIdentifier(project);
                          setOptions({ ...options, projects: options.projects.filter((p) => getEntityIdentifier(p) !== selectedId) });
                        }} style={{ fontSize: 16, color: "#787486", cursor: "pointer" }}></i>
                      </div>
                    ))}
                  </div>}
                <div className="dropdown-divider"></div>
                { isLoading ? (
                  <div className="dropdown-item" onClick={() => {}}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>Loading...</span>
                  </div>
                ) : projects.length > 0 ? projects.map((project) => (
                    <div className="dropdown-item" key={getEntityIdentifier(project)} onClick={() => {}}>
                      <div
                        style={{
                          width: "100%",
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: "0px",
                        }}
                        >
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={options.projects.some((p) => getEntityIdentifier(p) === getEntityIdentifier(project))}
                          onChange={(e) => {
                            const selectedId = getEntityIdentifier(project);
                            if (!selectedId) {
                              return;
                            }
                            const selectedProject = {
                              ...project,
                              _id: selectedId,
                            };
                            if (e.target.checked) {
                              setOptions({ ...options, projects: [...options.projects, selectedProject] });
                            } else {
                              setOptions({ ...options, projects: options.projects.filter((p) => getEntityIdentifier(p) !== selectedId) });
                            }
                          }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.name}</span>
                        </div>
                    </div>
                )) : (
                  <div className="dropdown-item" onClick={() => {}}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>No projects found</span>
                  </div>
                )}
              </div>
          )}
        </div>
  </div>
    )
  }

  function CareerStatusFilterDropdownItem({ options, setOptions }: { options: any, setOptions: (options: any) => void }) {
    const [filterOptionOpen, setFilterOptionOpen] = useState<boolean>(false);
    const getFilterCount = (options: any) => {
      let statusCount = 0;
      if (options["Published Status"]?.length > 0) {
        statusCount += 1;
      }
      if (options["Activity Status"]?.length > 0) {
        statusCount += 1;
      }
      if (options["Subscription Plan"]?.length > 0) {
        statusCount += 1;
      }
      return statusCount;
    }
    return (
        <div className="dropdown-item" 
        onMouseOver={() => setFilterOptionOpen(true)}
        onMouseOut={() => setFilterOptionOpen(false)}
        onClick={(e) => {
            e.stopPropagation();               
        }}>
          <div className="dropdown" style={{ width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>By status {getFilterCount(options) > 0 ? `(${getFilterCount(options)})` : ""}</span>
                <i className="la la-angle-right" style={{ fontSize: 16, color: "#787486" }}></i>
          </div>
          {filterOptionOpen && (
                <div 
                className={`dropdown-menu mt-1 org-dropdown-anim show`}
                style={{
                  left: "110%",
                  right: "auto",
                  top: "-20px",
                  maxHeight: "279px",
                  overflowY: "auto",
                  width: "248px",
                }}
                >
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0px 10px" }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>Filter by status</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#717680", cursor: "pointer" }} onClick={() => setOptions({ ...options, "Published Status": [], "Activity Status": [], "Subscription Plan": [] })}>Clear</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  {CAREER_STATUS_OPTIONS.map((o) => (
                    <div key={o.label}>
                    <div 
                        className="dropdown-item"
                        onClick={() => {}}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>{o.label}</span>
                    </div>

                    {o.options.map((option) => (
                      <div className="dropdown-item" key={option.value} onClick={() => {}}>
                        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <div
                          style={{
                            width: "100%",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: "0px",
                          }}
                          >
                        <input
                            type="checkbox"
                            className="custom-checkbox"
                            checked={options[o.label].includes(option.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setOptions({ ...options, [o.label]: [...options[o.label], option.value] });
                              } else {
                                setOptions({ ...options, [o.label]: options[o.label].filter((value) => value !== option.value) });
                              }
                            }}
                          />
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>{option.label || option.value}</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", padding: "4px 10px", borderRadius: "16px", backgroundColor: option.backgroundColor, border: option.border }}>
                          <img src={option.icon} alt={option.value} style={{ width: 13, height: 13 }} />
                        </div>
                      </div>
                      </div>
                    ))}
                    </div>
                  ))}
                </div>
            )}
          </div>
    </div>
    )
  }

  function HiringManagerFilterDropdownItem({ options, setOptions, projectId }: { options: {hiringManagers?: {id?: string, email?: string, name: string}[]}, setOptions: (options: {hiringManagers?: {id?: string, email?: string, name: string}[]}) => void, projectId?: string }) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [search, setSearch] = useState<string>("");
    const debouncedSearch = useDebounce(search, 500);
    const [hiringManagers, setHiringManagers] = useState<any[]>([]);
    const [filterOptionOpen, setFilterOptionOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
  
    useEffect(() => {
      const fetchHiringManagers = async () => {
        setIsLoading(true);
        try {
          const response = await api.get("/api/get-job-members", {
            params: { orgID, search: debouncedSearch, memberRole: "Hiring Manager", projectId },
          });
          setHiringManagers(response.data);
        } catch (error) {
          console.error("Error fetching hiring managers:", error);
        } finally {
          setIsLoading(false);
        }
      };
      if (orgID) {
        fetchHiringManagers();
      }
    }, [orgID, debouncedSearch, projectId]);
  
    return (
      <div className="dropdown-item" 
      onMouseOver={() => setFilterOptionOpen(true)}
      onMouseOut={() => setFilterOptionOpen(false)}
      onClick={(e) => {
          e.stopPropagation();               
      }}>
        <div className="dropdown" style={{ width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>By hiring manager {options.hiringManagers?.length > 0 ? `(${options.hiringManagers.length})` : ""}</span>
              <i className="la la-angle-right" style={{ fontSize: 16, color: "#787486" }}></i>
        </div>
        {filterOptionOpen && (
              <div 
              className={`dropdown-menu mt-1 org-dropdown-anim show`}
              style={{
                  left: "110%",
                  right: "auto",
                  top: "-20px",
                  maxHeight: "279px",
                  overflowY: "auto",
                  width: "248px",
              }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0px 10px" }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>Filter by hiring manager</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#717680", cursor: "pointer" }} onClick={() => setOptions({ ...options, hiringManagers: [] })}>Clear</span>
                </div>
                <div className="dropdown-divider"></div>
                <div style={{ padding: "8px 12px", width: "100%" }}>
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                  <i
                    className="la la-search"
                    style={{
                      position: "absolute",
                      left: "12px",
                      fontSize: 16,
                      color: "#9CA3AF",
                      zIndex: 1,
                    }}
                  ></i>
                  <input
                  type="text"
                  placeholder="Search"
                  style={{ width: "100%", padding: "10px 12px 10px 40px", borderRadius: "8px", border: "1px solid #D5D7DA" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                </div>
                </div>
                {options.hiringManagers?.length > 0 && <div style={{ display: "flex", width: "100%", gap: "8px", flexWrap: "wrap", padding: "0px 12px" }}>
                    {options.hiringManagers.map((hiringManager) => (
                      <div key={getEntityIdentifier(hiringManager)} style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", border: "1px solid #D5D7DA", borderRadius: "8px", padding: "4px", width: "fit-content", maxWidth: "100%" }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hiringManager.name}</span>
                        <i className="la la-times" onClick={() => {
                          const selectedId = getEntityIdentifier(hiringManager);
                          setOptions({ ...options, hiringManagers: options.hiringManagers.filter((j) => getEntityIdentifier(j) !== selectedId) });
                        }} style={{ fontSize: 16, color: "#787486", cursor: "pointer" }}></i>
                      </div>
                    ))}
                  </div>}
                <div className="dropdown-divider"></div>
                  {isLoading ? (
                    <div className="dropdown-item" onClick={() => {}}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>Loading...</span>
                    </div>
                  ) : (
                    hiringManagers.length > 0 ? hiringManagers.map((manager) => (
                      <div className="dropdown-item" key={getEntityIdentifier(manager)} onClick={() => {}}>
                        <div
                        style={{
                          width: "100%",
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: "0px",
                        }}
                        >
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={options.hiringManagers?.some((j) => getEntityIdentifier(j) === getEntityIdentifier(manager))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setOptions({ ...options, hiringManagers: [...options.hiringManagers, manager] });
                            } else {
                              const selectedId = getEntityIdentifier(manager);
                              setOptions({ ...options, hiringManagers: options.hiringManagers.filter((j) => getEntityIdentifier(j) !== selectedId) });
                            }
                          }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{manager.name}</span>
                        </div>
                      </div>
                  )) : (
                    <div className="dropdown-item" onClick={() => {}}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>No hiring managers found</span>
                    </div>
                  ))}
              </div>
          )}
        </div>
  </div>
    )
  }