import React from "react";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#F9FAFC",
        padding: "20px",
        textAlign: "center"
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #EAECF0",
          borderRadius: "16px",
          padding: "40px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0px 4px 12px rgba(10, 13, 18, 0.05)"
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <div style={{ 
            height: "56px", 
            width: "56px", 
            background: "#F2F4F7", 
            borderRadius: "50%", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            margin: "0 auto",
            color: "#475467",
            fontSize: "24px"
          }}>
            <i className="la la-link" />
          </div>
        </div>
        <h2 style={{ marginTop: 0, marginBottom: "12px", color: "#101828", fontSize: "24px", fontWeight: 600 }}>
          Link not found
        </h2>
        <p style={{ color: "#475467", margin: 0, fontSize: "16px", lineHeight: "24px" }}>
          The page you are looking for is not available.
        </p>
      </div>
    </div>
  );
}
