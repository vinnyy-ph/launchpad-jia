"use client";

import React, { useEffect, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { api } from "@/lib/utils/apiClient";
import { PricingPlan, PricingPlanFormData } from "@/lib/types/pricing";
import PricingPlanCard from "@/lib/components/AdminComponents/PricingPlans/PricingPlanCard";
import AddPlanModal from "@/lib/components/AdminComponents/PricingPlans/AddPlanModal";
import UnpublishConfirmModal from "@/lib/components/AdminComponents/PricingPlans/UnpublishConfirmModal";
import { candidateActionToast, errorToast } from "@/lib/Utils";

export default function PricingPlansPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Unpublish confirmation
  const [unpublishModal, setUnpublishModal] = useState<{
    isOpen: boolean;
    planId: string | null;
    planName: string;
  }>({ isOpen: false, planId: null, planName: "" });

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/api/pricing-plan/admin/get-pricing-plans");
      const sortedPlans = response.data.sort((a: PricingPlan, b: PricingPlan) => {
        if (a.status === b.status) return 0;
        return a.status === "unpublished" ? 1 : -1;
      });
      setPlans(sortedPlans);
    } catch (error) {
      console.error("Error fetching pricing plans:", error);
      errorToast("Error fetching pricing plans", 1500);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreatePlan = async (data: PricingPlanFormData) => {
    try {
      setIsCreating(true);
      await api.post("/api/pricing-plan/admin/create-pricing-plan", data);
      candidateActionToast(
        "New plan added.",
        1500,
        <i className="la la-check-circle text-success"></i>
      );
      await fetchPlans();
      setShowAddModal(false);
    } catch (error: any) {
      console.error("Error creating plan:", error);
      errorToast(error.response?.data?.error || "Error creating plan", 1500);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdatePlan = async (planId: string, data: PricingPlanFormData) => {
    try {
      setIsSaving(true);
      await api.put("/api/pricing-plan/admin/update-pricing-plan", { planId, ...data });
      candidateActionToast(
        "Plan updated successfully.",
        1500,
        <i className="la la-check-circle text-success"></i>
      );
      await fetchPlans();
      setEditingPlanId(null);
    } catch (error: any) {
      console.error("Error updating plan:", error);
      errorToast(error.response?.data?.error || "Error updating plan", 1500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = (planId: string, newStatus: "published" | "unpublished") => {
    if (newStatus === "unpublished") {
      const plan = plans.find((p) => p._id === planId);
      setUnpublishModal({
        isOpen: true,
        planId,
        planName: plan?.name || "",
      });
    } else {
      confirmToggleStatus(planId, newStatus);
    }
  };

  const confirmToggleStatus = async (planId: string, newStatus: "published" | "unpublished") => {
    try {
      await api.patch("/api/pricing-plan/admin/toggle-pricing-plan-status", { planId, status: newStatus });
      candidateActionToast(
        `Plan ${newStatus === "published" ? "published" : "unpublished"} successfully.`,
        1500,
        <i className="la la-check-circle text-success"></i>
      );
      await fetchPlans();
    } catch (error: any) {
      console.error("Error toggling plan status:", error);
      errorToast(error.response?.data?.error || "Error toggling plan status", 1500);
    } finally {
      setUnpublishModal({ isOpen: false, planId: null, planName: "" });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;

    try {
      await api.delete(`/api/pricing-plan/admin/delete-pricing-plan?planId=${planId}`);
      candidateActionToast(
        "Plan deleted successfully.",
        1500,
        <i className="la la-check-circle text-success"></i>
      );
      await fetchPlans();
      setEditingPlanId(null);
    } catch (error: any) {
      console.error("Error deleting plan:", error);
      errorToast(error.response?.data?.error || "Error deleting plan", 1500);
    }
  };

  const handleEdit = (planId: string) => {
    setEditingPlanId(planId);
  };

  const handleCancelEdit = () => {
    setEditingPlanId(null);
  };

  // Skeleton loader for cards
  const SkeletonCard = () => (
    <div
      style={{
        border: "1px solid #E9EAEB",
        borderRadius: "12px",
        padding: "24px",
        backgroundColor: "white",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "120px", height: "24px", backgroundColor: "#E9EAEB", borderRadius: "4px" }} />
          <div style={{ width: "80px", height: "24px", backgroundColor: "#E9EAEB", borderRadius: "16px" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "80px", height: "24px", backgroundColor: "#E9EAEB", borderRadius: "4px" }} />
          <div style={{ width: "44px", height: "24px", backgroundColor: "#E9EAEB", borderRadius: "24px" }} />
        </div>
      </div>
      <div style={{ borderTop: "1px solid #E9EAEB", paddingTop: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i}>
              <div style={{ width: "100px", height: "14px", backgroundColor: "#E9EAEB", borderRadius: "4px", marginBottom: "8px" }} />
              <div style={{ width: "150px", height: "18px", backgroundColor: "#E9EAEB", borderRadius: "4px" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <HeaderBar activeLink="Pricing Plans" currentPage="Overview" icon="la la-credit-card" />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem", paddingBottom: "6rem" }}>
        <div className="row">
          <div className="col">
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "24px",
              }}
            >
              <div>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#181D27", marginBottom: "4px" }}>
                  Pricing Plans
                </h1>
                <p style={{ fontSize: "16px", color: "#717680", margin: 0 }}>
                  Manage and customize available plans offered to customers.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #D5D7DA",
                  backgroundColor: "white",
                  color: "#181D27",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <i className="la la-plus" style={{ fontSize: "18px" }}></i>
                Add new plan
              </button>
            </div>

            {/* Plans List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : plans.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    border: "1px dashed #D5D7DA",
                    borderRadius: "12px",
                    backgroundColor: "#FAFAFA",
                  }}
                >
                  <i className="la la-credit-card" style={{ fontSize: "48px", color: "#D5D7DA", marginBottom: "16px" }}></i>
                  <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#181D27", marginBottom: "8px" }}>
                    No pricing plans yet
                  </h3>
                  <p style={{ fontSize: "14px", color: "#717680", marginBottom: "20px" }}>
                    Create your first pricing plan to get started.
                  </p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#181D27",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <i className="la la-plus" style={{ fontSize: "18px" }}></i>
                    Add new plan
                  </button>
                </div>
              ) : (
                plans.map((plan) => (
                  <PricingPlanCard
                    key={plan._id}
                    plan={plan}
                    isEditing={editingPlanId === plan._id}
                    onEdit={() => handleEdit(plan._id)}
                    onCancelEdit={handleCancelEdit}
                    onSave={(data) => handleUpdatePlan(plan._id, data)}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDeletePlan}
                    isSaving={isSaving && editingPlanId === plan._id}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Plan Modal */}
      <AddPlanModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreatePlan}
        isLoading={isCreating}
      />

      {/* Unpublish Confirmation Modal */}
      <UnpublishConfirmModal
        isOpen={unpublishModal.isOpen}
        onClose={() => setUnpublishModal({ isOpen: false, planId: null, planName: "" })}
        onConfirm={() => {
          if (unpublishModal.planId) {
            confirmToggleStatus(unpublishModal.planId, "unpublished");
          }
        }}
        planName={unpublishModal.planName}
      />
    </>
  );
}
