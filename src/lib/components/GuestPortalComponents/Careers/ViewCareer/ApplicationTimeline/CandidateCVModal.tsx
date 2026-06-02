"use client";

import React from "react";
import CandidateCVModalView from "./CandidateCVModalView";
import { useCandidateCVData } from "./useCandidateCVData";

type CandidateCVMini = {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
};

export default function CandidateCVModal({
  candidate,
  onClose,
}: {
  candidate: CandidateCVMini;
  onClose: () => void;
}) {
  const { isLoading, error, cvData } = useCandidateCVData(candidate?.email);

  return <CandidateCVModalView candidate={candidate} onClose={onClose} isLoading={isLoading} error={error} cvData={cvData} />;
}
