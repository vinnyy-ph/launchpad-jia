"use client";

import React, { useEffect, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { api } from "@/lib/utils/apiClient";
import { errorToast } from "@/lib/Utils";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Organization } from "@/lib/types/organization";
import OrgPageHeader from "@/lib/components/AdminComponents/OrgEditing/OrgPageHeader";
import OrgPageTabs from "@/lib/components/AdminComponents/OrgEditing/OrgPageTabs";
import OrgProfileTab from "@/lib/components/AdminComponents/OrgEditing/Tabs/OrgProfileTab";
import OrgPlanUsageTab from "@/lib/components/AdminComponents/OrgEditing/Tabs/OrgPlanUsageTab";
import OrgMembersTab from "@/lib/components/AdminComponents/OrgEditing/Tabs/OrgMembersTab";

export default function ManageOrganizationPage() {
    const { slug } = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const validTabs = ["profile", "plan-usage", "members"];
    const tabParam = searchParams.get("tab");
    const isValidTab = tabParam && validTabs.includes(tabParam);
    const activeTab = isValidTab ? tabParam : "profile";

    // Redirect to clean URL if invalid tab parameter
    useEffect(() => {
        if (tabParam && !isValidTab) {
            router.replace(`/admin-portal/organizations/manage/${slug}`);
        }
    }, [tabParam, isValidTab, router, slug]);

    useEffect(() => {
        const fetchOrganization = async () => {
            try {
                setIsLoading(true);
                const response = await api.get("/api/admin/get-organization-details", {
                    params: { id: slug }
                });
                if (response.status === 200) {
                    setOrganization(response.data);
                }
            } catch (error) {
                console.error("Error fetching organization:", error);
                errorToast("Error fetching organization", 1300);
                setTimeout(() => {
                    window.location.href = "/admin-portal/organizations";
                }, 1300);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrganization();
    }, [slug]);

    const handleTabChange = (tab: string) => {
        router.push(`/admin-portal/organizations/manage/${slug}?tab=${tab}`);
    };

    const handleOrgUpdate = (updates: Partial<Organization>) => {
        if (organization) {
            setOrganization({ ...organization, ...updates });
        }
    };

    const refreshOrganization = async () => {
        try {
            const response = await api.get("/api/admin/get-organization-details", {
                params: { id: slug }
            });
            if (response.status === 200) {
                setOrganization(response.data);
            }
        } catch (error) {
            console.error("Error refreshing organization:", error);
        }
    };

    if (isLoading) {
        return (
            <>
                <HeaderBar activeLink="Organizations" currentPage="Loading..." icon="la la-building" />
                <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
                    <div style={{ padding: 40, textAlign: "center" }}>
                        <i className="la la-spinner la-spin" style={{ fontSize: 48, color: "#717680" }} />
                        <p style={{ color: "#717680", marginTop: 16 }}>Loading organization...</p>
                    </div>
                </div>
            </>
        );
    }

    if (!organization) {
        return null;
    }

    return (
        <>
            <HeaderBar activeLink="Organizations" currentPage={organization.name} icon="la la-building" />
            <div className="container-fluid mt--7" style={{ paddingTop: "6rem", paddingBottom: "2.5rem" }}>
                <div className="row">
                    <div className="col">
                        <OrgPageHeader
                            organization={organization}
                            onUpdate={handleOrgUpdate}
                        />
                        <OrgPageTabs
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                        />
                        {activeTab === "profile" && (
                            <OrgProfileTab
                                organization={organization}
                                onUpdate={handleOrgUpdate}
                            />
                        )}
                        {activeTab === "plan-usage" && (
                            <OrgPlanUsageTab
                                organization={organization}
                                onUpdate={handleOrgUpdate}
                                onRefresh={refreshOrganization}
                            />
                        )}
                        {activeTab === "members" && (
                            <OrgMembersTab
                                organization={organization}
                                onUpdate={handleOrgUpdate}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}