"use client";

import React, { useEffect, useState } from "react";
import Tabs from "./Tabs";
import Sort from "./Sort";
import AddRequisitionButton from "./AddRequisitionButton";
import { CreateRequisitionForm } from "./Form";
import { GuestPortalTab } from "./types";

interface GuestPortalContainerProps {
  children: React.ReactNode;
  activeTab: GuestPortalTab;
  onTabChange?: (tab: GuestPortalTab) => void;
  showCreateForm?: boolean;
  onCreateRequisition?: () => void;
  onBackFromForm?: () => void;
  onSubmitForm?: (data: any) => void;
  onViewRequisitions?: () => void;
  onBackToHome?: () => void;
  hideHeaderControls?: boolean;
  onSortChange?: (sortOption: string) => void;
}

export default function GuestPortalContainer({ 
  children, 
  activeTab, 
  onTabChange = () => {},
  showCreateForm = false,
  onCreateRequisition,
  onBackFromForm,
  onSubmitForm,
  onViewRequisitions,
  onBackToHome,
  hideHeaderControls = false,
  onSortChange,
}: GuestPortalContainerProps) {
  const isCareers = activeTab === "careers";
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (localStorage.user) {
        const user = JSON.parse(localStorage.user);
        const fullName: string = user?.name || user?.displayName || "";

        if (fullName) {
          const derivedFirstName = fullName.trim().split(" ")[0];
          setFirstName(derivedFirstName || fullName);
        } else {
          setFirstName("Guest");
        }
      } else {
        setFirstName("Guest");
      }
    } catch (error) {
      console.error("Error parsing user data for guest portal greeting:", error);
      setFirstName("Guest");
    }
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1650px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        textAlign: "center",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          background: "#ffffff",
          padding: "32px 32px",
          borderRadius: "26px",
          textAlign: "left",
          boxSizing: "border-box",
          flex: 1,
        }}
      >
        {!showCreateForm && !hideHeaderControls && (
          <>
            {/* Welcome Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: "24px",
                    lineHeight: "2rem",
                    fontWeight: 550,
                    color: "#101828",
                  }}
                >
                  {`Welcome, ${firstName || "Guest"}!`}
                </h1>
                <p
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "16px",
                    lineHeight: "1rem",
                    fontWeight: 550,
                    color: "#667085",
                  }}
                >
                  Welcome to the guest portal — you can view, create, and manage job requisitions here.
                </p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              isCareers={isCareers}
              onTabChange={onTabChange}
            />
          </>
        )}

        {/* Content Area */}
        <div
          style={{
            paddingTop: showCreateForm ? "0rem" : "0.5rem",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          {!showCreateForm ? (
            <>
              {!hideHeaderControls && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "18px",
                      fontWeight: 500,
                      color: "#101828",
                      margin: 0,
                    }}
                  >
                    {isCareers ? "Careers" : "Requisitions"}
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "20px",
                      minHeight: "40px",
                    }}
                  >
                    <Sort onSortChange={onSortChange} />
                    {!isCareers && <AddRequisitionButton onClick={onCreateRequisition} />}
                  </div>
                </div>
              )}

              {children}
            </>
          ) : (
            <CreateRequisitionForm 
              onBack={onBackFromForm}
              onSubmit={onSubmitForm}
              onViewRequisitions={onViewRequisitions}
              onBackToHome={onBackToHome}
            />
          )}
        </div>
      </div>
    </div>
  );
}
