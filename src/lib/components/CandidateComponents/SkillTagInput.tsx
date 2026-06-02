import { useState, KeyboardEvent, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import { SkillTag } from "./SkillTag";
import { COMMON_SKILLS, loadSkillConfig, type SkillConfig } from "../../utils/skillSuggestions";
import Field from "../ui/field/Field";

const styles = {
  skillTagContainer: {
    width: "100%",
    boxSizing: "border-box",
    padding: "20px",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
  },
  infoText: {
    fontSize: "14px",
    color: "#6b7280",
    marginBottom: "20px",
    lineHeight: 1.5,
  },
  inputSection: {
    marginBottom: "20px",
  },
  inputLabel: {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#181d27",
    marginBottom: "8px",
  },
  inputWrapper: {
    position: "relative",
  },
  skillInput: {
    width: "100%",
    padding: "12px 16px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e0e4e9",
    borderRadius: "8px",
    fontSize: "14px",
    color: "#181d27",
    backgroundColor: "#ffffff",
    cursor: "text",
    transition: "all 0.2s ease",
  },
  skillInputFocused: {
    borderColor: "#5e72e4",
    boxShadow: "0 0 0 3px rgba(94, 114, 228, 0.1)",
  },
  suggestions: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    display: "inline-block",
    width: "40%",
    minWidth: "260px",
    maxWidth: "100%",
    backgroundColor: "#ffffff",
    border: "1px solid #e0e4e9",
    borderRadius: "8px",
    boxShadow:
      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    maxHeight: "300px",
    overflowY: "auto",
    zIndex: 10,
  },
  suggestionsLabel: {
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #e0e4e9",
  },
  suggestionItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    fontSize: "14px",
    color: "#181d27",
  },
  suggestionItemText: {
    flex: 1,
  },
  addButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 0,
    fontSize: "18px",
    lineHeight: 1,
    color: "#6b7280",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minWidth: 0,
    minHeight: 0,
    flexShrink: 0,
  },
  pillsWrapper: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "16px",
  },
  removeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    padding: 0,
    margin: 0,
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "50%",
    fontSize: "18px",
    lineHeight: 1,
    color: "inherit",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minWidth: 0,
    minHeight: 0,
    flexShrink: 0,
  },
} satisfies Record<string, CSSProperties>;

interface SkillTagInputProps {
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  compact?: boolean;
  placeholder?: string;
}

const normalizeSkillKey = (value: string) =>
  value.toLowerCase().replace(/\./g, "").trim();

const sanitizeSkillInput = (value: string) => {
  return value.replace(/[^A-Za-z0-9 +\-./#]/g, "");
};

export default function SkillTagInput({
  skills,
  onSkillsChange,
  compact = false,
  placeholder = "Enter skill (ex. Project Management)",
}: SkillTagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSkills, setFilteredSkills] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [initialSkills] = useState(skills);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [skillConfig, setSkillConfig] = useState<SkillConfig | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const fieldContainerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
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
        // loadSkillConfig already logs and falls back; keep UI functional.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Filter skills based on what the user typed (searchValue)
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
        const existingKeys = new Set(skills.map((s) => normalizeSkillKey(s)));

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
          .slice(0, 10); // Limit to 10 suggestions

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
      };

      void runSearch();
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      setIsSearching(false);
    };
  }, [searchValue, skills, skillConfig]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        fieldContainerRef.current &&
        !fieldContainerRef.current.contains(event.target as Node)
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
      current.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, showSuggestions, filteredSkills.length]);

  const addSkill = (skill: string) => {
    if (skills.length >= MAX_SKILLS) {
      return;
    }

    const sanitized = sanitizeSkillInput(skill).trim();
    if (!sanitized) {
      return;
    }

    const existingKeys = new Set(skills.map((s) => normalizeSkillKey(s)));
    const newKey = normalizeSkillKey(sanitized);

    if (existingKeys.has(newKey)) {
      setDuplicateWarning("This skill (or a similar variation) has already been added.");
      return;
    }

    onSkillsChange([...skills, sanitized]);
    setInputValue("");
    setSearchValue("");
    setShowSuggestions(false);
    setHighlightedIndex(null);
    setDuplicateWarning(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && filteredSkills.length > 0) {
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

    if (e.key === "ArrowUp" && filteredSkills.length > 0) {
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

    if (e.key === "Enter") {
      if (showSuggestions && filteredSkills.length > 0 && highlightedIndex !== null) {
        e.preventDefault();
        const selectedSkill = filteredSkills[highlightedIndex];
        if (selectedSkill) {
          addSkill(selectedSkill);
        }
      } else if (inputValue.trim()) {
        e.preventDefault();
        addSkill(inputValue);
      }
    }
  };

  const removeSkill = (indexToRemove: number) => {
    onSkillsChange(skills.filter((_, index) => index !== indexToRemove));
  };

  const fieldInputStyle = (() => {
    const base = compact
      ? {
          ...styles.skillInput,
          padding: "10px 12px",
          fontSize: "13px",
          borderRadius: "6px",
        }
      : styles.skillInput;

    return isInputFocused
      ? { ...base, ...styles.skillInputFocused }
      : base;
  })();

  return (
    <div
      style={
        compact
          ? {
              ...styles.skillTagContainer,
              padding: "0px",
              backgroundColor: "transparent",
              borderRadius: "0px",
            }
          : styles.skillTagContainer
      }
    >
      {!compact && (
        <div style={styles.infoText}>
          Jia automatically extracts skills from your CV. You can add more relevant skills if needed.
        </div>
      )}

      <div
        style={
          compact
            ? { ...styles.inputSection, marginBottom: "8px" }
            : styles.inputSection
        }
      >
        {!compact && <label style={styles.inputLabel}>Add Skill</label>}
        <div ref={fieldContainerRef} style={styles.inputWrapper}>
          <Field
            autoComplete="off"
            inputStyle={fieldInputStyle}
            maxLength={60}
            name={compact ? "compact-skill-input" : "skill-input"}
            radius={compact ? 6 : 8}
            size={compact ? "sm" : "md"}
            value={inputValue}
            onChange={(e) => {
              const sanitized = sanitizeSkillInput(e.target.value);
              setInputValue(sanitized);
              setSearchValue(sanitized);
              if (duplicateWarning) {
                setDuplicateWarning(null);
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsInputFocused(true);
              if (searchValue.trim()) {
                setShowSuggestions(filteredSkills.length > 0);
              }
            }}
            onBlur={() => {
              setIsInputFocused(false);
            }}
            placeholder={placeholder}
          />
          {/* {isSearching && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#98A2B3",
              }}
            >
              Searching skills...
            </div>
          )} */}
          {showSuggestions && filteredSkills.length > 0 && (
            <div ref={suggestionsRef} style={styles.suggestions}>
              <div
                style={
                  compact
                    ? { ...styles.suggestionsLabel, padding: "6px 12px" }
                    : styles.suggestionsLabel
                }
              >
                Search results
              </div>
              {filteredSkills.map((skill, index) => (
                <div
                  key={index}
                  data-skill-item="true"
                  style={{
                    ...styles.suggestionItem,
                    ...(compact
                      ? {
                          padding: "8px 12px",
                          fontSize: "13px",
                        }
                      : null),
                    ...(highlightedIndex === index ? { backgroundColor: "#eff6ff" } : null),
                  }}
                  onClick={() => addSkill(skill)}
                >
                  <span style={styles.suggestionItemText}>{skill}</span>
                  <button
                    type="button"
                    style={
                      compact
                        ? { ...styles.addButton, fontSize: "16px" }
                        : styles.addButton
                    }
                    aria-label={`Add ${skill}`}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {skills.length >= MAX_SKILLS && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "#EA580C", // orange
            }}
          >
            Maximum of 60 skills reached. Remove a skill to add another.
          </div>
        )}
        {duplicateWarning && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "#B91C1C",
            }}
          >
            {duplicateWarning}
          </div>
        )}
      </div>

      <div
        style={
          compact
            ? {
                ...styles.pillsWrapper,
                gap: "8px",
                marginTop: "6px",
                alignItems: "flex-start",
                alignContent: "flex-start",
                lineHeight: 1,
              }
            : styles.pillsWrapper
        }
      >
        {skills.map((skill, index) => {
          const isNewSkill = !initialSkills.includes(skill);

          return (
            <SkillTag
              key={index}
              label={skill}
              isHighlighted={isNewSkill}
              size={compact ? "sm" : "md"}
            >
              <button
                type="button"
                style={
                  compact
                    ? { ...styles.removeButton, width: "16px", height: "16px", fontSize: "16px" }
                    : styles.removeButton
                }
                onClick={() => removeSkill(index)}
                aria-label={`Remove ${skill}`}
              >
                ×
              </button>
            </SkillTag>
          );
        })}
      </div>
    </div>
  );
}
