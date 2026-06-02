"use client";

import React from "react";

// Text Input Field
export type TextInputFieldProps = {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  widthPercentage?: number;
  disabled?: boolean;
  error?: string;
};

export const TextInputField: React.FC<TextInputFieldProps> = ({
  label,
  required,
  value,
  onChange,
  placeholder,
  widthPercentage = 46,
  disabled = false,
  error,
}) => {
  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: "#F8F9FC",
        padding: 8,
      }}
    >
      <label
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: "#344054",
          display: "block",
          marginBottom: 8,
          padding: "4px 12px",
        }}
      >
        {label}
        {required && <span style={{ color: "#D92D20" }}>*</span>}
      </label>
      <div
        style={{
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9EAEB",
          padding: 24,
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: `${widthPercentage}%`,
            padding: "10px 40px 10px 14px",
            borderRadius: 8,
            border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
            fontSize: 14,
            color: "#101828",
            fontWeight: 500,
            outline: "none",
            backgroundColor: disabled ? "#F9FAFB" : "#FFFFFF",
          }}
        />
        {error && (
          <p
            style={{
              marginTop: 4,
              marginBottom: 0,
              fontSize: 12,
              color: "#F04438",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

// Rich Text / Textarea Field
export type RichTextInputFieldProps = {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  showToolbar?: boolean;
  disabled?: boolean;
  error?: string;
};

export const RichTextInputField: React.FC<RichTextInputFieldProps> = ({
  label,
  required,
  value,
  onChange,
  placeholder,
  minHeight = 200,
  showToolbar = true,
  disabled = false,
  error,
}) => {
  const descriptionEditorRef = React.useRef<HTMLDivElement>(null);

  const formatText = (command: string, value: string | null = null) => {
    document.execCommand(command, false, value ?? undefined);
    descriptionEditorRef.current?.focus();
  };

  const handleDescriptionChange = () => {
    if (descriptionEditorRef.current) {
      onChange(descriptionEditorRef.current.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    // Get plain text from clipboard
    const text = e.clipboardData.getData('text/plain');
    // Insert the plain text at cursor position
    document.execCommand('insertText', false, text);
    // Update the state
    handleDescriptionChange();
  };

  React.useEffect(() => {
    const editor = descriptionEditorRef.current;
    if (editor) {
      const handleFocus = () => {
        if (editor.innerHTML === '' || editor.innerHTML === '<br>') {
          editor.innerHTML = '';
        }
      };
      
      const handleBlur = () => {
        if (editor.innerHTML === '' || editor.innerHTML === '<br>') {
          editor.innerHTML = '';
        }
        handleDescriptionChange();
      };

      editor.addEventListener('focus', handleFocus);
      editor.addEventListener('blur', handleBlur);
      
      return () => {
        editor.removeEventListener('focus', handleFocus);
        editor.removeEventListener('blur', handleBlur);
      };
    }
  }, []);

  React.useEffect(() => {
    if (descriptionEditorRef.current && !descriptionEditorRef.current.innerHTML && value) {
      descriptionEditorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: "#F8F9FC",
        padding: 8,
      }}
    >
      <label
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: "#344054",
          display: "block",
          marginBottom: 8,
          padding: "4px 12px",
        }}
      >
        {label}
        {required && <span style={{ color: "#D92D20" }}>*</span>}
      </label>
      <div
        style={{
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9EAEB",
          padding: 24,
        }}
      >
        <div
          style={{
            borderRadius: 8,
            border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div
            ref={descriptionEditorRef}
            className="rich-text-editor"
            contentEditable={!disabled}
            style={{
              minHeight: minHeight,
              overflowY: "auto",
              padding: "12px",
              lineHeight: "1.5",
              position: "relative",
              textAlign: "left",
              outline: "none",
              fontSize: 14,
              color: "#101828",
              fontWeight: 500,
              fontFamily: "inherit",
              borderBottom: showToolbar && !disabled ? "1px solid #E9EAEB" : "none",
              backgroundColor: disabled ? "#F9FAFB" : "transparent",
            }}
            onInput={handleDescriptionChange}
            onBlur={handleDescriptionChange}
            onPaste={handlePaste}
            data-placeholder={placeholder || "Enter description"}
          ></div>
          
          {showToolbar && !disabled && (
            <div style={{ 
              backgroundColor: "#fff",
              display: "flex",
              gap: "4px",
              flexWrap: "wrap",
              padding: "8px 14px",
            }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => formatText('bold')}
                title="Bold"
                style={{ padding: "4px 8px", fontSize: 20, color: "#535862", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <i className="la la-bold"></i>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => formatText('italic')}
                title="Italic"
                style={{ padding: "4px 8px", fontSize: 20, color: "#535862", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <i className="la la-italic"></i>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => formatText('underline')}
                title="Underline"
                style={{ padding: "4px 8px", fontSize: 20, color: "#535862", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <i className="la la-underline"></i>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => formatText('strikeThrough')}
                title="Strikethrough"
                style={{ padding: "4px 8px", fontSize: 20, color: "#535862", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <i className="la la-strikethrough"></i>
              </button>
              
              <div style={{ width: "1px", backgroundColor: "#D5D7DA", margin: "0 4px" }}></div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => formatText('insertOrderedList')}
                title="Numbered List"
                style={{ padding: "4px 8px", fontSize: 20, color: "#535862", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <i className="la la-list-ol"></i>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => formatText('insertUnorderedList')}
                title="Bullet List"
                style={{ padding: "4px 8px", fontSize: 20, color: "#535862", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <i className="la la-list-ul"></i>
              </button>
            </div>
          )}
          <style jsx>{`
            [data-placeholder]:empty:before {
              content: attr(data-placeholder);
              color: #6c757d;
              pointer-events: none;
              position: absolute;
              top: 12px;
              left: 12px;
            }
          `}</style>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                .rich-text-editor * {
                  margin-left: 0 !important;
                  padding-left: 0 !important;
                }
                .rich-text-editor ul,
                .rich-text-editor ol {
                  list-style-position: inside !important;
                  margin-block-start: 0 !important;
                  margin-block-end: 0 !important;
                  margin-inline-start: 0 !important;
                  margin-inline-end: 0 !important;
                  padding-inline-start: 0 !important;
                  margin-left: 0 !important;
                  padding-left: 0 !important;
                }
                .rich-text-editor li {
                  margin-inline-start: 0 !important;
                  padding-inline-start: 0 !important;
                  margin-left: 0 !important;
                  padding-left: 0 !important;
                }
              `,
            }}
          />
        </div>
        {error && (
          <p
            style={{
              marginTop: 4,
              marginBottom: 0,
              fontSize: 12,
              color: "#F04438",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

// Dropdown Select Field
export type DropdownSelectFieldProps = {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  widthPercentage?: number;
};

export const DropdownSelectField: React.FC<DropdownSelectFieldProps> = ({
  label,
  required,
  value,
  onChange,
  options,
  widthPercentage = 50,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
  };

  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: "#F8F9FC",
        padding: 8,
      }}
    >
      <label
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: "#344054",
          display: "block",
          marginBottom: 8,
          padding: "4px 12px",
        }}
      >
        {label}
        {required && <span style={{ color: "#D92D20" }}>*</span>}
      </label>
      <div
        style={{
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9EAEB",
          padding: 24,
        }}
      >
        <div style={{ position: "relative", width: `${widthPercentage}%` }}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            style={{
              width: "100%",
              padding: "10px 14px",
              paddingRight: "40px",
              borderRadius: 8,
              border: "1px solid #E9EAEB",
              fontSize: 14,
              color: "#101828",
              fontWeight: 500,
              outline: "none",
              cursor: "pointer",
              backgroundColor: "#FFFFFF",
              textAlign: "left",
            }}
          >
            {value}
          </button>
          <img
            src="/icons/chevron.svg"
            alt=""
            style={{
              position: "absolute",
              right: "14px",
              top: "50%",
              transform: open ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
              width: 16,
              height: 16,
              pointerEvents: "none",
              transition: "transform 0.2s",
            }}
          />
          {open && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                width: "100%",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E9EAEB",
                borderRadius: 8,
                boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                zIndex: 10,
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "none",
                    backgroundColor: value === option ? "#F3F4F6" : "#FFFFFF",
                    color: "#101828",
                    fontSize: 14,
                    fontWeight: 500,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = value === option ? "#F3F4F6" : "#FFFFFF")
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Multi-Select Dropdown Field (Work Days)
export type MultiSelectFieldProps = {
  label: string;
  required?: boolean;
  values: { value: string; onChange: (value: string) => void; options: string[] }[];
  disabled?: boolean;
  error?: string;
};

export const MultiSelectField: React.FC<MultiSelectFieldProps> = ({ label, required, values, disabled = false, error }) => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const handleSelect = (index: number, selectedValue: string) => {
    values[index].onChange(selectedValue);
    setOpenIndex(null);
  };

  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: "#F8F9FC",
        padding: 8,
      }}
    >
      <label
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "#344054",
          display: "block",
          marginBottom: 8,
          padding: "4px 12px",
        }}
      >
        {label}
        {required && <span style={{ color: "#D92D20" }}>*</span>}
      </label>
      <div
        style={{
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9EAEB",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          {values.map((field, index) => (
            <div key={index} style={{ flex: "0 0 260px", position: "relative" }}>
              <button
                type="button"
                onClick={() => !disabled && setOpenIndex(openIndex === index ? null : index)}
                disabled={disabled}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  paddingRight: "40px",
                  borderRadius: 8,
                  border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
                  fontSize: 14,
                  color: field.value ? "#101828" : "#9CA3AF",
                  fontWeight: 500,
                  outline: "none",
                  backgroundColor: disabled ? "#F9FAFB" : "#FFFFFF",
                  cursor: disabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                {field.value || "Choose"}
              </button>
              <img
                src="/icons/chevron.svg"
                alt=""
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: openIndex === index ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                  width: 16,
                  height: 16,
                  pointerEvents: "none",
                  transition: "transform 0.2s",
                }}
              />
              {openIndex === index && !disabled && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    width: "100%",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E9EAEB",
                    borderRadius: 8,
                    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                    zIndex: 10,
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {field.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleSelect(index, option)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "none",
                        backgroundColor: field.value === option ? "#F3F4F6" : "#FFFFFF",
                        color: "#101828",
                        fontSize: 14,
                        fontWeight: 500,
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = field.value === option ? "#F3F4F6" : "#FFFFFF")
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {error && (
          <p
            style={{
              marginTop: 4,
              marginBottom: 0,
              fontSize: 12,
              color: "#F04438",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

// Office Location Field (3 dropdowns)
export type OfficeLocationInputFieldProps = {
  label: string;
  required?: boolean;
  country: { value: string; onChange: (value: string) => void; options: string[] };
  stateProvince: { value: string; onChange: (value: string) => void; options: string[] };
  city: { value: string; onChange: (value: string) => void; options: string[] };
  disabled?: boolean;
  error?: string;
};

export const OfficeLocationInputField: React.FC<OfficeLocationInputFieldProps> = ({
  label,
  required,
  country,
  stateProvince,
  city,
  disabled = false,
  error,
}) => {
  const [openDropdown, setOpenDropdown] = React.useState<'country' | 'state' | 'city' | null>(null);

  const handleSelectCountry = (selectedValue: string) => {
    country.onChange(selectedValue);
    setOpenDropdown(null);
  };

  const handleSelectState = (selectedValue: string) => {
    stateProvince.onChange(selectedValue);
    setOpenDropdown(null);
  };

  const handleSelectCity = (selectedValue: string) => {
    city.onChange(selectedValue);
    setOpenDropdown(null);
  };

  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: "#F8F9FC",
        padding: 8,
      }}
    >
      <label
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "#344054",
          display: "block",
          marginBottom: 8,
          padding: "4px 12px",
        }}
      >
        {label}
        {required && <span style={{ color: "#D92D20" }}>*</span>}
      </label>
      <div
        style={{
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9EAEB",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: "0 0 260px", position: "relative" }}>
            <button
              type="button"
              onClick={() => !disabled && setOpenDropdown(openDropdown === 'country' ? null : 'country')}
              disabled={disabled}
              style={{
                width: "100%",
                padding: "10px 14px",
                paddingRight: "40px",
                borderRadius: 8,
                border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
                fontSize: 14,
                color: "#101828",
                fontWeight: 500,
                outline: "none",
                backgroundColor: disabled ? "#F9FAFB" : "#FFFFFF",
                cursor: disabled ? "not-allowed" : "pointer",
                textAlign: "left",
              }}
            >
              {country.value}
            </button>
            <img
              src="/icons/chevron.svg"
              alt=""
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: openDropdown === 'country' ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                width: 16,
                height: 16,
                pointerEvents: "none",
                transition: "transform 0.2s",
              }}
            />
            {openDropdown === 'country' && !disabled && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  width: "100%",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: 8,
                  boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                  zIndex: 10,
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {country.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectCountry(option)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      backgroundColor: country.value === option ? "#F3F4F6" : "#FFFFFF",
                      color: "#101828",
                      fontSize: 14,
                      fontWeight: 500,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = country.value === option ? "#F3F4F6" : "#FFFFFF")
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: "0 0 260px", position: "relative" }}>
            <button
              type="button"
              onClick={() => !disabled && setOpenDropdown(openDropdown === 'state' ? null : 'state')}
              disabled={disabled}
              style={{
                width: "100%",
                padding: "10px 14px",
                paddingRight: "40px",
                borderRadius: 8,
                border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
                fontSize: 14,
                color: stateProvince.value ? "#101828" : "#9CA3AF",
                fontWeight: 500,
                outline: "none",
                backgroundColor: disabled ? "#F9FAFB" : "#FFFFFF",
                cursor: disabled ? "not-allowed" : "pointer",
                textAlign: "left",
              }}
            >
              {stateProvince.value || "Choose State / province"}
            </button>
            <img
              src="/icons/chevron.svg"
              alt=""
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: openDropdown === 'state' ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                width: 16,
                height: 16,
                pointerEvents: "none",
                transition: "transform 0.2s",
              }}
            />
            {openDropdown === 'state' && !disabled && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  width: "100%",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: 8,
                  boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                  zIndex: 10,
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {stateProvince.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectState(option)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      backgroundColor: stateProvince.value === option ? "#F3F4F6" : "#FFFFFF",
                      color: "#101828",
                      fontSize: 14,
                      fontWeight: 500,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = stateProvince.value === option ? "#F3F4F6" : "#FFFFFF")
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: "0 0 260px", position: "relative" }}>
            <button
              type="button"
              onClick={() => !disabled && setOpenDropdown(openDropdown === 'city' ? null : 'city')}
              disabled={disabled}
              style={{
                width: "100%",
                padding: "10px 14px",
                paddingRight: "40px",
                borderRadius: 8,
                border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
                fontSize: 14,
                color: city.value ? "#101828" : "#9CA3AF",
                fontWeight: 500,
                outline: "none",
                backgroundColor: disabled ? "#F9FAFB" : "#FFFFFF",
                cursor: disabled ? "not-allowed" : "pointer",
                textAlign: "left",
              }}
            >
              {city.value || "Choose City"}
            </button>
            <img
              src="/icons/chevron.svg"
              alt=""
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: openDropdown === 'city' ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                width: 16,
                height: 16,
                pointerEvents: "none",
                transition: "transform 0.2s",
              }}
            />
            {openDropdown === 'city' && !disabled && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  width: "100%",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: 8,
                  boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                  zIndex: 10,
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {city.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectCity(option)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      backgroundColor: city.value === option ? "#F3F4F6" : "#FFFFFF",
                      color: "#101828",
                      fontSize: 14,
                      fontWeight: 500,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = city.value === option ? "#F3F4F6" : "#FFFFFF")
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {error && (
          <p
            style={{
              marginTop: 4,
              marginBottom: 0,
              fontSize: 12,
              color: "#F04438",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

// Salary Range Input Field
export type SalaryRangeInputFieldProps = {
  label: string;
  required?: boolean;
  minSalary: { value: string; onChange: (value: string) => void };
  maxSalary: { value: string; onChange: (value: string) => void };
  currency: { value: string; onChange: (value: string) => void; options: string[] };
  disabled?: boolean;
  error?: string;
};

export const SalaryRangeInputField: React.FC<SalaryRangeInputFieldProps> = ({
  label,
  required,
  minSalary,
  maxSalary,
  currency,
  disabled = false,
  error,
}) => {
  const [openMinCurrency, setOpenMinCurrency] = React.useState(false);
  const [openMaxCurrency, setOpenMaxCurrency] = React.useState(false);

  const handleSelectCurrency = (value: string, isMin: boolean) => {
    currency.onChange(value);
    if (isMin) {
      setOpenMinCurrency(false);
    } else {
      setOpenMaxCurrency(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: "#F8F9FC",
        padding: 8,
      }}
    >
      <label
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "#344054",
          display: "block",
          marginBottom: 8,
          padding: "4px 12px",
        }}
      >
        {label}
        {required && <span style={{ color: "#D92D20" }}>*</span>}
      </label>
      <div
        style={{
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9EAEB",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <div
            style={{
              width: "260px",
              display: "flex",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 8,
              border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
              fontSize: 14,
              color: "#101828",
              backgroundColor: disabled ? "#F9FAFB" : "#FFFFFF",
              boxSizing: "border-box",
            }}
          >
            <span style={{ marginRight: 8, color: "rgba(113, 118, 128, 1)" }}>₱</span>
            <input
              type="text"
              value={minSalary.value}
              onChange={(e) => minSalary.onChange(e.target.value)}
              placeholder="Min. Salary"
              disabled={disabled}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 14,
                fontWeight: 500,
                maxWidth: "150px",
                backgroundColor: "transparent",
                color: "#101828",
              }}
            />
            <div style={{ position: "relative", marginLeft: 8, minWidth: "60px" }}>
              <button
                type="button"
                onClick={() => !disabled && setOpenMinCurrency(!openMinCurrency)}
                disabled={disabled}
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  paddingLeft: 10,
                  paddingRight: 20,
                  backgroundColor: "transparent",
                  cursor: disabled ? "not-allowed" : "pointer",
                  color: "#101828",
                }}
              >
                {currency.value}
              </button>
              <img
                src="/icons/chevron.svg"
                alt=""
                style={{
                  position: "absolute",
                  right: "2px",
                  top: "50%",
                  transform: openMinCurrency ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                  width: 16,
                  height: 16,
                  pointerEvents: "none",
                  transition: "transform 0.2s",
                }}
              />
              {openMinCurrency && !disabled && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    minWidth: "80px",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E9EAEB",
                    borderRadius: 8,
                    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                    zIndex: 10,
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {currency.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleSelectCurrency(option, true)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "none",
                        backgroundColor: currency.value === option ? "#F3F4F6" : "#FFFFFF",
                        color: "#101828",
                        fontSize: 14,
                        fontWeight: 500,
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = currency.value === option ? "#F3F4F6" : "#FFFFFF")
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              width: "260px",
              display: "flex",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 8,
              border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
              fontSize: 14,
              color: "#101828",
              backgroundColor: disabled ? "#F9FAFB" : "#FFFFFF",
              boxSizing: "border-box",
            }}
          >
            <span style={{ marginRight: 8, color: "rgba(113, 118, 128, 1)" }}>₱</span>
            <input
              type="text"
              value={maxSalary.value}
              onChange={(e) => maxSalary.onChange(e.target.value)}
              placeholder="Max. Salary"
              disabled={disabled}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 14,
                fontWeight: 500,
                maxWidth: "150px",
                backgroundColor: "transparent",
                color: "#101828",
              }}
            />
            <div style={{ position: "relative", marginLeft: 8, minWidth: "60px" }}>
              <button
                type="button"
                onClick={() => !disabled && setOpenMaxCurrency(!openMaxCurrency)}
                disabled={disabled}
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  paddingLeft: 10,
                  paddingRight: 20,
                  backgroundColor: "transparent",
                  cursor: disabled ? "not-allowed" : "pointer",
                  color: "#101828",
                }}
              >
                {currency.value}
              </button>
              <img
                src="/icons/chevron.svg"
                alt=""
                style={{
                  position: "absolute",
                  right: "2px",
                  top: "50%",
                  transform: openMaxCurrency ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                  width: 16,
                  height: 16,
                  pointerEvents: "none",
                  transition: "transform 0.2s",
                }}
              />
              {openMaxCurrency && !disabled && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    minWidth: "80px",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E9EAEB",
                    borderRadius: 8,
                    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                    zIndex: 10,
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {currency.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleSelectCurrency(option, false)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "none",
                        backgroundColor: currency.value === option ? "#F3F4F6" : "#FFFFFF",
                        color: "#101828",
                        fontSize: 14,
                        fontWeight: 500,
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = currency.value === option ? "#F3F4F6" : "#FFFFFF")
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {error && (
          <p
            style={{
              marginTop: 4,
              marginBottom: 0,
              fontSize: 12,
              color: "#F04438",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

// Employment Type with Duration Field
export type EmploymentTypeInputFieldProps = {
  label: string;
  required?: boolean;
  employmentType: { value: string; onChange: (value: string) => void; options: string[] };
  duration: { value: string; onChange: (value: string) => void; options?: string[] };
  durationUnit?: { value: string; onChange: (value: string) => void; options: string[] };
  disabled?: boolean;
  error?: string;
};

export const EmploymentTypeInputField: React.FC<EmploymentTypeInputFieldProps> = ({
  label,
  required,
  employmentType,
  duration,
  durationUnit,
  disabled = false,
  error,
}) => {
  const [openEmploymentType, setOpenEmploymentType] = React.useState(false);
  const [openDurationUnit, setOpenDurationUnit] = React.useState(false);

  const handleSelectEmploymentType = (value: string) => {
    employmentType.onChange(value);
    setOpenEmploymentType(false);
  };

  const handleSelectDurationUnit = (value: string) => {
    if (durationUnit) {
      durationUnit.onChange(value);
    }
    setOpenDurationUnit(false);
  };

  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: "#F8F9FC",
        padding: 8,
      }}
    >
      <label
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "#344054",
          display: "block",
          marginBottom: 8,
          padding: "4px 12px",
        }}
      >
        {label}
        {required && <span style={{ color: "#D92D20" }}>*</span>}
      </label>
      <div
        style={{
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9EAEB",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: "0 0 260px", position: "relative" }}>
            <button
              type="button"
              onClick={() => !disabled && setOpenEmploymentType(!openEmploymentType)}
              disabled={disabled}
              style={{
                width: "100%",
                padding: "10px 14px",
                paddingRight: "40px",
                borderRadius: 8,
                border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
                fontSize: 14,
                color: employmentType.value ? "#101828" : "#9CA3AF",
                fontWeight: 500,
                outline: "none",
                backgroundColor: disabled ? "#F9FAFB" : "#FFFFFF",
                cursor: disabled ? "not-allowed" : "pointer",
                textAlign: "left",
              }}
            >
              {employmentType.value || "Choose"}
            </button>
            <img
              src="/icons/chevron.svg"
              alt=""
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: openEmploymentType ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                width: 16,
                height: 16,
                pointerEvents: "none",
                transition: "transform 0.2s",
              }}
            />
            {openEmploymentType && !disabled && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  width: "100%",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: 8,
                  boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                  zIndex: 10,
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {employmentType.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectEmploymentType(option)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      backgroundColor: employmentType.value === option ? "#F3F4F6" : "#FFFFFF",
                      color: "#101828",
                      fontSize: 14,
                      fontWeight: 500,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = employmentType.value === option ? "#F3F4F6" : "#FFFFFF")
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: "0 0 260px", position: "relative" }}>
            {employmentType.value === "Contract" && durationUnit ? (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: error ? "1px solid #F04438" : "1px solid #E9EAEB",
                  fontSize: 14,
                  color: "#101828",
                  backgroundColor: disabled ? "#F9FAFB" : "#FFFFFF",
                  boxSizing: "border-box",
                }}
              >
                <input
                  type="text"
                  value={duration.value}
                  onChange={(e) => duration.onChange(e.target.value)}
                  placeholder="Duration"
                  disabled={disabled}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    fontSize: 14,
                    fontWeight: 500,
                    maxWidth: "150px",
                    backgroundColor: "transparent",
                    color: "#101828",
                  }}
                />
                <div style={{ position: "relative", marginLeft: 8, minWidth: "80px" }}>
                  <button
                    type="button"
                    onClick={() => !disabled && setOpenDurationUnit(!openDurationUnit)}
                    disabled={disabled}
                    style={{
                      border: "none",
                      outline: "none",
                      fontSize: 14,
                      fontWeight: 500,
                      paddingLeft: 10,
                      paddingRight: 20,
                      backgroundColor: "transparent",
                      cursor: disabled ? "not-allowed" : "pointer",
                      color: "#101828",
                    }}
                  >
                    {durationUnit.value}
                  </button>
                  <img
                    src="/icons/chevron.svg"
                    alt=""
                    style={{
                      position: "absolute",
                      right: "2px",
                      top: "50%",
                      transform: openDurationUnit ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                      width: 16,
                      height: 16,
                      pointerEvents: "none",
                      transition: "transform 0.2s",
                    }}
                  />
                  {openDurationUnit && !disabled && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        minWidth: "100px",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E9EAEB",
                        borderRadius: 8,
                        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                        zIndex: 10,
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                      {durationUnit.options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleSelectDurationUnit(option)}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            border: "none",
                            backgroundColor: durationUnit.value === option ? "#F3F4F6" : "#FFFFFF",
                            color: "#101828",
                            fontSize: 14,
                            fontWeight: 500,
                            textAlign: "left",
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = durationUnit.value === option ? "#F3F4F6" : "#FFFFFF")
                          }
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {error && (
          <p
            style={{
              marginTop: 4,
              marginBottom: 0,
              fontSize: 12,
              color: "#F04438",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
