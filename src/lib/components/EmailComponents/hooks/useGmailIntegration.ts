import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";

interface UseGmailIntegrationReturn {
    isLoading: boolean;
    hasGmailToken: boolean;
    isEnablingGmail: boolean;
    checkGmailIntegration: () => Promise<void>;
    handleEnableGmailIntegration: () => Promise<void>;
}

export function useGmailIntegration(userEmail?: string): UseGmailIntegrationReturn {
    const [isLoading, setIsLoading] = useState(true);
    const [hasGmailToken, setHasGmailToken] = useState(false);
    const [isEnablingGmail, setIsEnablingGmail] = useState(false);

    const checkGmailIntegration = async () => {
        try {
            // Check if refresh token exists in sessionStorage
            const storedToken = sessionStorage.getItem("gmRefreshToken");

            if (storedToken) {
                setHasGmailToken(true);
                setIsLoading(false);
                return;
            }

            // If no stored token, check with the API
            if (userEmail) {
                const response = await api.post("/api/email-module/gm-fetch-extension", {
                    email: userEmail,
                });

                if (response.data?.success) {
                    const data = await response.data;
                    if (data.success && data.data.refreshToken) {
                        // Save refresh token to sessionStorage
                        sessionStorage.setItem("gmRefreshToken", data.data.refreshToken);
                        setHasGmailToken(true);
                    } else {
                        setHasGmailToken(false);
                    }
                } else {
                    setHasGmailToken(false);
                }
            } else {
                setHasGmailToken(false);
            }
        } catch (error) {
            setHasGmailToken(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEnableGmailIntegration = async () => {
        if (!userEmail) {
            return;
        }

        setIsEnablingGmail(true);
        try {
            const response = await api.post("/api/email-module/gm-enable-extension", {
                email: userEmail,
            });

            if (response.data?.success) {
                const data = await response.data;
                if (data.success && data.data.authUrl) {
                    // Redirect to Google OAuth
                    window.location.href = data.data.authUrl;
                } else if (data.success && data.data.refreshToken) {
                    // User already has integration
                    sessionStorage.setItem("gmRefreshToken", data.data.refreshToken);
                    setHasGmailToken(true);
                    setIsEnablingGmail(false);
                }
            } else {
                setIsEnablingGmail(false);
            }
        } catch (error) {
            setIsEnablingGmail(false);
        }
    };

    // Check for Gmail integration on component mount
    useEffect(() => {
        checkGmailIntegration();
    }, [userEmail]);

    // Handle URL parameters for OAuth callback
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get("success");
        const error = urlParams.get("error");

        if (success === "gmail_integrated") {
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);

            // Re-check Gmail integration
            setIsLoading(true);
            checkGmailIntegration();
        } else if (error) {
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    return {
        isLoading,
        hasGmailToken,
        isEnablingGmail,
        checkGmailIntegration,
        handleEnableGmailIntegration,
    };
}
