import React, { useEffect, useRef, useState } from "react";
import { COMMON_SKILLS, computeSuggestedSkills, loadSkillConfig, type SkillConfig, getSuggestedSkillsForCandidate } from "@/lib/utils/skillSuggestions";
import { SkillTag } from "./SkillTag";

const normalizeSkillKey = (value: string) =>
    value.toLowerCase().replace(/\./g, "").trim();

const sanitizeSkillInput = (value: string) => {
    return value.replace(/[^A-Za-z0-9 +\-./#]/g, "");
};

interface AddSkillsModalProps {
    candidateSkills: string[];
    onClose: () => void;
    onSave: () => void;
    onSkillsChange: (skills: string[]) => void;
    skillsEndorsementsMap?: { [key: string]: any[] };
    isSaving?: boolean;
}

export function AddSkillsModal({ candidateSkills, onClose, onSave, onSkillsChange, skillsEndorsementsMap, isSaving = false }: AddSkillsModalProps) {
    const [inputValue, setInputValue] = useState("");
    const [searchValue, setSearchValue] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredSkills, setFilteredSkills] = useState<string[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
    const [initialSkills] = useState(candidateSkills);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [skillConfig, setSkillConfig] = useState<SkillConfig | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const suggestionsRef = useRef<HTMLDivElement | null>(null);
    const MAX_SKILLS = 60;

    useEffect(() => {
        let isMounted = true;

        loadSkillConfig()
            .then((config) => {
                if (isMounted) {
                    setSkillConfig(config);
                }
            })
            .catch(() => {
                // loadSkillConfig already logs and falls back to hardcoded config;
                // we keep UI functional by not throwing here.
            });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!searchValue.trim()) {
            setFilteredSkills([]);
            setShowSuggestions(false);
            setHighlightedIndex(null);
            setIsSearching(false);
            return;
        }

        let isActive = true;

        setIsSearching(true);

        const timeoutId = window.setTimeout(() => {
            const runSearch = async () => {
                const normalizedSearch = normalizeSkillKey(searchValue);
                const existingKeys = new Set(candidateSkills.map((s) => normalizeSkillKey(s)));

                let source: string[] | null = null;

                try {
                    const response = await fetch(`/api/skills/search?q=${encodeURIComponent(searchValue)}`);
                    if (response.ok) {
                        const data: any = await response.json();
                        if (Array.isArray(data.skills)) {
                            source = data.skills.map((s: any) => (s ?? "").toString()).filter(Boolean);
                        }
                    }
                } catch {
                }

                if (!source) {
                    const commonSource = skillConfig?.common ?? COMMON_SKILLS;
                    source = commonSource;
                }

                if (!isActive) {
                    return;
                }

                const filtered = source
                    .filter((skill) => {
                        const normalizedSkillKeyValue = normalizeSkillKey(skill);
                        return (
                            normalizedSkillKeyValue.includes(normalizedSearch) &&
                            !existingKeys.has(normalizedSkillKeyValue)
                        );
                    })
                    .slice(0, 10);

                setFilteredSkills(filtered);
                setShowSuggestions(filtered.length > 0);

                if (filtered.length === 0) {
                    setHighlightedIndex(null);
                } else {
                    setHighlightedIndex((prev) => {
                        if (prev === null || prev >= filtered.length) {
                            return 0;
                        }
                        return prev;
                    });
                }

                setIsSearching(false);
            };

            void runSearch();
        }, 300);

        return () => {
            isActive = false;
            window.clearTimeout(timeoutId);
            setIsSearching(false);
        };
    }, [searchValue, candidateSkills, skillConfig]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!showSuggestions || highlightedIndex === null || !suggestionsRef.current) {
            return;
        }

        const items = suggestionsRef.current.querySelectorAll('[data-skill-item="true"]');
        const current = items[highlightedIndex] as HTMLElement | undefined;

        if (current) {
            current.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, showSuggestions, filteredSkills.length]);

    const addSkill = (skill: string) => {
        if (candidateSkills.length >= MAX_SKILLS) {
            return;
        }

        const sanitized = sanitizeSkillInput(skill).trim();
        if (!sanitized) {
            return;
        }

        const existingKeys = new Set(candidateSkills.map((s) => normalizeSkillKey(s)));
        const newKey = normalizeSkillKey(sanitized);

        if (existingKeys.has(newKey)) {
            setDuplicateWarning("This skill (or a similar variation) has already been added.");
            return;
        }

        onSkillsChange([...candidateSkills, sanitized]);
        setInputValue("");
        setSearchValue("");
        setShowSuggestions(false);
        setHighlightedIndex(null);
        setDuplicateWarning(null);
    };

    const newSkills = candidateSkills.filter((skill) => !initialSkills.includes(skill));
    const hasChanges = newSkills.length > 0;
    const isSaveDisabled = !hasChanges || isSaving;

    const initialSkillsWithEndorsements = initialSkills.filter((skill) => {
        const endorsements = skillsEndorsementsMap?.[skill] || [];
        return endorsements.length > 0;
    });

    const initialSkillsWithoutEndorsements = initialSkills.filter((skill) => {
        const endorsements = skillsEndorsementsMap?.[skill] || [];
        return endorsements.length === 0;
    });

    const orderedInitialSkills = [...initialSkillsWithEndorsements, ...initialSkillsWithoutEndorsements];

    const suggestedSkills = skillConfig
        ? computeSuggestedSkills(candidateSkills, skillConfig)
        : getSuggestedSkillsForCandidate(candidateSkills);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <style>
                {`
                    .add-skills-modal-body {
                        scrollbar-width: none; /* Firefox */
                    }

                    .add-skills-modal-body::-webkit-scrollbar {
                        width: 0;
                        height: 0;
                    }
                `}
            </style>
            <div
                className="fade-in-bottom"
                style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '28px',
                width: '92%',
                maxWidth: '760px',
                maxHeight: '90vh',
                minHeight: '600px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div className="add-skills-modal-body" style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#181D27' }}>Add Skills</h2>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            color: '#717680',
                            outline: 'none',
                            boxShadow: 'none'
                        }}
                    >
                        ×
                    </button>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                    {orderedInitialSkills.length > 0 ? (
                        <>
                            <span style={{ fontSize: '14px', color: '#717680', marginBottom: '8px', display: 'block' }}>This candidate's skills</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {orderedInitialSkills.map((skill, index) => {
                                    const endorsements = skillsEndorsementsMap?.[skill] || [];
                                    const hasEndorsements = endorsements.length > 0;

                                    return (
                                        <SkillTag
                                            key={index}
                                            label={skill}
                                            isHighlighted={hasEndorsements}
                                            showThumb={hasEndorsements}
                                        />
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <p
                            style={{
                                marginTop: 4,
                                fontSize: '13px',
                                color: '#98A2B3',
                            }}
                        >
                            No skills have been added for this candidate yet. Use the field below to add skills.
                        </p>
                    )}
                    </div>

                    <div style={{ marginBottom: '20px', position: 'relative' }}>
                    <label style={{ fontSize: '14px', color: '#181D27', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Skill</label>
                    <input
                        ref={inputRef}
                        type="text"
                        maxLength={60}
                        placeholder="Enter skill (ex. Project Management)"
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: isInputFocused ? '#5E72E4' : '#E9EAEB',
                            borderRadius: '6px',
                            fontSize: '14px',
                            outline: 'none',
                            boxShadow: isInputFocused ? '0 0 0 3px rgba(94, 114, 228, 0.15)' : 'none',
                        }}
                        value={inputValue}
                        onChange={(e) => {
                            const sanitized = sanitizeSkillInput(e.target.value);
                            setInputValue(sanitized);
                            setSearchValue(sanitized);
                            if (duplicateWarning) {
                                setDuplicateWarning(null);
                            }
                        }}
                        onFocus={() => {
                            setIsInputFocused(true);
                            if (searchValue.trim() && filteredSkills.length > 0) {
                                setShowSuggestions(true);
                            }
                        }}
                        onBlur={() => {
                            setIsInputFocused(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown' && filteredSkills.length > 0) {
                                e.preventDefault();
                                setShowSuggestions(true);
                                setHighlightedIndex((prev) => {
                                    const nextIndex = prev === null ? 0 : (prev + 1) % filteredSkills.length;
                                    const nextSkill = filteredSkills[nextIndex];
                                    if (nextSkill) {
                                        setInputValue(nextSkill);
                                    }
                                    return nextIndex;
                                });
                                return;
                            }

                            if (e.key === 'ArrowUp' && filteredSkills.length > 0) {
                                e.preventDefault();
                                setShowSuggestions(true);
                                setHighlightedIndex((prev) => {
                                    const nextIndex = prev === null
                                        ? filteredSkills.length - 1
                                        : (prev - 1 + filteredSkills.length) % filteredSkills.length;
                                    const nextSkill = filteredSkills[nextIndex];
                                    if (nextSkill) {
                                        setInputValue(nextSkill);
                                    }
                                    return nextIndex;
                                });
                                return;
                            }

                            if (e.key === 'Enter') {
                                if (showSuggestions && filteredSkills.length > 0 && highlightedIndex !== null) {
                                    e.preventDefault();
                                    const selectedSkill = filteredSkills[highlightedIndex];
                                    if (selectedSkill) {
                                        addSkill(selectedSkill);
                                    }
                                } else if (e.currentTarget.value.trim()) {
                                    e.preventDefault();
                                    addSkill(e.currentTarget.value);
                                }
                            }
                        }}
                    />
                    {candidateSkills.length >= MAX_SKILLS && (
                        <p
                            style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: '#EA580C', // orange
                            }}
                        >
                            Maximum of 60 skills reached. Remove a skill to add another.
                        </p>
                    )}
                    {/* {isSearching && (
                        <p
                            style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: '#98A2B3',
                            }}
                        >
                            Searching skills...
                        </p>
                    )} */}
                    {duplicateWarning && (
                        <p
                            style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: "#B91C1C",
                            }}
                        >
                            {duplicateWarning}
                        </p>
                    )}
                    {showSuggestions && filteredSkills.length > 0 && (
                        <div
                            ref={suggestionsRef}
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: '4px',
                                border: '1px solid #E9EAEB',
                                borderRadius: '6px',
                                backgroundColor: '#FFFFFF',
                                maxHeight: '240px',
                                overflowY: 'auto',
                                boxShadow: '0 8px 16px rgba(15, 23, 42, 0.12)',
                                zIndex: 10
                            }}
                        >
                            <div style={{
                                padding: '8px 12px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#717680',
                                borderBottom: '1px solid #F2F4F7'
                            }}>
                                Search results
                            </div>
                            {filteredSkills.map((skill, index) => (
                                <div
                                    key={index}
                                    data-skill-item="true"
                                    onClick={() => addSkill(skill)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 12px',
                                        fontSize: '14px',
                                        color: '#181D27',
                                        cursor: 'pointer',
                                        borderBottom: index < filteredSkills.length - 1 ? '1px solid #F2F4F7' : 'none',
                                        backgroundColor: highlightedIndex === index ? '#eff6ff' : '#FFFFFF'
                                    }}
                                >
                                    <span>{skill}</span>
                                    <button
                                        type="button"
                                        style={{
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            color: '#181D27',
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            lineHeight: 1,
                                            outline: 'none',
                                            boxShadow: 'none'
                                        }}
                                        aria-label={`Add ${skill}`}
                                    >
                                        +
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {newSkills.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {newSkills.map((skill, index) => (
                                <SkillTag
                                    key={index}
                                    label={skill}
                                    isHighlighted
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = candidateSkills.filter((s) => s !== skill);
                                            onSkillsChange(updated);
                                        }}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                        }}
                                        style={{
                                            marginLeft: '4px',
                                            border: 'none',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            lineHeight: 1,
                                            color: 'inherit',
                                            padding: 0,
                                            outline: 'none',
                                            boxShadow: 'none'
                                        }}
                                        aria-label={`Remove ${skill}`}
                                    >
                                        ×
                                    </button>
                                </SkillTag>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                    <span style={{ fontSize: '14px', color: '#717680', marginBottom: '12px', display: 'block' }}>Suggested based on this candidate's profile</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {suggestedSkills.map((skill, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => {
                                    if (candidateSkills.length >= MAX_SKILLS) {
                                        return;
                                    }

                                    const sanitized = sanitizeSkillInput(skill).trim();
                                    if (!sanitized) {
                                        return;
                                    }

                                    const existingKeys = new Set(candidateSkills.map((s) => normalizeSkillKey(s)));
                                    const newKey = normalizeSkillKey(sanitized);

                                    if (existingKeys.has(newKey)) {
                                        setDuplicateWarning("This skill (or a similar variation) has already been added.");
                                        return;
                                    }

                                    onSkillsChange([...candidateSkills, sanitized]);
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                }}
                                style={{
                                    padding: '6px 16px',
                                    backgroundColor: '#FFFFFF',
                                    border: '1px solid #E0E4E9',
                                    borderRadius: '999px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#414651',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    lineHeight: 1,
                                    outline: 'none',
                                    boxShadow: 'none'
                                }}
                            >
                                <span>{skill}</span>
                                <span
                                    style={{
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: '#667085',
                                        marginTop: '-1px'
                                    }}
                                >
                                    +
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button 
                        onClick={onClose}
                        disabled={isSaving}
                        style={{
                            padding: '8px 16px',
                            border: '1px solid #E9EAEB',
                            borderRadius: '32px',
                            backgroundColor: 'white',
                            color: '#414651',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.7 : 1,
                            outline: 'none',
                            boxShadow: 'none'
                        }}
                    >
                        Cancel
                    </button>
                    <button 
                        disabled={isSaveDisabled}
                        onClick={onSave}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: '32px',
                            backgroundColor: isSaveDisabled ? '#EAECF0' : '#181D27',
                            color: isSaveDisabled ? '#98A2B3' : 'white',
                            cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
                            outline: 'none',
                            boxShadow: 'none'
                        }}
                    >
                        {isSaving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
