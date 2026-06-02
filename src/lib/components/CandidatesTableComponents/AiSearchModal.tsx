import React from "react";
import Image from "next/image";
    
interface AiSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (prompt: string) => void;
    isLoading: boolean;
    aiEvaluationProgress?: { phase?: "fetching" | "evaluating"; current: number; total: number };
    aiProgressPercent?: number;
    aiEstimatedMinutes?: number | null;
}

export default function AiSearchModal({ isOpen, onClose, onSubmit, isLoading, aiEvaluationProgress, aiProgressPercent, aiEstimatedMinutes }: AiSearchModalProps) {
    const [prompt, setPrompt] = React.useState("");
    const [placeholder, setPlaceholder] = React.useState("e.g., Find me current developers who can potentially be career shift into DevOps engineer");
    const [hasError, setHasError] = React.useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim() && !isLoading) {
            onSubmit(prompt.trim());
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setPrompt("");
            setPlaceholder("e.g., Find me current developers who can potentially be career shift into DevOps engineer");
            setHasError(false);
            onClose();
        }
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !isLoading) {
            handleClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Escape" && !isLoading) {
            handleClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="modal-background fade-in-bottom"
            onClick={handleBackdropClick}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "#00000040",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
            }}
        >
            <div 
                className="modal-container"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "588px",
                    background: "#00000040",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {isLoading ? (
                    // Loading Screen with Progress
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 24px", width: "100%", gap: "16px" }}>
                        <Image alt="loading" src="/gifs/analysis-loading.gif" style={{objectFit: "cover"}} width={100} height={100} />
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "100%" }}>
                            <span style={{ fontSize: 18, color: "#FFFFFF", fontWeight: 700 }}>
                                Searching candidates...
                            </span>
                            {/* Progress Bar */}
                            {aiProgressPercent !== undefined && aiProgressPercent >= 0 && (
                                <div style={{ width: "100%", maxWidth: "300px", height: "6px", borderRadius: "999px", background: "rgba(255, 255, 255, 0.2)", overflow: "hidden" }}>
                                    <div
                                        style={{
                                            width: `${Math.min(100, Math.max(0, aiProgressPercent))}%`,
                                            height: "100%",
                                            borderRadius: "999px",
                                            background: "#FFFFFF",
                                            transition: "width 0.3s ease"
                                        }}
                                    />
                                </div>
                            )}
                            <span style={{ fontSize: 14, color: "#FFFFFF", opacity: 0.8 }}>
                                Please wait while we are searching
                            </span>
                        </div>
                    </div>
                ) : (
                    // Form Modal
                    <div
                style={{
                            width: "588px",
                            borderRadius: "12px",
                            padding: "24px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                            background: "var(--Surface-white, #FFFFFF)",
                            boxShadow: "0px 8px 8px -4px #0A0D1208, 0px 20px 24px -4px #0A0D1214",
                    position: "relative",
                }}
            >
                        {/* Title Container */}
                        <div 
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                    <h2 
                        style={{
                            fontWeight: 700,
                                    fontStyle: "Bold",
                                    fontSize: "24px",
                                    lineHeight: "32px",
                                    letterSpacing: "0%",
                                    margin: 0,
                            color: "var(--Text-text-primary, #181D27)",
                        }}
                    >
                                AI Search
                    </h2>
                            <button
                                type="button"
                                className="ai-search-close-button"
                                onClick={(e) => {
                                    e.currentTarget.style.outline = "none";
                                    e.currentTarget.style.border = "none";
                                    handleClose();
                                }}
                                disabled={isLoading}
                        style={{
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    cursor: isLoading ? "not-allowed" : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "24px",
                                    height: "24px",
                                    outline: "none",
                        }}
                                onMouseDown={(e) => {
                                    e.currentTarget.style.outline = "none";
                                    e.currentTarget.style.border = "none";
                                }}
                                onMouseUp={(e) => {
                                    e.currentTarget.style.outline = "none";
                                    e.currentTarget.style.border = "none";
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.outline = "none";
                                    e.currentTarget.style.border = "none";
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.outline = "none";
                                    e.currentTarget.style.border = "none";
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M11 1L1 11M1 1L11 11" stroke="#A4A7AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                </div>

                        {/* Text Area Container */}
                        <div>
                <form onSubmit={handleSubmit}>
                        <textarea
                                    className={`ai-search-textarea ${hasError ? 'ai-search-textarea-error' : ''}`}
                            value={prompt}
                                    onChange={(e) => {
                                        setPrompt(e.target.value);
                                        if (hasError) {
                                            setHasError(false);
                                        }
                                    }}
                            onKeyDown={handleKeyDown}
                                    placeholder={placeholder}
                            disabled={isLoading}
                                    onFocus={(e) => {
                                        setPlaceholder("");
                                    }}
                                    onBlur={(e) => {
                                        setPlaceholder("e.g., Find me current developers who can potentially be career shift into DevOps engineer");
                                    }}
                            style={{
                                width: "100%",
                                borderRadius: "8px",
                                        border: hasError ? "1px solid #EF4444" : "1px solid var(--Input-border-primary, #E9EAEB)",
                                        background: isLoading ? "var(--Surface-disabled, #F5F5F5)" : "var(--Input-bg-primary, #FFFFFF)",
                                        padding: "10px 14px",
                                        boxSizing: "border-box",
                                        boxShadow: hasError ? "0px 1px 2px 0px #0A0D120D" : "0px 1px 2px 0px #0A0D120D",
                                        transition: "box-shadow 0.3s",
                                        outline: "none",
                                        fontWeight: 500,
                                        fontSize: "16px",
                                        lineHeight: "24px",
                                        letterSpacing: "0%",
                                        color: isLoading ? "var(--Text-disabled, #A0A0A0)" : "var(--Input-text-placeholder-or-disabled, #717680)",
                                fontFamily: "inherit",
                                        maxHeight: "200px",
                                        resize: "none",
                                    }}
                                />
                            </form>
                            {hasError && (
                                <div style={{ minHeight: "18px", marginTop: "4px" }}>
                                    <span style={{
                                        fontSize: "12px",
                                        color: "#EF4444",
                                        fontWeight: 400,
                                    }}>
                                        This is a required field.
                                    </span>
                                </div>
                            )}
                    </div>

                        {/* Action Buttons Container */}
                    <div 
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "12px",
                        }}
                    >
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isLoading}
                            style={{
                                    width: "163px",
                                    borderRadius: "9999px",
                                    gap: "8px",
                                    paddingTop: "10px",
                                    paddingRight: "16px",
                                    paddingBottom: "10px",
                                    paddingLeft: "16px",
                                    borderWidth: "1px",
                                    border: "1px solid var(--Button-border-destructive, #FDA29B)",
                                backgroundColor: "transparent",
                                cursor: isLoading ? "not-allowed" : "pointer",
                                transition: "background-color 0.2s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = "var(--Surface-hover, #F7F8F9)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                            }}
                        >
                                <span style={{
                                    fontWeight: 700,
                                    fontStyle: "Bold",
                                    fontSize: "14px",
                                    lineHeight: "20px",
                                    letterSpacing: "0%",
                                    color: isLoading ? "var(--Text-disabled, #A0A0A0)" : "var(--Button-text-destructive, #B32318)",
                                }}>
                            Cancel
                                </span>
                        </button>
                        <button
                                type="button"
                                className="button-v2 primary"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (!prompt.trim()) {
                                        setHasError(true);
                                        return;
                                    }
                                    if (!isLoading) {
                                        onSubmit(prompt.trim());
                                    }
                                }}
                                disabled={isLoading}
                            style={{
                                    width: "163px",
                                    borderRadius: "9999px",
                                    gap: "8px",
                                    paddingTop: "10px",
                                    paddingRight: "16px",
                                    paddingBottom: "10px",
                                    paddingLeft: "16px",
                                    borderWidth: "1px",
                                    background: "var(--Button-bg-primary, #181D27)",
                                border: "1px solid var(--Button-bg-primary, #181D27)",
                                    boxShadow: "0px 1px 2px 0px #0A0D120D",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: isLoading ? "not-allowed" : "pointer",
                                transition: "background-color 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                                    if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = "var(--Button-bg-hover, #2D2D2D)";
                                        e.currentTarget.style.borderColor = "var(--Button-bg-hover, #2D2D2D)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                    if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = "var(--Button-bg-primary, #181D27)";
                                        e.currentTarget.style.borderColor = "var(--Button-bg-primary, #181D27)";
                                    }
                                }}
                            >
                                <div style={{ 
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                                    width: "20px",
                                    height: "20px",
                                    flexShrink: 0,
                                }}>
                                    <img src="/iconsV3/search.svg" alt="Search icon" width={20} height={20} />
                                </div>
                                <span style={{ 
                                    fontFamily: "Font family/body", 
                                    fontWeight: 700,
                                    fontStyle: "Bold", 
                                    fontSize: "14px",
                                    lineHeight: "20px", 
                                    letterSpacing: "0%", 
                                    color: "var(--Button-text-primary, #FFFFFF)" 
                                }}>
                                    Search
                                </span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            <style jsx>{`
                .ai-search-textarea:focus {
                    box-shadow: 0px 0px 0px 4px #F5F5F5, 0px 1px 2px 0px #0A0D120D !important;
                    outline: none !important;
                }
                .ai-search-textarea:focus:not(.ai-search-textarea-error) {
                    border: 1px solid var(--Input-border-primary, #E9EAEB) !important;
                }
                .ai-search-textarea-error:focus {
                    border: 1px solid #EF4444 !important;
                }
                .ai-search-textarea::placeholder {
                    color: var(--Input-text-placeholder-or-disabled, #717680);
                }
                .ai-search-close-button,
                .ai-search-close-button:focus,
                .ai-search-close-button:active,
                .ai-search-close-button:hover {
                    outline: none !important;
                    border: none !important;
                    box-shadow: none !important;
                }
            `}</style>
        </div>
    );
}
