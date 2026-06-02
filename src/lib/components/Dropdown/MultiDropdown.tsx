"use client"
import { useState } from "react";

export default function MultiSelectDropdown({ label, options, onApply, selectedOptions }: { label: any, options: any[], onApply: (options: any[]) => void, selectedOptions: any[] }) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [currentSelectedOptions, setCurrentSelectedOptions] = useState(selectedOptions || []);
    return (
        <div className="dropdown">
            <div 
            onClick={() => {
                setCurrentSelectedOptions(selectedOptions);
                setDropdownOpen(!dropdownOpen);
            }}
            style={{ 
                display: "flex", 
                flexDirection: "row", 
                alignItems: "center", 
                gap: 8, 
                border: "1px solid #D5D7DA", 
                borderRadius: 60, 
                padding: "5px 10px", 
                cursor: "pointer", 
                width: "fit-content", 
                height: "fit-content",
                color: selectedOptions.length > 0 ? "#FFFFFF" : "#181D27",
                background: selectedOptions.length > 0 ? "#181D27" : "#FFFFFF",
                fontSize: "14px",
                fontWeight: 500,
                whiteSpace: "nowrap",
            }}>
                {label}
            </div>
            {dropdownOpen && (
            <div className={`dropdown-menu dropdown-menu-right mt-1 org-dropdown-anim${
                dropdownOpen ? " show" : ""
                }`}
                style={{
                    width: "fit-content",
                    left: "50%",
                    transform: "translateX(-50%)",
                }}
            >
                {options.map((option) => (
                    <div 
                    key={option} 
                    className="dropdown-item" 
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "5px",
                        color: "#181D27",
                        fontSize: "14px",
                        fontWeight: 500,
                    }}
                    onClick={() => {
                        if (currentSelectedOptions.includes(option)) {
                            setCurrentSelectedOptions(currentSelectedOptions.filter((o) => o !== option));
                        } else {
                            setCurrentSelectedOptions([...currentSelectedOptions, option]);
                        }
                    }}>
                        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                            <input type="checkbox" checked={currentSelectedOptions.includes(option)} onChange={(e) => {
                                if (e.target.checked) {
                                    setCurrentSelectedOptions([...currentSelectedOptions, option]);
                                } else {
                                    setCurrentSelectedOptions(currentSelectedOptions.filter((o) => o !== option));
                                }
                            }} />
                            <span>{option}</span>
                        </div>
                    </div>
                ))}
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", padding: "0 16px" }}>
                <button className="button-v2 primary" style={{ backgroundColor: "#FFFFFF", color: "#000000" }} onClick={() => {
                    setCurrentSelectedOptions([]);
                    onApply([]);
                    setDropdownOpen(false);
                }}>
                    Reset
                </button>
                <button className="button-v2 primary" onClick={() => {
                    onApply(currentSelectedOptions);
                    setDropdownOpen(false);
                }}>
                    Apply
                </button>
                </div>
            </div>
            )}
        </div>
    )
}