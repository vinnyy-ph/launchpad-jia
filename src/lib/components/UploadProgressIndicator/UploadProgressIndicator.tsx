"use client";
import React, { useState } from "react";
import { useUpload } from "@/lib/context/UploadContext";

export default function UploadProgressIndicator() {
    const { isProcessing, processedFiles, setUploadModalOpen, totalRecords } = useUpload();

    // Don't show anything if not processing and no files
    if (!isProcessing && processedFiles.length === 0) {
        return null;
    }

    const importedCount = processedFiles.filter(file => file.status === "Imported").length;
    const duplicateCount = processedFiles.filter(file => file.status === "Duplicate").length;
    const failedCount = processedFiles.filter(file => file.status === "Failed").length;
    const progressPercentage = totalRecords > 0 
        ? (processedFiles.filter(f => f.status !== "Processing").length / totalRecords * 100).toFixed(0) 
        : 0;
    const uploadStatusStyles = {
        "Imported": {
            color: "#039855",
            backgroundColor: "#ECFDF3",
            icon: "la la-check",
            iconColor: "#039855",
            text: `${importedCount} candidates successfully imported`
        },
        "Duplicate": {
            color: "#DC6803",
            backgroundColor: "#FFFAEB",
            icon: "la la-exclamation-triangle",
            iconColor: "#DC6803",
            text: `${duplicateCount} duplicates found on recent import`
        },
        "Failed": {
            color: "#D92D20",
            backgroundColor: "#FEE4E2",
            icon: "la la-times",
            iconColor: "#D92D20",
            text: `${failedCount} candidates failed due to missing required fields`
        },
        "Processing": {
            color: "#1570EF",
            backgroundColor: "#D1E9FF",
            icon: "la la-clock",
            iconColor: "#1570EF",
            text: `${progressPercentage}% Importing candidates`
        },
    };

    const getStatus = () => {
        if (isProcessing) {
            return uploadStatusStyles["Processing"];
        }
        if (duplicateCount > 0) {
            return uploadStatusStyles["Duplicate"];
        }
        if (failedCount >= importedCount) {
            return uploadStatusStyles["Failed"];
        }
        return uploadStatusStyles["Imported"];
    }

    return (
        <div style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            right: 0,  
            backgroundColor: getStatus().backgroundColor, 
            borderRadius: "10px", 
            zIndex: 1000, 
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            height: "40px",
            gap: "10px",
        }}
        >
            <i className={getStatus().icon} style={{ fontSize: "16px", color: getStatus().iconColor }} />
            <span style={{ color: "#181D27", fontSize: "14px", fontWeight: 500 }}>{getStatus().text}</span>
            <span style={{ cursor: "pointer", color: getStatus().color, fontSize: "14px", fontWeight: 500 }} onClick={() => setUploadModalOpen(true)}>
                {!isProcessing ? "Review" : "View Progress"}
            </span>
        </div>
    );
}

