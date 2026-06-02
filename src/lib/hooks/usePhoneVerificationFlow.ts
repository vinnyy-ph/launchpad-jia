import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import firebase, { firebaseAuth } from "@/lib/firebase/firebaseClient";
import { api } from "@/lib/utils/apiClient";
import { isStrictInternationalPhone } from "@/lib/utils/phoneInput";

type PhoneVerificationStep = "phone" | "otp" | "contact";
type OtpProvider = "console" | "firebase-auth" | "twilio-verify";
type VerificationFlow = "client" | "server";
type FirebaseVerificationState =
  | "approved"
  | "expired"
  | "failed"
  | "max_attempts_reached";

const GENERIC_REQUEST_ERROR_MESSAGE =
  "Unable to send verification code. Please try again.";
const GENERIC_VERIFY_ERROR_MESSAGE =
  "Unable to verify code. Please try again.";
const GENERIC_ERROR_HOSTS = new Set(["staging.hellojia.ai", "hellojia.ai"]);

interface UsePhoneVerificationFlowParams {
  isPhoneVerificationModalOpen: boolean;
  mobileNumber: string;
  onDigitChange: (index: number, digit: string) => void;
  onRequestMobileApplied: (mobileNumber: string) => void;
  onVerificationApproved: (nextUser: any, verifiedMobileNumber: string) => void;
  otpCountdown: number;
  passcode: string;
  phoneVerificationStep: PhoneVerificationStep;
  recaptchaContainerId: string;
  resetPasscode: () => void;
  setIsRequestingOtp: Dispatch<SetStateAction<boolean>>;
  setIsVerifyingOtp: Dispatch<SetStateAction<boolean>>;
  setMaskedMobileNumber: Dispatch<SetStateAction<string>>;
  setMobileNumber: Dispatch<SetStateAction<string>>;
  setMobileNumberError: Dispatch<SetStateAction<string>>;
  setOtpCountdown: Dispatch<SetStateAction<number>>;
  setOtpError: Dispatch<SetStateAction<string | null>>;
  setPhoneVerificationStep: Dispatch<SetStateAction<PhoneVerificationStep>>;
  updateStoredUser: (nextUser: any) => void;
  user: any;
}

function normalizeProvider(value?: string): OtpProvider {
  const normalized = `${value || ""}`.trim().toLowerCase();

  if (normalized === "firebase-auth") {
    return "firebase-auth";
  }

  if (normalized === "console") {
    return "console";
  }

  return "twilio-verify";
}

function normalizeFlow(value?: string): VerificationFlow {
  return `${value || ""}`.trim().toLowerCase() === "client"
    ? "client"
    : "server";
}

function shouldUseGenericErrorMessage() {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = `${window.location.hostname || ""}`.trim().toLowerCase();
  return GENERIC_ERROR_HOSTS.has(hostname);
}

function toSafeMessage(message: any, fallback: string) {
  if (shouldUseGenericErrorMessage()) {
    return fallback;
  }

  const normalizedMessage = `${message || ""}`.trim();
  return normalizedMessage || fallback;
}

function mapFirebaseErrorMessage(
  error: any,
  fallback = GENERIC_VERIFY_ERROR_MESSAGE,
) {
  if (shouldUseGenericErrorMessage()) {
    return fallback;
  }

  const code = `${error?.code || ""}`.trim();
  const rawMessage = `${error?.response?.data?.error?.message || error?.message || ""}`
    .trim()
    .toUpperCase();

  if (code === "auth/invalid-verification-code") {
    return "Incorrect verification code. Please try again.";
  }

  if (code === "auth/code-expired" || code === "auth/session-expired") {
    return "Verification code has expired. Please request a new one.";
  }

  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please try again later or use a different number.";
  }

  if (code === "auth/provider-already-linked") {
    return "Your account already has a linked mobile number.";
  }

  if (code === "auth/account-exists-with-different-credential") {
    return "This mobile number is already associated with another account. Please use a different number.";
  }

  if (code === "auth/captcha-check-failed") {
    return "Captcha validation failed. Please try again.";
  }

  if (
    code === "auth/invalid-app-credential" ||
    code === "auth/missing-app-credential" ||
    code === "auth/invalid-app-verifier" ||
    rawMessage.includes("INVALID_APP_CREDENTIAL")
  ) {
    return "Invalid reCAPTCHA app credential. Check Firebase authorized domains and make sure reCAPTCHA is not blocked.";
  }

  if (code === "auth/operation-not-allowed" || rawMessage.includes("OPERATION_NOT_ALLOWED")) {
    return "Phone sign-in is disabled in Firebase. Enable Phone under Firebase Auth > Sign-in method.";
  }

  if (rawMessage.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
    return "Too many attempts. Please try again later or use a different test number.";
  }

  return fallback;
}

function mapFirebaseErrorState(errorCode: string): FirebaseVerificationState | null {
  if (errorCode === "auth/invalid-verification-code") {
    return "failed";
  }

  if (errorCode === "auth/code-expired" || errorCode === "auth/session-expired") {
    return "expired";
  }

  if (errorCode === "auth/too-many-requests") {
    return "max_attempts_reached";
  }

  return null;
}

export function usePhoneVerificationFlow({
  isPhoneVerificationModalOpen,
  mobileNumber,
  onDigitChange,
  onRequestMobileApplied,
  onVerificationApproved,
  otpCountdown,
  passcode,
  phoneVerificationStep,
  recaptchaContainerId,
  resetPasscode,
  setIsRequestingOtp,
  setIsVerifyingOtp,
  setMaskedMobileNumber,
  setMobileNumber,
  setMobileNumberError,
  setOtpCountdown,
  setOtpError,
  setPhoneVerificationStep,
  updateStoredUser,
  user,
}: UsePhoneVerificationFlowParams) {
  const challengeIdRef = useRef("");
  const providerRef = useRef<OtpProvider>("twilio-verify");
  const recaptchaVerifierRef = useRef<any>(null);
  const confirmationResultRef = useRef<any>(null);

  const setRecaptchaUiVisibility = useCallback(
    (isVisible: boolean) => {
      if (typeof document === "undefined") {
        return;
      }

      const recaptchaContainer = document.getElementById(recaptchaContainerId);
      if (recaptchaContainer) {
        recaptchaContainer.style.display = isVisible ? "" : "none";
      }

      document.querySelectorAll(".grecaptcha-badge").forEach((element) => {
        const badge = element as HTMLElement;
        badge.style.visibility = isVisible ? "visible" : "hidden";
        badge.style.opacity = isVisible ? "1" : "0";
        badge.style.pointerEvents = isVisible ? "auto" : "none";
      });
    },
    [recaptchaContainerId],
  );

  const clearRecaptchaVerifier = useCallback(() => {
    if (recaptchaVerifierRef.current?.clear) {
      recaptchaVerifierRef.current.clear();
    }

    if (typeof document !== "undefined") {
      const recaptchaContainer = document.getElementById(recaptchaContainerId);
      if (recaptchaContainer?.parentNode) {
        recaptchaContainer.parentNode.removeChild(recaptchaContainer);
      }
    }

    setRecaptchaUiVisibility(false);
    recaptchaVerifierRef.current = null;
  }, [recaptchaContainerId, setRecaptchaUiVisibility]);

  const getRecaptchaVerifier = useCallback(async () => {
    if (recaptchaVerifierRef.current) {
      setRecaptchaUiVisibility(true);
      return recaptchaVerifierRef.current;
    }

    if (typeof window === "undefined") {
      throw new Error("Phone verification is only available in the browser.");
    }

    let recaptchaContainer = document.getElementById(recaptchaContainerId);

    if (!recaptchaContainer) {
      recaptchaContainer = document.createElement("div");
      recaptchaContainer.id = recaptchaContainerId;
      recaptchaContainer.className = "recaptcha-container";
      document.body.appendChild(recaptchaContainer);
    }

    if (!recaptchaContainer) {
      throw new Error("Unable to initialize phone verification. Please refresh.");
    }

    recaptchaVerifierRef.current = new firebase.auth.RecaptchaVerifier(
      recaptchaContainerId,
      {
        badge: "bottomright",
        size: "invisible",
      },
    );

    await recaptchaVerifierRef.current.render();
    setRecaptchaUiVisibility(true);

    return recaptchaVerifierRef.current;
  }, [recaptchaContainerId, setRecaptchaUiVisibility]);

  const startFirebaseVerification = useCallback(
    async (nextMobileNumber: string, forceNewChallenge = false) => {
      let currentUser = firebaseAuth.currentUser;

      if (!currentUser) {
        currentUser = await new Promise<any | null>((resolve) => {
          let settled = false;
          let timeoutId = 0;
          let unsubscribe: () => void = () => {};

          const complete = (user: any | null) => {
            if (settled) {
              return;
            }

            settled = true;
            window.clearTimeout(timeoutId);
            unsubscribe();
            resolve(user);
          };

          timeoutId = window.setTimeout(() => {
            complete(firebaseAuth.currentUser);
          }, 2500);

          unsubscribe = firebaseAuth.onAuthStateChanged((nextUser) => {
            if (nextUser) {
              complete(nextUser);
            }
          });
        });
      }

      if (!currentUser) {
        throw new Error("You need to sign in again before verifying your number.");
      }

      if (!forceNewChallenge && confirmationResultRef.current) {
        return;
      }

      const recaptchaVerifier = await getRecaptchaVerifier();

      const unlinkPhoneProviderIfLinked = async () => {
        const hasLinkedPhoneProvider = Array.isArray(currentUser?.providerData)
          ? currentUser.providerData.some(
              (provider: any) =>
                provider?.providerId === firebase.auth.PhoneAuthProvider.PROVIDER_ID,
            )
          : false;

        if (!hasLinkedPhoneProvider) {
          return;
        }

        try {
          await currentUser.unlink(firebase.auth.PhoneAuthProvider.PROVIDER_ID);
        } catch (unlinkError: any) {
          const unlinkCode = `${unlinkError?.code || ""}`.trim();
          if (
            unlinkCode !== "auth/no-such-provider" &&
            unlinkCode !== "auth/provider-not-linked"
          ) {
            throw unlinkError;
          }
        }
      };

      await unlinkPhoneProviderIfLinked();

      try {
        confirmationResultRef.current = await currentUser.linkWithPhoneNumber(
          nextMobileNumber,
          recaptchaVerifier,
        );
      } catch (linkError: any) {
        const linkErrorCode = `${linkError?.code || ""}`.trim();
        if (linkErrorCode !== "auth/provider-already-linked") {
          throw linkError;
        }

        await currentUser.reload();
        currentUser = firebaseAuth.currentUser || currentUser;
        await unlinkPhoneProviderIfLinked();

        confirmationResultRef.current = await currentUser.linkWithPhoneNumber(
          nextMobileNumber,
          recaptchaVerifier,
        );
      }
    },
    [getRecaptchaVerifier],
  );

  const applyRequestResponse = useCallback(
    async (
      responseData: any,
      nextMobileNumber: string,
      forceNewFirebaseChallenge: boolean,
    ) => {
      const normalizedMobileNumber = nextMobileNumber.trim();
      const nextProvider = normalizeProvider(responseData?.provider);
      const nextFlow = normalizeFlow(responseData?.flow);

      challengeIdRef.current = `${responseData?.challengeId || ""}`.trim();
      providerRef.current = nextProvider;

      if (nextProvider === "firebase-auth" && nextFlow === "client") {
        await startFirebaseVerification(
          normalizedMobileNumber,
          forceNewFirebaseChallenge,
        );
      }

      const resendAvailableInSeconds = Number(
        responseData?.resendAvailableInSeconds,
      );

      setMobileNumber(normalizedMobileNumber);
      setMaskedMobileNumber(responseData?.maskedMobileNumber || "");
      setOtpCountdown(
        Number.isFinite(resendAvailableInSeconds)
          ? resendAvailableInSeconds
          : 105,
      );
      onRequestMobileApplied(normalizedMobileNumber);
      resetPasscode();
      setPhoneVerificationStep("otp");
    },
    [
      onRequestMobileApplied,
      resetPasscode,
      setMaskedMobileNumber,
      setMobileNumber,
      setOtpCountdown,
      setPhoneVerificationStep,
      startFirebaseVerification,
    ],
  );

  const requestPhoneVerificationCode = useCallback(
    async (nextMobileNumber = mobileNumber) => {
      const isOtpStep = phoneVerificationStep === "otp";
      setIsRequestingOtp(true);
      setMobileNumberError("");
      setOtpError(null);

      try {
        const response = await api.post(
          "/api/job-portal/phone-verification/request",
          {
            mobileNumber: nextMobileNumber.trim(),
          },
        );

        await applyRequestResponse(response.data, nextMobileNumber, true);
      } catch (error: any) {
        const responseData = error?.response?.data;

        if (error?.response?.status === 429 && responseData?.maskedMobileNumber) {
          try {
            await applyRequestResponse(
              responseData,
              nextMobileNumber,
              !confirmationResultRef.current,
            );
            return;
          } catch (providerError: any) {
            const providerErrorMessage = mapFirebaseErrorMessage(
              providerError,
              GENERIC_REQUEST_ERROR_MESSAGE,
            );

            if (isOtpStep) {
              setOtpError(providerErrorMessage);
            } else {
              setMobileNumberError(providerErrorMessage);
            }

            return;
          }
        }

        const errorMessage = toSafeMessage(
          responseData?.message ||
            responseData?.error ||
            mapFirebaseErrorMessage(error, GENERIC_REQUEST_ERROR_MESSAGE),
          GENERIC_REQUEST_ERROR_MESSAGE,
        );

        if (isOtpStep) {
          setOtpError(errorMessage);
        } else {
          setMobileNumberError(errorMessage);
        }
      } finally {
        setIsRequestingOtp(false);
      }
    },
    [
      applyRequestResponse,
      mobileNumber,
      phoneVerificationStep,
      setIsRequestingOtp,
      setMobileNumberError,
      setOtpError,
    ],
  );

  const handlePhoneVerificationNext = useCallback(async () => {
    const normalizedMobileNumber = mobileNumber.trim();
    if (!normalizedMobileNumber) {
      setMobileNumberError("Please enter your mobile number.");
      return;
    }

    if (!isStrictInternationalPhone(normalizedMobileNumber)) {
      setMobileNumberError(
        "Enter a valid number with country code, e.g. +639223334444.",
      );
      return;
    }

    await requestPhoneVerificationCode(normalizedMobileNumber);
  }, [mobileNumber, requestPhoneVerificationCode, setMobileNumberError]);

  const handleOtpDigitChange = useCallback(
    (index: number, digit: string) => {
      setOtpError((current) => {
        if (current) {
          return null;
        }

        return current;
      });
      onDigitChange(index, digit);
    },
    [onDigitChange, setOtpError],
  );

  const handleVerifyOtp = useCallback(async () => {
    if (!passcode || passcode.trim().length < 6) {
      setOtpError("Please enter the 6-digit verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    const normalizedMobileNumber = mobileNumber.trim();

    try {
      if (providerRef.current === "firebase-auth") {
        if (!confirmationResultRef.current) {
          throw new Error("Please request a new verification code.");
        }

        try {
          await confirmationResultRef.current.confirm(passcode.trim());
        } catch (firebaseError: any) {
          const firebaseErrorCode = `${firebaseError?.code || ""}`.trim();
          const verificationState = mapFirebaseErrorState(firebaseErrorCode);

          if (verificationState) {
            try {
              await api.post("/api/job-portal/phone-verification/verify", {
                challengeId: challengeIdRef.current,
                mobileNumber: normalizedMobileNumber,
                verificationErrorCode: firebaseErrorCode,
                verificationState,
              });
            } catch (failedAttemptError: any) {
              setOtpError(
                  failedAttemptError?.response?.data?.message ||
                  failedAttemptError?.response?.data?.error ||
                  mapFirebaseErrorMessage(
                    firebaseError,
                    GENERIC_VERIFY_ERROR_MESSAGE,
                  ),
              );
              return;
            }
          }

          setOtpError(
            mapFirebaseErrorMessage(
              firebaseError,
              GENERIC_VERIFY_ERROR_MESSAGE,
            ),
          );
          return;
        }

        const firebaseUser = firebaseAuth.currentUser;

        if (firebaseUser) {
          const refreshedToken = await firebaseUser.getIdToken(true);
          localStorage.authToken = refreshedToken;
        }

        const response = await api.post(
          "/api/job-portal/phone-verification/verify",
          {
            challengeId: challengeIdRef.current,
            mobileNumber: normalizedMobileNumber,
            verificationState: "approved",
          },
        );

        const updatedUser = {
          ...user,
          ...response.data?.applicant,
        };

        updateStoredUser(updatedUser);
        onVerificationApproved(
          updatedUser,
          response.data?.applicant?.mobileNumber || normalizedMobileNumber,
        );
        resetPasscode();
        setPhoneVerificationStep("contact");
        return;
      }

      const response = await api.post("/api/job-portal/phone-verification/verify", {
        challengeId: challengeIdRef.current,
        code: passcode.trim(),
        mobileNumber: normalizedMobileNumber,
      });

      const updatedUser = {
        ...user,
        ...response.data?.applicant,
      };

      updateStoredUser(updatedUser);
      onVerificationApproved(
        updatedUser,
        response.data?.applicant?.mobileNumber || normalizedMobileNumber,
      );
      resetPasscode();
      setPhoneVerificationStep("contact");
    } catch (error: any) {
      setOtpError(
        toSafeMessage(
          error?.response?.data?.message || error?.response?.data?.error,
          GENERIC_VERIFY_ERROR_MESSAGE,
        ),
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  }, [
    mobileNumber,
    onVerificationApproved,
    passcode,
    resetPasscode,
    setIsVerifyingOtp,
    setOtpError,
    setPhoneVerificationStep,
    updateStoredUser,
    user,
  ]);

  const handleResendOtp = useCallback(
    async () => {
      if (otpCountdown > 0) {
        return;
      }

      await requestPhoneVerificationCode(mobileNumber);
    },
    [mobileNumber, otpCountdown, requestPhoneVerificationCode],
  );

  const handleBackToPhone = useCallback(() => {
    setOtpError(null);
    resetPasscode();
    setPhoneVerificationStep("phone");
  }, [resetPasscode, setOtpError, setPhoneVerificationStep]);

  const resetVerificationSession = useCallback(() => {
    challengeIdRef.current = "";
    providerRef.current = "twilio-verify";
    confirmationResultRef.current = null;
    clearRecaptchaVerifier();
  }, [clearRecaptchaVerifier]);

  useEffect(() => {
    if (
      !isPhoneVerificationModalOpen ||
      phoneVerificationStep !== "otp" ||
      otpCountdown <= 0
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOtpCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [
    isPhoneVerificationModalOpen,
    otpCountdown,
    phoneVerificationStep,
    setOtpCountdown,
  ]);

  useEffect(() => {
    return () => {
      clearRecaptchaVerifier();
    };
  }, [clearRecaptchaVerifier]);

  return {
    handleBackToPhone,
    handleOtpDigitChange,
    handlePhoneVerificationNext,
    handleResendOtp,
    handleVerifyOtp,
    requestPhoneVerificationCode,
    resetVerificationSession,
  };
}
