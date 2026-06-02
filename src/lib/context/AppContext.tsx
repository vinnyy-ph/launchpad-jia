"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useLocalStorage } from "../hooks/useLocalStorage";

// Define the shape of the context data
interface AppContextProps {
  // Add your global props here
  user: any;
  isAuthenticated: boolean;
  theme: string;
  orgID: string;
  setUser: (user: any) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setTheme: (theme: string) => void;
  setOrgID: (orgID: string) => void;
}

// Create the context with default values
const AppContext = createContext<AppContextProps>({
  user: null,
  isAuthenticated: false,
  theme: "light",
  orgID: "",
  setUser: () => {},
  setIsAuthenticated: () => {},
  setTheme: () => {},
  setOrgID: () => {},
});

// Custom hook to use the context
export const useAppContext = () => useContext(AppContext);

// Context Provider component
export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [theme, setTheme] = useState("light");
  const [orgID, setOrgID] = useState("");
  const searchParams = useSearchParams();
  const [activeOrg, setActiveOrg] = useLocalStorage("activeOrg", null);

  // Add any initialization logic here
  // For example, load user data from localStorage on mount
  React.useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const authToken = localStorage.getItem("authToken");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error(
          "AppContext: Error parsing user from localStorage:",
          error
        );
      }
    }

    if (authToken) {
      setIsAuthenticated(true);
    }
  }, []);

  React.useEffect(() => {
    const orgIDParams = searchParams.get("orgID");

    if (orgIDParams) {
      setOrgID(orgIDParams);
    } else if (activeOrg) {
      setOrgID(activeOrg._id);
    }
  }, [activeOrg, searchParams]);

  React.useEffect(() => {
  
   setTimeout(()=>{
    if (activeOrg && activeOrg.name) {
      document.title = `${activeOrg.name} | JIA | AI-Powered End-to-End Hiring Tool`;
    } else {
     if(window.location.hostname.includes("hellojia.ai")) {
      document.title = "Jia | A Smarter Job Portal for New Opportunities";
     } else {
      document.title = "JIA | AI-Powered End-to-End Hiring Tool";
     }
    }
   },300)
   
  }, [activeOrg]);

  // Listen for localStorage changes to update user
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user" && e.newValue) {
        try {
          const newUser = JSON.parse(e.newValue);
          setUser(newUser);
        } catch (error) {
          console.error("AppContext: Error parsing updated user:", error);
        }
      }
    };

    const handleCustomStorageChange = (e: CustomEvent) => {
      if (e.detail.key === "user" && e.detail.value) {
        setUser(e.detail.value);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "localStorageChange",
      handleCustomStorageChange as EventListener
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "localStorageChange",
        handleCustomStorageChange as EventListener
      );
    };
  }, []);

  // The value to be provided to consuming components
  const contextValue = {
    user,
    isAuthenticated,
    theme,
    orgID,
    setUser,
    setIsAuthenticated,
    setTheme,
    setOrgID,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};
