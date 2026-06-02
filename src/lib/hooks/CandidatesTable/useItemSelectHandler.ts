import { useCallback, RefObject } from "react";
import { saveRecentSearch } from "@/lib/components/Dropdown/CandidatesTable/SearchDropdown";
import { Filter } from "@/lib/utils/CandidatesTable/candidateFilterHelpers";

interface UseItemSelectHandlerParams {
    setSelectedFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
    setIsSearchDropdownVisible: (visible: boolean) => void;
    setIsLocationDropdownVisible: (visible: boolean) => void;
    setFocusedInput: (input: string | null) => void;
    setSearchInput: (value: string) => void;
    setLocationInput: (value: string) => void;
    searchInputRef: RefObject<HTMLInputElement>;
    locationInputRef: RefObject<HTMLInputElement>;
}

/**
 * Custom hook that handles item selection from search and location dropdowns
 * Manages filter addition, recent search saving, and dropdown state
 */
export function useItemSelectHandler({
    setSelectedFilters,
    setIsSearchDropdownVisible,
    setIsLocationDropdownVisible,
    setFocusedInput,
    setSearchInput,
    setLocationInput,
    searchInputRef,
    locationInputRef,
}: UseItemSelectHandlerParams) {
    const handleItemSelect = useCallback(
        (type: "Candidates" | "Skills" | "Current Position" | "Location", name: string) => {
            if (type === "Location") {
                // Handle location selection
                setSelectedFilters(prev => {
                    // Check if this filter already exists
                    const exists = prev.some(f => f.type === "Location" && f.name === name);
                    if (exists) return prev;
                    // Add new filter
                    return [...prev, { type: "Location" as const, name }];
                });
                // Save to recent searches
                saveRecentSearch("Location", name);
                // Close location dropdown and clear location input
                setIsLocationDropdownVisible(false);
                setFocusedInput(null);
                setLocationInput("");
                if (locationInputRef.current) {
                    locationInputRef.current.blur();
                }
            } else {
                // Handle other filter types (Candidates, Skills, Current Position)
                setSelectedFilters(prev => {
                    // Check if this filter already exists
                    const exists = prev.some(f => f.type === type && f.name === name);
                    if (exists) return prev;
                    // Add new filter
                    return [...prev, { type, name }];
                });
                // Save to recent searches
                saveRecentSearch(type, name);
                // Close dropdown and clear search input
                setIsSearchDropdownVisible(false);
                setFocusedInput(null);
                setSearchInput("");
                if (searchInputRef.current) {
                    searchInputRef.current.blur();
                }
            }
        },
        [
            setSelectedFilters,
            setIsSearchDropdownVisible,
            setIsLocationDropdownVisible,
            setFocusedInput,
            setSearchInput,
            setLocationInput,
            searchInputRef,
            locationInputRef,
        ]
    );

    return handleItemSelect;
}

