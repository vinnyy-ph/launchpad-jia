"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "@/lib/styles/components/DropdownModal.module.scss";


export interface DropdownOption {
    label: string;
    value: string;
    avatar?: string;
}

export interface DropdownModalProps {
    value: string;
    options: DropdownOption[];
    onSelect: (value: string) => void;
    placeholder?: string;
    buttonClassName?: string;
    containerClassName?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    displayLabelFormatter?: (label: string, value: string) => string;
    style?: React.CSSProperties;
    menuStyle?: React.CSSProperties;
    showImg?: boolean;
}

export default function DropdownModal({
    value,
    options,
    onSelect,
    placeholder = "Select an option",
    buttonClassName = "",
    containerClassName = "",
    icon,
    disabled = false,
    displayLabelFormatter,
    style,  
    menuStyle = {},
    showImg = false,
}: DropdownModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isOpen) {
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        onSelect(optionValue);
        setIsOpen(false);
    };

    const baseLabel = value
        ? options.find((opt) => opt.value === value)?.label || value
        : placeholder;

    const displayLabel = displayLabelFormatter
        ? displayLabelFormatter(baseLabel, value)
        : baseLabel;

    return (
        <div
            ref={containerRef}
            className={`${styles.dropdownContainer} ${containerClassName}`}
            style={style}
        >   
            <button
                type="button"
                className={`${styles.dropdownButton} ${buttonClassName}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                {icon && <span className={styles.buttonIcon}>{icon}</span>}
                {value && (() => {
                    const selectedOption = options.find((opt) => opt.value === value);
                    return selectedOption?.avatar ? (
                        <img
                            src={selectedOption.avatar}
                            alt={selectedOption.label}
                            style={{ 
                                width: "32px", 
                                height: "32px", 
                                marginRight: "8px", 
                                flexShrink: 0,
                                borderRadius: "50%",
                                objectFit: "cover"
                            }}
                            onError={(e: any) => {
                                e.target.src = `https://api.dicebear.com/9.x/glass/svg?seed=${Date.now()}`;
                            }}
                        />
                    ) : null;
                })()}
                <span className={styles.buttonText}>{displayLabel}</span>
                <svg
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {isOpen && (
                <div className={styles.dropdownMenu} role="listbox" style={menuStyle}>
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                className={`${styles.dropdownOption} ${isSelected ? styles.optionSelected : ""}`}
                                onClick={() => handleSelect(option.value)}
                                role="option"
                                aria-selected={isSelected}
                                style={{ display: "flex", alignItems: "center", gap: "12px" }}
                            >
                                {showImg && (
                                    option.avatar ? (
                                        <img
                                            src={option.avatar}
                                            alt={option.label}
                                            style={{ 
                                                width: "32px", 
                                                height: "32px", 
                                                flexShrink: 0,
                                                borderRadius: "50%",
                                                objectFit: "cover"
                                            }}
                                            onError={(e: any) => {
                                                e.target.src = `https://api.dicebear.com/9.x/glass/svg?seed=${Date.now()}`;
                                            }}
                                        />
                                    ) : (
                                        <div style={{ width: "32px", height: "32px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <i className="la la-user" style={{ fontSize: "20px", color: "#9CA3AF" }}></i>
                                        </div>
                                    )
                                )}
                                <span className={styles.optionLabel} style={{ flex: 1 }}>{option.label}</span>
                                {isSelected && (
                                    <svg
                                        className={styles.checkmark}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                        style={{ flexShrink: 0 }}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

