"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/utils/apiClient";
import { CORE_API_URL, errorToast, parseSkillsFromMarkdown, syncParsedSkillsToMetadata, syncParsedSkillsToOrgMetadata, syncOrgSkillsMetadataDiff, convertSkillsToMarkdown, validateEmail, validatePhone } from "@/lib/Utils";
import axios from "axios";
import * as XLSX from "xlsx";
import { useSearchParams } from "next/navigation";
import ImportCandidatesModal from "../components/CandidateComponents/ImportCandidates";
import Swal from "sweetalert2";

export type ProcessedFile = {
    row?: number;
    file: File | null;
    name: string | null;
    email: string | null;
    jiaAccount: boolean | null;
    status: "Processing" | "Imported" | "Duplicate" | "Failed";
    errorMessage?: string;
    currentCV?: any;
    newCV?: any;
    invalidFields?: string[];
};

type UploadContextType = {
    isProcessing: boolean;
    processedFiles: ProcessedFile[];
    startProcessing: (files: File[]) => void;
    clearProcessedFiles: () => void;
    replaceExistingFiles: (files: ProcessedFile[]) => Promise<void>;
    updateFileStatus: (email: string, updates: Partial<ProcessedFile>) => void;
    setUploadModalOpen: (open: boolean) => void;
    uploadModalOpen: boolean;
    totalRecords: number;
    uploadType: "cv" | "spreadsheet";
    fileQueue: File[];
    bulkEmailInviteSent: boolean;
    setBulkEmailInviteSent: (sent: boolean) => void;
    importApplicantDetails: (file: ProcessedFile, digitalCV: any) => Promise<void>;
};

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
    const [fileQueue, setFileQueue] = useState<File[]>([]);
    const processingRef = useRef(false);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadType, setUploadType] = useState<"cv" | "spreadsheet">("cv");
    const [rowsToProcess, setRowsToProcess] = useState<number>(0);
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [bulkEmailInviteSent, setBulkEmailInviteSent] = useState(false);
    const setHeaders = [
        "First Name*(e.g. Juan)",
        "Last Name*(e.g. Dela Cruz)",
        "Email*(e.g. juan.delacruz@gmail.com)",
        "Mobile Number* (+639xxxxxxxxx)",
        "Full Address",
        "City",
        "Province",
        "Country",
        "Current Title",
        "Experience",
        "Education",
        "Skills(e.g. Customer support, Excel, Data entry)",
        "Certifications",
        "Projects",
        "Awards",
        "Introduction"
    ];

    // Load state from localStorage on mount
    useEffect(() => {
        const savedState = localStorage.getItem("uploadState");
        if (savedState) {
            try {
                const { processedFiles: saved, isProcessing: wasProcessing } = JSON.parse(savedState);
                setProcessedFiles(saved || []);
                if (wasProcessing) {
                    const incomplete = saved.filter((f: ProcessedFile) => f.status === "Processing");
                    if (incomplete.length > 0) {
                        // These files were interrupted, mark as failed
                        setProcessedFiles(saved.map((f: ProcessedFile) => 
                            f.status === "Processing" 
                                ? { ...f, status: "Failed", errorMessage: "Processing interrupted" }
                                : f
                        ));
                    }
                }
            } catch (error) {
                console.error("Failed to load upload state:", error);
            }
        }
    }, []);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        if (processedFiles.length > 0 || isProcessing) {
            localStorage.setItem("uploadState", JSON.stringify({
                processedFiles,
                isProcessing,
            }));
        }
    }, [processedFiles, isProcessing, fileQueue]);

    const processFile = async (file: File): Promise<ProcessedFile> => {
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("fName", file.name);
            formData.append("userEmail", file.name.split(".")?.[0]);

            // First parse the CV file
            const response = await axios({
                method: "POST",
                url: `${CORE_API_URL}/upload-cv`,
                data: formData,
            });

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            // Then extract and structure the data using gpt
            const digitalCVResponse = await api.post("/api/whitecloak/digitalize-cv", { 
                chunks: response.data.cvChunks 
            });

            const parsedUserCV = JSON.parse(digitalCVResponse.data.result);
            const formattedDigitalCV: {name: string; content: string}[] = parsedUserCV.digitalCV.map((section: any) => {
                let formattedContent;
                if (typeof section.content === "string") {
                    formattedContent = section.content?.trim()
                } else if (Array.isArray(section.content) && section.content?.length > 0) {
                    // Convert array to markdown
                    formattedContent = convertSkillsToMarkdown(section.content);

                }
                return {
                    name: section.name,
                    content: formattedContent || "",
                }
            });
            
            const email = (parsedUserCV?.email || "")?.trim()?.toLowerCase();
            const name = ((parsedUserCV?.name || "")?.trim())
                .split(" ")
                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(" ");
            const phone = (parsedUserCV?.phone || "")?.trim();
            const skillSection = formattedDigitalCV.find((section: any) => section?.name === "Skills");
            const parsedSkills = skillSection?.content && typeof skillSection?.content === "string" ? parseSkillsFromMarkdown(skillSection.content) : [];

            const newCVData = {
                digitalCV: formattedDigitalCV,
                errorRemarks: parsedUserCV.errorRemarks,
                fileInfo: {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                },
                name: name,
                updatedAt: new Date(),
            };

            // Validate email
            let invalidFields: string[] = [];
            if (!email || !validateEmail(email)) {
                invalidFields.push("Email");
            }

            if (!name) {
                invalidFields.push("Name");
            }

            if (!phone || !validatePhone(phone)) {
                invalidFields.push("Phone");
            }

            if (invalidFields.length === 0) {
                 // Check if email is already in the database
                const applicantAccountResponse = await api.post("/api/import-applicant", { email, name, orgID, cvData: newCVData });
                const applicantDetails = applicantAccountResponse.data;

                // Sync skills data if new CV is imported
                if (parsedSkills && !applicantDetails.currentCV) {
                    await syncParsedSkillsToMetadata(email, parsedSkills);
                    await syncParsedSkillsToOrgMetadata(email, orgID, parsedSkills);
                }

                return {
                    file,
                    name: applicantDetails.applicantAccount?.name || name,
                    email: email,
                    jiaAccount: applicantDetails.applicantAccount.status !== "invited",
                    status: applicantDetails.currentCV ? "Duplicate" : "Imported",
                    currentCV: applicantDetails.currentCV,
                    newCV: newCVData,
                };
            } else {
                // Allow user to fix then continue to save 
                return {
                    file,
                    name: name,
                    email: email,
                    jiaAccount: null,
                    status: "Failed",
                    currentCV: null,
                    newCV: newCVData,
                    invalidFields: invalidFields,
                    errorMessage: `Missing or incorrect format for required fields: ${invalidFields.join(", ")}`,
                };
            }
        } catch (error: any) {
            console.error("Error processing file:", error);
            return {
                file,
                name: file.name,
                email: null,
                jiaAccount: null,
                status: "Failed",
                errorMessage: error.message || "Unknown error",
            };
        }
    };

    // Helper function to format spreadsheet row data into digitalCV format
    const formatRowToDigitalCV = (row: any): { name: string; email: string; phone: string; digitalCV: any[], skills: string[], missingFields?: string[] } => {
        const firstName = (row[setHeaders[0]] || "")?.trim();
        const lastName = (row[setHeaders[1]] || "")?.trim();
        const fullName = `${firstName} ${lastName}`.trim();
        
        const email = (row[setHeaders[2]] || "")?.trim()?.toLowerCase();
        const phone = (row[setHeaders[3]] || "")?.toString()?.trim();
        const address = row[setHeaders[4]] || "";
        const city = row[setHeaders[5]] || "";
        const province = row[setHeaders[6]] || "";
        const country = row[setHeaders[7]] || "";
        const currentTitle = row[setHeaders[8]] || "";
        const experience = row[setHeaders[9]] || "";
        const education = row[setHeaders[10]] || "";
        const skills = row[setHeaders[11]] || "";
        const certifications = row[setHeaders[12]] || "";
        const projects = row[setHeaders[13]] || "";
        const awards = row[setHeaders[14]] || "";
        const introduction = row[setHeaders[15]] || "";
        
        // Format contact info markdown with explicit newlines for correct markdown rendering
        const contactRows = [];
        if (fullName) contactRows.push(`**Name:** ${fullName}`);
        if (email) contactRows.push(`**Email:** [${email}](mailto:${email})`);
        contactRows.push(`**Phone:** ${phone || "Not available"}`);
        if (city) contactRows.push(`**City:** ${city}`);
        if (province) contactRows.push(`**Province:** ${province}`);
        if (country) contactRows.push(`**Country:** ${country}`);
        if (address) contactRows.push(`**Address:** ${address}`);
        // Add a blank line before and after for markdown block, and use <br/> for line breaks so markdown renders correctly
        let contactInfoContent = contactRows.length
            ? contactRows.join('  \n')
            : '';

        // Format content markdown
        const formatRows = (content: string) => {
            if (!content) return "Not available";
            return content.split("\n").map((line: string) => line.trim()).join("\n\n");
        };

        const parsedSkills = skills ? parseSkillsFromMarkdown(skills) : [];
        
        // Create the digitalCV array in the expected format
        const digitalCV = [
            {
                name: "Introduction",
                content: introduction || ""
            },
            {
                name: "Current Position",
                content: formatRows(currentTitle)
            },
            {
                name: "Contact Info",
                content: contactInfoContent
            },
            {
                name: "Skills",
                content: formatRows(skills)
            },
            {
                name: "Experience",
                content: formatRows(experience)
            },
            {
                name: "Education",
                content: formatRows(education)
            },
            {
                name: "Projects",
                content: formatRows(projects)
            },
            {
                name: "Certifications",
                content: formatRows(certifications)
            },
            {
                name: "Awards",
                content: formatRows(awards)
            }
        ];

        const missingFields: string[] = [];
        if (!fullName) missingFields.push("Name");
        if (!email) missingFields.push("Email");
        if (!phone) missingFields.push("Phone");
        
        return {
            name: fullName,
            email: email,
            phone: phone,
            digitalCV: digitalCV,
            skills: parsedSkills,
            missingFields: missingFields,
        };
    };

    const processSpreadsheet = async (file: File): Promise<void> => {
        if (processingRef.current) return;
        processingRef.current = true;
        setIsProcessing(true);
        try {
            // Read the file as array buffer
            const arrayBuffer = await file.arrayBuffer();
            
            // Parse the spreadsheet (works for both .xlsx and .csv)
            const workbook = XLSX.read(arrayBuffer, { type: "array", codepage: 65001 });
            
            // Get the first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            // Convert to JSON with header row
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
                skipHidden: true,
                header: setHeaders,
            });
            const filteredJsonData = jsonData.filter((row: any) => 
                // Skip introduction row
                Object.keys(row).length > 1 && 
                // Skip header row
                Object.values(row).every((value: any) => !setHeaders.includes(value))
            );

            if (filteredJsonData.length === 0) {
                throw new Error("Spreadsheet is empty");
            }
            // Check if the spreadsheet has the required headers
            const hasRequiredHeaders = filteredJsonData.find((row: any) => Object.keys(row).every((header: string) => setHeaders.includes(header)));
            if (!hasRequiredHeaders) {
                throw new Error("Spreadsheet is missing required headers, please download the latest template from Jia");
            }

            setRowsToProcess(filteredJsonData.length);
            
            for (const [index, row] of filteredJsonData.entries()) {
                try {
                     // Add file to processedFiles with "Processing" status
                    setProcessedFiles(prev => [...prev, {
                        row: index + 1,
                        file: null,
                        name: null,
                        email: null,
                        jiaAccount: null,
                        status: "Processing",
                    }]);
                    // Format the row data into digitalCV format
                    const formattedData = formatRowToDigitalCV(row);
                    
                    const { name, email, phone, digitalCV, skills, missingFields } = formattedData;

                    const newCVData = {
                        digitalCV: digitalCV,
                        errorRemarks: null,
                        fileInfo: {
                            name: file.name,
                            size: file.size,
                            type: file.type,
                        },
                        name: name,
                        updatedAt: new Date(),
                    };

                    // Validate email and mobile number
                    let invalidFields: string[] = [];
                    if (missingFields && missingFields.length > 0) {
                        invalidFields.push(...missingFields);
                    }

                    if (!validateEmail(email)) {
                        invalidFields = [...new Set([...invalidFields, "Email"])];
                    }
                    if (!validatePhone(phone)) {
                        invalidFields = [...new Set([...invalidFields, "Phone"])];
                    }

                    if (invalidFields.length === 0) {
                        // Check if email is already in the database
                        const applicantAccountResponse = await api.post("/api/import-applicant", { 
                            email, 
                            name,
                            orgID,
                            cvData: newCVData,
                        });
                        const applicantDetails = applicantAccountResponse.data;

                        // Sync skills data if new CV is imported
                        if (skills && !applicantDetails.currentCV) {
                            await syncParsedSkillsToMetadata(email, skills);
                            await syncParsedSkillsToOrgMetadata(email, orgID, skills);
                        }
                        
                        setProcessedFiles(prev => {
                            const newFiles = [...prev];
                            const fileIndex = newFiles.findIndex(f => f.row === index + 1);
                            if (fileIndex !== -1) {
                                newFiles[fileIndex] = {
                                    row: index + 1,
                                    file: null,
                                    name: applicantDetails.applicantAccount?.name || name,
                                    email: email,
                                    jiaAccount: applicantDetails.applicantAccount.status !== "invited",
                                    status: applicantDetails.currentCV ? "Duplicate" : "Imported",
                                    currentCV: applicantDetails.currentCV,
                                    newCV: newCVData,
                                }
                            }
                            return newFiles;
                        });
                    } else {
                        setProcessedFiles(prev => {
                            const newFiles = [...prev];
                            const fileIndex = newFiles.findIndex(f => f.row === index + 1);
                            if (fileIndex !== -1) {
                                newFiles[fileIndex] = {
                                    row: index + 1,
                                    file: null,
                                    name: name,
                                    email: email,
                                    jiaAccount: null,
                                    status: "Failed",
                                    currentCV: null,
                                    newCV: newCVData,
                                    invalidFields: invalidFields,
                                    errorMessage: `Missing or incorrect format for required fields: ${invalidFields.join(", ")}`,
                                }
                            }
                            return newFiles;
                        });
                    }
                } catch (error: any) {
                    console.error(`Error processing row ${index + 1}:`, error);
                    setProcessedFiles(prev => {
                        const newFiles = [...prev];
                        const fileIndex = newFiles.findIndex(f => f.row === index + 1);
                        if (fileIndex !== -1) {
                            newFiles[fileIndex] = {
                                row: index + 1,
                                file: null,
                                name: row[setHeaders[0]] || `Row ${index + 1}`,
                                email: row[setHeaders[2]] || null,
                                jiaAccount: null,
                                status: "Failed",
                                errorMessage: error.message || "Unknown error"
                            }
                        }
                        return newFiles;
                    });
                }
            }
        } catch (error: any) {
            console.error("Error processing spreadsheet:", error);
            alert(error.message || "Error processing spreadsheet");
            throw error;
        } finally {
            processingRef.current = false;
            setIsProcessing(false);
        }
    }

    const processQueue = useCallback(async () => {
        if (processingRef.current) return;
        processingRef.current = true;
        setIsProcessing(true);

        // Create a copy of the queue to process
        const filesToProcess = [...fileQueue];
        
        for (const [index, file] of filesToProcess.entries()) {
            const row = index + 1;
            if (processedFiles.find(f => f.row === row)) {
                continue;
            }
            // Add file to processedFiles with "Processing" status
            setProcessedFiles(prev => [...prev, {
                row: row,
                file: file,
                name: null,
                email: null,
                jiaAccount: null,
                status: "Processing",
            }]);

            // Process the file
            const result = await processFile(file);

            // Update the file status
            setProcessedFiles(prev => {
                const newFiles = [...prev];
                const fileIndex = newFiles.findIndex(f => f.file === file && f.status === "Processing");
                if (fileIndex !== -1) {
                    newFiles[fileIndex] = {
                        row: row,
                        ...result,
                    };
                }
                return newFiles;
            });
        }
        // Clear the queue after all files are processed
        setFileQueue([]);

        processingRef.current = false;
        setIsProcessing(false);
    }, [fileQueue]);

    // Process queue whenever it changes
    useEffect(() => {
        if (fileQueue.length > 0 && !processingRef.current) {
            // Check if the file is a spreadsheet
            if (fileQueue[0].type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || fileQueue[0].type === "text/csv") {
                setUploadType("spreadsheet");
                processSpreadsheet(fileQueue[0]);
            } else {
                setUploadType("cv");
                processQueue();
            }
        }
    }, [fileQueue]);

    const startProcessing = useCallback((files: File[]) => {
        setFileQueue(prev => [...prev, ...files]);
    }, []);

    const clearProcessedFiles = useCallback(() => {
        setProcessedFiles([]);
        setFileQueue([]);
        localStorage.removeItem("uploadState");
    }, []);

    const importApplicantDetails = async (file: ProcessedFile, digitalCV: any) => {
        const { email, name } = file;
        if (!email || !name || !digitalCV) {
            throw new Error("Email, name and newCV are required");
        }

        const newCVData = {
            ...file.newCV,
            digitalCV: digitalCV,
            errorRemarks: null,
            name: name,
            updatedAt: new Date(),
        };
        try {
            Swal.showLoading();
            // Check if email is already in the database
            const applicantAccountResponse = await api.post("/api/import-applicant", { 
                email, 
                name,
                orgID,
                cvData: newCVData,
            });
            const applicantDetails = applicantAccountResponse.data;

            const skillSection = digitalCV.find((section: any) => section?.name === "Skills");
            const parsedSkills = skillSection?.content && typeof skillSection?.content === "string" ? parseSkillsFromMarkdown(skillSection.content) : [];

            // Sync skills data if new CV is imported
            if (parsedSkills && !applicantDetails.currentCV) {
                await syncParsedSkillsToMetadata(email, parsedSkills);
                await syncParsedSkillsToOrgMetadata(email, orgID, parsedSkills);
            }

            setProcessedFiles(prev => {
                const newFiles = [...prev];
                const fileIndex = newFiles.findIndex(f => f.row === file.row);
                if (fileIndex !== -1) {
                    newFiles[fileIndex] = {
                        file: file.file,
                        name: applicantDetails.applicantAccount?.name || name,
                        email: email,
                        jiaAccount: applicantDetails.applicantAccount.status !== "invited",
                        status: applicantDetails.currentCV ? "Duplicate" : "Imported",
                        currentCV: applicantDetails.currentCV,
                        newCV: newCVData,
                    }
                }
                return newFiles;
            });
        } catch (error) {
            console.error("Failed to import applicant details:", error);
            errorToast("Failed to import applicant details", 1300);
        } finally {
            Swal.close();
        }
    }

    const replaceExistingFiles = async (files: ProcessedFile[]) => {
        for (const file of files) {
            Swal.showLoading();
            try {
                const data = {
                    name: file.name,
                    cvData: {
                        errorRemarks: null,
                        digitalCV: file.newCV.digitalCV,
                    },
                    email: file.email,
                    fileInfo: file.newCV.fileInfo || null,
                };
                await api.post("/api/whitecloak/save-cv", data);
                // Sync skills
                const originalSkills = file.currentCV?.digitalCV?.find((section: any) => section?.name === "Skills")?.content;
                const parsedOriginalSkills = originalSkills && typeof originalSkills === "string" ? parseSkillsFromMarkdown(originalSkills) : [];
                const newSkills = file.newCV?.digitalCV?.find((section: any) => section?.name === "Skills")?.content;
                const parsedNewSkills = newSkills && typeof newSkills === "string" ? parseSkillsFromMarkdown(newSkills) : [];
                await syncOrgSkillsMetadataDiff(file.email, orgID, parsedOriginalSkills, parsedNewSkills);

                // Update status to Imported
                setProcessedFiles(prev => prev.map(f => 
                    f.email === file.email && f.status === "Duplicate" 
                        ? { ...f, status: "Imported", currentCV: file.newCV, newCV: null }
                        : f
                ));
            } catch (error) {
                console.error("Failed to replace file:", error);
                errorToast("Failed to replace existing files", 1300);
            } finally {
                Swal.close();
            }
        }
    };

    const updateFileStatus = useCallback((email: string, updates: Partial<ProcessedFile>) => {
        setProcessedFiles(prev => prev.map(f => 
            f.email === email ? { ...f, ...updates } : f
        ));
    }, []);

    return (
        <UploadContext.Provider value={{
            isProcessing,
            processedFiles,
            startProcessing,
            clearProcessedFiles,
            replaceExistingFiles,
            updateFileStatus,
            setUploadModalOpen,
            uploadModalOpen,
            totalRecords: uploadType === "spreadsheet" ? rowsToProcess : fileQueue.length,
            uploadType,
            fileQueue,
            bulkEmailInviteSent,
            setBulkEmailInviteSent,
            importApplicantDetails,
        }}>
            {uploadModalOpen && <ImportCandidatesModal />}
            {children}
        </UploadContext.Provider>
    );
}

export function useUpload() {
    const context = useContext(UploadContext);
    if (context === undefined) {
        throw new Error("useUpload must be used within an UploadProvider");
    }
    return context;
}

