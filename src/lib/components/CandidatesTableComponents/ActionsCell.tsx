import React, { useState, useEffect, useRef, useCallback } from "react";

interface ActionsCellProps {
    candidate: any;
    rowId: string;
    onMenuToggle: (rowId: string, candidate: any, event: React.MouseEvent) => void;
    onMenuClose: () => void;
    onInviteCandidate: (candidate: any) => void;
    onViewCV: () => void;
    onAddComment: (candidate: any) => void;
    onInviteToJob: (candidate: any) => void;
}

// ActionsCell component that manages its own menu state to prevent columns array recreation
const ActionsCell = React.memo(({ 
    candidate, 
    rowId, 
    onMenuToggle, 
    onMenuClose, 
    onInviteCandidate, 
    onViewCV,
    onAddComment,
    onInviteToJob
}: ActionsCellProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLElement | null>(null);
    
    const handleToggle = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.nativeEvent) {
            e.nativeEvent.stopImmediatePropagation();
        }
        
        const target = e.currentTarget as HTMLElement;
        buttonRef.current = target;
        
        if (!isMenuOpen) {
            // Calculate position for fixed dropdown
            const rect = target.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 4, // 4px gap
                right: window.innerWidth - rect.right
            });
        }
        
        setIsMenuOpen(prev => !prev);
        onMenuToggle(rowId, candidate, e);
    }, [rowId, candidate, onMenuToggle, isMenuOpen]);
    
    const handleClose = useCallback(() => {
        setIsMenuOpen(false);
        setMenuPosition(null);
        onMenuClose();
    }, [onMenuClose]);
    
    // Update menu position on scroll/resize
    useEffect(() => {
        if (!isMenuOpen || !menuPosition || !buttonRef.current) return;
        
        const updatePosition = () => {
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setMenuPosition({
                    top: rect.bottom + 4,
                    right: window.innerWidth - rect.right
                });
            }
        };
        
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isMenuOpen, menuPosition]);
    
    // Close menu when clicking outside
    useEffect(() => {
        if (!isMenuOpen) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            // If click is inside the menu, do nothing (keep open)
            if (menuRef.current && menuRef.current.contains(target)) {
                return;
            }
            // If click is on the toggle button itself, do nothing (toggle handler will run)
            if (buttonRef.current && buttonRef.current.contains(target)) {
                return;
            }
            handleClose();
        };
        
        const timeoutId = setTimeout(() => {
            document.addEventListener("mousedown", handleClickOutside, true);
        }, 0);
        
        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener("mousedown", handleClickOutside, true);
        };
    }, [isMenuOpen, handleClose]);
    
    return (
        <div className="dropdown" style={{ position: "relative" }}>
            <button
                ref={buttonRef as any}
                type="button"
                aria-label="Candidate actions"
                style={{ background: "none", border: "none", padding: "4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={handleToggle}
            >
                <img src="/iconsV3/ellipsis.svg" alt="" width={20} height={20} style={{ display: "block" }} />
            </button>
            {isMenuOpen && menuPosition && (
                <div ref={menuRef} key={`menu-${rowId}`} className="dropdown-menu dropdown-menu-right w-100 mt-1 org-dropdown-anim show" style={{ position: "fixed", top: `${menuPosition.top}px`, right: `${menuPosition.right}px`, zIndex: 10000, maxWidth: "200px" }} onClick={(e) => e.stopPropagation()}>   
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#414651", marginLeft: 15, cursor: "default" }}>
                        <span>Candidate Menu</span>
                    </div>
                    <div className="dropdown-divider"></div>
                    {candidate.candidateStatus === "Inactive" && (
                        <div 
                            className="dropdown-item" 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClose();
                                onInviteCandidate(candidate);
                            }}
                        >
                            <span>
                                <i className="la la-user-plus" style={{ fontSize: "16px", marginRight: "8px" }} /> 
                                Invite to Jia
                            </span>
                        </div>
                    )}
                    <div 
                        className="dropdown-item" 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClose();
                            onViewCV();
                        }}
                    >
                        <span>
                            <i className="la la-file-alt" style={{ fontSize: "16px", marginRight: "8px" }} /> 
                            View CV
                        </span>
                    </div>

                    <div
                        className="dropdown-item"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClose();
                            onAddComment(candidate);
                        }}
                    >
                        <span>
                            <i className="las la-comment-medical" style={{ fontSize: "16px", marginRight: "8px" }} /> 
                            Add Comment
                        </span>
                    </div>

                    <div
                        className="dropdown-item"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClose();
                            onInviteToJob(candidate);
                        }}
                    >
                        <span>
                            <i className="la la-briefcase" style={{ fontSize: "16px", marginRight: "8px" }} /> 
                            Invite to a Job
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // Only re-render if candidate or rowId changed
    const prevId = prevProps.candidate?._id || prevProps.candidate?.id || prevProps.candidate?.email || '';
    const nextId = nextProps.candidate?._id || nextProps.candidate?.id || nextProps.candidate?.email || '';
    return prevId === nextId && prevProps.rowId === nextProps.rowId;
});

ActionsCell.displayName = "ActionsCell";

export default ActionsCell;

