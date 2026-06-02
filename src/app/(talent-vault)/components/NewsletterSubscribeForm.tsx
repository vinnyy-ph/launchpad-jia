"use client";

import { useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { validateEmail } from "../../../lib/Utils";
import Button from "./base/Button";

export function NewsletterSubscribeForm() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleSubscribeNewsletter = async () => {
    if (!validateEmail(email) || !email?.trim()) {
      setEmailError("Please enter a valid email address");
      return;
    } else {
      setEmailError("");
    }

    try {
      Swal.showLoading();
      await axios.post("/api/add-inquiry", { email, reasonForInquiry: "Subscribe to newsletter" });
      Swal.close();
      Swal.fire({
        title: "Success",
        text: "You have been subscribed to our newsletter. Thank you for subscribing!",
        icon: "success",
        confirmButtonText: "OK",
      });
      setEmail("");
      setEmailError("");
    } catch (error) {
      console.error(error);
      Swal.close();
      Swal.fire({
        title: "Error",
        text: "Something went wrong. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  }

  return (
    <div className="tv-newsletter-subscribe-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div className="tv-newsletter-subscribe-form">
        <div className="tv-newsletter-subscribe-form--input">
          <i className="la la-envelope"></i>
          <input 
            type="email" 
            placeholder="Enter your email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button variant="primary" onClick={handleSubscribeNewsletter}>
          Subscribe
        </Button>
      </div>
      {emailError && <span style={{ color: "red", fontSize: 12 }}>{emailError}</span>}
    </div>
  )
}