"use client";

import { useEffect, useState } from "react";
import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import styles from "@/lib/styles/screens/manage-project.module.scss";
import { errorToast } from "@/lib/Utils";
import SuccessModal from "./SuccessModal";
import { Career } from "@/lib/types/projects";

interface ShowCareersModalProps {
  onClose: () => void;
  onBack: () => void;
  projectId: string;
  onSave: () => void;
}

export default function ShowCareersModal({ onClose, onBack, projectId, onSave }: ShowCareersModalProps) {
  const { orgID, user } = useAppContext()

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [search, setSearch] = useState("")
  const [careers, setCareers] = useState<Career[]>([]);
  const [selectedCareers, setSelectedCareers] = useState<Career[]>([]);
  const [projectCareerIds, setProjectCareerIds] = useState<string[]>([]);

  useEffect(() => {
    let skeletonTimer: NodeJS.Timeout;

    const fetchData = async () => {
      try {
        skeletonTimer = setTimeout(() => {
          setLoading(true)
        }, 200);

        // Fetch all careers and project data in parallel
        const [careersResponse, projectResponse] = await Promise.all([
          api.get(`/api/get-careers?orgID=${orgID}&userEmail=${user?.email}&limit=1000`),
          api.post("/api/projects/get", { projectId, orgID })
        ])

        clearTimeout(skeletonTimer);

        if (careersResponse.status === 200) {
          const allCareers = careersResponse.data.careers.map((career: Career) => ({
            _id: career._id,
            jobTitle: career.jobTitle,
          }))

          // Get project's existing career IDs and filter them out
          const currentProjectCareerIds = projectResponse.data?.project?.careers || []
          setProjectCareerIds(currentProjectCareerIds)
          const availableCareers = allCareers.filter(
            (career: Career) => !currentProjectCareerIds.includes(career._id)
          )

          // Check availability status for all careers
          const careerIds = availableCareers.map((c: Career) => c._id);
          const availabilityResponse = await api.post("/api/projects/check-careers-availability", {
            careerIds,
            orgID
          });

          // Filter to only show truly available careers (not linked to any project)
          const availableCareerIds = availabilityResponse.data.careerStatuses
            .filter((status: any) => status.isAvailable)
            .map((status: any) => status.careerId);

          const onlyAvailableCareers = availableCareers.filter((career: Career) =>
            availableCareerIds.includes(career._id)
          );

          setCareers(onlyAvailableCareers)
        }
      } catch (error) {
        errorToast(error.message, 2500)
      } finally {
        clearTimeout(skeletonTimer);
        setLoading(false)
      }
    }

    fetchData()
  }, [orgID, projectId])

  const filteredCareers = careers.filter(career =>
    career.jobTitle.toLowerCase().includes(search.toLowerCase()) &&
    !projectCareerIds.includes(career._id)
  );

  const handleSelect = (career: Career) => {
    if (careers.some(c => c._id === career._id)) {
      setCareers(prev => prev.filter(c => c._id !== career._id))
      setSelectedCareers(prev => [...prev, career])
    } else {
      setSelectedCareers(prev => prev.filter(c => c._id !== career._id))
      setCareers(prev => [...prev, career])
    }
  }

  const handleSave = async () => {
    if (selectedCareers.length === 0) {
      errorToast("Please select at least one career", 2500)
      return
    }

    try {
      setSaving(true)
      const careerIds = selectedCareers.map(c => c._id)

      const response = await api.post("/api/projects/add-careers", {
        projectId,
        orgID,
        careerIds
      })

      if (response.status === 200) {
        setShowSuccess(true)
      }
    } catch (error: any) {
      // Parse 409 conflict errors
      if (error.response?.status === 409 && error.response?.data?.conflicts) {
        const conflicts = error.response.data.conflicts;
        if (conflicts.length === 1) {
          errorToast(
            `Cannot add "${conflicts[0].careerName}". Already linked to "${conflicts[0].projectName}".`,
            3500
          );
        } else {
          const conflictList = conflicts.map((c: any) => `• ${c.careerName} (${c.projectName})`).join('\n');
          errorToast(
            `Cannot add ${conflicts.length} careers:\n${conflictList}`,
            4000
          );
        }
      } else {
        errorToast(error.message || "Failed to add careers", 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  if (showSuccess) {
    return (
      <SuccessModal
        title="Careers have been added"
        description="Selected careers have been added to this project."
        onClose={() => {
          onSave()
          onClose()
        }}
      />
    );
  }

  return (
    <div
      className={`${styles.modalBackdrop} fade-in`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.careersModal}>
        {/* Modal Header */}
        <div className={styles.careersModalHeader}>
          <button className={styles.backButton} onClick={onBack}>
            <i className="la la-arrow-left"></i>
            <span>Back</span>
          </button>
          <h2>Add existing careers</h2>
          <i className="la la-times" onClick={onClose}></i>
        </div>

        {/* Modal Content */}
        <div className={styles.careersModalContent}>
          {/* Search Bar */}
            <div className={`table-search-bar ${styles.searchBar}`}>
              <div className="icon mr-2">
                <i className="la la-search"></i>
              </div>
              <input
                id="careers-search"
                type="search"
                className="form-control ml-auto search-input"
                placeholder="Search for career"
                onChange={(e) => setSearch(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Selected Careers List */}
            {selectedCareers.length > 0 && (
              <ul className={styles.selectedCareersList}>
                {selectedCareers.map((career) => (
                  <li key={career._id} className={styles.selectedCareerItem}>
                    <p className={styles.selectedCareerTitle}>{career.jobTitle}</p>
                    <button className={styles.removeCareerButton} onClick={() => handleSelect(career)} disabled={saving}>
                      <i className="la la-times"></i>
                    </button>
                  </li>
                ))}
              </ul>
            )}

          {/* Careers List */}
          <div className={styles.careersListContainer}>
            <ul className={styles.careersList}>
              {loading ? (
                [...Array(10)].map((_, index) => (
                  <li key={index} className={styles.careerItem}>
                    <div className="skeleton-bar" style={{ width: '180px', marginBottom: '14px'}} />
                  </li>
                ))
              ) : filteredCareers.length === 0 && selectedCareers.length === 0 && !loading ? (
                <div className={styles.emptyCareersList}>
                  <div className={styles.emptyStateIcon}>
                    <i className="las la-briefcase"></i>
                  </div>
                  <h3 className={styles.emptyStateTitle}>
                    {search ? "No careers found" : "No available careers"}
                  </h3>
                  <p className={styles.emptyStateText}>
                    {search
                      ? "Try adjusting your search term"
                      : "All careers are already linked to projects"}
                  </p>
                </div>
              ) : (
                filteredCareers.map((career) => (
                  <li key={career._id} className={styles.careerItem}>
                    <strong className={styles.careerItemTitle}>{career.jobTitle}</strong>
                    <button
                      className={styles.addCareerButton}
                      onClick={() => handleSelect(career)}
                      disabled={saving}
                    >
                      <i className="la la-plus"></i>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={styles.careersModalFooter}>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving || selectedCareers.length === 0}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
