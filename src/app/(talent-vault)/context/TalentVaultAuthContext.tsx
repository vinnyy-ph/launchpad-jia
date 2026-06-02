"use client";

import { createContext, useContext, useEffect, useState } from "react";

const TalentVaultAuthContext = createContext({
  modalType: null,
  user: null,
  setModalType: (_modalType: string | null) => {},
});

export function useTalentVaultAuth() {
  return useContext(TalentVaultAuthContext);
}

export default function TalentVaultAuthProvider({ children }) {
  const [modalType, setModalType] = useState(null);
  const [user, setUser] = useState(null);
  const contextValue = { modalType, user, setModalType };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse stored user:", error);
      }
    }
  }, []);

  return (
    <TalentVaultAuthContext.Provider value={contextValue}>
      {children}
    </TalentVaultAuthContext.Provider>
  );
}
