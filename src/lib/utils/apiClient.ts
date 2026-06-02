/**
 * Centralized API client configuration
 * Automatically adds Bearer token to all requests
 */

import axios from "axios";
import { clearUserSession, loadingToast } from "../Utils";
import Swal from "sweetalert2";
import { toast } from "react-toastify";

// ============================================
// AXIOS CONFIGURATION WITH INTERCEPTORS
// ============================================

// Create axios instance
export const apiClient = axios.create({
  baseURL: "/", // Use relative paths for Next.js API routes
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - automatically adds Bearer token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("authToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper function to retry request with delay
const retryRequest = (config: any, retryCount: number = 0): Promise<any> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      apiClient(config)
        .then(resolve)
        .catch((error) => {
          if (error.response?.status === 401 && retryCount < 2) {
            console.log(`Retry attempt ${retryCount + 1} for 401 error`);
            retryRequest(config, retryCount + 1)
              .then(resolve)
              .catch(reject);
          } else {
            reject(error);
          }
        });
    }, 3000); // 3 second delay
  });
};

// Response interceptor - handle common errors with retry logic
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized with retry logic
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Show loading toast for retry attempts
      loadingToast("Fetching data...");

      try {
        // Retry the request up to 2 times with 3-second intervals
        const response = await retryRequest(originalRequest);

        // Dismiss loading toast on successful retry
        if (typeof window !== "undefined") {
          toast.dismiss("loading-toast");
        }

        return response;
      } catch (retryError) {
        // All retry attempts failed, show SweetAlert modal
        if (typeof window !== "undefined") {
          // Dismiss loading toast
          toast.dismiss("loading-toast");

          // Show SweetAlert modal
          const result = await Swal.fire({
            title: "Session Expired",
            text: "Your session has expired. Please log in again to continue.",
            icon: "warning",
            showCancelButton: false,
            confirmButtonText: "Log In",
            confirmButtonColor: "#4169e1",
            allowOutsideClick: false,
            allowEscapeKey: false,
          });

          if (result.isConfirmed) {
            clearUserSession();
            // Redirect to appropriate login page
            if (window.location.host.startsWith(process.env.NEXT_PUBLIC_ADMIN_APP_DOMAIN)) {
              window.location.href = "/login";
            } else {
              window.location.href = "/";
            }
          }
        }
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      const errorCode = error.response?.data?.error;
      const isExpectedPhoneVerificationFlow =
        errorCode === "phone_verification_required" ||
        error.response?.data?.verificationRequired === true;

      if (!isExpectedPhoneVerificationFlow) {
        console.error("Forbidden - insufficient permissions");
        console.error("Error details:", {
          message: error.response?.data?.message,
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
        });
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// CONVENIENCE METHODS
// ============================================

export const api = {
  get: (url: string, config = {}) => apiClient.get(url, config),
  post: (url: string, data?: any, config = {}) =>
    apiClient.post(url, data, config),
  put: (url: string, data?: any, config = {}) =>
    apiClient.put(url, data, config),
  patch: (url: string, data?: any, config = {}) =>
    apiClient.patch(url, data, config),
  delete: (url: string, config = {}) => apiClient.delete(url, config),
};

export default apiClient;
