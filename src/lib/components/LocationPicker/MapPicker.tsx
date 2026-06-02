"use client";

import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import styles from "./LocationPicker.module.scss";

interface MapPickerProps {
  height: number;
  initialLocation?: {
    lat: number;
    lon: number;
  } | null;
  onLocationSelect?: (lat: number, lon: number, address: string) => void;
  readOnly?: boolean;
}

// Fix Leaflet default marker icon issue
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function MapPicker({
  height,
  initialLocation,
  onLocationSelect,
  readOnly = false,
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Default to Manila, Philippines if no initial location
  const defaultCenter: [number, number] = [14.5995, 120.9842];

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: initialLocation
        ? [initialLocation.lat, initialLocation.lon]
        : defaultCenter,
      zoom: initialLocation ? 15 : 12,
      zoomControl: true,
    });

    // Add OpenStreetMap tiles (free)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Add initial marker if location exists
    if (initialLocation) {
      const marker = L.marker([initialLocation.lat, initialLocation.lon], {
        icon: defaultIcon,
        draggable: !readOnly,
      }).addTo(map);

      if (!readOnly) {
        marker.on("dragend", async () => {
          const position = marker.getLatLng();
          const address = await reverseGeocode(position.lat, position.lng);
          onLocationSelect?.(position.lat, position.lng, address);
        });
      }

      markerRef.current = marker;
    }

    // Handle map clicks for pinning
    if (!readOnly) {
      map.on("click", async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        // Remove existing marker
        if (markerRef.current) {
          markerRef.current.remove();
        }

        // Add new marker
        const marker = L.marker([lat, lng], {
          icon: defaultIcon,
          draggable: true,
        }).addTo(map);

        marker.on("dragend", async () => {
          const position = marker.getLatLng();
          setIsLoading(true);
          const address = await reverseGeocode(position.lat, position.lng);
          setIsLoading(false);
          onLocationSelect?.(position.lat, position.lng, address);
        });

        markerRef.current = marker;

        // Reverse geocode to get address
        setIsLoading(true);
        const address = await reverseGeocode(lat, lng);
        setIsLoading(false);
        onLocationSelect?.(lat, lng, address);
      });
    }

    mapRef.current = map;

    // Cleanup
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update marker when initialLocation changes
  useEffect(() => {
    if (!mapRef.current) return;

    if (initialLocation) {
      mapRef.current.setView([initialLocation.lat, initialLocation.lon], 15);

      if (markerRef.current) {
        markerRef.current.setLatLng([initialLocation.lat, initialLocation.lon]);
      } else {
        const marker = L.marker([initialLocation.lat, initialLocation.lon], {
          icon: defaultIcon,
          draggable: !readOnly,
        }).addTo(mapRef.current);

        if (!readOnly) {
          marker.on("dragend", async () => {
            const position = marker.getLatLng();
            const address = await reverseGeocode(position.lat, position.lng);
            onLocationSelect?.(position.lat, position.lng, address);
          });
        }

        markerRef.current = marker;
      }
    }
  }, [initialLocation?.lat, initialLocation?.lon]);

  // Reverse geocode using Nominatim (free, OpenStreetMap-based)
  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        {
          headers: {
            "User-Agent": "JiaWebApp/1.0",
          },
        }
      );
      const data = await response.json();
      return data.display_name || "";
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      return "";
    }
  };

  return (
    <div className={styles.mapContainer} style={{ height }}>
      <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
      {isLoading && (
        <div className={styles.mapLoadingOverlay}>
          <div className={styles.spinner} />
          <span>Getting address...</span>
        </div>
      )}
    </div>
  );
}
