"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";
import { useAppContext } from "@/lib/context/ContextV2";
import { api } from "@/lib/utils/apiClient";
import Breadcrumbs from "@/lib/ui/components/Breadcrumbs";
import Button from "@/lib/components/ui/button/Button";
import { CVandProfile } from "./CVandProfile";
import { InterviewSection } from "./InterviewSection";

export function TalentVaultProfileDashboard() {
  const { user } = useAppContext();
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<"cv" | "interview">("cv");
  const [profile, setProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      if (!user?.email) {
        if (!cancelled) {
          setProfile(null);
          setIsLoadingProfile(false);
        }
        return;
      }

      setIsLoadingProfile(true);

      try {
        const response = await api.get("/api/talent-vault/profiles");

        if (!cancelled) {
          setProfile(response?.data?.data || null);
        }
      } catch (error) {
        console.error("Error loading talent vault profile:", error);

        if (!cancelled) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.uid]);

  const displayUserImage = profile?.userInfo?.image || user?.image || "/user-profile.png";
  const displayUserName = profile?.userInfo?.name || user?.name || "";
  const aiInterviewId =
    typeof profile?.latestAssessment?.aiInterviewAssessmentId === "string"
      ? profile.latestAssessment.aiInterviewAssessmentId
      : null;

  return (
    <div className={styles.talentVault}>
      <div className={styles.header}>
        <div className={styles.headerBreadcrumbDesktop}>
          <Breadcrumbs
            items={[
              {
                label: "Talent Vault",
                href: "/dashboard/talent-vault",
                iconSrc: "/iconsV3/tv-icon.svg",
                iconAlt: "Talent Vault icon",
              },
              {
                label: "Profile",
                current: true,
              },
            ]}
          />
        </div>
        <div className={styles.headerBreadcrumbMobile}>
          <Button
            variant="secondary"
            size="default"
            pill
            icon="/icons/arrow.svg"
            iconPosition="left"
            iconStyle={{ width: 20, height: 20 }}
            label="Back to Dashboard"
            onClick={() => router.push("/dashboard/talent-vault")}
          />
        </div>
        <div className={styles.profileHeaderRow}>
          <div className={styles.profilePhoto}>
            <img src={displayUserImage} alt="User profile photo" />
          </div>
          <div className={styles.profileHeaderText}>
            <h1 className={styles.name}>Talent Vault Profile</h1>
            <p className={styles.profileHeaderUserName}>{displayUserName}</p>
          </div>
        </div>
      </div>

      {/* TODO: Make it dropdown for smaller screens */}
      <div className={styles.tabs}>
        <div 
          className={`${styles.tab} ${selectedTab === "cv" ? styles.selected : styles.unselected}`}
          onClick={() => setSelectedTab("cv")}
          style={{ cursor: "pointer" }}
        >
          <img src="/iconsV3/file.svg" alt="File Icon" />
          <span className={`${styles.tabName} ${selectedTab === "cv" ? styles.selected : styles.unselected}`}>CV and Profile</span>
        </div>

        <div 
          className={`${styles.tab} ${selectedTab === "interview" ? styles.selected : styles.unselected}`}
          onClick={() => setSelectedTab("interview")}
          style={{ cursor: "pointer" }}
        >
          <img src="/iconsV3/mic.svg" alt="Microphone Icon" />
          <span className={`${styles.tabName} ${selectedTab === "interview" ? styles.selected : styles.unselected}`}>AI Interview</span>
        </div>

        {/* <div className={`${styles.tab} ${styles.unselected}`}>
          <img src="/icons/sensor_occupied.svg" alt="Sensor Occupied Icon" />
          <span className={`${styles.tabName} ${styles.unselected}`}>Personality Test</span>
        </div> */}
      </div>

      <div className={styles.content}>
        {selectedTab === "cv" && (
          <CVandProfile
            profile={profile}
            isLoading={isLoadingProfile}
            onProfileUpdated={(nextProfile) => setProfile(nextProfile)}
          />
        )}
        {selectedTab === "interview" && (
          <InterviewSection
            interviewId={aiInterviewId}
            applicantName={displayUserName}
          />
        )}
      </div>
    </div>
  )
}
