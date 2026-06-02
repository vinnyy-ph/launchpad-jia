import { useMemo } from "react";
import { getCandidateLocation } from "@/lib/utils/candidateHelpers";

interface LocationItem {
    name: string;
    count: number;
    region?: string;
}

interface LocationDropdownData {
    locations: LocationItem[];
}

/**
 * Invalid location values (work setup options that should not appear as locations)
 */
const INVALID_LOCATIONS = ['Remote', 'Hybrid', 'On-site', 'Onsite', 'Fully Remote'];

/**
 * Checks if a location string is a work setup option (invalid for location filtering)
 */
function isInvalidLocation(location: string): boolean {
    const normalized = location.trim().toLowerCase();
    return INVALID_LOCATIONS.some(invalid => normalized === invalid.toLowerCase());
}

/**
 * Custom hook to compute location dropdown data from candidates
 * Aggregates unique locations with counts and region information
 */
export function useLocationDropdownData(allCandidates: any[]): LocationDropdownData {
    return useMemo(() => {
        if (!Array.isArray(allCandidates) || allCandidates.length === 0) {
            return { locations: [] };
        }

        const locationCounts = new Map<string, { count: number; region?: string }>();

        allCandidates.forEach((candidate: any) => {
            const location = getCandidateLocation(candidate);
            if (location && location !== "-") {
                const trimmedLocation = location.trim();
                if (trimmedLocation && !isInvalidLocation(trimmedLocation)) {
                    // Try to extract city and region from location string (e.g., "Pasay City, Metro Manila, PH")
                    const parts = trimmedLocation.split(',').map(p => p.trim());
                    const cityName = parts[0];
                    
                    // Skip if city name itself is a work setup option
                    if (isInvalidLocation(cityName)) {
                        return;
                    }
                    
                    const region = parts.length > 1 ? parts.slice(1).join(', ') : undefined;
                    
                    // Use city name as the key for grouping
                    const existing = locationCounts.get(cityName);
                    if (existing) {
                        existing.count += 1;
                        // If we have a region and the existing doesn't, or if the new region is longer (more complete), update it
                        if (region && (!existing.region || region.length > existing.region.length)) {
                            existing.region = region;
                        }
                    } else {
                        locationCounts.set(cityName, {
                            count: 1,
                            region: region || undefined,
                        });
                    }
                }
            }
        });

        const locations = Array.from(locationCounts.entries())
            .filter(([name]) => !isInvalidLocation(name)) // Final filter to ensure no invalid locations
            .map(([name, data]) => ({
                name,
                count: data.count,
                region: data.region,
            }));

        return { locations };
    }, [allCandidates]);
}

