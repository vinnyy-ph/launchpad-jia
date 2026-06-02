"use client";

import { useState, useEffect } from "react";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown"; // Assuming this path exists and is correct based on usage in SegmentedCareerForm

interface PhilippinesData {
  provinces: { name: string; key: string }[];
  cities: { name: string; province: string }[];
}

interface ManualAddressFormProps {
  value?: {
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    countryCode?: string;
    displayName?: string;
  } | null;
  onChange?: (location: {
    country: string;
    state: string;
    city: string;
    address: string;
    displayName: string;
    countryCode?: string;
  }) => void;
}

export default function ManualAddressForm({
  value,
  onChange,
}: ManualAddressFormProps) {
  const [country, setCountry] = useState(value?.country || "Philippines");
  const [province, setProvince] = useState(value?.state || "");
  const [city, setCity] = useState(value?.city || "");

  // Philippines location data
  const [philippinesData, setPhilippinesData] = useState<PhilippinesData>({
    provinces: [],
    cities: [],
  });
  const [provinceList, setProvinceList] = useState<{ name: string; key: string }[]>([]);
  const [cityList, setCityList] = useState<{ name: string; province: string }[]>([]);

  // Load Philippines location data
  useEffect(() => {
    const loadLocationData = async () => {
      try {
        const response = await fetch("/philippines-locations.json");
        const data: PhilippinesData = await response.json();
        setPhilippinesData(data);
        setProvinceList(data.provinces);
      } catch (error) {
        console.error("Error loading location data:", error);
      }
    };
    loadLocationData();
  }, []);

  // Initialize/Sync state with props
  useEffect(() => {
    if (value) {
      setCountry(value.country || "");
      setProvince(value.state || "");
      setCity(value.city || "");
      
      // Only update address if it's different to avoid overwriting user input while typing if parent updates
      if (value.displayName && !value.address) { 
          // If we only have displayName (e.g. from legacy data), try to parse or just set it? 
          // Actually, SegmentedCareerForm passes constructed object.
          // logic in SegmentedCareerForm: locationAddress: loc?.displayName
          // So initially `value.address` might be the full string? 
          // Let's assume passed value has decomposed parts if possible, or we might need to handle it.
          // For now, let's trust the passed props match the interface.
      }
      
      // If we are editing, we might need to populate city list based on province
      if (value.state && philippinesData.cities.length > 0) {
          const provinceObj = philippinesData.provinces.find(p => p.name === value.state);
          if (provinceObj) {
            const cities = philippinesData.cities.filter(c => c.province === provinceObj.key);
            setCityList(cities);
          }
      }
    }
  }, [value, philippinesData]);


  const updateLocation = (
    newCountry: string,
    newProvince: string,
    newCity: string
  ) => {
    const parts = [newCity, newProvince, newCountry].filter(Boolean);
    const displayName = parts.join(", ");
    
    onChange?.({
      country: newCountry,
      state: newProvince,
      city: newCity,
      address: "",
      displayName: displayName,
      countryCode: value?.countryCode 
    });
  };

  const handleProvinceChange = (newProvince: string) => {
    const provinceObj = provinceList.find((p) => p.name === newProvince);
    const cities = philippinesData.cities.filter(
      (city) => city.province === provinceObj?.key
    );
    
    setProvince(newProvince);
    setCity(""); // Reset city when province changes
    setCityList(cities);
    
    updateLocation(country, newProvince, "");
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    updateLocation(country, province, newCity);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {/* Country */}
        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: "#344054" }}>
            Country
          </label>
          <input
            type="text"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              updateLocation(e.target.value, province, city);
            }}
            style={{
                width: "100%",
                height: "44px",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #D0D5DD",
                fontSize: "16px",
                outline: "none"
            }}
            placeholder="Enter country"
          />
        </div>

        {/* State / Province */}
        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: "#344054" }}>
            State / Province
          </label>
          <CustomDropdown
            onSelectSetting={handleProvinceChange}
            screeningSetting={province}
            settingList={provinceList}
            placeholder="Select State / Province"
            enableSearch={true}
          />
        </div>

        {/* City */}
        <div>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: "#344054" }}>
            City
          </label>
          <CustomDropdown
            onSelectSetting={handleCityChange}
            screeningSetting={city}
            settingList={cityList}
            placeholder="Select City"
            enableSearch={true}
          />
        </div>
      </div>
    </div>
  );
}
