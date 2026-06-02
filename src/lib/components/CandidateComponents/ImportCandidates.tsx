"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import apiClient, { api } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import { candidateActionToast, convertSkillsToMarkdown, errorToast, getPhoneFromContent, parseSkillsFromMarkdown, syncOrgSkillsMetadataDiff, validateEmail, validatePhone } from "@/lib/Utils";
import { useUpload } from "@/lib/context/UploadContext";
import Markdown from "react-markdown";
import { Button } from "../ui";
import SkillTagInput from "./SkillTagInput";
import Image from "next/image";

const tableHeaderStyle: any = {
    textTransform: "none",
    fontWeight: 700,
    fontSize: 12,
    color: "#717680",
}

export default function ImportCandidatesModal() {
    const [showCVModal, setShowCVModal] = useState(false);
    const [selectedApplicant, setSelectedApplicant] = useState(null);
    const { isProcessing, processedFiles, startProcessing, replaceExistingFiles, clearProcessedFiles, updateFileStatus, setUploadModalOpen, totalRecords, uploadType, fileQueue, bulkEmailInviteSent, setBulkEmailInviteSent } = useUpload();

    const importedProcessing = processedFiles.filter(file => file.status === "Imported").length;
    const failedProcessing = processedFiles.filter(file => file.status === "Failed").length;
    const duplicateProcessing = processedFiles.filter(file => file.status === "Duplicate").length;
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");

    const handleBulkInvite = async () => {
        try {
            Swal.showLoading();
            const response = await api.post("/api/bulk-invite-applicants", {
                orgID: orgID,
                emails: processedFiles.filter(file => file.status === "Imported" && !file.jiaAccount).map(file => file.email),
            });
            if (response.data.error) {
                throw new Error(response.data.error);
            }
            candidateActionToast(
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginLeft: 8,
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                            Email invites sent
                        </span>
                        <span
                            style={{
                                fontSize: 14,
                                color: "#717680",
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                            }}
                        >
                            You have sent invites to {processedFiles.filter(file => file.status === "Imported" && !file.jiaAccount).length} candidates.
                        </span>
                    </div>
                </div>,
                3000,
                <i
                    className="la la-user-check"
                    style={{ color: "#039855", fontSize: 32 }}
                ></i>);
            setBulkEmailInviteSent(true);
        } catch (error) {
            console.error(error);
            errorToast("Failed to send email invites", 3000);
        } finally {
            Swal.close();
        }
    }

    const validateCVFiles = (fileList: File[]): boolean => {
        const invalidFiles = fileList.filter((file: File) => file.type !== "application/pdf" && file.type !== "application/msword" && file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && file.type !== "text/plain");
        if (invalidFiles.length > 0) {
            alert("Only PDF, DOC, DOCX, or TXT files are allowed.");
            return false;
        }

        const invalidFilesSizes = fileList.filter((file: File) => file.size > 25 * 1024 * 1024);
        if (invalidFilesSizes.length > 0) {
            alert("File size must be less than 25MB.");
            return false;
        }
        return true;
    }

    const validateSpreadsheetFiles = (fileList: File[]): boolean => {
        const invalidFiles = fileList.filter((file: File) => file.type !== "text/csv" && file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        if (invalidFiles.length > 0) {
            alert("Only CSV or XLSX files are allowed.");
            return false;
        }
        if (fileList.length > 1) {
            alert("Only one spreadsheet is allowed.");
            return false;
        }
        const invalidFilesSizes = fileList.filter((file: File) => file.size > 25 * 1024 * 1024);
        if (invalidFilesSizes.length > 0) {
            alert("File size must be less than 25MB.");
            return false;
        }
        return true;
    }

    const downloadTemplate = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const response = await apiClient.get("https://cdn.hellojia.ai/import-candidate-template/Jia_Candidate_Import_Template.xlsx", {
                responseType: "blob",
            });
            const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "Jia_Candidate_Import_Template.xlsx";
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 500);
        } catch (error) {
            console.error(error);
            errorToast("Failed to download template", 3000);
        }
    }

    return (
        <div className="modal-background fade-in-bottom">
            <div className="modal-container">
                <div className="modal-content" style={{
                    overflowY: "auto",
                    height: "504px",
                    width: processedFiles.length > 0 ? "900px" : "640px",
                    background: "#fff",
                    border: `1.5px solid #E9EAEB`,
                    borderRadius: 14,
                    boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
                    position: "absolute",
                    top: "50%",
                    left: showCVModal ? "calc(50% - 300px)" : "50%",
                    transform: "translate(-50%, -50%)",
                }}
                >
                    <div className="modal-header">
                        <h3 className="modal-title">Import Candidates</h3>
                        <button type="button" className="close" data-dismiss="modal" aria-label="Close" onClick={() => {
                            setUploadModalOpen(false);
                        }}>
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    {(processedFiles.length > 0 || isProcessing) ?
                        <div className="modal-body">
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {isProcessing ?
                                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
                                        <Image src="/gifs/analysis-loading.gif" alt="Uploading CVs" width={48} height={48} style={{ objectFit: "cover" }} />
                                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                            <span style={{ fontSize: "14px", color: "#181D27", fontWeight: 700 }}>{uploadType === "spreadsheet" ? `Uploading [${fileQueue?.[0].name}]` : "Uploading CVs..."}</span>
                                            <span>Your upload continues even if you close this modal. <br /> You can close this window and reopen it anytime from the top bar.</span>
                                        </div>
                                    </div> : <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        <span style={{ fontSize: "14px", color: "#181D27", fontWeight: 700 }}>Upload Complete!</span>
                                        {importedProcessing > 0 && (<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#D1FADF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <i className="la la-check" style={{ fontSize: "16px", color: "#12B76A" }} />
                                            </div>
                                            <span> <span style={{ color: "#181D27", fontWeight: 700, fontSize: "14px" }}>{importedProcessing}</span> candidates imported successfully</span>
                                        </div>)}
                                        {duplicateProcessing > 0 && (
                                            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                                                <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#FEF0C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <i className="la la-exclamation-triangle" style={{ fontSize: "16px", color: "#DC6803" }} />
                                                </div>
                                                <span> <span style={{ color: "#181D27", fontWeight: 700, fontSize: "14px" }}>{duplicateProcessing}</span> candidates flagged as duplicates</span>
                                            </div>
                                        )}
                                        {failedProcessing > 0 && (
                                            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                                                <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#FEF3F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <i className="la la-times" style={{ fontSize: "16px", color: "#F04438" }} />
                                                </div>
                                                <span> <span style={{ color: "#181D27", fontWeight: 700, fontSize: "14px" }}>{failedProcessing}</span> candidates failed due to missing required fields or incorrect format</span>
                                            </div>
                                        )}
                                    </div>}

                                {isProcessing && <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>{processedFiles.filter(f => f.status !== "Processing").length} of {totalRecords} {uploadType === "spreadsheet" ? "rows" : "files"} processed</span>
                                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px", maxWidth: "420px", width: "100%" }}>
                                        <div
                                            style={{
                                                width: "100%",
                                                height: 8,
                                                borderRadius: 4,
                                                background: "#E9EAEB",
                                                marginRight: 16,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${(processedFiles.filter(f => f.status !== "Processing").length / totalRecords * 100).toFixed(0)}%`,
                                                    height: "100%",
                                                    borderRadius: 4,
                                                    background: "linear-gradient(90deg, #9FCAED 0%, #CEB6DA 33%, #EBACC9 66%, #FCCEC0 100%)"
                                                }}
                                            />
                                        </div>
                                        <span style={{ fontSize: 14 }}>
                                            {(processedFiles.filter(f => f.status !== "Processing").length / totalRecords * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>}

                                <div style={{ height: "1px", width: "100%", backgroundColor: "#E9EAEB", margin: "10px 0" }} />

                                {duplicateProcessing > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", backgroundColor: "#FFFAEB", padding: "15px", borderRadius: "10px" }}>
                                        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                                            <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 700 }}>Duplicates</span>

                                            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setSelectedApplicant(null);
                                                        setShowCVModal(false);
                                                        processedFiles.filter(file => file.status === "Duplicate").forEach(file => {
                                                            if (file.email) {
                                                                updateFileStatus(file.email, {
                                                                    status: "Imported",
                                                                    newCV: null,
                                                                });
                                                            }
                                                        });
                                                    }}
                                                    label="Keep Old Versions"
                                                    icon="/folder.svg"
                                                >
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setSelectedApplicant(null);
                                                        setShowCVModal(false);
                                                        replaceExistingFiles(processedFiles.filter(file => file.status === "Duplicate"))
                                                    }}
                                                    label="Replace Existing Files"
                                                    icon="/redo.svg"
                                                >
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="table-responsive" style={{ height: "100%", background: "#FFFFFF", borderRadius: "20px" }}>
                                            <table className="table align-items-center table-flush" style={{ border: "1px solid #E9EAEB" }}>
                                                <thead>
                                                    <tr>
                                                        <th scope="col" className="sort" data-sort="name" style={tableHeaderStyle}>
                                                            Candidate
                                                        </th>
                                                        <th scope="col" className="sort" data-sort="assessment" style={tableHeaderStyle}>
                                                            Email Address
                                                        </th>
                                                        <th scope="col" className="sort" data-sort="dropped-by" style={tableHeaderStyle}>
                                                            Action
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {processedFiles.filter(file => file.status === "Duplicate").map((file, index) => (
                                                        <tr key={index}>
                                                            <td>{file.name}</td>
                                                            <td>{file.email}</td>
                                                            <td>
                                                                <i className="la la-eye" style={{ fontSize: "16px", color: "#535862", cursor: "pointer" }} onClick={() => {
                                                                    setSelectedApplicant(file);
                                                                    setShowCVModal(true);
                                                                }} />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {failedProcessing > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", backgroundColor: "#FEF3F2", padding: "15px", borderRadius: "10px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", width: "100%", gap: "5px" }}>
                                            <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 700 }}>Failed</span>
                                            <span>These candidates were skipped due to either missing information or incorrect format. </span>
                                        </div>

                                        <div className="table-responsive" style={{ height: "100%", background: "#FFFFFF", borderRadius: "20px" }}>
                                            <table className="table align-items-center table-flush" style={{ border: "1px solid #E9EAEB" }}>
                                                <thead>
                                                    <tr>
                                                        <th scope="col" className="sort" data-sort="candidate" style={tableHeaderStyle}>
                                                            Candidate
                                                        </th>
                                                        <th scope="col" className="sort" data-sort="row" style={tableHeaderStyle}>
                                                            Row
                                                        </th>
                                                        <th scope="col" className="sort" data-sort="email" style={tableHeaderStyle}>
                                                            Email Address
                                                        </th>
                                                        <th scope="col" className="sort" data-sort="reason" style={tableHeaderStyle}>
                                                            Reason
                                                        </th>
                                                        <th scope="col" className="sort" data-sort="dropped-by" style={tableHeaderStyle}>
                                                            Action
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {processedFiles.filter(file => file.status === "Failed").map((file, index) => (
                                                        <tr key={index}>
                                                            <td>{file.name || "N/A"}</td>
                                                            <td>{file.row || "N/A"}</td>
                                                            <td>{file.email || "N/A"}</td>
                                                            <td>
                                                                {file.errorMessage || "-"}
                                                            </td>
                                                            {file.invalidFields && file.invalidFields.length > 0 ? (<td>
                                                                <i className="la la-eye" style={{ fontSize: "16px", color: "#535862", cursor: "pointer" }} onClick={() => {
                                                                    setSelectedApplicant(file);
                                                                    setShowCVModal(true);
                                                                }} />
                                                            </td>) : (<td>-</td>)}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {!isProcessing && <>
                                    {importedProcessing > 0 && (<span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>{importedProcessing} successfully imported</span>)}
                                    {processedFiles.filter(f => f.status === "Imported" && !f.jiaAccount).length > 0 && <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8F9FC", padding: "20px", borderRadius: "10px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                            <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 700 }}>Invite candidates without a Jia account</span>
                                            <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>Email candidates a link to join Jia.</span>
                                        </div>

                                        <Button
                                            disabled={bulkEmailInviteSent}
                                            variant="secondary"
                                            label={`Invite ${processedFiles.filter(f => f.status === "Imported" && !f.jiaAccount).length} candidates`}
                                            icon="/user-plus.svg"
                                            style={{
                                                opacity: bulkEmailInviteSent ? 0.5 : 1,
                                                cursor: bulkEmailInviteSent ? "not-allowed" : "pointer"
                                            }}
                                            onClick={() => {
                                                if (!bulkEmailInviteSent) {
                                                    handleBulkInvite();
                                                }
                                            }}
                                        >
                                            {/* <i className="la la-user-plus" style={{ fontSize: "16px", marginRight: "8px" }} /> */}
                                        </Button>
                                    </div>}
                                </>}
                                {/* Table */}
                                <div className="table-responsive" style={{ height: "100%", background: "#FFFFFF", borderRadius: "20px" }}>
                                    <table className="table align-items-center table-flush" style={{ border: "1px solid #E9EAEB" }}>
                                        <thead>
                                            <tr>
                                                <th scope="col" className="sort" data-sort="name" style={tableHeaderStyle}>
                                                    Candidate
                                                </th>
                                                <th scope="col" className="sort" data-sort="assessment" style={tableHeaderStyle}>
                                                    Email Address
                                                </th>
                                                <th scope="col" className="sort" data-sort="assessment" style={tableHeaderStyle}>
                                                    Jia Account
                                                </th>
                                                <th scope="col" className="sort" data-sort="evaluation" style={tableHeaderStyle}>
                                                    Status
                                                </th>
                                                <th scope="col" className="sort" data-sort="dropped-by" style={tableHeaderStyle}>
                                                    CV
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {processedFiles.map((file, index) => (
                                                <tr key={index}>
                                                    <td>{file.name || "N/A"}</td>
                                                    <td>{file.email || "N/A"}</td>
                                                    <td>{file.jiaAccount ? <i className="la la-check" style={{ fontSize: "16px", color: "#12B76A" }} /> : file.jiaAccount === null ? <span>-</span> : <i className="la la-times" style={{ fontSize: "16px", color: "#F04438" }} />}</td>
                                                    <td><ImportCandidateStatus status={file.status} /></td>
                                                    <td>
                                                        <i className="la la-eye" style={{ fontSize: "16px", color: "#535862", cursor: "pointer" }} onClick={() => {
                                                            setSelectedApplicant(file);
                                                            setShowCVModal(true);
                                                        }} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
                                    {!isProcessing && duplicateProcessing === 0 && <Button
                                        variant="primary"
                                        onClick={() => {
                                            clearProcessedFiles();
                                            setUploadModalOpen(false);
                                        }}
                                        // style={{ width: "120px", marginTop: "10px" }}
                                        label="Finish"
                                    >
                                    </Button>}
                                </div>
                            </div>
                        </div>
                        : <div className="modal-body">
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "10px", width: "100%", boxSizing: "border-box", height: "100%", minHeight: "300px" }}>
                                    <label
                                        htmlFor="upload-cvs-input"
                                        style={{
                                            boxSizing: "border-box",
                                            width: "50%",
                                            border: "1px dashed #E9EAEB",
                                            borderRadius: "10px",
                                            padding: "20px 40px",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "flex-start",
                                            gap: "10px",
                                            height: "288px",
                                            textAlign: "center",
                                            cursor: "pointer",
                                            position: "relative",
                                            transition: "background 0.2s",
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.style.background = "#F1F7FF";
                                        }}
                                        onDragLeave={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.style.background = "transparent";
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.style.background = "transparent";
                                            // Validate file type
                                            const files = e.dataTransfer.files;
                                            const fileList = Array.from(files);
                                            if (fileList?.length > 0) {
                                                const isValid = validateCVFiles(fileList);
                                                if (isValid) {
                                                    startProcessing(fileList);
                                                }
                                            }
                                        }}
                                    >
                                        <input
                                            id="upload-cvs-input"
                                            type="file"
                                            accept=".pdf,.doc,.docx,.txt"
                                            multiple
                                            style={{
                                                display: "none",
                                            }}
                                            onChange={(e) => {
                                                const files = e.target.files;
                                                const fileList = Array.from(files);
                                                if (fileList.length > 0) {
                                                    const isValid = validateCVFiles(fileList);
                                                    if (isValid) {
                                                        startProcessing(fileList);
                                                    }
                                                }
                                            }}
                                        // Optionally add an onChange handler here to process file uploads
                                        />
                                        <i className="la la-file" style={{ fontSize: "48px", color: "#E9EAEB" }} />
                                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 700 }}>Upload CVs</span>
                                        <span style={{ fontSize: "12px", color: "#717680", fontWeight: 500 }}>
                                            Upload one or more resumes and let Jia automatically extract each candidate’s information.
                                        </span>
                                        <span style={{ fontSize: "14px", color: "#414651", fontWeight: 500 }}>
                                            Click to upload or drag and drop
                                        </span>
                                        <span style={{ fontSize: "12px", color: "#717680", fontWeight: 500 }}>
                                            PDF, DOC, DOCX or TXT <br />(≤2MB per file)
                                        </span>
                                    </label>
                                    <label htmlFor="upload-spreadsheet-input"
                                        style={{
                                            boxSizing: "border-box",
                                            width: "50%",
                                            border: "1px dashed #E9EAEB",
                                            borderRadius: "10px",
                                            padding: "20px 40px",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "flex-start",
                                            gap: "10px",
                                            height: "288px",
                                            textAlign: "center",
                                            cursor: "pointer",
                                            position: "relative",
                                            transition: "background 0.2s",
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.style.background = "#F1F7FF";
                                        }}
                                        onDragLeave={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.style.background = "transparent";
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.style.background = "transparent";
                                            // You may want to handle dropped files here
                                            const files = e.dataTransfer.files;
                                            const fileList = Array.from(files);
                                            if (fileList?.length > 0) {
                                                const isValid = validateSpreadsheetFiles(fileList);
                                                if (isValid) {
                                                    startProcessing(fileList);
                                                }
                                            }
                                        }}
                                    >
                                        <input
                                            id="upload-spreadsheet-input"
                                            type="file"
                                            accept=".csv,.xlsx"
                                            style={{
                                                display: "none",
                                            }}
                                            onChange={(e) => {
                                                const files = e.target.files;
                                                const fileList = Array.from(files);
                                                if (fileList.length > 0) {
                                                    const isValid = validateSpreadsheetFiles(fileList);
                                                    if (isValid) {
                                                        startProcessing(fileList);
                                                    }
                                                }
                                            }}
                                        />
                                        <i className="la la-file-csv" style={{ fontSize: "48px", color: "#E9EAEB" }} />
                                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 700 }}>Upload a Spreadsheet</span>
                                        <span style={{ fontSize: "12px", color: "#717680", fontWeight: 500 }}>Upload a spreadsheet containing multiple candidates’ details using Jia’s column template for fast, bulk importing.</span>
                                        <span style={{ fontSize: "14px", color: "#414651", fontWeight: 500 }}>Click to upload or drag and drop</span>
                                        <span style={{ fontSize: "12px", color: "#717680", fontWeight: 500 }}>CSV or XLSX <br />(≤ 25 MB, max. 1 file per upload)</span>
                                    </label>
                                </div>

                                <div style={{ width: "100%", border: "1px solid #FFF6ED", backgroundColor: "#FFF6ED", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                        <span style={{ fontSize: "14px", color: "#181D27", fontWeight: 700 }}>For spreadsheets, download our template</span>
                                        <span style={{ fontSize: "12px", color: "#717680", fontWeight: 500 }}>Use our sample sheet to make sure your column headers match Jia’s required fields.</span>
                                    </div>
                                    <button
                                        className="button-v2 primary"
                                        style={{ width: "36px", height: "36px", borderRadius: "50%", padding: 0, margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                                        onClick={downloadTemplate}>
                                        <i className="la la-upload" />
                                    </button>
                                </div>
                            </div>
                        </div>}
                </div>
            </div>
            {showCVModal && <ApplicantCVMenu importedApplicant={selectedApplicant} setShowCVModal={setShowCVModal} />}
        </div>
    )
}

function ApplicantCVMenu({ importedApplicant, setShowCVModal }: { importedApplicant: any, setShowCVModal: any }) {
    const [currentCVIndex, setCurrentCVIndex] = useState(0);
    const [cvFiles, setCVFiles] = useState([]);
    const [activeTab, setActiveTab] = useState("New Upload");
    const [selectedCVVersion, setSelectedCVVersion] = useState(null);
    const [editingCV, setEditingCV] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const { updateFileStatus, importApplicantDetails } = useUpload();
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [originalCVData, setOriginalCVData] = useState(null);
    const [invalidFields, setInvalidFields] = useState<string[]>([]);
    const [applicantDetails, setApplicantDetails] = useState({ name: "", email: "" });

    const tabOptions = ["New Upload", "Existing Data"];

    useEffect(() => {
        if (importedApplicant) {
            const cvFilesData = [];
            if (importedApplicant.newCV) {
                const deepCopy = JSON.parse(JSON.stringify(importedApplicant.newCV));
                cvFilesData.push(deepCopy);
            }

            if (importedApplicant.currentCV) {
                const deepCopy = JSON.parse(JSON.stringify(importedApplicant.currentCV));
                cvFilesData.push(deepCopy);
            }
            setOriginalCVData(importedApplicant.currentCV || importedApplicant.newCV);
            setCVFiles(cvFilesData);

            if (importedApplicant.invalidFields) {
                setInvalidFields(importedApplicant.invalidFields);
            }

            setApplicantDetails({ name: importedApplicant.name, email: importedApplicant.email });
        }
    }, [importedApplicant]);

    const updateCVData = async (cvData: any) => {
        try {
            Swal.showLoading();
            const data = {
                name: applicantDetails.name?.trim()?.split(" ")
                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(" "),
                cvData: cvData,
                email: applicantDetails.email?.trim()?.toLowerCase(),
                fileInfo: cvData.fileInfo,
            };
            // if name or email is changed, update the candidate details
            if (importedApplicant.name !== applicantDetails.name || importedApplicant.email !== applicantDetails.email) {
                await api.post("/api/update-candidate-details", {
                    oldName: importedApplicant.name,
                    oldEmail: importedApplicant.email,
                    newName: data.name,
                    newEmail: data.email,
                    orgID: orgID,
                });
            }
            await api.post("/api/whitecloak/save-cv", data);
            // Sync new skills
            const originalSkills = originalCVData?.digitalCV?.find((section: any) => section?.name === "Skills")?.content;
            const parsedOriginalSkills = originalSkills && typeof originalSkills === "string" ? parseSkillsFromMarkdown(originalSkills) : [];
            const newSkills = cvData?.digitalCV?.find((section: any) => section?.name === "Skills")?.content;
            const parsedNewSkills = newSkills && typeof newSkills === "string" ? parseSkillsFromMarkdown(newSkills) : [];
            await syncOrgSkillsMetadataDiff(data.email, orgID, parsedOriginalSkills, parsedNewSkills);
            updateFileStatus(importedApplicant.email, {
                currentCV: cvData,
                newCV: null,
                name: data.name,
                email: data.email,
            });
            const deepCopy = JSON.parse(JSON.stringify(cvData));
            setOriginalCVData(deepCopy);
            setShowCVModal(false);
        } catch (error) {
            console.error(error);
            errorToast("Failed to update Candidate details", 3000);
        } finally {
            Swal.close();
        }
    }

    const saveCVVersion = async () => {
        if (selectedCVVersion === null || selectedCVVersion === undefined) return;
        try {
            // New CV upload
            if (selectedCVVersion === 0) {
                Swal.showLoading();
                const file = cvFiles[selectedCVVersion];
                const data = {
                    name: applicantDetails.name,
                    cvData: {
                        errorRemarks: null,
                        digitalCV: file.digitalCV,
                    },
                    email: applicantDetails.email,
                    fileInfo: file.fileInfo || null,
                };
                await api.post("/api/whitecloak/save-cv", data);
                // Sync updated skills metadata
                const originalSkills = cvFiles[1]?.digitalCV?.find((section: any) => section?.name === "Skills")?.content;
                const parsedOriginalSkills = originalSkills && typeof originalSkills === "string" ? parseSkillsFromMarkdown(originalSkills) : [];
                const newSkills = cvFiles[0]?.digitalCV?.find((section: any) => section?.name === "Skills")?.content;
                const parsedNewSkills = newSkills && typeof newSkills === "string" ? parseSkillsFromMarkdown(newSkills) : [];
                await syncOrgSkillsMetadataDiff(applicantDetails.email, orgID, parsedOriginalSkills, parsedNewSkills);
                Swal.close();
            }

            updateFileStatus(applicantDetails.email, {
                status: "Imported",
                currentCV: cvFiles[selectedCVVersion],
                newCV: null
            });
            setCVFiles([cvFiles[selectedCVVersion]]);
            const deepCopy = JSON.parse(JSON.stringify(cvFiles[selectedCVVersion]));
            setOriginalCVData(deepCopy);
            setSelectedCVVersion(null);
            setCurrentCVIndex(0);
        } catch (error) {
            console.error(error);
            errorToast("Failed to save CV version", 3000);
        } finally {
            Swal.close();
        }
    }

    const importCandidate = async () => {
        try {
            Swal.showLoading();
            const candidateData = {
                ...importedApplicant,
                name: applicantDetails.name?.trim().split(" ")
                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(" "),
                email: applicantDetails.email?.trim()?.toLowerCase(),
            }
            await importApplicantDetails(candidateData, cvFiles[currentCVIndex].digitalCV);
            setShowCVModal(false);
        } catch (error) {
            console.error(error);
            errorToast("Failed to update candidate", 3000);
        } finally {
            Swal.close();
        }
    }

    return (
        <div className="applicant-cv-side-menu">
            <div className="applicant-cv-side-menu-content">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h1>{applicantDetails.name || "N/A"}</h1>
                    <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowCVModal(false)}>
                        <i className="la la-times"></i>
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: "10px", width: "100%" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "#F8F9FC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {/* Initials from name */}
                        <span style={{ fontSize: "18px", color: "#3E4784", fontWeight: 500 }}>{applicantDetails.name?.split(" ")?.map((name: string) => name[0])?.join("") || "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "70%" }}>
                        {editingCV && editingCV === "Applicant Details" ? <>
                            <input
                            value={applicantDetails.name}
                            style={{
                            width: "100%",
                            height: "48px",
                            padding: "0.375rem 0.75rem",
                            fontSize: "1rem",
                            lineHeight: "1.5",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E9EAEB",
                            borderRadius: "8px",
                            }}
                            placeholder="Enter name"
                            onChange={(e) => {
                                const name = e.target.value
                                setApplicantDetails({ ...applicantDetails, name: name });
                                if (!name?.trim()) {
                                    setInvalidFields(prev => [...new Set([...prev, "Name"])]);
                                } else {
                                    setInvalidFields(prev => prev.filter(field => field !== "Name"));
                                }
                                setHasChanges(true);
                            }}>
                            </input>
                            <input
                            value={applicantDetails.email}
                            style={{
                            width: "100%",
                            height: "48px",
                            padding: "0.375rem 0.75rem",
                            fontSize: "1rem",
                            lineHeight: "1.5",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E9EAEB",
                            borderRadius: "8px",
                            }}
                            placeholder="Enter email"
                            onChange={(e) => {
                                const email = e.target.value?.trim()?.toLowerCase();
                                setApplicantDetails({ ...applicantDetails, email: email });
                                if (email && validateEmail(email)) {
                                    setInvalidFields(prev => prev.filter(field => field !== "Email"));
                                } else {
                                    setInvalidFields(prev => [...new Set([...prev, "Email"])]);
                                }
                                console.log(invalidFields);
                                setHasChanges(true);
                            }}>
                            </input>
                        </> : <>
                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 700 }}>{applicantDetails.name || "N/A"}</span>
                        <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>{applicantDetails.email || "N/A"}</span>
                        </>}
                        {(invalidFields?.includes("Email") || invalidFields?.includes("Name")) && (
                            <span style={{ fontSize: "12px", color: "#F04438", fontWeight: 500 }}>Invalid applicant details</span>
                        )}
                    </div>
                </div>

                {cvFiles.length === 1 && 
                (editingCV && editingCV === "Applicant Details" ?
                        <button style={{ background: "#181D27", border: "none", cursor: "pointer", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => {
                            setEditingCV(null);
                        }}>
                            <i className="la la-check-circle" style={{ color: "#FFFFFF", fontSize: "16px" }}></i>
                        </button> : 
                        <button style={{ background: "#FFFFFF", border: "none", cursor: "pointer", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => {
                            setEditingCV("Applicant Details");
                        }}>
                            <i className="la la-pencil" style={{ color: "#717680", fontSize: "16px" }}></i>
                    </button>)}
                </div>
            </div>
            <div style={{ height: "1px", width: "100%", backgroundColor: "#E9EAEB", margin: "10px 0" }} />

            {cvFiles.length > 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", backgroundColor: "#FFFAEB", padding: "10px", borderRadius: "10px" }}>
                        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 700 }}>Select which version to keep</span>
                                <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>You may compare both versions down below.</span>
                            </div>
                            <Button
                                disabled={selectedCVVersion === null}
                                style={{
                                    opacity: selectedCVVersion === null ? 0.5 : 1,
                                    cursor: selectedCVVersion === null ? "not-allowed" : "pointer"
                                }}
                                variant="primary"
                                onClick={() => saveCVVersion()}
                                label="Save"
                            >
                            </Button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "10px" }}>
                            {cvFiles.map((file, index) => (
                                <div key={index} style={{ width: "50%", display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", border: selectedCVVersion === index ? "1px solid #A4A7AE" : "1px solid #E9EAEB", borderRadius: "10px", padding: "10px", backgroundColor: "#FFFFFF", cursor: "pointer" }}
                                    onClick={() => setSelectedCVVersion(index)}
                                >
                                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
                                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: index === 0 ? "#D1FADF" : "#FFFAEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {index === 0 ? <span style={{ fontSize: "11px", color: "#027948", fontWeight: 500 }}>New</span> : <i className="la la-folder" style={{ fontSize: "16px", color: "#B54708" }} />}
                                        </div>

                                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                            <span style={{ fontSize: "14px", color: "#181D27", fontWeight: 700 }}>{index === 0 ? "New Upload" : "Existing Data"}</span>
                                            <span style={{ fontSize: "12px", color: "#717680", fontWeight: 500 }}>{file.updatedAt ? new Date(file.updatedAt).toLocaleString() : new Date().toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: selectedCVVersion === index ? "#181D27" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #D5D7DA" }}>
                                        {selectedCVVersion === index && <i className="la la-check" style={{ fontSize: "12px", color: "#FFFFFF" }} />}
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                    <span>Compare CVs:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row", height: "44px", width: "100%", backgroundColor: "#EAECF5", borderRadius: "60px", padding: "5px" }}>
                        {tabOptions.map((option, index) => (
                            <div
                                key={index}
                                style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    width: "50%",
                                    height: "100%",
                                    backgroundColor: activeTab === option ? "#FFFFFF" : "#EAECF5",
                                    color: activeTab === option ? "#414651" : "#717680",
                                    borderRadius: "60px",
                                    cursor: "pointer",
                                    transition: "all 0.3s ease"
                                }}
                                onClick={() => {
                                    setActiveTab(option);
                                    setCurrentCVIndex(option === "New Upload" ? 0 : 1);
                                }}
                            >
                                <i className="la la-file-alt" style={{ color: "#414651", fontSize: 16 }}></i>
                                <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>{option}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {hasChanges && <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-end", width: "100%", gap: "10px", padding: "0px 10px" }}>
                <Button
                    variant="secondary"
                    onClick={() => {
                        setEditingCV(null);
                        setHasChanges(false);
                        const cvFilesData = [];
                        const deepCopy = JSON.parse(JSON.stringify(importedApplicant.status === "Failed" ? importedApplicant.newCV : originalCVData));
                        cvFilesData.push(deepCopy);
                        setCVFiles(cvFilesData);
                        setInvalidFields(importedApplicant.invalidFields || []);
                        setApplicantDetails({ name: importedApplicant.name, email: importedApplicant.email });
                    }}
                    label="Cancel Changes"
                >
                </Button>
                <Button
                    disabled={invalidFields?.length > 0}
                    variant="primary"
                    onClick={() => {
                        setEditingCV(null);
                        setHasChanges(false);
                        if (importedApplicant.status === "Failed") {
                            importCandidate();
                        } else {
                            updateCVData(cvFiles[currentCVIndex]);
                        }
                    }}
                    label="Save Changes"
                >
                </Button>
            </div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "20px" }}>
                {cvFiles[currentCVIndex] && cvFiles[currentCVIndex]?.digitalCV?.map((item: any, index: number) => (
                    <div key={index}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", border: invalidFields?.includes("Phone") && item.name === "Contact Info" ? "1px solid #F04438" : "1px solid #E9EAEB", borderRadius: "10px", padding: "10px", backgroundColor: "#F8F9FC" }}>
                        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                                <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 700, marginLeft: "10px" }}>{item.name}</span>
                                {editingCV && item.name === editingCV &&
                                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px", backgroundColor: "#F8F9FC", borderRadius: "16px", padding: "2px 10px", fontSize: "12px", border: "1px solid #D5D9EB" }}>
                                        <span style={{ fontSize: "12px", color: "#363F72", fontWeight: 700 }}>Editing</span>
                                    </div>
                                }
                            </div>
                            {cvFiles.length === 1 &&
                                (editingCV && item.name === editingCV ? <button style={{ background: "#181D27", border: "none", cursor: "pointer", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => {
                                    setEditingCV(null);
                                }}>
                                    <i className="la la-check-circle" style={{ color: "#FFFFFF", fontSize: "16px" }}></i>
                                </button> : <button style={{ background: "#FFFFFF", border: "none", cursor: "pointer", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => {
                                    setEditingCV(item.name);
                                }}>
                                    <i className="la la-pencil" style={{ color: "#717680", fontSize: "16px" }}></i>
                                </button>)
                            }
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", border: "1px solid #E9EAEB", borderRadius: "10px", padding: "10px", backgroundColor: "#FFFFFF" }}>
                            {editingCV === item.name ?
                                item.name === "Skills" ? (
                                    <SkillTagInput
                                        skills={item.content && typeof item.content === "string" ? parseSkillsFromMarkdown(item.content) : []}
                                        onSkillsChange={(newSkills: string[]) => {
                                            const markdownContent = convertSkillsToMarkdown(newSkills);
                                            setCVFiles(prev => {
                                                const newCV = [...prev];
                                                newCV[currentCVIndex].digitalCV[index].content = markdownContent;
                                                return newCV;
                                            });
                                            setHasChanges(true);
                                        }}
                                        compact
                                    />
                                ) :
                                    <textarea
                                        value={item.content}
                                        onChange={(e) => {
                                            setCVFiles(prev => {
                                                const newCV = [...prev];
                                                newCV[currentCVIndex].digitalCV[index].content = e.target.value;
                                                return newCV;
                                            });
                                            if (item.name === "Contact Info") {
                                                const newValue = e.target.value;
                                                const phoneValue = getPhoneFromContent(newValue);
                                                if (phoneValue && validatePhone(phoneValue)) {
                                                    setInvalidFields(prev => prev.filter(field => field !== "Phone"));
                                                } else {
                                                    setInvalidFields(prev => [...new Set([...prev, "Phone"])]);
                                                }
                                            }
                                            setHasChanges(true);
                                        }} /> : <Markdown>{item.content}</Markdown>}
                        </div>
                    </div>
                    {invalidFields?.includes("Phone") && item.name === "Contact Info" && (
                        <span style={{ fontSize: "12px", color: "#F04438", fontWeight: 500 }}>Invalid phone number</span>
                    )}
                    </div>
                ))}
            </div>
        </div>)
}

function ImportCandidateStatus({ status }: { status: string }) {
    const statusMap = {
        "Imported": {
            color: "#027948",
            backgroundColor: "#ECFDF3",
            border: "1px solid #A6F4C5",
            icon: "la la-check",
            iconColor: "#12B76A",
        },
        "Processing": {
            color: "#414651",
            backgroundColor: "#F5F5F5",
            border: "1px solid #E9EAEB",
            icon: "la la-clock",
            iconColor: "#414651",
        },
        "Duplicate": {
            color: "#B54708",
            backgroundColor: "#FFFAEB",
            border: "1px solid #FEDF89",
            icon: "la la-exclamation-triangle",
            iconColor: "#F79009",
        },
        "Failed": {
            color: "#B32318",
            backgroundColor: "#FEF3F2",
            border: "1px solid #FECDCA",
            icon: "la la-times",
            iconColor: "#F04438",
        },
    }
    return (
        <div style={{ width: "fit-content", display: "flex", flexDirection: "row", alignItems: "center", gap: "5px", borderRadius: "60px", padding: "2px 10px", fontSize: "12px", border: `1px solid ${statusMap[status].border}`, backgroundColor: statusMap[status].backgroundColor, color: statusMap[status].color }}>
            <i className={statusMap[status].icon} style={{ fontSize: "16px", color: statusMap[status].iconColor }} />
            <span style={{ fontSize: "12px", fontWeight: 700 }}>{status}</span>
        </div>
    )
}