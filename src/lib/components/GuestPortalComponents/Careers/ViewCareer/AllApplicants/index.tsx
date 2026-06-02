"use client";

import React, { useState } from "react";
import ApplicantsFilters from "./ApplicantsFilters";
import ApplicantsTable from "./ApplicantsTable";
import { useAllApplicants } from "./useAllApplicants";
import { CandidateDetailsModal } from "./CandidateDetailsModal";

type Props = {
  careerId: string;
};

type SelectedCandidate = {
  _id?: string;
  interviewID?: string;
  name: string;
  email: string;
  image?: string;
  fit?: string;
  endorsedBy?: string;
  endorsedByAvatar?: string;
};

export default function AllApplicants({ careerId }: Props) {
  const {
    loading,
    search,
    setSearch,
    sortBy,
    setSortBy,
    filterStatus,
    setFilterStatus,
    filterStage,
    setFilterStage,
    filterStageOptions,
    sortByOptions,
    filterStatusOptions,
    applicants,
    totalPages,
    totalApplicants,
    currentPage,
    setCurrentPage,
  } = useAllApplicants({ careerId });

  const [selectedCandidate, setSelectedCandidate] = useState<SelectedCandidate | null>(null);

  const handleRowClick = (applicant: any) => {
    // Open the candidate details modal
    setSelectedCandidate({
      _id: applicant._id?.toString(),
      interviewID: applicant.interviewID || applicant._id?.toString(),
      name: applicant.name || "Unknown Candidate",
      email: applicant.email || "",
      image: applicant.image || "/default-avatar.png",
      fit: applicant.cvStatus,
      endorsedBy: applicant.endorsedBy,
      endorsedByAvatar: applicant.endorsedByAvatar,
    });
  };

  const handleCloseModal = () => {
    setSelectedCandidate(null);
  };

  return (
    <>
      <ApplicantsFilters
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortByOptions={sortByOptions}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterStatusOptions={filterStatusOptions}
        filterStage={filterStage}
        setFilterStage={setFilterStage}
        filterStageOptions={filterStageOptions}
        search={search}
        setSearch={setSearch}
        onResetPage={() => setCurrentPage(1)}
      />

      <ApplicantsTable
        loading={loading}
        applicants={applicants}
        totalApplicants={totalApplicants}
        totalPages={totalPages}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onRowClick={handleRowClick}
      />

      {selectedCandidate && (
        <CandidateDetailsModal
          candidate={selectedCandidate}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
