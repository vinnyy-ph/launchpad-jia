"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "../../ui";
import Image from "next/image";

type StatusChangeModalProps = {
  onClose: () => void;
  onConfirm: (details?: string) => void;
  title: string;
  description: string;
  iconSrc: string;
  confirmButtonText: string;
  cancelButtonText?: string;
  confirmButtonColor?: string; // Background color for confirm button
  confirmButtonTextColor?: string; // Text color for confirm button
  showDetailsInput?: boolean;
  detailsPlaceholder?: string;
  isLoading?: boolean;
};

export default function StatusChangeModal({
  onClose,
  onConfirm,
  title,
  description,
  iconSrc,
  confirmButtonText,
  cancelButtonText = "Cancel",
  confirmButtonColor = "#1F2937",
  confirmButtonTextColor = "#fff",
  showDetailsInput = false,
  detailsPlaceholder = "Specify details",
  isLoading = false,
}: StatusChangeModalProps) {
  const [details, setDetails] = useState("");
  const detailsRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    if (!showDetailsInput || !detailsRef.current) return;
    const textarea = detailsRef.current;
    textarea.style.setProperty("height", "100px", "important");
    textarea.style.overflowY = "auto";
  }, [showDetailsInput]);

  const handleDetailsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDetails(event.target.value);
  };

  return (
    <div
      className="modal show fade-in-bottom"
      style={{
        display: "block",
        fontFamily: "Open Sans, sans-serif",
        background: "rgba(0,0,0,0.45)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1050,
        overflow: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100%",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "none",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            width: 415,
            maxWidth: "none",
            position: "relative",
            padding: 24,
            textAlign: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Loading State */}
          {isLoading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                gap: 16,
              }}
            >
              <Image
                src="/gifs/loading.gif"
                alt="Loading"
                width={64}
                height={64}
              /> 
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  color: "#6B7280",
                  margin: 0,
                }}
              >
                Updating status...
              </p>
            </div>
          ) : (
            <>
          {/* Icon, Heading, and Description */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* Icon using SVG */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={iconSrc}
                alt="Status change"
                style={{ width: 56, height: 56 }}
              />
            </div>

            {/* Title */}
            <h2
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: "#1F2937",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h2>

            {/* Description */}
            <p
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: "#6B7280",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>

            {showDetailsInput && (
              <div
                style={{
                  textAlign: "left",
                }}
              >
                <textarea
                  ref={detailsRef}
                  placeholder={detailsPlaceholder}
                  value={details}
                  onChange={handleDetailsChange}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #E5E7EB",
                    fontFamily: "Open Sans, sans-serif",
                    fontSize: 14,
                    color: "#111827",
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                    overflow: "auto",
                  }}
                />
              </div>
            )}
          </div>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: 12,
              width: "100%",
            }}
          >
            <Button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
              }}
              label={cancelButtonText}
              variant="secondary"
            >
            </Button>
            <Button
              type="button"
              onClick={() => onConfirm(details)}
              disabled={showDetailsInput && !details.trim()}
              style={{
                flex: 1,
              }}
              label={confirmButtonText}
            >
            </Button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
