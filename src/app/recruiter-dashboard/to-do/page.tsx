"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { errorToast } from "@/lib/Utils";
import ToDoTable from "@/lib/components/DataTables/ToDoTable";

const TODO_TAB_VALUES = ["cv-review", "interview-review", "retake-interview-requests"] as const;
type ToDoTabValue = (typeof TODO_TAB_VALUES)[number];
const DEFAULT_TODO_TAB: ToDoTabValue = "cv-review";

function isValidToDoTab(value: string | null): value is ToDoTabValue {
    return value !== null && TODO_TAB_VALUES.includes(value as ToDoTabValue);
}

export default function () {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchParamsString = searchParams.toString();
    const tabFromUrl = searchParams.get("tab");
    const orgID = searchParams.get("orgID");

    const activeTab: ToDoTabValue = isValidToDoTab(tabFromUrl)
        ? tabFromUrl
        : DEFAULT_TODO_TAB;

    const tabs = [
        { label: "CV Review", value: "cv-review" as ToDoTabValue },
        { label: "Interview Review", value: "interview-review" as ToDoTabValue },
        { label: "Retake Interview Requests", value: "retake-interview-requests" as ToDoTabValue },
    ];
    const [isLoading, setIsLoading] = useState(true);
    const [pendingTaskCounts, setPendingTaskCounts] = useState({
        "cv-review": 0,
        "interview-review": 0,
        "retake-interview-requests": 0
    });
    const initialLoadRef = useRef(true);

    const handleTabChange = useCallback((tabValue: ToDoTabValue) => {
        const params = new URLSearchParams(searchParamsString);

        if (tabValue === DEFAULT_TODO_TAB) {
            params.delete("tab");
        } else {
            params.set("tab", tabValue);
        }

        const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;
        const nextQuery = params.toString();
        const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

        if (nextUrl === currentUrl) {
            return;
        }

        router.push(nextUrl, { scroll: false });
    }, [pathname, router, searchParamsString]);

    // Clean up invalid tab values from URL
    useEffect(() => {
        if (!tabFromUrl || isValidToDoTab(tabFromUrl)) {
            return;
        }

        const params = new URLSearchParams(searchParamsString);
        params.delete("tab");
        const nextQuery = params.toString();
        const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        router.replace(nextUrl, { scroll: false });
    }, [pathname, router, searchParamsString, tabFromUrl]);

    useEffect(() => {
        const fetchPendingTaskCounts = async () => {
            setIsLoading(true);
            try {
                const response = await api.get("/api/get-pending-recruiter-tasks", { params: { orgID } });
                if (response.status === 200) {
                    setPendingTaskCounts({
                        "cv-review": response.data.cvReview?.length || 0,
                        "interview-review": response.data.aiInterviewReview?.length || 0,
                        "retake-interview-requests": response.data.retakeRequest?.length || 0
                    });
                }
            } catch (error) {
                console.log(error);
                errorToast("Error failed to load pending tasks", 1300);
            } finally {
                setIsLoading(false);
            }
        }

        if (orgID) {
            fetchPendingTaskCounts();
        } else {
            setIsLoading(false);
        }
    }, [orgID]);

    return (
        <>
        <HeaderBar activeLink="To Do" currentPage="Overview" icon="la la-cogs" />
        <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
            <div className="row">
            <div className="col">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: "35px"}}>
                <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}>To Do</h1>
                <span style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}>This page lists all the items that need your attention and review.</span>
            </div>

            {isLoading ? (
                <div className="d-flex justify-content-center align-items-center" style={{ height: "200px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                        <div className="spinner-border text-primary" role="status">
                            <span className="sr-only">Loading...</span>
                        </div>
                        <span style={{ color: "#6B7280" }}>Loading tasks...</span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Tabs */}
                    <div className="career-tab-container">
                        <div className="career-tab-content">
                            {tabs.map((tab) => (
                            <div 
                            key={tab.value} 
                            className={`career-tab-item ${activeTab === tab.value ? "active" : ""}`}
                                onClick={() => {
                                    initialLoadRef.current = true;
                                    handleTabChange(tab.value);
                                }}>
                                {tab.label} <span style={{ marginLeft: "5px", borderRadius: "20px", border: "1px solid #D5D9EB", backgroundColor: "#F8F9FC", color: "#363F72", fontSize: "12px", padding: "0 10px" }}>{pendingTaskCounts[tab.value]}</span>
                            </div>
                            ))}
                    </div>
                    </div>

                    <ToDoTable taskType={activeTab} initialLoadRef={initialLoadRef} />
                </>
            )}
            </div>
            </div>
        </div>
        </>
    );
}