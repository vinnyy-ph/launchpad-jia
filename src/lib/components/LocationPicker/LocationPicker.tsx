"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./LocationPicker.module.scss";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";

interface PhilippinesData {
  provinces: { name: string; key: string }[];
  cities: { name: string; province: string }[];
}

interface LocationResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  type: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
}

interface SelectedLocation {
  displayName: string;
  lat?: number;
  lon?: number;
  isPinned: boolean;
  country?: string;
  countryCode?: string;
  state?: string;
  city?: string;
  address?: string;
  isGPS?: boolean;
}


interface LocationPickerProps {
  label?: string;
  placeholder?: string;
  value?: SelectedLocation | null;
  onChange?: (location: SelectedLocation | null) => void;
  showMap?: boolean;
  mapHeight?: number;
  defaultInputValue?: string;
  showCurrentLocationButton?: boolean;
  onDelete?: () => void;
  startInManualMode?: boolean;
  onModeChange?: (isManual: boolean) => void;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function LocationPicker({
  placeholder = "Search for a location...",
  value,
  onChange,
  showMap = true,
  mapHeight = 300,
  defaultInputValue = "",
  showCurrentLocationButton = true,
  onDelete,
  startInManualMode = false,
  onModeChange,
}: LocationPickerProps) {
  const [query, setQuery] = useState(value?.displayName || defaultInputValue || "");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(value || null);
  const [isMapVisible, setIsMapVisible] = useState(false);
  
  // Manual mode state
  const [isManualMode, setIsManualMode] = useState(startInManualMode);

  useEffect(() => {
    setIsManualMode(startInManualMode);
  }, [startInManualMode]);
  const [manualCountry, setManualCountry] = useState("");
  const [manualProvince, setManualProvince] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  
  // Philippines location data
  const [philippinesData, setPhilippinesData] = useState<PhilippinesData>({
    provinces: [],
    cities: [],
  });
  const [provinceList, setProvinceList] = useState<{ name: string; key: string }[]>([]);
  const [cityList, setCityList] = useState<{ name: string; province: string }[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDeleteTooltip, setShowDeleteTooltip] = useState(false);

  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Sync state with props (fixes issues when items are re-ordered/deleted in parent list)
  useEffect(() => {
    if (value) {
      setQuery(value.displayName);
      setSelectedLocation(value);
      
      if (value.country) setManualCountry(value.country);
      if (value.state) setManualProvince(value.state);
      if (value.city) setManualCity(value.city);
      if ((value as any).address) setManualAddress((value as any).address);
    } else {
      setQuery(defaultInputValue || "");
      if (!selectedLocation || defaultInputValue !== selectedLocation.displayName) {
        setSelectedLocation(null);
      }
    }
  }, [value, defaultInputValue]);

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

  useEffect(() => {
    if (showMap) {
      import("./MapPicker" as string).then((mod: { default: React.ComponentType<any> }) => {
        setMapComponent(() => mod.default);
      });
    }
  }, [showMap]);

  // Search locations using Photon API (OpenStreetMap-based, free)
  useEffect(() => {
    const searchLocations = async () => {
      if (debouncedQuery.length < 2) {
        setResults([]);
        return;
      }

      // Skip search if query matches selected location (avoid reopening dropdown after selection)
      if (selectedLocation && debouncedQuery === selectedLocation.displayName) {
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(debouncedQuery)}&limit=5`
        );
        const data = await response.json();

        const mappedResults: LocationResult[] = data.features.map(
          (feature: any, index: number) => {
            const props = feature.properties;
            const coords = feature.geometry.coordinates;

            // Build display name from available properties
            const parts = [
              props.name,
              props.city,
              props.state,
              props.country,
            ].filter(Boolean);

            return {
              id: `${index}-${coords[0]}-${coords[1]}`,
              name: props.name || "Unknown",
              displayName: parts.join(", "),
              lat: coords[1],
              lon: coords[0],
              type: props.osm_value || props.type || "place",
              city: props.city,
              state: props.state,
              country: props.country,
              countryCode: props.countrycode,
            };
          }
        );

        setResults(mappedResults);
        
        if (document.activeElement === inputRef.current) {
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Error searching locations:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchLocations();
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectLocation = (location: LocationResult) => {
    const selected: SelectedLocation = {
      displayName: location.displayName,
      lat: location.lat,
      lon: location.lon,
      isPinned: false,
      country: location.country,
      countryCode: location.countryCode,
      isGPS: true,
    };
    setSelectedLocation(selected);
    setQuery(location.displayName);
    setIsOpen(false);
    onChange?.(selected);
  };

  const handleMapPin = useCallback((lat: number, lon: number, address: string) => {
    const selected: SelectedLocation = {
      displayName: address || `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      lat,
      lon,
      isPinned: true,
      isGPS: true,
    };
    setSelectedLocation(selected);
    setQuery(selected.displayName);

    onChange?.(selected);
  }, [onChange]);

  const handleClear = () => {
    setQuery("");
    setSelectedLocation(null);
    setResults([]);
    onChange?.(null);
    inputRef.current?.focus();
  };

  // Toggle between GPS and manual mode
  const toggleManualMode = () => {
    setIsManualMode(!isManualMode);
    if (!isManualMode) {
      // Switching to manual mode - try to parse GPS location
      if (selectedLocation?.country) {
        setManualCountry(selectedLocation.country);
        setManualProvince(selectedLocation.state || "");
        setManualCity(selectedLocation.city || "");
        setManualAddress((selectedLocation as any).address || "");
      }
    } else {
      // Switching to GPS mode - clear manual fields
      setManualAddress("");
    }
    onModeChange?.(!isManualMode);
  };

  // Handle province change
  const handleProvinceChange = (province: string) => {
    const provinceObj = provinceList.find((p) => p.name === province);
    const cities = philippinesData.cities.filter(
      (city) => city.province === provinceObj?.key
    );
    const isSameProvince = manualProvince === province;
    
    if (isSameProvince) {
      setManualProvince("");
      setManualCity("");
      setCityList([]);
    } else {
      setManualProvince(province);
      setManualCity(cities[0]?.name || "");
      setCityList(cities);
    }
    
    updateManualLocation(
      manualCountry,
      isSameProvince ? "" : province,
      isSameProvince ? "" : cities[0]?.name || "",
      manualAddress
    );
  };

  // Handle city change
  const handleCityChange = (city: string) => {
    const isSameCity = manualCity === city;
    setManualCity(isSameCity ? "" : city);
    updateManualLocation(
      manualCountry,
      manualProvince,
      isSameCity ? "" : city,
      manualAddress
    );
  };

  // Update manual location
  const updateManualLocation = (
    country: string,
    province: string,
    city: string,
    address: string
  ) => {
    const parts = [address, city, province, country].filter(Boolean);
    const displayName = parts.join(", ");
    
    if (displayName) {
      const selected: SelectedLocation = {
        displayName,
        country,
        countryCode: undefined,
        state: province,
        city,
        address,
        isPinned: false,
        isGPS: false,
      };
      setSelectedLocation(selected);
      setQuery(displayName);
      onChange?.(selected);
    }
  };

  return (
    <div className={styles.locationPicker} ref={containerRef}>
      <div className={styles.inputContainer}>
        {!isManualMode ? (
          // GPS Search Mode
          <div className={styles.inputWrapper}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={styles.searchIcon}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selectedLocation) {
                  setSelectedLocation(null);
                }
              }}
              onFocus={() => {
                if (results.length > 0) {
                  setIsOpen(true);
                }
              }}
            />
            {isLoading && <div className={styles.spinner} />}
            {query && !isLoading && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={handleClear}
                aria-label="Clear"
              >
                ×
              </button>
            )}

            {/* Autocomplete dropdown */}
            {isOpen && results.length > 0 && (
              <ul className={styles.dropdown}>
                {results.map((result) => (
                  <li
                    key={result.id}
                    className={styles.dropdownItem}
                    onClick={() => handleSelectLocation(result)}
                  >

                    <div className={styles.resultContent}>
                      <span className={styles.resultName}>{result.name}</span>
                      <span className={styles.resultAddress}>
                        {result.displayName}
                      </span>
                    </div>
                  </li>
                ))}
                
                {/* Pin on map option */}
                <li
                  className={styles.dropdownItem}
                  onClick={() => {
                    setIsOpen(false);
                    setIsMapVisible(true);
                  }}
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderTop: '1px solid #EAECF0',
                    color: '#175CD3',
                    fontSize: '14px',
                    padding: '12px 16px',
                  }}
                >
                  <span>
                    Not your location?{' '}
                    <span style={{ fontWeight: 600 }}>
                      Pin on map
                    </span>
                  </span>
                </li>
              </ul>
            )}
          </div>
        ) : (
          // Manual Address Entry Mode
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {/* Country */}
              <div>
                <label className={styles.label} style={{ display: "block", marginBottom: 6 }}>
                  Country
                </label>
                <input
                  type="text"
                  value={manualCountry}
                  onChange={(e) => {
                    setManualCountry(e.target.value);
                    updateManualLocation(e.target.value, manualProvince, manualCity, manualAddress);
                  }}
                  className={styles.input}
                  placeholder="Enter country"
                />
              </div>

              {/* State / Province */}
              <div>
                <label className={styles.label} style={{ display: "block", marginBottom: 6 }}>
                  State / Province
                </label>
                <CustomDropdown
                  onSelectSetting={handleProvinceChange}
                  screeningSetting={manualProvince}
                  settingList={provinceList}
                  placeholder="Select State / Province"
                />
              </div>

              {/* City */}
              <div>
                <label className={styles.label} style={{ display: "block", marginBottom: 6 }}>
                  City
                </label>
                <CustomDropdown
                  onSelectSetting={handleCityChange}
                  screeningSetting={manualCity}
                  settingList={cityList}
                  placeholder="Select City"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className={styles.label} style={{ display: "block", marginBottom: 6 }}>
                Address
              </label>
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => {
                  setManualAddress(e.target.value);
                  updateManualLocation(manualCountry, manualProvince, manualCity, e.target.value);
                }}
                className={styles.input}
                placeholder="Enter address"
              />
            </div>
          </div>
        )}

        {onDelete && (
          <div style={{ 
            position: "relative",
            alignSelf: isManualMode ? "flex-start" : "stretch",
            marginTop: isManualMode ? 26 : 0,
            display: "flex"
          }}>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={onDelete}
              onMouseEnter={() => setShowDeleteTooltip(true)}
              onMouseLeave={() => setShowDeleteTooltip(false)}
              style={{
                height: isManualMode ? "42px" : "100%",
                width: "100%"
              }}
            >
              <i className="la la-trash" style={{ fontSize: 20 }} />
            </button>
            {showDeleteTooltip && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  marginBottom: 8,
                  backgroundColor: "#111827",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "8px 12px",
                  borderRadius: 8,
                  width: "max-content",
                  maxWidth: 200,
                  whiteSpace: "normal",
                  lineHeight: 1.4,
                  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
                  zIndex: 9999,
                  textAlign: "center",
                  pointerEvents: "none"
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0,
                    height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: "6px solid #111827",
                  }}
                />
                Remove location
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Map picker modal */}


      {/* Preview map (when location is selected with GPS coordinates) */}
      {showMap && isMapVisible && MapComponent && (
        <div style={{ marginTop: 16 }}>
            <div className={styles.previewMap} style={{ height: mapHeight }}>
            <MapComponent
                height={mapHeight}
                initialLocation={selectedLocation?.lat && selectedLocation?.lon ? selectedLocation : null}
                onLocationSelect={handleMapPin}
            />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                    type="button"
                    style={{
                        backgroundColor: '#101828',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                    onClick={() => setIsMapVisible(false)}
                >
                    Confirm location
                </button>
            </div>
        </div>
      )}

      {/* Mode Toggle Button */}
      {!isMapVisible && (
        <button
            type="button"
            className={styles.toggleModeButton}
            onClick={toggleManualMode}
            style={{ marginTop: 16 }}
        >
            {isManualMode ? (
            <>
                Search for address
            </>
            ) : (
            <>
                Enter address manually
                <div
                style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 8 }}
                onClick={(e) => e.stopPropagation()}
                >
                <i
                    className="la la-question-circle"
                    style={{ fontSize: 16, color: "#98A2B3", cursor: "pointer" }}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                ></i>
                {showTooltip && (
                    <div
                    style={{
                        position: "absolute",
                        left: "100%",
                        top: "50%",
                        transform: "translateY(-50%)",
                        marginLeft: 8,
                        backgroundColor: "#000000",
                        color: "#FFFFFF",
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "8px 12px",
                        borderRadius: 8,
                        width: 250,
                        whiteSpace: "normal",
                        lineHeight: 1.4,
                        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
                        zIndex: 9999,
                        textAlign: "left"
                    }}
                    >
                    <div
                        style={{
                        position: "absolute",
                        right: "100%",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 0,
                        height: 0,
                        borderTop: "6px solid transparent",
                        borderBottom: "6px solid transparent",
                        borderRight: "6px solid #000000",
                        }}
                    />
                    Add a location that is unique to this career and not listed among the organization's saved locations
                    </div>
                )}
                </div>
            </>
            )}
        </button>
      )}
    </div>
  );
}
