"use client";
import React from "react";
import { useEffect, useRef, useState } from "react";
import Fuse from "fuse.js";

export default function CustomDropdown(props) {
  const {
    onSelectSetting,
    screeningSetting,
    settingList = [],
    placeholder,
    error,
    enableSearch = false,
  } = props;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [hoveredSetting, setHoveredSetting] = useState<string | null>(null);
  const [activeSetting, setActiveSetting] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
        setSearch("");
        setHoveredSetting(null);
        setActiveSetting(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fuseOptions = {
    keys: ["name"],
    threshold: 0.3,
  };

  const filteredSettings = React.useMemo(() => {
    if (!search) return settingList;
    const fuse = new Fuse(settingList, fuseOptions);
    return fuse.search(search).map((result) => result.item);
  }, [settingList, search]);

  return (
    <div
      ref={dropdownRef}
      className="dropdown w-100"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      <button
        disabled={settingList.length === 0}
        className="dropdown-btn fade-in-bottom"
        style={{
          width: "100%",
          height: "48px",
          color: "#181D27",
          border: error ? "2px solid #EF4444" : "2px solid #E9EAEB",
          backgroundColor: "#FFFFFF",
          borderRadius: "8px",
          padding: "0 12px",
        }}
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <i
            className={
              settingList.find((setting) => setting.name === screeningSetting)
                ?.icon
            }
          ></i>
          {settingList.find((setting) => setting.name === screeningSetting)?.image && <img src={settingList.find((setting) => setting.name === screeningSetting)?.image} alt={screeningSetting} style={{ width: "20px", height: "20px" }} />}
          <span>{screeningSetting?.replace("_", " ") || placeholder}</span>
          {settingList.find((setting) => setting.name === screeningSetting)?.isMarkedHQ && (
            <span
              style={{
                backgroundColor: "#FCE7F3",
                color: "#BE185D",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                marginLeft: 8,
              }}
            >
              HQ
            </span>
          )}
        </span>
        <i className="la la-angle-down ml-10"></i>
      </button>
      <div
        style={{
          minHeight: error && !dropdownOpen ? "18px" : "0",
          marginTop: error && !dropdownOpen ? 4 : 0,
        }}
      >
        {error && !dropdownOpen && (
          <span style={{ color: "#EF4444", fontSize: 12, fontWeight: 400 }}>
            {error}
          </span>
        )}
      </div>
      {dropdownOpen && (
        <div
          className="org-dropdown-anim show"
          style={{
            position: "absolute",
            top: "calc(48px + 4px)",
            left: "0",
            right: "0",
            padding: "0",
            maxHeight: 200,
            overflowY: "auto",
            zIndex: 1000,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
        >
          {/* Search Input */}
          {enableSearch && (
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #E9EAEB", width: "100%" }}>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
              <i
                className="la la-search"
                style={{
                  position: "absolute",
                  left: "12px",
                  fontSize: 16,
                  color: "#9CA3AF",
                  zIndex: 1,
                }}
              ></i>
              <input
              type="text"
              placeholder="Search"
              style={{ width: "100%", padding: "10px 12px 10px 40px", borderRadius: "8px", border: "1px solid #E9EAEB" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            </div>
            </div>
          )}
          {filteredSettings.length > 0 ? (filteredSettings.map((setting, index) => (
            <div key={index}>
              <button
                className="dropdown-item d-flex align-items-center"
                style={{
                  width: "100%",
                  borderRadius: screeningSetting === setting.name ? 0 : 10,
                  overflow: "hidden",
                  padding: "10px 12px",
                  color: "#181D27",
                  fontWeight: screeningSetting === setting.name ? 700 : 500,
                  background:
                    screeningSetting === setting.name
                      ? "#F8F9FC"
                      : activeSetting === setting.name
                        ? "#EEF2F6"
                        : hoveredSetting === setting.name
                          ? "#F5F7FA"
                      : "transparent",
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  whiteSpace: "wrap",
                  transition: "background-color 0.15s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredSetting(setting.name)}
                onMouseLeave={() => {
                  setHoveredSetting((prev) =>
                    prev === setting.name ? null : prev,
                  );
                  setActiveSetting((prev) =>
                    prev === setting.name ? null : prev,
                  );
                }}
                onMouseDown={() => setActiveSetting(setting.name)}
                onMouseUp={() =>
                  setActiveSetting((prev) =>
                    prev === setting.name ? null : prev,
                  )
                }
                onClick={() => {
                  onSelectSetting(setting.name);
                  setDropdownOpen(false);
                  setSearch("");
                  setHoveredSetting(null);
                  setActiveSetting(null);
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
                  {setting.icon && <i className={setting.icon}></i>}{" "}
                  {setting.image && <img src={setting.image} alt={setting.name} style={{ width: "20px", height: "20px" }} />}
                  {setting.name?.replace("_", " ")}
                  {setting.isMarkedHQ && (
                    <span
                      style={{
                        backgroundColor: "#FCE7F3",
                        color: "#BE185D",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        marginLeft: 8,
                      }}
                    >
                      HQ
                    </span>
                  )}
                </div>
                {setting.name === screeningSetting && (
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
              </button>
            </div>
          ))) : (
            <div style={{ padding: "10px 12px", color: "#181D27", fontWeight: 500, textAlign: "center" }}>
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
