import React, { useState, useEffect } from "react";
import styles from "@/lib/components/MailgunComponents/email.module.scss";
import Button from "@/lib/components/ui/button/Button";
import Dropdown from "@/lib/components/ui/dropdown/Dropdown";
import { apiClient } from "@/lib/utils/apiClient";

interface LinkCareerModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string | null;
  applicantEmail: string | null;
  orgId: string | null;
  onSuccess?: () => void;
}

interface CareerOption {
  id: string;
  jobTitle: string;
}

const LinkCareerModal = ({
  isOpen,
  onClose,
  threadId,
  applicantEmail,
  orgId,
  onSuccess,
}: LinkCareerModalProps) => {
  const [selectedCareerId, setSelectedCareerId] = useState("");
  const [careers, setCareers] = useState<CareerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCareers, setIsFetchingCareers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch careers for the applicant when modal opens
  useEffect(() => {
    if (!isOpen || !applicantEmail || !orgId) {
      setCareers([]);
      return;
    }

    async function fetchCareers() {
      setIsFetchingCareers(true);
      setError(null);
      try {
        const response = await apiClient.post(
          "/api/mailgun-module/mg-fetch-applicant-careers",
          {
            applicantEmail,
            orgId,
          }
        );

        const fetchedCareers = response.data?.careers || [];
        setCareers(fetchedCareers);
      } catch (err: any) {
        console.error("Failed to fetch careers:", err);
        setError(
          err.response?.data?.error || "Failed to load careers. Please try again."
        );
      } finally {
        setIsFetchingCareers(false);
      }
    }

    fetchCareers();
  }, [isOpen, applicantEmail, orgId]);

  const handleSave = async () => {
    if (!selectedCareerId || !threadId || !orgId) {
      setError("Please select a career");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiClient.post("/api/mailgun-module/mg-link-career", {
        threadId,
        careerId: selectedCareerId,
        orgId,
      });

      onSuccess?.();
      onClose();
      setSelectedCareerId("");
    } catch (err: any) {
      console.error("Failed to link career:", err);
      setError(
        err.response?.data?.error || "Failed to link career. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const careerOptions = careers.map((career) => career.jobTitle);
  const selectedCareerTitle = careers.find(
    (c) => c.id === selectedCareerId
  )?.jobTitle || "";

  return (
    <div className={styles.emailModalOverlay} onClick={onClose}>
      <div
        className={`${styles.emailModalContainer} ${styles.career}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.icon}>
            <img src="/iconsV3/briefcase.svg" />
          </div>
          <div className={styles.modalTitleWrapper}>
            <span className={styles.modalTitle}>Link to Career</span>
            <span className={styles.modalSubtitle}>
              Assign this email thread to a specific career
            </span>
          </div>
          <img
            src="/iconsV3/x.svg"
            alt="close"
            onClick={onClose}
            style={{ alignSelf: "flex-start", cursor: "pointer" }}
          />
        </div>

        {/* Content */}
        <div className={styles.modalContent}>
          {isFetchingCareers ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <span>Loading careers...</span>
            </div>
          ) : careers.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <span>
                No careers found for this applicant in your organization.
              </span>
            </div>
          ) : (
            <Dropdown
              label="Career"
              placeholder="Select a career"
              dropdownItems={careerOptions}
              value={selectedCareerTitle}
              onSelect={(careerTitle) => {
                const career = careers.find((c) => c.jobTitle === careerTitle);
                setSelectedCareerId(career?.id || "");
              }}
            />
          )}
          {error && (
            <div
              style={{
                color: "red",
                fontSize: "14px",
                marginTop: "10px",
                padding: "10px",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <Button
            label="Save"
            onClick={handleSave}
            disabled={!selectedCareerId || isLoading || isFetchingCareers}
          />
        </div>
      </div>
    </div>
  );
};

export default LinkCareerModal;
