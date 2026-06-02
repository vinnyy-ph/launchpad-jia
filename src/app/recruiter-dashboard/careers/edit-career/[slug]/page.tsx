"use client";

import React, { useEffect, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import SegmentedCareerForm from "@/lib/components/CareerComponents/SegmentedCareerForm";
import { useParams, useSearchParams } from "next/navigation";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/AppContext";
import { errorToast } from "../../../../../lib/Utils";

export default function EditCareerPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const { orgID } = useAppContext();
  const [career, setCareer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const rawStep = searchParams.get("step");
  const parsedStep = rawStep ? parseInt(rawStep) : undefined;
  const initialStep =
    parsedStep !== undefined && parsedStep >= 0 && parsedStep <= 4
      ? parsedStep
      : undefined;
  const sectionId = searchParams.get("section") || undefined;

  useEffect(() => {
    const fetchCareer = async () => {
      try {
        const [careerResponse, projectsResponse] = await Promise.all([
          api.post("/api/career-data", { id: slug, orgID }),
          api.post("/api/projects/get-by-career", { careerId: slug, orgID }),
        ]);

        if (careerResponse.status === 200 && projectsResponse.status === 200) {
          const project = projectsResponse.data.project;
          setCareer({
            ...careerResponse.data,
            project: project?.name || "",
            projectId: project?._id || "",
          });
        }
      } catch (error) {
        console.error(error);
        errorToast("Error fetching career data", 1300);
        setTimeout(() => {
          window.location.href = "/recruiter-dashboard/careers";
        }, 1300);
      } finally {
        setIsLoading(false);
      }
    };
    if (slug && orgID) {
      fetchCareer();
    }
  }, [slug, orgID]);
  return isLoading ? (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ height: "100vh" }}
    >
      <div className="spinner-border text-primary" role="status">
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  ) : (
    <>
      <HeaderBar
        activeLink="Careers"
        currentPage={career?.jobTitle}
        icon="la la-suitcase"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <SegmentedCareerForm
            formType="edit"
            career={career}
            initialStep={initialStep}
            sectionId={sectionId}
          />
        </div>
      </div>
    </>
  );
}
