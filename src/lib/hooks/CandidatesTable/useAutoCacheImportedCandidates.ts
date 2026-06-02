import { useEffect, useRef } from "react";
import { useUpload, ProcessedFile } from "@/lib/context/UploadContext";
import { useSearchParams } from "next/navigation";
import { addCandidateToCache } from "./useCandidatesDataCached";
import { Candidate } from "@/lib/utils/candidateHelpers";

/**
 * Hook that automatically adds newly imported candidates to the cache.
 * Watches the upload context for imported files and adds them to cache without API calls.
 * 
 * This hook should be used in components that display candidates (e.g., CandidatesTableV2)
 * to ensure newly imported candidates appear immediately in the table.
 */
export const useAutoCacheImportedCandidates = () => {
    const { processedFiles } = useUpload();
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const processedEmailsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!orgID) return;

        // Find newly imported candidates
        const newlyImported = processedFiles.filter((file: ProcessedFile) => {
            // Only process files that are successfully imported (not duplicates, not failed)
            if (file.status !== "Imported") return false;
            if (!file.email) return false;
            
            // Skip if there's an error message (shouldn't happen with "Imported" status, but extra safety)
            if (file.errorMessage) return false;
            
            // Skip if we've already processed this email
            if (processedEmailsRef.current.has(file.email)) return false;
            
            // Skip if it's a duplicate (has currentCV)
            if (file.currentCV) return false;
            
            return true;
        });

        // Add each newly imported candidate to cache
        newlyImported.forEach((file: ProcessedFile) => {
            if (!file.email || !file.name) return;

            // Mark as processed
            processedEmailsRef.current.add(file.email);

            // Construct candidate object from available data
            const candidate: Candidate = {
                _id: file.email, // Use email as ID if no _id available
                id: file.email,
                email: file.email,
                name: file.name,
                image: null,
                candidateStatus: "Ongoing", // Default status for newly imported candidates
                activeAt: new Date().toISOString(),
                cvData: file.newCV || null,
                interviews: [], // New candidates don't have interviews yet
            };

            // Add to cache
            addCandidateToCache(orgID, candidate);
        });
    }, [processedFiles, orgID]);

    // Clear processed emails when orgID changes
    useEffect(() => {
        processedEmailsRef.current.clear();
    }, [orgID]);
};

