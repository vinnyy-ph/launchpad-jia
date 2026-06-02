"use client"
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import { validateEmail } from "../Utils";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import countryCodeList from "../../../public/country-codes.json";
import Fuse from "fuse.js";
import React from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { COMPANY_SIZE_OPTIONS, REASON_FOR_INQUIRY_OPTIONS, MONTHLY_HIRING_VOLUME_OPTIONS } from "../utils/constants";
import { useLazyLoad } from "../hooks/useLazyLoad";
import HireJiaForm from "../components/HireJiaForm/HireJiaForm";

const sourceOfInquiryOptions = [
    { name: "Search Engine (Google, Bing, etc.)" },
    { name: "Social Media (LinkedIn, Facebook, etc.)" },
    { name: "Referral / Word of Mouth" },
    { name: "Industry Event / Conference" },
    { name: "Blog / Article / Publication" },
    { name: "Others" },
];

export default function ContactUsForm() {
  const searchParams = useSearchParams();
  const reasonForInquiry = searchParams.get("reasonForInquiry");
  const [countryCode, setCountryCode] = useState({dial_code: "+63", name: "Philippines", code: "PH"});
  const [formData, setFormData] = useState({
    email: "",
    message: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    companyName: "",
    companySize: "",
    companyPosition: "",
    monthlyHiringVolume: "",
    recruiterCount: "",
    reasonForInquiry: "",
    sourceOfInquiry: "",
    customSourceOfInquiry: "",
    subscribeToNewsletter: false,
  });
  const [formError, setFormError] = useState({
    email: "",
    message: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    companyName: "",
    companyPosition: "",
    companySize: "",
    monthlyHiringVolume: "",
    recruiterCount: "",
    reasonForInquiry: "",
    sourceOfInquiry: "",
    customSourceOfInquiry: "",
  });
  const [countryCodes, setCountryCodes] = useState([]);
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  const [searchCountryCode, setSearchCountryCode] = useState("");

  const { elementRef: contactUsHeaderRef, isVisible: isContactUsHeaderVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: contactUsSubheaderRef, isVisible: isContactUsSubheaderVisible } = useLazyLoad({ delay: 800 });
  const { elementRef: contactUsFormContainerRef, isVisible: isContactUsFormContainerVisible } = useLazyLoad({ delay: 2000 });
  const { elementRef: contactUsStar1Ref, isVisible: isContactUsStar1Visible } = useLazyLoad({ delay: 600 });
  const { elementRef: contactUsStar2Ref, isVisible: isContactUsStar2Visible } = useLazyLoad({ delay: 600 });
  const { elementRef: contactUsStar3Ref, isVisible: isContactUsStar3Visible } = useLazyLoad({ delay: 600 });
  const { elementRef: contactUsStar4Ref, isVisible: isContactUsStar4Visible } = useLazyLoad({ delay: 600 });

  useEffect(() => {
    if (reasonForInquiry) {
      const reason = reasonForInquiry.replaceAll("_", " ");
      setFormData({ ...formData, reasonForInquiry: reason });
    }
  }, [reasonForInquiry]);

  useEffect(() => {
    if (countryCodeList.countryCodes) {
      setCountryCodes(countryCodeList.countryCodes);
    }
  }, []);

  const fuseOptions = {
    keys: ["name", "dial_code"],
    threshold: 0.3,
  };

  const filteredCountryCodes = React.useMemo(() => {
    if (!searchCountryCode) return countryCodeList.countryCodes;
    const fuse = new Fuse(countryCodes, fuseOptions);
    return fuse.search(searchCountryCode).map((result) => result.item);
  }, [countryCodes, searchCountryCode]);

    const handleSubmitInquiry = async () => {
        let hasError = false;
        let error: any = {};
        if (!validateEmail(formData.email) || !formData.email?.trim()) {
          error.email = "Please enter a valid email address";
          hasError = true;
        }
    
        if (!formData.message?.trim()) {
          error.message = "Please enter a message";
          hasError = true;
        }

        if (!formData.firstName?.trim()) {
          error.firstName = "Please enter a first name";
          hasError = true;
        }

        if (!formData.lastName?.trim()) {
          error.lastName = "Please enter a last name";
          hasError = true;
        }

        if (!formData.phoneNumber?.trim()) {
          error.phoneNumber = "Please enter a valid phone number";
          hasError = true;
        }
        
        if (!formData.companyName?.trim()) {
          error.companyName = "Please enter a company name";
          hasError = true;
        }
        
        if (!formData.companyPosition?.trim()) {
          error.companyPosition = "Please enter a company position";
          hasError = true;
        }

        if (!formData.companySize?.trim()) {
          error.companySize = "Please select a company size";
          hasError = true;
        }

        if (!formData.monthlyHiringVolume?.trim()) {
          error.monthlyHiringVolume = "Please select a monthly hiring volume";
          hasError = true;
        }

        if (formData.recruiterCount === "" || isNaN(parseInt(formData.recruiterCount))) {
          error.recruiterCount = "Please enter number of recruiters";
          hasError = true;
        }
        
        if (!formData.reasonForInquiry?.trim()) {
          error.reasonForInquiry = "Please select a reason for inquiry";
          hasError = true;
        }
        
        if (!formData.sourceOfInquiry?.trim()) {
          error.sourceOfInquiry = "Please select a source of inquiry";
          hasError = true;
        }

        if (formData.sourceOfInquiry === "Others" && !formData.customSourceOfInquiry?.trim()) {
          error.customSourceOfInquiry = "Please specify the source of inquiry";
          hasError = true;
        }
        
    
        if (hasError) {
          setFormError(error);
          return;
        }
    
        try {
          Swal.fire({
            title: "Submitting inquiry...",
            text: "Please wait while we submit your inquiry...",
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
              Swal.showLoading();
            },
          });
  
          await axios.post("/api/add-inquiry", {
            email: formData.email,
            message: formData.message,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: countryCode.dial_code + formData.phoneNumber,
            companyName: formData.companyName,
            companySize: formData.companySize,
            monthlyHiringVolume: formData.monthlyHiringVolume,
            companyPosition: formData.companyPosition,
            recruiterCount: parseInt(formData.recruiterCount),
            reasonForInquiry: formData.reasonForInquiry,
            sourceOfInquiry: formData.sourceOfInquiry,
            customSourceOfInquiry: formData.customSourceOfInquiry,
            subscribeToNewsletter: formData.subscribeToNewsletter,
          })
          triggerConversionEvent();
          Swal.close();
          Swal.fire({
            title: "Success",
            text: "Your inquiry has been submitted. We will get back to you as soon as possible.",
            icon: "success",
            confirmButtonText: "OK",
          });
          const initialFormData = {
            email: "",
            message: "",
            firstName: "",
            lastName: "",
            phoneNumber: "",
            companyName: "",
            companySize: "",
            companyPosition: "",
            monthlyHiringVolume: "",
            recruiterCount: "",
            reasonForInquiry: "",
            sourceOfInquiry: "",
            customSourceOfInquiry: "",
            subscribeToNewsletter: false,
          };
          setFormData(initialFormData);
          setFormError(initialFormData);
          setSearchCountryCode("");
        } catch (error) {
          console.error(error);
          Swal.fire({
            title: "Error",
            text: "Something went wrong. Please try again.",
            icon: "error",
          });
        }
    }

    const triggerConversionEvent = () => {
      try {
        if (typeof window !== 'undefined' && (window as any)?.gtag) {
          (window as any)?.gtag?.('event', 'conversion', {'send_to': 'AW-17523605644/K-I_CIjD5ZEbEIyB9KNB'});
        }
      } catch (error) {
        console.error(error);
      }
    }
    return (
        <section 
        id="contact-us"
        className="contact-us-section"
      >
        <div className="contact-us-container">
        <div 
        ref={contactUsStar1Ref}
        className="star-1-icon"
        style={{ opacity: isContactUsStar1Visible ? 1 : 0, transform: isContactUsStar1Visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
         <Image src="/big-blue-star.svg" alt="Jia Star" width={40} height={40} className="star-1-icon" />
         </div>
         <div 
         ref={contactUsStar2Ref} 
         className="star-2-icon"
         style={{ opacity: isContactUsStar2Visible ? 1 : 0, transform: isContactUsStar2Visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
         <Image src="/big-blue-star.svg" alt="Jia Star" width={40} height={40} className="star-2-icon" />
         </div>
         <div 
         ref={contactUsStar3Ref} 
         className="star-3-icon"
         style={{ opacity: isContactUsStar3Visible ? 1 : 0, transform: isContactUsStar3Visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
         <Image src="/big-blue-star.svg" alt="Jia Star" width={40} height={40} className="star-3-icon" />
         </div>
         <div 
         ref={contactUsStar4Ref} 
         className="star-4-icon"
         style={{ opacity: isContactUsStar4Visible ? 1 : 0, transform: isContactUsStar4Visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
         <Image src="/big-blue-star.svg" alt="Jia Star" width={40} height={40} className="star-4-icon" />
         </div>
          <div className="contact-us-form-container">
          <h1 
          className="header"
          ref={contactUsHeaderRef}
          style={{
            opacity: isContactUsHeaderVisible ? 1 : 0,
            transform: isContactUsHeaderVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
          >
            Talk to Us
          </h1>
          <span 
          ref={contactUsSubheaderRef}
          style={{
            opacity: isContactUsSubheaderVisible ? 1 : 0,
            transform: isContactUsSubheaderVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
          className="description"
          >
            Got inquiries about Jia or our company? Fill out this form and we’ll get back to you within 24 hours.
          </span>
          {/* <div 
          ref={contactUsFormContainerRef}
          style={{ 
            opacity: isContactUsFormContainerVisible ? 1 : 0,
            transform: isContactUsFormContainerVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            width: "100%",
            }}
          >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", alignItems: "flex-start" }}>
          <div className="name-form-row">
            <div className="name-form-column">
                <span>First Name</span>
                <input 
                type="test" 
                placeholder="Enter first name" 
                className="form-control search-input"
                style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #E0E0E0",
                }}
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
                {formError.firstName && <p style={{ color: "red", fontSize: 12 }}>{formError.firstName}</p>}
            </div>
            <div className="name-form-column">
                <span>Last Name</span>
                <input 
                type="test" 
                placeholder="Enter last name" 
                className="form-control search-input"
                style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #E0E0E0",
                }}
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
                {formError.lastName && <p style={{ color: "red", fontSize: 12 }}>{formError.lastName}</p>}
            </div>
        </div>
          <span>Work Email</span>
          <input 
          type="email" 
          placeholder="Enter work email" 
          className="form-control search-input"
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #E0E0E0",
          }}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          {formError.email && <p style={{ color: "red", fontSize: 12 }}>{formError.email}</p>}
          <span>Phone Number</span>
          <div style={{ position: "relative", width: "100%" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#181D27",
              fontSize: "16px",
              cursor: "pointer",
              border: "none",
              backgroundColor: "transparent",
              maxWidth: "90px",
              width: "100%",
              height: "100%",
            }}
            onClick={() => setShowCountryCodeDropdown(!showCountryCodeDropdown)}
          >
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5 }}>
            {countryCode.code}
            <i className="las la-chevron-down"></i>
            </div>
            {countryCode.dial_code}
          </div>
          <div
            className={`dropdown-menu w-100 mt-1 org-dropdown-anim${
              showCountryCodeDropdown ? " show" : ""
            }`}
            style={{
              padding: "10px",
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            <div className="table-search-bar" style={{ width: "100%" }}>
              <div className="icon mr-2">
                  <i className="la la-search"></i>
              </div>
              <input
                type="text"
                className="form-control search-input"
                placeholder="Search country code"
                value={searchCountryCode}
                onChange={(e) => setSearchCountryCode(e.target.value)}
              />
            </div>
            {filteredCountryCodes.map((c, index) => (
              <div className="dropdown-item d-flex align-items-center" key={index} onClick={() => {
                setCountryCode(c);
                setShowCountryCodeDropdown(false);
              }}>
                {c.name} {c.dial_code}
              </div>
            ))}
          </div>
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: "110px" }}
            placeholder="000 000 0000"
            min={0}
            value={formData.phoneNumber}
            onChange={(e) => {
              setFormData({ ...formData, phoneNumber: e.target.value });
            }}
          />
          </div>
          {formError.phoneNumber && <p style={{ color: "red", fontSize: 12 }}>{formError.phoneNumber}</p>}
          <span>Company Name</span>
          <input 
          type="email" 
          placeholder="Enter company name" 
          className="form-control search-input"
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #E0E0E0",
          }}
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          />
          {formError.companyName && <p style={{ color: "red", fontSize: 12 }}>{formError.companyName}</p>}
          <span>Company Position</span>
          <input 
          type="email" 
          placeholder="Enter company position" 
          className="form-control search-input"
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #E0E0E0",
          }}
          value={formData.companyPosition}
          onChange={(e) => setFormData({ ...formData, companyPosition: e.target.value })}
          />
          {formError.companyPosition && <p style={{ color: "red", fontSize: 12 }}>{formError.companyPosition}</p>}
          <span>Company Size</span>
          <CustomDropdown
          placeholder="Select company size"
          onSelectSetting={(setting) => setFormData({ ...formData, companySize: setting })}
          screeningSetting={formData.companySize}
          settingList={COMPANY_SIZE_OPTIONS}
          />
          {formError.companySize && <p style={{ color: "red", fontSize: 12 }}>{formError.companySize}</p>}
          <span>Monthly Hiring Volume</span>
          <CustomDropdown
          placeholder="Select monthly hiring volume"
          onSelectSetting={(setting) => setFormData({ ...formData, monthlyHiringVolume: setting })}
          screeningSetting={formData.monthlyHiringVolume}
          settingList={MONTHLY_HIRING_VOLUME_OPTIONS}
          />
          {formError.monthlyHiringVolume && <p style={{ color: "red", fontSize: 12 }}>{formError.monthlyHiringVolume}</p>}
          <span>How many recruiters do you have right now?</span>
          <input 
          type="number" 
          placeholder="Enter number of recruiters" 
          className="form-control search-input"
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #E0E0E0",
          }}
          min={0}
          value={formData.recruiterCount}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "" || (value.match(/^\d+$/) && parseInt(value) >= 0)) {
              setFormData({ ...formData, recruiterCount: value });
            }
          }}
          />
          {formError.recruiterCount && <p style={{ color: "red", fontSize: 12 }}>{formError.recruiterCount}</p>}
          <span>Reason for inquiry</span>
          <CustomDropdown
          placeholder="Select reason"
          onSelectSetting={(setting) => setFormData({ ...formData, reasonForInquiry: setting })}
          screeningSetting={formData.reasonForInquiry}
          settingList={REASON_FOR_INQUIRY_OPTIONS}
          />
          {formError.reasonForInquiry && <p style={{ color: "red", fontSize: 12 }}>{formError.reasonForInquiry}</p>}
          <span>Message</span>
          <textarea
          placeholder="message"
          className="form-control"
          style={{
            maxHeight: "200px",
            width: "100%",
            padding: "10px",
            border: "1px solid #E0E0E0",
          }}
          maxLength={500}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          />
          {formError.message && <p style={{ color: "red", fontSize: 12 }}>{formError.message}</p>}
          <span>How did you hear about us?</span>
          <CustomDropdown
          placeholder="Select an option"
          onSelectSetting={(setting) => setFormData({ ...formData, sourceOfInquiry: setting })}
          screeningSetting={formData.sourceOfInquiry}
          settingList={sourceOfInquiryOptions}
          />
          {formError.sourceOfInquiry && <p style={{ color: "red", fontSize: 12 }}>{formError.sourceOfInquiry}</p>}
          {formData.sourceOfInquiry === "Others" && (
            <>
            <span>Please specify source of inquiry</span>
            <input
              type="text"
              className="form-control"
              placeholder="Please specify"
              value={formData.customSourceOfInquiry}
              onChange={(e) => setFormData({ ...formData, customSourceOfInquiry: e.target.value })}
            />
            {formError.customSourceOfInquiry && <p style={{ color: "red", fontSize: 12 }}>{formError.customSourceOfInquiry}</p>}
            </>
          )}
          </div>


          <div style={{ display: "flex", width: "100%", flexDirection: "row", alignItems: "flex-start", justifyContent: "flex-start", gap: 10, marginTop: 20 }}>
            <input type="checkbox" style={{ width: 20, height: 20 }} checked={formData.subscribeToNewsletter} onChange={(e) => setFormData({ ...formData, subscribeToNewsletter: e.target.checked })} />
            <span className="privacy-policy-text">Yes, I’d like to receive helpful resources like tutorials, templates and the latest hiring advice, as well as invitations to Jia events. (You can opt out any time). View our <span style={{ color: "#007AFF", cursor: "pointer" }} onClick={() => window.open("/privacy-policy", "_blank")}>privacy policy</span>.</span>
          </div>
          </div>
          <button
          id="submit-button"
          style={{
              marginTop: 16,
              textAlign: "center",
              width: "240px",
              height: "40px",
              backgroundColor: "black",
              color: "white",
              padding: "5px 10px",
              borderRadius: "60px",
              textDecoration: "none",
            }}
            onClick={handleSubmitInquiry}
          >
            Submit
          </button> */}
          </div>
          <div 
          ref={contactUsFormContainerRef}
          style={{
            opacity: isContactUsFormContainerVisible ? 1 : 0,
            transform: isContactUsFormContainerVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            width: "100%", 
            height: "100%", 
            position: "relative" 
          }}>
            <HireJiaForm />
          </div>
        </div>
      </section>
    )
}