import { useEffect, RefObject } from "react";

interface UseClickOutsideOptions {
    isVisible: boolean;
    focusedInput: string | null;
    inputName: string;
    wrapperRef: RefObject<HTMLElement>;
    dropdownRef: RefObject<HTMLElement>;
    inputRef: RefObject<HTMLElement>;
    onClose: () => void;
}

/**
 * Custom hook to handle click-outside behavior for dropdowns
 */
export function useClickOutside({
    isVisible,
    focusedInput,
    inputName,
    wrapperRef,
    dropdownRef,
    inputRef,
    onClose,
}: UseClickOutsideOptions) {
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isVisible && focusedInput !== inputName) return;

            const target = event.target as HTMLElement;

            // Check if click is inside the input wrapper
            if (wrapperRef.current && wrapperRef.current.contains(target)) {
                return;
            }

            // Check if click is inside the dropdown
            if (dropdownRef.current && dropdownRef.current.contains(target)) {
                return;
            }

            // Close dropdown if clicking outside
            onClose();
            if (inputRef.current && 'blur' in inputRef.current) {
                (inputRef.current as HTMLInputElement).blur();
            }
        };

        if (isVisible || focusedInput === inputName) {
            // Use a small delay to avoid immediate closure on the same click that opened it
            const timeoutId = setTimeout(() => {
                document.addEventListener("mousedown", handleClickOutside, true);
            }, 0);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener("mousedown", handleClickOutside, true);
            };
        }
    }, [isVisible, focusedInput, inputName, wrapperRef, dropdownRef, inputRef, onClose]);
}

