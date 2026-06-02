"use client";
import { useEffect, useRef, useState, ReactNode } from "react";

const dropdownOptionIconMap: Record<string, string> = {
  Ongoing: "#F79009",
  Dropped: "#F04438",
  Cancelled: "#F04438",
  Hired: "#12B76A",
  "No CV Uploaded": "#414651",
  Published: "#12B76A",
  Unpublished: "#717680",
  Joined: "#027A48",
  Invited: "#C4320A",
  Admin: "#175CD3",
  "Hiring Manager": "#C01048",
  Guest: "#344054",
};

interface CustomDropdownProps {
  value: string;
  setValue: (value: string) => void;
  options: string[];
  icon?: string;
  iconJsx?: ReactNode;
  iconPosition?: "left" | "right";
  valuePrefix?: string;
  maxContent?: boolean;
  suffixIconJsx?: ReactNode;
  disabled?: boolean;
  iconMap?: Record<string, string>;
  buttonStyle?: React.CSSProperties;
  defaultMenuPosition?: "left" | "right" | "center";
  parentContainer?: HTMLElement;
}

export default function CustomDropdown({
  value,
  setValue,
  options,
  icon,
  iconJsx,
  iconPosition = "left",
  suffixIconJsx,
  valuePrefix,
  maxContent = false,
  disabled = false,
  iconMap = {},
  buttonStyle = {},
  defaultMenuPosition = "center",
  parentContainer,
}: CustomDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  const [dropdownMenuPosition, setDropdownMenuPosition] = useState(defaultMenuPosition);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const renderIcon = () => {
    if (iconJsx) return iconJsx;
    if (icon) return <i className={`la ${icon}`} style={{ fontSize: 16 }} />;
    return null;
  };

  const handleDropdownMenuPosition = (event?: any) => {
    if (!event) {
      return
    }
    const mouseEvent = event as MouseEvent
    const mousePosition = {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
    }
    // container bounding client rect
    const dropdownMenu = dropdownMenuRef.current;
    if (parentContainer) {
      const parentContainerRect = parentContainer.getBoundingClientRect();
      const dropdownMenuWidth = dropdownMenu?.getBoundingClientRect()?.width || 300;

      if ((mousePosition.x + dropdownMenuWidth) >= parentContainerRect.right) {
        setDropdownMenuPosition("left");
      } else {
        setDropdownMenuPosition("right");
      }
    }
  }
  const dropDownMenuPositionStyle = {
    "left": {
      left: "0",
      right: "auto",
      transform: "translateX(-90%)",
    },
    "right": {
      right: "0",
      left: "auto",
      transform: "translateX(90%)",
    },
    "center": {
      left: "50%",
      right: "auto",
      transform: "translateX(-50%)",
    }
  }

  return (
    <div ref={dropdownRef} className="dropdown" style={{ zIndex: 1000 }}>
      <button
        type="button"
        disabled={disabled}
        className="button-v2 secondary"
        style={{
          minWidth: maxContent ? "max-content" : "fit-content",
          width: maxContent ? "max-content" : "100%",
          display: "flex",
          justifyContent: "center",
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
          opacity: disabled ? 0.5 : 1,
          ...buttonStyle,
        }}
        onClick={(event) => {
          handleDropdownMenuPosition(event);
          setDropdownOpen(!dropdownOpen)
        }}
      >
        {(iconPosition === "left") && renderIcon()}
        {value &&<span>
          {valuePrefix || ""} {value}
        </span>}
        {iconPosition === "right" && renderIcon()}
        {suffixIconJsx && suffixIconJsx}
      </button>
      {dropdownOpen && (
        <div
          ref={dropdownMenuRef}
          className={`dropdown-menu dropdown-menu mt-1 org-dropdown-anim${
            dropdownOpen ? " show" : ""
          }`}
          style={{
            maxHeight: 200,
            overflowY: "scroll",
            width: "fit-content",
            ...dropDownMenuPositionStyle[dropdownMenuPosition],
          }}
        >
          {options.map((option) => (
            <div
              key={option}
              className="dropdown-item"
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "5px",
                color: "#181D27",
                fontSize: "14px",
                fontWeight: option === value ? 700 : 500,
              }}
              onClick={() => {
                setValue(option);
                setDropdownOpen(false);
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                {iconMap?.[option] && (
                  <img src={iconMap[option]} alt={option} style={{ width: 20, height: 20 }} />
                )}
                {dropdownOptionIconMap[option] && (
                  <div
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      backgroundColor: dropdownOptionIconMap[option],
                      marginRight: "5px",
                    }}
                  />
                )}
                {option}
              </div>
              {option === value && (
                <i
                  className="la la-check"
                  style={{
                    fontSize: "20px",
                    background:
                      "linear-gradient(180deg, #9FCAED 0%, #CEB6DA 33%, #EBACC9 66%, #FCCEC0 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                ></i>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
