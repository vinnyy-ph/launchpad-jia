import React from "react";
import { Button } from "../ui";

interface HeaderProps {
    onUploadClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onUploadClick }) => {
    return (
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px"}}>
                    <h1 style={{ fontWeight: 700, fontStyle: "Bold", fontSize: "24px", lineHeight: "32px", letterSpacing: "0%", verticalAlign: "middle", color: "var(--Text-text-primary, #181D27)", margin: 0 }}>Candidates</h1>
                </div>
                <span style={{ fontWeight: 500, fontStyle: "Medium", fontSize: "16px", lineHeight: "24px", letterSpacing: "0%", verticalAlign: "middle", color: "var(--Text-text-tertiary, #717680)" }}>See the list of candidates across all your job openings here.</span>
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
                <Button 
                variant="primary" 
                onClick={onUploadClick} 
                label="Import Candidates"
                icon="/iconsV3/upload-file.svg"
                >
                </Button>
            </div>
        </div>
    );
};

export default Header;

