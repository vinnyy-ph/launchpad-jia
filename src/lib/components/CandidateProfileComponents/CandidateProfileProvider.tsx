"use client";

import Modal from "@/lib/components/commonV2/Modal";
import { createContext, useContext, useState } from "react";

type CandidateProfileContextType = {
  modalType: string | null;
  setModalType: (modalType: string | null) => void;
};

const CandidateProfileContext = createContext<CandidateProfileContextType>({
  modalType: null,
  setModalType: () => {},
});

export function useCandidateProfileContext() {
  return useContext(CandidateProfileContext);
}

export default function CandidateProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modalType, setModalType] = useState<string | null>(null);
  const contextValue = { modalType, setModalType };

  return (
    <CandidateProfileContext.Provider value={contextValue}>
      {modalType && <Modal modalType={modalType} setModalType={setModalType} />}
      {children}
    </CandidateProfileContext.Provider>
  );
}
