"use client";

import { useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { Organization, OrganizationAddress } from "@/lib/types/organization";
import RichTextEditor from "@/lib/components/CareerComponents/RichTextEditor";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(
  () => import("@/lib/components/LocationPicker/LocationPicker"),
  { ssr: false }
);
import Button from "@/lib/components/ui/button/Button";
import { sanitizeString } from "@/lib/utils/sanitizeInput";
import GradientCheckbox from "@/lib/components/GradientCheckbox/GradientCheckbox";
import philippineCitiesAndProvinces from "../../../../../../public/philippines-locations.json";
import CurrencyDropdown from "@/lib/components/CareerComponents/CurrencyDropdown";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";

const currencyOptions = [
  { name: "PHP", symbol: "₱" },
  { name: "AUD", symbol: "A$" },
  { name: "SGD", symbol: "S$" },
  { name: "GBP", symbol: "£" },
  { name: "USD", symbol: "$" },
];

const salaryUnitOptions = [
  { name: "Annual" },
  { name: "Monthly" },
  { name: "Hourly" },
];

const COUNTRY_SALARY_UNIT_MAP: { [key: string]: string } = {
  "Philippines": "Monthly",
  "Singapore": "Monthly",
  "Australia": "Annual",
  "United Kingdom": "Annual",
  "United States": "Annual",
  "United States of America": "Annual",
};

const COUNTRY_CURRENCY_MAP: { [key: string]: string } = {
  "Philippines": "PHP",
  "Australia": "AUD",
  "Singapore": "SGD",
  "United Kingdom": "GBP",
  "United States": "USD",
  "United States of America": "USD",
};

interface OrgDetailsCardProps {
  organization: Organization;
  onUpdate: (updates: Partial<Organization>) => void;
}

export default function OrgDetailsCard({ organization, onUpdate }: OrgDetailsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(organization.name || "");
  const [description, setDescription] = useState(organization.description || "");
  // Helper to infer isGPS from existing data: if it has lat/lon, it's GPS
  const inferIsGPS = (loc: OrganizationAddress): boolean => {
    if (loc.isGPS !== undefined) return loc.isGPS;
    return !!(loc.latitude && loc.longitude);
  };

  // Initialize locations with fallback to legacy fields if organizationAddress is empty
  const [locations, setLocations] = useState<OrganizationAddress[]>(
    organization.organizationAddress && organization.organizationAddress.length > 0
      ? organization.organizationAddress.map(loc => ({ ...loc, isGPS: inferIsGPS(loc) }))
      : organization.country || organization.address
        ? [{
          country: organization.country || "Philippines",
          location: organization.address ? `${organization.address}${organization.city ? `, ${organization.city}` : ""}${organization.province ? `, ${organization.province}` : ""}` : "",
          isMarkedHQ: true,
          isGPS: true
        }]
        : [{ country: "Philippines", location: "", isMarkedHQ: true, isGPS: true }]
  );
  const [defaultCurrency, setDefaultCurrency] = useState(organization.defaultCurrency || "PHP");
  const [defaultSalaryUnit, setDefaultSalaryUnit] = useState(organization.defaultSalaryUnit || "Monthly");

  // No need for global city/province list as we handle it per location or simplify

  const handleCancel = () => {
    setName(organization.name || "");
    setDescription(organization.description || "");
    const initialLocations = organization.organizationAddress && organization.organizationAddress.length > 0
      ? organization.organizationAddress
      : organization.country || organization.address
        ? [{
          country: organization.country || "Philippines",
          location: organization.address ? `${organization.address}${organization.city ? `, ${organization.city}` : ""}${organization.province ? `, ${organization.province}` : ""}` : "",
          isMarkedHQ: true
        }]
        : [{ country: "Philippines", location: "", isMarkedHQ: true }];

    setLocations(initialLocations);
    setDefaultCurrency(organization.defaultCurrency || "PHP");
    setDefaultSalaryUnit(organization.defaultSalaryUnit || "Monthly");
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      errorToast("Organization name is required", 1300);
      return;
    }

    setIsSaving(true);
    try {
      await api.post("/api/admin/update-organization", {
        orgID: organization._id,
        update: {
          name,
          description,
          organizationAddress: locations,
          defaultCurrency,
          defaultSalaryUnit
        },
      });
      onUpdate({
        name,
        description,
        organizationAddress: locations,
        defaultCurrency,
        defaultSalaryUnit
      });
      candidateActionToast("Organization details updated", 1300, <i className="la la-check-circle text-success" />);
      setIsEditing(false);
    } catch (error) {
      errorToast("Error updating organization", 1300);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "#F8F9FC",
        borderRadius: 16,
        padding: 8,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
          Organization Details
        </h3>
        {isEditing ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              style={{
                padding: "8px 16px",
                border: "1px solid #D5D7DA",
                borderRadius: 999,
                background: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: isSaving ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: 999,
                background: "#181D27",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: isSaving ? "not-allowed" : "pointer",
              }}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
            }}
          >
            <i className="la la-pencil" style={{ fontSize: 18, color: "#535862" }} />
          </button>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
        }}
      >
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Name */}
            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: "#717680", display: "block", marginBottom: 6 }}>
                Organization Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #E9EAEB",
                  borderRadius: 8,
                  fontSize: 16,
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 14, fontWeight: 500, color: "#717680", display: "block", marginBottom: 6 }}>
                Description
              </label>
              <RichTextEditor
                setText={setDescription}
                text={description}
                error={false}
              />
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginBottom: 12 }}>
                Organization Address
              </div>

              {locations.map((location, index) => (
                <div key={index}>
                  {/* Location Picker */}
                  <LocationPicker
                    placeholder="Search for a location or pin on map..."
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
                    startInManualMode={location.isGPS === false}
                    onModeChange={(isManual) => {
                      const newLocations = [...locations];
                      newLocations[index] = { ...newLocations[index], isGPS: !isManual };
                      setLocations(newLocations);
                    }}
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
                    showCurrentLocationButton={false}
                    onDelete={
                      locations.length > 1
                        ? () => {
                            const newLocations = locations.filter(
                              (_, i) => i !== index
                            );
                            
                            // If we're deleting the HQ, make the first remaining one the HQ
                            if (location.isMarkedHQ && newLocations.length > 0) {
                              newLocations[0] = { ...newLocations[0], isMarkedHQ: true };
                              
                              const newHqCountry = newLocations[0].country || "Philippines";
                              const currency = COUNTRY_CURRENCY_MAP[newHqCountry] || "USD";
                              const salaryUnit = COUNTRY_SALARY_UNIT_MAP[newHqCountry] || "Annual";
                              
                              setDefaultCurrency(currency);
                              setDefaultSalaryUnit(salaryUnit);
                            }
                            
                            setLocations(newLocations);
                          }
                        : undefined
                    }
                  />

                  {/* Mark as HQ */}
                  <div style={{ marginTop: 8 }}>
                    <GradientCheckbox
                      checked={location.isMarkedHQ}
                      onChange={(checked) => {
                        if (checked) {
                          const newLocations = locations.map((loc, i) => ({
                            ...loc,
                            isMarkedHQ: i === index,
                          }));
                          
                          const country = newLocations[index].country || "Philippines";
                          const currency = COUNTRY_CURRENCY_MAP[country] || "USD";
                          const salaryUnit = COUNTRY_SALARY_UNIT_MAP[country] || "Annual";
                          
                          setDefaultCurrency(currency);
                          setDefaultSalaryUnit(salaryUnit);
                          setLocations(newLocations);
                        }
                      }}
                      label="Mark as HQ"
                    />
                  </div>

                  {/* Add Location Button */}
                  {index === locations.length - 1 && (
                    <div style={{ marginTop: 16 }}>
                      <Button
                        label="Add more locations"
                        variant="tertiary-outline"
                        onClick={() => {
                          setLocations([...locations, { country: "Philippines", location: "", isMarkedHQ: false, isGPS: true }]);
                        }}
                        size="default"
                        style={{
                          width: "fit-content",
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #D0D5DD",
                          color: "#344054",
                          boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)"
                        }}
                        svgAsset={<i className="la la-plus" style={{ fontSize: 16, marginRight: 8 }} />}
                      />
                    </div>
                  )}


                  {/* Divider between locations */}
                  {index < locations.length - 1 && (
                    <hr
                      style={{
                        margin: "24px 0",
                        border: "none",
                        borderTop: "1px solid #E9EAEB",
                      }}
                    />
                  )}
                </div>
              ))}
              
              {/* Default Settings Section */}
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #E9EAEB" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginBottom: 16 }}>
                  Default Settings
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  {/* Default Currency */}
                  <div>
                    <label
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#717680",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Default Currency
                    </label>
                    <div style={{ width: "100%" }}>
                      <CurrencyDropdown
                        currency={defaultCurrency}
                        onCurrencyChange={setDefaultCurrency}
                        currencyOptions={currencyOptions}
                        fullWidth
                      />
                    </div>
                  </div>

                  {/* Default Salary Unit */}
                  <div>
                    <label
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#717680",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Default Salary Unit
                    </label>
                    <CustomDropdown
                      settingList={salaryUnitOptions}
                      screeningSetting={defaultSalaryUnit}
                      onSelectSetting={setDefaultSalaryUnit}
                      placeholder="Select Unit"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 4 }}>Organization Name</p>
              <p style={{ fontSize: 16, fontWeight: 500, color: "#181D27", margin: 0 }}>{organization.name}</p>
            </div>
            <div>
              <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 4 }}>Description</p>
              <div
                style={{ fontSize: 16, fontWeight: 500, color: "#181D27", margin: 0 }}
                dangerouslySetInnerHTML={{ __html: sanitizeString(organization.description || "—", "moderate") }}
              />
            </div>
            <div>
              <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 4 }}>Organization Address</p>
              {organization.organizationAddress && organization.organizationAddress.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(
                    organization.organizationAddress.reduce((acc, loc) => {
                      const country = loc.country || "Unknown";
                      if (!acc[country]) acc[country] = [];
                      acc[country].push(loc);
                      return acc;
                    }, {} as Record<string, OrganizationAddress[]>)
                  ).map(([country, locs], i) => (
                    <div key={i}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#344054", display: "block", marginBottom: 2 }}>{country}</span>
                      {locs.map((loc, j) => (
                        <div key={j} style={{ fontSize: 16, fontWeight: 500, color: "#181D27", display: "flex", alignItems: "center", gap: 8 }}>
                          {loc.location || "—"}
                          {loc.isMarkedHQ && (
                            <span style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#BE185D",
                              backgroundColor: "#F9F5FF",
                              padding: "2px 8px",
                              borderRadius: 16,
                              border: "1px solid #E9D7FE"
                            }}>HQ</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 16, fontWeight: 500, color: "#181D27", margin: 0 }}>
                  {[organization.address, organization.city, organization.province, organization.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              )}
            </div>
            
            {/* Default Settings Read-only */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 4 }}>Default Currency</p>
                <p style={{ fontSize: 16, fontWeight: 500, color: "#181D27", margin: 0 }}>
                  {organization.defaultCurrency || "PHP"}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 4 }}>Default Salary Unit</p>
                <p style={{ fontSize: 16, fontWeight: 500, color: "#181D27", margin: 0 }}>
                  {organization.defaultSalaryUnit || "Monthly"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
