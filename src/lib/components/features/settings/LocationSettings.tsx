"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import styles from "./settings.module.scss";
import { api } from "@/lib/utils/apiClient";
import { OrganizationAddress } from "@/lib/types/organization";
import { candidateActionToast, errorToast } from "@/lib/Utils";

const LocationPicker = dynamic(
  () => import("@/lib/components/LocationPicker/LocationPicker"),
  { ssr: false }
);

export default function LocationSettings() {
  const [locations, setLocations] = useState<OrganizationAddress[]>([
    { country: "Philippines", location: "", isMarkedHQ: true },
  ]);
  const [orgID, setOrgID] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const activeOrg = localStorage.getItem("activeOrg");
    if (activeOrg) {
      const parsedOrg = JSON.parse(activeOrg);
      setOrgID(parsedOrg._id);

      // Helper to infer isGPS
      const inferIsGPS = (loc: OrganizationAddress): boolean => {
        if (loc.isGPS !== undefined) return loc.isGPS;
        return !!(loc.latitude && loc.longitude);
      };

      // Load existing locations
      if (parsedOrg.organizationAddress && parsedOrg.organizationAddress.length > 0) {
        setLocations(parsedOrg.organizationAddress.map((loc: any) => ({ ...loc, isGPS: inferIsGPS(loc) })));
      } else if (parsedOrg.country || parsedOrg.address) {
        // Legacy data fallback
        setLocations([
          {
            country: parsedOrg.country || "Philippines",
            location: parsedOrg.address
              ? `${parsedOrg.address}${parsedOrg.city ? `, ${parsedOrg.city}` : ""}${
                  parsedOrg.province ? `, ${parsedOrg.province}` : ""
                }`
              : "",
            isMarkedHQ: true,
            isGPS: true,
          },
        ]);
      }
    }
    setIsLoading(false);
  }, []);

  const handleSave = async () => {
    if (!orgID) {
      errorToast("Organization ID not found", 2500);
      return;
    }

    // Validate at least one location
    const validLocations = locations.filter((loc) => loc.location.trim() !== "");
    if (validLocations.length === 0) {
      errorToast("Please add at least one location", 2500);
      return;
    }

    setIsSaving(true);
    try {
      await api.post("/api/admin/update-organization", {
        orgID,
        update: { organizationAddress: validLocations },
      });

      // Update localStorage
      const activeOrg = localStorage.getItem("activeOrg");
      if (activeOrg) {
        const parsedOrg = JSON.parse(activeOrg);
        parsedOrg.organizationAddress = validLocations;
        localStorage.setItem("activeOrg", JSON.stringify(parsedOrg));
      }

      candidateActionToast("Location settings updated successfully", 1200, undefined);
    } catch (error) {
      console.error("Error updating locations:", error);
      errorToast("Failed to update location settings", 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const addLocation = () => {
    setLocations([
      ...locations,
      { country: "Philippines", location: "", isMarkedHQ: false, isGPS: true },
    ]);
  };

  const removeLocation = (index: number) => {
    if (locations.length === 1) {
      errorToast("At least one location is required", 2500);
      return;
    }

    const newLocations = locations.filter((_, i) => i !== index);
    // If we're deleting the HQ, make the first remaining one the HQ
    if (locations[index].isMarkedHQ && newLocations.length > 0) {
      newLocations[0] = { ...newLocations[0], isMarkedHQ: true };
    }
    setLocations(newLocations);
  };

  if (isLoading) {
    return (
      <div className={styles.settingsContent}>
        <div style={{ padding: "40px", textAlign: "center", color: "#717680" }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.settingsContent}>
      <div className={styles.settingsSection}>
        <div className={styles.sectionHeader}>
          <h3>Organization Locations</h3>
          <p>Manage your organization's addresses and locations</p>
        </div>

        <div style={{ marginTop: 24 }}>
          {locations.map((location, index) => (
            <div
              key={index}
              style={{
                marginBottom: index < locations.length - 1 ? 24 : 0,
                padding: 20,
                background: "#FAFAFA",
                borderRadius: 12,
                border: "1px solid #E9EAEB",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <LocationPicker
                    label={`Location ${index + 1}`}
                    placeholder="Search for a location or pin on map..."
                    startInManualMode={location.isGPS === false}
                    onModeChange={(isManual) => {
                      const newLocations = [...locations];
                      newLocations[index] = { ...newLocations[index], isGPS: !isManual };
                      setLocations(newLocations);
                    }}
                    value={
                      location.isGPS === false
                        ? {
                            displayName: location.location,
                            country: location.country,
                            state: location.province,
                            city: location.city,
                            address: location.address,
                            isPinned: false,
                            isGPS: false,
                          }
                        : location.latitude && location.longitude
                        ? {
                            displayName: location.location,
                            lat: location.latitude,
                            lon: location.longitude,
                            isPinned: true,
                            country: location.country,
                            state: location.province,
                            city: location.city,
                            address: location.address,
                            isGPS: true,
                          }
                        : null
                    }
                    defaultInputValue={location.location}
                    onChange={(selected) => {
                      const newLocations = [...locations];
                      if (selected) {
                        newLocations[index] = {
                          ...newLocations[index],
                          location: selected.displayName,
                          latitude: selected.lat,
                          longitude: selected.lon,
                          country: selected.country || "Philippines",
                          province: selected.state,
                          city: selected.city,
                          address: selected.address,
                          isGPS: selected.isGPS,
                        };
                      } else {
                        newLocations[index] = {
                          ...newLocations[index],
                          location: "",
                          latitude: undefined,
                          longitude: undefined,
                        };
                      }
                      setLocations(newLocations);
                    }}
                    showMap={true}
                    mapHeight={200}
                  />
                </div>

                {locations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLocation(index)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "8px",
                      marginTop: "28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Remove location"
                  >
                    <i
                      className="la la-trash"
                      style={{ fontSize: 20, color: "#98A2B3" }}
                    />
                  </button>
                )}
              </div>

              {/* Mark as HQ checkbox */}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  id={`hq-checkbox-${index}`}
                  checked={location.isMarkedHQ || false}
                  onChange={(e) => {
                    const newLocations = [...locations].map((loc, i) => ({
                      ...loc,
                      isMarkedHQ: i === index ? e.target.checked : false,
                    }));
                    setLocations(newLocations);
                  }}
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: "#6941C6",
                    cursor: "pointer",
                  }}
                />
                <label
                  htmlFor={`hq-checkbox-${index}`}
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: location.isMarkedHQ ? "#181D27" : "#A4A7AE",
                    cursor: "pointer",
                  }}
                >
                  Mark as HQ
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addLocation}
            style={{
              marginTop: 16,
              padding: "10px 16px",
              background: "none",
              border: "1px dashed #C7CCD3",
              borderRadius: 8,
              color: "#6941C6",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <i className="la la-plus" style={{ fontSize: 16 }} />
            Add Another Location
          </button>
        </div>

        <div
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid #E9EAEB",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "12px 24px",
              background: "#6941C6",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 500,
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
