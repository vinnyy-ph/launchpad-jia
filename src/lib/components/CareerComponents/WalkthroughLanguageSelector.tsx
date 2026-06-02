"use client";

export type WalkthroughLanguage = "english" | "tagalog";

const LANG_OPTIONS: { value: WalkthroughLanguage; label: string }[] = [
  { value: "english", label: "English" },
  { value: "tagalog", label: "Tagalog" },
];

const selectorContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  background: "#F9F9FB",
  border: "1px solid #E9EAEB",
  borderRadius: 8,
  padding: 2,
  width: "fit-content",
  marginTop: 8,
};

const getLangButtonStyle = (isActive: boolean): React.CSSProperties => ({
  width: 210,
  padding: "8px 20px",
  fontFamily: "Satoshi, sans-serif",
  fontWeight: 500,
  fontSize: 14,
  lineHeight: "1.43em",
  borderRadius: 6,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition:
    "color 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
  background: isActive ? "#FFFFFF" : "transparent",
  color: isActive ? "#414651" : "#A4A7AE",
  border: isActive ? "1px solid #D5D7DA" : "1px solid transparent",
  boxShadow: isActive ? "0 1px 2px rgba(0, 0, 0, 0.04)" : "none",
});

const selectedBadgeStyle: React.CSSProperties = {
  background: "#FAFAFA",
  border: "1px solid #E9EAEB",
  borderRadius: 6,
  padding: "2px 6px 2px 8px",
  fontSize: 12,
  color: "#414651",
  fontWeight: 400,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export type WalkthroughLanguageSelectorProps = {
  value: WalkthroughLanguage;
  onChange: (value: WalkthroughLanguage) => void;
};

export default function WalkthroughLanguageSelector({
  value,
  onChange,
}: WalkthroughLanguageSelectorProps) {
  return (
    <div style={selectorContainerStyle}>
      {LANG_OPTIONS.map(({ value: optionValue, label }) => {
        const isActive = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            style={getLangButtonStyle(isActive)}
          >
            {label}
            {isActive && (
              <span style={selectedBadgeStyle}>
                Selected
                <img
                  width={12}
                  height={12}
                  src="/icons/check-circle-broken.svg"
                  alt="Selected"
                />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
