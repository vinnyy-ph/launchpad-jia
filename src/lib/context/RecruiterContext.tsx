import { createContext, ReactNode, useState, useContext } from "react";

const RecruiterContext = createContext({
    hasUnsavedChanges: false,
    setHasUnsavedChanges: (_hasUnsavedChanges: boolean) => { },
    setModalType: (_modalType: string | null) => { },
    modalType: null,
    refreshTabBadges: () => { },
    activeCareerUsageType: null as "premium" | "credit-based" | null,
    setActiveCareerUsageType: (_type: "premium" | "credit-based" | null) => { },
});

export function useRecruiterContext() {
    return useContext(RecruiterContext);
}

export const RecruiterContextProvider = ({ children, refreshTabBadges }: { children: ReactNode, refreshTabBadges: () => void }) => {
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [modalType, setModalType] = useState(null);
    const [activeCareerUsageType, setActiveCareerUsageType] = useState<"premium" | "credit-based" | null>(null);

    return (
        <RecruiterContext.Provider value={{
            hasUnsavedChanges,
            setHasUnsavedChanges,
            setModalType,
            modalType,
            refreshTabBadges,
            activeCareerUsageType,
            setActiveCareerUsageType
        }}>
            {children}
        </RecruiterContext.Provider>
    );
}