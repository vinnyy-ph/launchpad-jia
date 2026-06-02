"use client";

// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import TableLoader from "../../Loader/TableLoader";
import AvatarImage from "../AvatarImage/AvatarImage";
import Fuse from "fuse.js";
import { validateEmail } from "../../Utils";
import useDebounce from "../../hooks/useDebounceHook";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { Project } from "@/lib/types/projects";
import { Button } from "../ui";
import AdminSeatUsageSummary from "../MemberComponents/AdminSeatUsageSummary";
import CustomDropdown from "../Dropdown/CustomDropdown";

const tableHeaderStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 500,
    color: "#717680",
    textTransform: "none",
};

function RoleBadge({ role }: { role?: string }) {
    const normalizedRole = role?.toLowerCase()?.replace("_", " ");
    const isAdmin = normalizedRole === "admin";
    const isHiringManager = normalizedRole === "hiring manager" || normalizedRole === "hiring_manager";

    const bgColor = isAdmin ? "#EFF8FF" : isHiringManager ? "#FFF1F3" : "#F9FAFB";
    const textColor = isAdmin ? "#175CD3" : isHiringManager ? "#C01048" : "#344054";
    const borderColor = isAdmin ? "#B2DDFF" : isHiringManager ? "#FECCD6" : "#EAECF0";

    return (
        <span style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 999,
            backgroundColor: bgColor,
            color: textColor,
            border: `1px solid ${borderColor}`,
            fontSize: 12,
            fontWeight: 500,
            textTransform: "capitalize",
        }}>
            {normalizedRole || "Member"}
        </span>
    );
}

function StatusBadge({ status }: { status?: string }) {
    const isJoined = status === "joined";
    const isInvited = status === "invited";

    const bgColor = isJoined ? "#ECFDF3" : isInvited ? "#FFF6ED" : "#F9FAFB";
    const textColor = isJoined ? "#027A48" : isInvited ? "#C4320A" : "#344054";
    const borderColor = isJoined ? "#ABEFC6" : isInvited ? "#F9DBAF" : "#EAECF0";

    return (
        <span style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 999,
            backgroundColor: bgColor,
            color: textColor,
            border: `1px solid ${borderColor}`,
            fontSize: 12,
            fontWeight: 500,
            textTransform: "capitalize",
        }}>
            {status || "-"}
        </span>
    );
}

interface MembersV2TableProps {
    externalShowInviteModal?: boolean;
    onCloseInviteModal?: () => void;
    externalSearch?: string;
}

export default function MembersV2Table({
    externalShowInviteModal,
    onCloseInviteModal,
    externalSearch = ""
}: MembersV2TableProps) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Use external search if provided
    const effectiveSearch = externalSearch || search;

    // Sync external invite modal state
    useEffect(() => {
        if (externalShowInviteModal !== undefined) {
            setShowInviteModal(externalShowInviteModal);
        }
    }, [externalShowInviteModal]);
    const [selectedMember, setSelectedMember] = useState(null);
    const router = useRouter();
    const pathname = usePathname();
    const searchParamsString = searchParams.toString();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const currentPage = pageFromUrl;
    const [totalPages, setTotalPages] = useState(1);
    const [totalMembers, setTotalMembers] = useState(0);
    const debouncedInternalSearch = useDebounce(search, 500);
    const debouncedExternalSearch = useDebounce(externalSearch, 500);
    const debouncedSearch = externalSearch ? debouncedExternalSearch : debouncedInternalSearch;
    const limit = 10;
    const [activeOrg] = useLocalStorage("activeOrg", null);

    const navigateToPage = useCallback((page: number, mode: "push" | "replace" = "push") => {
        const nextPage = Math.max(1, Math.floor(page));
        const params = new URLSearchParams(searchParamsString);
        if (nextPage === 1) {
            params.delete("page");
        } else {
            params.set("page", String(nextPage));
        }
        const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;
        const nextQuery = params.toString();
        const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        if (nextUrl === currentUrl) return;
        if (mode === "replace") {
            router.replace(nextUrl, { scroll: false });
        } else {
            router.push(nextUrl, { scroll: false });
        }
    }, [pathname, router, searchParamsString]);
    const projectsEnabled = !!activeOrg?.projectsEnabled;
    const guestPortalEnabledEffective =
        typeof activeOrg?.guestPortalEnabled === "boolean"
            ? activeOrg.guestPortalEnabled
            : projectsEnabled;
    const hasGuestMembers = members.some((member: any) => member.role === "guest");

    // Filter states
    const [filterStatus, setFilterStatus] = useState("All Statuses");
    const filterStatusOptions = ["All Statuses", "Joined", "Invited"];
    const [filterRole, setFilterRole] = useState("All Roles");
    const filterRoleOptions = ["All Roles", "Admin", "Hiring Manager", "Guest"];
    const [sortBy, setSortBy] = useState("Oldest First");
    const sortByOptions: Record<string, { key: string | null; direction: string }> = {
        "Oldest First": { key: "createdAt", direction: "ascending" },
        "Newest First": { key: "createdAt", direction: "descending" },
        "Name (A-Z)": { key: "name", direction: "ascending" },
        "Name (Z-A)": { key: "name", direction: "descending" },
        "Last Login (Recent)": { key: "lastLogin", direction: "descending" },
        "Last Login (Oldest)": { key: "lastLogin", direction: "ascending" },
    };
    const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: string }>({ key: "createdAt", direction: "ascending" });

    // Admin seat usage state
    const [adminSeatUsage, setAdminSeatUsage] = useState({ used: 0, max: 0 as number | null });

    // Fetch admin seat usage data
    const fetchAdminSeatUsage = useCallback(async () => {
        if (!orgID) return;
        try {
            const response = await api.get("/api/pricing-plan/get-plan-details", {
                params: { orgID },
            });
            const usage = response.data.usage || {};
            setAdminSeatUsage({
                used: usage.adminSeatsUsed || 0,
                max: usage.maxAdminSeats !== undefined ? usage.maxAdminSeats : 0,
            });
        } catch (error) {
            console.error("Error fetching admin seat usage:", error);
        }
    }, [orgID]);

    useEffect(() => {
        fetchAdminSeatUsage();
    }, [fetchAdminSeatUsage, members]);

    useEffect(() => {
        const fetchMembers = async () => {
            setIsLoading(true);
            try {
                const response = await api.get("/api/search-members", {
                    params: {
                        orgID,
                        search: debouncedSearch,
                        page: currentPage,
                        limit,
                        status: filterStatus,
                        role: filterRole,
                        sortConfig: sortConfig.key ? JSON.stringify(sortConfig) : null,
                    },
                });
                setMembers(response.data.members);
                setTotalMembers(response.data.totalMembers);
                setTotalPages(response.data.totalPages);
            } catch (error) {
                Swal.fire({
                    title: "Error",
                    text: "Failed to fetch members",
                    icon: "error",
                });
            } finally {
                setIsLoading(false);
            }
        }
        if (orgID) {
            fetchMembers();
        } else {
            setIsLoading(false);
        }
    }, [orgID, debouncedSearch, currentPage, filterStatus, filterRole, sortConfig]);

    const deleteMember = async (email: string) => {
        if (members.length === 1) {
            Swal.fire({
                title: "Action Blocked!",
                text: "You cannot delete the last member.",
                icon: "error",
                showClass: { popup: "fade-in-bottom" },
                hideClass: { popup: "fade-out" },
                timer: 1500,
                showConfirmButton: false,
            });
            return;
        }
        const result = await Swal.fire({
            title: "Are you sure?",
            text: "Are you sure you want to delete the member?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete it!",
            showClass: {
                popup: "fade-in-bottom",
            },
            hideClass: {
                popup: "fade-out",
            },
        });
        if (result.isConfirmed) {
            try {
                await api.post("/api/delete-member", { email, orgID });
                Swal.fire({
                    title: "Deleted!",
                    text: "The member has been deleted.",
                    icon: "success",
                    showClass: { popup: "fade-in-bottom" },
                    hideClass: { popup: "fade-out" },
                    timer: 1000,
                    showConfirmButton: false,
                });
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (error: any) {
                // Handle conflict error when member owns projects
                if (error.response?.status === 409) {
                    const data = error.response.data;

                    Swal.fire({
                        title: data.error,
                        html: `
                  <p>${data.message}</p>
                  <ul style="display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0 0; padding: 10px; list-style: none; max-height: 150px; overflow-y: auto;">
                    ${data.projects.map((p: Project) => `
                      <li style="display: flex; align-items: center; gap: 8px; background: #EFF8FF; border: 1px solid #B2DDFF; border-radius: 999px; padding: 2px 8px 2px 10px;">
                        <span style="font-size: 13px; font-weight: 500; color: #175CD3; margin: 0;">${p.name}</span>
                      </li>
                    `).join('')}
                  </ul>
                `,
                        icon: "error",
                        confirmButtonText: "OK",
                        showClass: { popup: "fade-in-bottom" },
                        hideClass: { popup: "fade-out" },
                    });
                } else {
                    // Handle other errors
                    Swal.fire({
                        title: "Error",
                        text:
                            error.response?.data?.error ||
                            error.response?.data?.message ||
                            "Failed to delete member",
                        icon: "error",
                        showClass: { popup: "fade-in-bottom" },
                        hideClass: { popup: "fade-out" },
                    });
                }
            }
        }
    };

    return (
        <div className="row" style={{ marginBottom: "50px" }}>
            <div className="col">
                {!guestPortalEnabledEffective && hasGuestMembers && (
                    <div
                        style={{
                            marginBottom: "16px",
                            padding: "12px 16px",
                            borderRadius: "8px",
                            backgroundColor: "#FEF3C7",
                            border: "1px solid #FDE68A",
                            color: "#92400E",
                        }}
                    >
                        <strong>Guest Portal is disabled for this organization.</strong>
                        <div>
                            New Guest invitations and role changes to Guest are blocked, and guest portal access is disabled accordingly.
                        </div>
                    </div>
                )}
                <div className="layered-card-outer">
                    <div className="layered-card-content" style={{ padding: 0 }}>
                        {/* Card header */}
                        <div style={{ display: "flex", flexDirection: "column", padding: "15px 20px" }}>
                            {/* Top row: Title, count, filters */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ fontSize: "18px", fontWeight: 600, color: "#181D27" }}>Team Members</div>
                                    <div style={{
                                        borderRadius: 999,
                                        border: "1px solid #D5D9EB",
                                        backgroundColor: "#F8F9FC",
                                        color: "#363F72",
                                        fontSize: "12px",
                                        padding: "2px 10px",
                                        fontWeight: 500
                                    }}>
                                        {totalMembers}
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {/* Filter dropdowns */}
                                    <CustomDropdown
                                        value={filterStatus}
                                        setValue={(value: string) => {
                                            setFilterStatus(value);
                                            navigateToPage(1, "replace");
                                        }}
                                        options={filterStatusOptions}
                                        icon="la-filter"
                                    />
                                    <CustomDropdown
                                        value={filterRole}
                                        setValue={(value: string) => {
                                            setFilterRole(value);
                                            navigateToPage(1, "replace");
                                        }}
                                        options={filterRoleOptions}
                                        icon="la-filter"
                                    />
                                    <CustomDropdown
                                        value={sortBy}
                                        setValue={(value: string) => {
                                            setSortBy(value);
                                            setSortConfig(sortByOptions[value]);
                                            navigateToPage(1, "replace");
                                        }}
                                        options={Object.keys(sortByOptions)}
                                        icon="la-sort-amount-down"
                                        valuePrefix="Sort by:"
                                    />
                                </div>
                            </div>
                            {/* Admin Seat Usage Bar - on its own line */}
                            {adminSeatUsage.max !== null && adminSeatUsage.max > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <AdminSeatUsageSummary
                                        used={adminSeatUsage.used}
                                        max={adminSeatUsage.max}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Light table */}
                        <div className="table-responsive">
                            {isLoading ? (
                                <table className="table align-items-center table-flush">
                                    <thead>
                                        <tr>
                                            <th scope="col" style={tableHeaderStyle}>Name <i className="la la-arrow-down" style={{ fontSize: 12, marginLeft: 4 }} /></th>
                                            <th scope="col" style={tableHeaderStyle}>Email</th>
                                            <th scope="col" style={tableHeaderStyle}>Role</th>
                                            <th scope="col" style={tableHeaderStyle}>Last Login</th>
                                            <th scope="col" style={tableHeaderStyle}>Status</th>
                                            <th scope="col" style={tableHeaderStyle}></th>
                                        </tr>
                                    </thead>
                                    <tbody className="list">
                                        <TableLoader type="members" />
                                    </tbody>
                                </table>
                            ) : (
                                <table className="table align-items-center table-flush">
                                    <thead>
                                        <tr>
                                            <th scope="col" style={tableHeaderStyle}>Name <i className="la la-arrow-down" style={{ fontSize: 12, marginLeft: 4 }} /></th>
                                            <th scope="col" style={tableHeaderStyle}>Email</th>
                                            <th scope="col" style={tableHeaderStyle}>Role</th>
                                            <th scope="col" style={tableHeaderStyle}>Last Login</th>
                                            <th scope="col" style={tableHeaderStyle}>Status</th>
                                            <th scope="col" style={tableHeaderStyle}></th>
                                        </tr>
                                    </thead>
                                    <tbody className="list">
                                        {members.length === 0 ? (
                                            <tr style={{ cursor: "default", pointerEvents: "none" }}>
                                                <td colSpan={6} className="text-center py-4" style={{ verticalAlign: "middle", height: "200px" }}>
                                                    <div className="d-flex justify-content-center align-items-center w-100 h-100" style={{ minHeight: "100px" }}>
                                                        No members found
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            members.map((member) => (
                                                <tr key={member._id}>
                                                    <td>
                                                        <div className="media align-items-center">
                                                            <div style={{ position: "relative" }}>
                                                                <AvatarImage
                                                                    alt="Member avatar"
                                                                    src={member.image}
                                                                    className="avatar rounded-circle mr-3"
                                                                    style={{ width: 40, height: 40 }}
                                                                />
                                                            </div>
                                                            <div className="media-body">
                                                                <span style={{ fontSize: 14, fontWeight: 600, color: "#181D27" }}>
                                                                    {member.name || "Unknown Member"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: 14, color: "#535862" }}>
                                                            {member.email || "Not specified"}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <RoleBadge role={member.role} />
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: 14, color: "#535862" }}>
                                                            {member.lastLogin
                                                                ? new Date(member.lastLogin).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                                                                : "-"
                                                            }
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <StatusBadge status={member.status} />
                                                    </td>
                                                    <td>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button
                                                                style={{
                                                                    background: "none",
                                                                    border: "none",
                                                                    cursor: "pointer",
                                                                    padding: 8,
                                                                    color: "#717680",
                                                                }}
                                                                onClick={() => deleteMember(member.email)}
                                                            >
                                                                <i className="la la-trash" style={{ fontSize: 18 }} />
                                                            </button>
                                                            <button
                                                                style={{
                                                                    background: "none",
                                                                    border: "none",
                                                                    cursor: "pointer",
                                                                    padding: 8,
                                                                    color: "#717680",
                                                                }}
                                                                onClick={() => {
                                                                    setSelectedMember(member);
                                                                    setShowEditModal(true);
                                                                }}
                                                            >
                                                                <i className="la la-pen" style={{ fontSize: 18 }} />
                                                            </button>
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

                                <div>
                                    {Array.from({ length: totalPages }, (_, index) => (
                                        <button
                                            key={index}
                                            className={`btn shadow-none ${currentPage === index + 1 ? "btn-primary" : ""}`}
                                            style={{ backgroundColor: currentPage === index + 1 ? "#F8F8F8" : "white", color: "black", border: "none", fontSize: "14px", fontWeight: 550 }}
                                            onClick={() => {
                                                navigateToPage(index + 1);
                                            }}
                                        >
                                            {index + 1}
                                        </button>
                                    ))}
                                </div>

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
            <InviteMemberMenu
                isOpen={showInviteModal}
                onClose={() => {
                    setShowInviteModal(false);
                    onCloseInviteModal?.();
                }}
                guestPortalEnabledEffective={guestPortalEnabledEffective}
            />
            <EditMemberMenu
                isOpen={showEditModal && !!selectedMember}
                onClose={() => {
                    setShowEditModal(false);
                    setSelectedMember(null);
                }}
                memberData={selectedMember}
                guestPortalEnabledEffective={guestPortalEnabledEffective}
            />
        </div>
    )
}

function InviteMemberMenu({ isOpen, onClose, guestPortalEnabledEffective }: { isOpen: boolean; onClose: () => void; guestPortalEnabledEffective: boolean }) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState(null);
    const [selectedCareers, setSelectedCareers] = useState([]);
    const [careers, setCareers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [emailError, setEmailError] = useState("");
    const [careersLoading, setCareersLoading] = useState(false);

    // Fuse.js options for searching careers
    const fuseOptions = {
        keys: ["jobTitle"],
        threshold: 0.3,
    };

    // Filtered careers based on search
    const filteredCareers = React.useMemo(() => {
        if (!search) return careers;
        const fuse = new Fuse(careers, fuseOptions);
        return fuse.search(search).map((result) => result.item);
    }, [search, careers]);

    useEffect(() => {
        const fetchCareers = async () => {
            setCareersLoading(true);
            try {
                const response = await api.post("/api/fetch-careers", { orgID });
                setCareers(response.data);
            } catch (error) {
                Swal.fire({
                    title: "Error",
                    text: "Failed to fetch careers",
                    icon: "error",
                });
            } finally {
                setCareersLoading(false);
            }
        }
        fetchCareers();
    }, []);

    const handleOnSubmit = async () => {
        try {
            Swal.fire({
                title: "Inviting member...",
                text: "Please wait while we invite the member...",
                allowOutsideClick: false,
                showConfirmButton: false,
                willOpen: () => {
                    Swal.showLoading();
                },
            });

            if (!guestPortalEnabledEffective && role === "guest") {
                Swal.close();
                Swal.fire({
                    title: "Error",
                    text: "Guest role is only available when Guest Portal is enabled for this organization.",
                    icon: "error",
                });
                return;
            }

            await api.post("/api/add-member", {
                email: email.trim(),
                orgID: orgID,
                role: role,
                careers:
                    role === "hiring_manager"
                        ? selectedCareers.map((c) => c.id)
                        : undefined,
            });
            Swal.close();
            onClose();
            window.location.reload();
        } catch (error: any) {
            Swal.close();
            Swal.fire({
                title: "Error",
                text: error.response?.data?.error || error.response?.data?.message || "Failed to invite member",
            });
        }
    }

    return (
        <>
            {/* Backdrop overlay */}
            <div
                onClick={onClose}
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 1040,
                    opacity: isOpen ? 1 : 0,
                    visibility: isOpen ? "visible" : "hidden",
                    transition: "opacity 0.3s ease, visibility 0.3s ease",
                }}
            />
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    background: "#fff",
                    position: "fixed",
                    top: 0,
                    right: 0,
                    height: "100%",
                    width: "100%",
                    maxWidth: "560px",
                    overflowY: "auto",
                    borderLeft: "1px solid #E9EAEB",
                    zIndex: 1050,
                    boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
                    transform: isOpen ? "translateX(0)" : "translateX(100%)",
                    transition: "transform 0.3s ease",
                }}
            >
                <div className="modal-header" style={{ borderBottom: "1px solid #E9EAEB" }}>
                    <h3 className="modal-title">Invite Member</h3>
                    {/* Close Modal */}
                    <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={onClose}>
                        <i className="la la-times"></i>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input type="email" className="form-control" id="email" placeholder="Enter email" value={email} onChange={(e) => {
                            setEmail(e.target.value)
                            setEmailError(validateEmail(e.target.value) ? "" : "Invalid email address")
                        }} />
                        {/* Error message */}
                        {emailError && <p className="text-danger">{emailError}</p>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="role">Role</label>
                        {/* Radio buttons */}
                        <div className="form-check" style={{ display: "flex", flexDirection: "row", gap: 32 }}>

                            <label className="form-check-label" htmlFor="role-admin">
                                <input className="form-check-input" type="radio" name="role" id="role-admin" value="admin" checked={role === "admin"} onChange={(e) => setRole(e.target.value)} style={{ marginRight: 8 }} />
                                Admin
                            </label>
                            <label className="form-check-label" htmlFor="role-hiring-manager">
                                <input className="form-check-input" type="radio" name="role" id="role-hiring-manager" value="hiring_manager" checked={role === "hiring_manager"} onChange={(e) => setRole(e.target.value)} style={{ marginRight: 8 }} />
                                Hiring Manager
                            </label>
                            <label
                                className="form-check-label"
                                htmlFor="role-guest"
                                title={
                                    !guestPortalEnabledEffective
                                        ? "Guest role is only available when Guest Portal is enabled for this organization."
                                        : ""
                                }
                                style={{
                                    opacity: !guestPortalEnabledEffective ? 0.5 : 1,
                                    cursor: !guestPortalEnabledEffective ? "not-allowed" : "pointer",
                                }}
                            >
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="role"
                                    id="role-guest"
                                    value="guest"
                                    checked={role === "guest"}
                                    onChange={(e) => setRole(e.target.value)}
                                    style={{ marginRight: 8 }}
                                    disabled={!guestPortalEnabledEffective}
                                />
                                Guest
                            </label>
                        </div>
                    </div>

                    {role === "hiring_manager" && (
                        <div>
                            <label>Select Careers</label>
                            <input
                                type="search"
                                className="form-control ml-auto search-input"
                                placeholder="Search Careers..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value?.trim());
                                }}
                            />
                            {/* Row of careers */}
                            <div style={{ marginTop: 16, border: "1px solid #E9EAEB", borderRadius: 4, padding: 8, maxHeight: "250px", overflowY: "auto" }}>
                                {careersLoading ? (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            height: "100%",
                                            color: "#666",
                                            fontSize: "0.9rem",
                                        }}
                                    >
                                        Loading careers...
                                    </div>
                                ) : filteredCareers.length > 0 ? (
                                    <div>
                                        {!search && (
                                            <label
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    cursor: "pointer",
                                                    padding: "4px 8px",
                                                    transition: "background-color 0.2s ease",
                                                    borderRadius: 4,
                                                }}
                                                onMouseOver={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                    "#f8f9fa")
                                                }
                                                onMouseOut={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                    "transparent")
                                                }
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        selectedCareers.length === careers.length
                                                    }
                                                    onChange={() =>
                                                        setSelectedCareers(
                                                            selectedCareers.length === careers.length ? [] : [...careers]
                                                        )
                                                    }
                                                    style={{ cursor: "pointer" }}
                                                />
                                                All Careers
                                            </label>
                                        )}
                                        {filteredCareers.map((career) => (
                                            <label
                                                key={career.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    cursor: "pointer",
                                                    padding: "4px 8px",
                                                    transition: "background-color 0.2s ease",
                                                    borderRadius: 4,
                                                }}
                                                onMouseOver={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                    "#f8f9fa")
                                                }
                                                onMouseOut={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                    "transparent")
                                                }
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCareers.some(
                                                        (c) => c.id === career.id
                                                    )}
                                                    onChange={() => {
                                                        setSelectedCareers((prev) =>
                                                            prev.some((c) => c.id === career.id)
                                                                ? prev.filter((c) => c.id !== career.id)
                                                                : [...prev, career]
                                                        );
                                                    }}
                                                    style={{ cursor: "pointer" }}
                                                />
                                                {career.jobTitle}
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            height: "100%",
                                            color: "#666",
                                            fontSize: "0.9rem",
                                        }}
                                    >
                                        <p>No careers found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                        <Button
                            variant="primary"
                            disabled={
                                !email?.trim() ||
                                emailError !== "" ||
                                !role ||
                                (!guestPortalEnabledEffective && role === "guest") ||
                                (role === "hiring_manager" && selectedCareers.length === 0)
                            }
                            onClick={handleOnSubmit}
                            label="Invite"
                        />
                    </div>
                </div>
            </div>
        </>
    )
}

function EditMemberMenu({ isOpen, onClose, memberData, guestPortalEnabledEffective }: { isOpen: boolean; onClose: () => void; memberData: any; guestPortalEnabledEffective: boolean }) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [role, setRole] = useState(null);
    const [selectedCareers, setSelectedCareers] = useState([]);
    const [careers, setCareers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [careersLoading, setCareersLoading] = useState(false);

    // Return empty drawer shell if no memberData (drawer won't be visible anyway since isOpen will be false)
    const safeEmail = memberData?.email || "";
    const safeRole = memberData?.role || "";

    // Fuse.js options for searching careers
    const fuseOptions = {
        keys: ["jobTitle"],
        threshold: 0.3,
    };

    // Filtered careers based on search
    const filteredCareers = React.useMemo(() => {
        if (!search) return careers;
        const fuse = new Fuse(careers, fuseOptions);
        return fuse.search(search).map((result) => result.item);
    }, [search, careers]);

    useEffect(() => {
        const fetchCareers = async () => {
            try {
                setCareersLoading(true);
                const response = await api.post("/api/fetch-careers", { orgID });
                setCareers(response.data);
            } catch (error) {
                Swal.fire({
                    title: "Error",
                    text: "Failed to fetch careers",
                    icon: "error",
                });
            } finally {
                setCareersLoading(false);
            }
        }
        fetchCareers();
    }, []);

    const initialRoleRef = useRef(memberData?.role);

    const handleOnSubmit = async () => {
        try {
            Swal.fire({
                title: "Updating member...",
                text: "Please wait while we update the member...",
                allowOutsideClick: false,
                showConfirmButton: false,
                willOpen: () => {
                    Swal.showLoading();
                },
            });

            const initialRole = initialRoleRef.current;
            if (!guestPortalEnabledEffective && role === "guest" && initialRole !== "guest") {
                Swal.close();
                Swal.fire({
                    title: "Error",
                    text: "Guest role is only available when Guest Portal is enabled for this organization.",
                    icon: "error",
                });
                return;
            }
            await api.post("/api/update-member", {
                email: safeEmail,
                orgID: orgID,
                role: role,
                careers:
                    role === "hiring_manager"
                        ? selectedCareers.map((c) => c.id)
                        : undefined,
            });
            Swal.fire({
                title: "Member updated successfully",
                icon: "success",
                showConfirmButton: false,
                timer: 1500,
            }).then(() => {
                onClose();
                window.location.reload();
            });
        } catch (error: any) {
            Swal.close();
            Swal.fire({
                title: "Error",
                text: error.response?.data?.error || error.response?.data?.message || "Failed to update member",
                icon: "error",
            });
        }
    }

    useEffect(() => {
        if (memberData) {
            setRole(memberData.role as "admin" | "hiring_manager" | "guest");
            if (memberData.careers) {
                // Match careers with their full data
                const matchedCareers = memberData.careers.map((careerId) => {
                    const career = careers.find((c) => c.id === careerId);
                    return career || { id: careerId, jobTitle: "Unknown Career" };
                });
                setSelectedCareers(matchedCareers);
            }
        }
    }, [memberData, careers]);
    return (
        <>
            {/* Backdrop overlay */}
            <div
                onClick={onClose}
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 1040,
                    opacity: isOpen ? 1 : 0,
                    visibility: isOpen ? "visible" : "hidden",
                    transition: "opacity 0.3s ease, visibility 0.3s ease",
                }}
            />
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    background: "#fff",
                    position: "fixed",
                    top: 0,
                    right: 0,
                    height: "100%",
                    width: "100%",
                    maxWidth: "560px",
                    overflowY: "auto",
                    borderLeft: "1px solid #E9EAEB",
                    zIndex: 1050,
                    boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
                    transform: isOpen ? "translateX(0)" : "translateX(100%)",
                    transition: "transform 0.3s ease",
                }}
            >
                <div className="modal-header" style={{ borderBottom: "1px solid #E9EAEB" }}>
                    <h3 className="modal-title">Edit Member</h3>
                    {/* Close Modal */}
                    <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={onClose}>
                        <i className="la la-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    {/* Display email */}
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input type="email" className="form-control" id="email" placeholder="Enter email" value={safeEmail} disabled />
                    </div>
                    <div className="form-group">
                        <label htmlFor="role">Role</label>
                        {/* Radio buttons */}
                        <div className="form-check" style={{ display: "flex", flexDirection: "row", gap: 32 }}>

                            <label className="form-check-label" htmlFor="role-admin">
                                <input className="form-check-input" type="radio" name="role" id="role-admin" value="admin" checked={role === "admin"} onChange={(e) => setRole(e.target.value)} style={{ marginRight: 8 }} />
                                Admin
                            </label>
                            <label className="form-check-label" htmlFor="role-hiring-manager">
                                <input className="form-check-input" type="radio" name="role" id="role-hiring-manager" value="hiring_manager" checked={role === "hiring_manager"} onChange={(e) => setRole(e.target.value)} style={{ marginRight: 8 }} />
                                Hiring Manager
                            </label>
                            {(
                                guestPortalEnabledEffective ||
                                memberData?.role === "guest"
                            ) && (
                                    <label className="form-check-label" htmlFor="role-guest">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="role"
                                            id="role-guest"
                                            value="guest"
                                            checked={role === "guest"}
                                            onChange={(e) => setRole(e.target.value)}
                                            style={{ marginRight: 8 }}
                                            disabled={
                                                !guestPortalEnabledEffective &&
                                                memberData?.role !== "guest"
                                            }
                                        />
                                        Guest
                                    </label>
                                )}
                        </div>
                    </div>
                    {role === "hiring_manager" && (
                        <div>
                            <label>Select Careers</label>
                            <input
                                type="search"
                                className="form-control ml-auto search-input"
                                placeholder="Search Careers..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value?.trim());
                                }}
                            />
                            {/* Row of careers */}
                            <div style={{ marginTop: 16, border: "1px solid #E9EAEB", borderRadius: 4, padding: 8, maxHeight: "250px", overflowY: "auto" }}>
                                {careersLoading ? (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            height: "100%",
                                            color: "#666",
                                            fontSize: "0.9rem",
                                        }}
                                    >
                                        Loading careers...
                                    </div>
                                ) : filteredCareers.length > 0 ? (
                                    <div>
                                        {!search && (
                                            <label
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    cursor: "pointer",
                                                    padding: "4px 8px",
                                                    transition: "background-color 0.2s ease",
                                                    borderRadius: 4,
                                                }}
                                                onMouseOver={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                    "#f8f9fa")
                                                }
                                                onMouseOut={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                    "transparent")
                                                }
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        selectedCareers.length === careers.length
                                                    }
                                                    onChange={() =>
                                                        setSelectedCareers(
                                                            selectedCareers.length === careers.length ? [] : [...careers]
                                                        )
                                                    }
                                                    style={{ cursor: "pointer" }}
                                                />
                                                All Careers
                                            </label>
                                        )}
                                        {filteredCareers.map((career) => (
                                            <label
                                                key={career.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    cursor: "pointer",
                                                    padding: "4px 8px",
                                                    transition: "background-color 0.2s ease",
                                                    borderRadius: 4,
                                                }}
                                                onMouseOver={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                    "#f8f9fa")
                                                }
                                                onMouseOut={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                    "transparent")
                                                }
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCareers.some(
                                                        (c) => c.id === career.id
                                                    )}
                                                    onChange={() => {
                                                        setSelectedCareers((prev) =>
                                                            prev.some((c) => c.id === career.id)
                                                                ? prev.filter((c) => c.id !== career.id)
                                                                : [...prev, career]
                                                        );
                                                    }}
                                                    style={{ cursor: "pointer" }}
                                                />
                                                {career.jobTitle}
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            height: "100%",
                                            color: "#666",
                                            fontSize: "0.9rem",
                                        }}
                                    >
                                        <p>No careers found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                        <Button
                            variant="primary"
                            disabled={
                                !role ||
                                (!guestPortalEnabledEffective &&
                                    role === "guest" &&
                                    memberData?.role !== "guest") ||
                                (role === "hiring_manager" && selectedCareers.length === 0)
                            }
                            onClick={handleOnSubmit}
                            label="Update"
                        >
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}

