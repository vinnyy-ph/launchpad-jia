"use client";

import React from "react";

type SuccessScreenProps = {
  onViewRequisitions?: () => void;
  onBackToHome?: () => void;
  isResubmit?: boolean;
};

const SuccessScreen: React.FC<SuccessScreenProps> = ({ 
  onViewRequisitions, 
  onBackToHome,
  isResubmit = false
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: "80px 32px",
        textAlign: "center",
        minHeight: "400px",
      }}
    >
      {/* Success Icon */}
      <div
        style={{
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="48" height="48" rx="24" fill="#D1FADF"/>
          <rect x="4" y="4" width="48" height="48" rx="24" stroke="#ECFDF3" strokeWidth="8"/>
          <path d="M38 27.0799V27.9999C37.9988 30.1563 37.3005 32.2545 36.0093 33.9817C34.7182 35.7088 32.9033 36.9723 30.8354 37.5838C28.7674 38.1952 26.5573 38.1218 24.5345 37.3744C22.5117 36.6271 20.7847 35.246 19.611 33.4369C18.4373 31.6279 17.8798 29.4879 18.0217 27.3362C18.1636 25.1844 18.9972 23.1362 20.3983 21.4969C21.7994 19.8577 23.6928 18.7152 25.7962 18.24C27.8996 17.7648 30.1003 17.9822 32.07 18.8599M38 19.9999L28 30.0099L25 27.0099" stroke="#039855" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Success Message */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: "#101828",
            margin: 0,
            lineHeight: 1.33,
          }}
        >
          {isResubmit ? "Your requisition has been re-submitted." : "Your requisition has been submitted."}
        </h2>
        <p
          style={{
            fontSize: 16,
            fontWeight: 400,
            color: "#667085",
            margin: 0,
            lineHeight: 1.5,
            maxWidth: 400,
          }}
        >
          {isResubmit ? "Please wait for our team to review your re-submission." : "Please wait for our team to review your submission."}
        </p>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {/* View my requisitions button */}
        <button
          type="button"
          onClick={onViewRequisitions}
          style={{
            padding: "10px 18px",
            borderRadius: 9999,
            border: "1px solid #D0D5DD",
            background: "#FFFFFF",
            fontSize: 14,
            fontWeight: 500,
            color: "#344054",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
            minWidth: 140,
            boxShadow: "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
          }}
        >
          {isResubmit ? "View my Requisition" : "View my requisitions"}
        </button>

        {/* Back to home button */}
        <button
          type="button"
          onClick={onBackToHome}
          style={{
            padding: "10px 18px",
            borderRadius: 9999,
            border: "none",
            background: "#181D27",
            fontSize: 14,
            fontWeight: 500,
            color: "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
            minWidth: 120,
            boxShadow: "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default SuccessScreen;