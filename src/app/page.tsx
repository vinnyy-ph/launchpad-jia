"use client"
import Image from "next/image";
import Footer from "@/lib/PageComponent/Footer";
import HomeNavBar from "@/lib/PageComponent/HomeNavBar";
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { validateEmail } from "../lib/Utils";
import { useLazyLoad } from "@/lib/hooks/useLazyLoad";
import { useParallax } from "react-scroll-parallax";
import { useVisibilityHook } from "../lib/hooks/useVisibilityHook";
import ContactUsForm from "../lib/PageComponent/ContactUsForm";
import Lottie from 'lottie-react';
import hireFasterAnimation from '../../public/hire-faster.json';
import reduceCostsAnimation from '../../public/cut-costs.json';
import meetJiaAnimation from '../../public/meet-jia.json';
import { useMobileMenu } from "@/lib/hooks/useMobileMenu";

const palette = {
    primaryText: "black",
    gradientCard: "linear-gradient(180deg, #F5F5F5 0%, #FFFFFF 100%)",
    cardShadow: "0px 0px 24px 0px rgba(149, 37, 201, 0.08)",
    accentPurple: "#9525C9",
};

const faqs = [
  {
    question: "What exactly does Jia do?",
    answer: "<p>Jia is an AI-powered recruitment assistant. It screens CVs, conducts interviews, and generates structured insights on candidate competency. Instead of juggling schedules, repetitive phone screens, and scattered notes, you get transcripts, scores, and recommendations in one place.</p>",
  },
  {
    question: "Is the AI interview really conversational, or just a recording tool?",
    answer: `
     <p>Unlike older platforms that only record candidate answers, Jia acts like a real interviewer. It:</p>

     <ul>
      <li>Listens, challenges, and probes responses</li>
      <li>Follows up when answers are vague, exaggerated, or suspicious</li>
      <li>Detects inconsistencies and asks for concrete examples</li>
     </ul>
     
     <p>This conversational depth reveals whether a candidate is truly prepared or bluffing—giving you <strong>10x more insight</strong> than one-way video submissions.</p>
    `
  },
  {
    question: "How does Jia save me time and costs?",
    answer: `
    <p>Jia automates the repetitive front-end of hiring:</p>
    <ul>
      <li>CV matching against your job description</li>
      <li>First-round AI interviews available 24/7</li>
      <li>Instant scoring and report generation</li>
      <li>Sending of emails to candidates</li>
    </ul>
    <p>This cuts admin time, lowers cost per hire, and speeds up your hiring cycle.</p>
    `
  },
  {
    question: "Will I still have control over the hiring process?",
    answer:`
    <p>Yes. You define the job requirements and questions. Jia runs standardized interviews, but the final decision is always yours. You can:</p>
    <ul>
      <li>Review transcripts and video recording</li>
      <li>Override or adjust AI suggestions</li>
      <li>Set auto-rules (e.g., drop or promote candidates based on score thresholds)</li>
    </ul>
    `
  },
  {
    question: "How accurate and unbiased is Jia AI?",
    answer: `<p>Jia applies consistent structured questioning to every applicant, reducing human bias. Instead of gut feel, you get measurable, data-driven insights that support fairer hiring decisions.</p>`
  },
  {
    question: "Can candidates cheat or game the system?",
    answer: `
    <p>Guardrails are in place to protect integrity:</p>
    <ul>
      <li>Jia won’t reveal answers or hints</li>
      <li>Suspicious responses trigger follow-ups</li>
      <li>Video recordings are attached for your review</li>
    </ul>
    `
  },
  {
    question: "What if a candidate prefers a live interview?",
    answer: `<p>Jia is best for the first screening stage. After reviewing insights, you can still invite shortlisted candidates for your own live or panel interviews. Most clients cut total interview hours by half without losing candidate experience.</p>`
  },
  {
    question: "What other value can I get from Jia aside from AI interviews and automation?",
    answer: `
    <p>Jia also functions as a <strong>modern, built-in Applicant Tracking System (ATS)</strong> with a clean, recruiter-friendly UI/UX. It helps you:</p>
    <ul>
      <li>Automate candidate communication (emails, reminders, notifications)</li>
      <li>Organize job postings and requirements in one place</li>
      <li>Manage your candidate database with easy search and tracking</li>
      <li>Create custom pipelines and hiring flows for a tailored process</li>
    </ul>
    <p>This makes Jia not just an AI screener, but a full end-to-end recruitment platform.</p>
    `
  },
  {
    question: "What industries or roles is Jia best for?",
    answer: `
    <p>Jia works across industries. It's especially valuable for:</p>
    <ul>
      <li> <strong>Tech & BPO</strong> - high-volume, structured roles</li>
      <li> <strong>Startups & SMEs</strong> - lean teams that need to hire fast</li>
      <li> <strong>Enterprises</strong> - roles where fairness, compliance, and scale are critical</li>
    </ul>
    `
  },
  {
    question: "How much does it cost?",
    answer: `<p>Pricing is flexible based on usage and active job slots. <strong>Book a demo</strong> to get a tailored plan that matches your hiring needs.</p>`
  },
  {
    question: "Is my data secure?",
    answer: `<p>Yes. Jia is built on secure cloud infrastructure. Candidate data, transcripts, and reports are encrypted and accessible only to authorized team members, fully compliant with data privacy laws.</p>`
  },
  {
    question: "How fast can I start using Jia?",
    answer: `<p>Most recruiters are up and running the same day. Once onboarded, you can post jobs, share interview links, and receive candidate insights almost instantly.</p>`
  },
  {
    question: "What kind of support do you provide?",
    answer: `<p>All clients receive email and help-center support. Corporate and enterprise clients also get priority support, with 24/7 coverage available for enterprise plans.</p>`
  },
  {
    question: "How do I get started?",
    answer: `<p>Click <strong>“Book a Demo”</strong> and our sales team will reach out within 24 hours to walk you through Jia’s platform and tailor a plan for your organization.</p>`
  }
]

const parallaxOptions = {
  speed: -10,
}

const features = [
  {
    title: "Smart CV Screener",
    description: "Jia instantly benchmarks CVs against your job description, giving you a clear <span class='text-bold'>“fit score”</span> and ranking candidates from <span class='career-fit bad-fit'>Bad Fit</span> to <span class='career-fit strong-fit'>Strong Fit</span>.",
    styles: {
      backgroundColor: "rgba(240, 249, 255, 0.4)",
      border: "1px solid rgba(224, 242, 254, 1)"
    }
  },
  {
    title: "AI Interview",
    description: "Jia conducts <span class='text-bold'>dynamic, bias-free AI interviews</span> that probe deeper, challenge vague answers, and deliver scored transcripts.",
    styles: {
      backgroundColor: "rgba(253, 242, 250, 0.4)",
      border: "1px solid rgba(252, 231, 246, 1)"
    }
  },
  {
    title: "Modern ATS",
    description: "Jia's built-in ATS <span class='text-bold'>organizes pipelines, automates notifications, and tracks candidates</span> seamlessly. Unlocking more time for what truly matters: <span class='text-bold'>choosing the right hire</span>.",
    styles: {
      backgroundColor: "rgba(255, 246, 237, 0.4)",
      border: "1px solid rgba(255, 234, 213, 1)"
    }
  }
]

const tabs = ["Bad Fit", "Maybe Fit", "Good Fit", "Strong Fit"]

const candidateAnalysisFits ={
  "Bad Fit": {
    transcript: "/bad-fit-transcript.svg",
    score: "/bad-fit-score.svg"
  },
  "Maybe Fit": {
    transcript: "/maybe-fit-transcript.svg",
    score: "/maybe-fit-score.svg"
  },
  "Good Fit": {
    transcript: "/good-fit-transcript.svg",
    score: "/good-fit-score.svg"
  },
  "Strong Fit": {
    transcript: "/strong-fit-transcript.svg",
    score: "/strong-fit-score.svg"
  }
}

const testimonialCards = [
  {
    rating: 5,
    feedback: "It was amazing! I love how Jia was able to talk through what I was talking about and how she was able to keep asking me relevant questions without sounding like an AI. It was great!",
    interviewDetails: {
      name: "Billy Joe",
      jobTitle: "Software Engineer",
    }
  },
  {
    rating: 5,
    feedback: "I did not feel any pressure at all when Jia asked me those questions. I did not experience any negative technicalities during the interview and it was very smooth and Jia even motivated or uplifted me based on my responses.",
    interviewDetails: {
      name: "Joriz",
      jobTitle: "Marketing Intern",
    }
  },
  {
    rating: 5,
    feedback: "I really enjoyed this new type of interview. It was a quick and easy kind of setup which can serve as a practice interview before having to communicate with a human interviewer.",
    interviewDetails: {
      name: "Julia",
      jobTitle: "HR Intern",
    }
  },
  {
    rating: 5,
    feedback: "The AI interview was smooth and well-structured. The questions covered both technical and behavioral areas, and the flow felt natural and engaging. Overall, a valuable and modern interview experience.",
    interviewDetails: {
      name: "Lysander",
      jobTitle: "WhiteCloak Launchpad Trainees",
    }
  }
]

const ChevronDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 8L10 13L15 8" stroke="#A4A7AE" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 12L10 7L5 12" stroke="#A4A7AE" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const testimonialCardStyles = [
  {
    backgroundColor: "#F4F3FF66",
    border: "1px solid #EBE9FE",
    iconBg: "#F4F3FF",
    iconColor: "#D9D6FE"
  },
  {
    backgroundColor: "#FDF2FA66",
    border: "1px solid #FCE7F6",
    iconBg: "#FDF2FA",
    iconColor: "#FCCEEE"
  },
  {
    backgroundColor: "#FFF6ED66",
    border: "1px solid #FFEAD5",
    iconBg: "#FFF6ED",
    iconColor: "#FDDCAB"
  },
  {
    backgroundColor: "#F0F9FF66",
    border: "1px solid #E0F2FE",
    iconBg: "#EFF8FF",
    iconColor: "#B2DDFF"
  }
]

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [testimonials, setTestimonials] = useState([]);
  const [faqAccordionIndex, setFaqAccordionIndex] = useState<number>(0);
  const [displayLearnMoreModal, setDisplayLearnMoreModal] = useState<null | string>(null);
  const { isStickyMobileMenu } = useMobileMenu();

  // Lazy load hooks for each section
  const { elementRef: heroRef, isVisible: isHeroVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: logoRef, isVisible: isLogoVisible } = useLazyLoad({ delay: 200 });
  const { elementRef: subheaderRef, isVisible: isSubheaderVisible } = useLazyLoad({ delay: 400 });
  const { elementRef: subheader2Ref, isVisible: isSubheader2Visible } = useLazyLoad({ delay: 600 });
  const { elementRef: demoButtonRef, isVisible: isDemoButtonVisible } = useLazyLoad({ delay: 600 });
  const { elementRef: imagesContainerRef, isVisible: isImagesContainerVisible } = useLazyLoad({ delay: 600 });
  const { elementRef: interviewScoreRef, isVisible: isInterviewScoreVisible } = useLazyLoad({ delay: 20500 });
  const { elementRef: interviewScoreMetricsRef, isVisible: isInterviewScoreMetricsVisible } = useLazyLoad({ delay: 21000 });
  
  // Feature list section
  const { elementRef: featureListHeaderRef, isVisible: isFeatureListHeaderVisible } = useLazyLoad({ delay: 0, stagger: true, staggerDelay: 200 });
  const { elementRef: featureListContainerRef, isVisible: isFeatureListContainerVisible } = useLazyLoad({ delay: 200, stagger: true, staggerDelay: 200 });

  const { elementRef: hireFasterTitleRef, isVisible: isHireFasterTitleVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: hireFasterSpeedRef, isVisible: isHireFasterSpeedVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: hireFasterDescriptionRef, isVisible: isHireFasterDescriptionVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: hireFasterImageContainerRef, isVisible: isHireFasterImageContainerVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: hireFasterTextContainerRef, isVisible: isHireFasterTextContainerVisible } = useLazyLoad({ delay: 800, stagger: true, staggerDelay: 200 });


  const { elementRef: cutCostTitleRef, isVisible: isCutCostTitleVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: cutCostEfficiencyRef, isVisible: isCutCostEfficiencyVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: cutCostDescriptionRef, isVisible: isCutCostDescriptionVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: cutCostImageContainerRef, isVisible: isCutCostImageContainerVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: cutCostTextContainerRef, isVisible: isCutCostTextContainerVisible } = useLazyLoad({ delay: 800, stagger: true, staggerDelay: 200 });

  const { elementRef: ensureFairnessTitleRef, isVisible: isEnsureFairnessTitleVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: ensureFairnessNeutralityRef, isVisible: isEnsureFairnessNeutralityVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: ensureFairnessTabBarRef, isVisible: isEnsureFairnessTabBarVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: ensureFairnessDescriptionRef, isVisible: isEnsureFairnessDescriptionVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: ensureFairnessImageContainerRef, isVisible: isEnsureFairnessImageContainerVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: ensureFairnessTextContainerRef, isVisible: isEnsureFairnessTextContainerVisible } = useLazyLoad({ delay: 800, stagger: true, staggerDelay: 200 });

  const { elementRef: betterDecisionsTitleRef, isVisible: isBetterDecisionsTitleVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: betterDecisionsInsightsRef, isVisible: isBetterDecisionsInsightsVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: betterDecisionsDescriptionRef, isVisible: isBetterDecisionsDescriptionVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });
  const { elementRef: betterDecisionsImageContainerRef, isVisible: isBetterDecisionsImageContainerVisible } = useLazyLoad({ delay: 600, stagger: true, staggerDelay: 200 });

  // Design principles section
  const { elementRef: designPrinciplesHeaderRef, isVisible: isDesignPrinciplesHeaderVisible } = useLazyLoad({ delay: 200 });
  const { elementRef: designPrinciplesSubHeaderRef, isVisible: isDesignPrinciplesSubHeaderVisible } = useLazyLoad({ delay: 400 });
  
  const { elementRef: empowerRecruitersStarIconRef, isVisible: isEmpowerRecruitersStarIconVisible } = useLazyLoad({ delay: 2000 });
  const { elementRef: empowerRecruitersHeaderRef, isVisible: isEmpowerRecruitersHeaderVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: empowerRecruitersSubheaderRef, isVisible: isEmpowerRecruitersSubheaderVisible } = useLazyLoad({ delay: 800 });
  const { elementRef: empowerRecruitersDescriptionRef, isVisible: isEmpowerRecruitersDescriptionVisible } = useLazyLoad({ delay: 2000 });
  
  const { elementRef: obsessedWithRecruitersStarIconRef, isVisible: isObsessedWithRecruitersStarIconVisible } = useLazyLoad({ delay: 2000 });
  const { elementRef: obsessedWithRecruitersHeaderRef, isVisible: isObsessedWithRecruitersHeaderVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: obsessedWithRecruitersSubheaderRef, isVisible: isObsessedWithRecruitersSubheaderVisible } = useLazyLoad({ delay: 800 });
  const { elementRef: obsessedWithRecruitersDescriptionRef, isVisible: isObsessedWithRecruitersDescriptionVisible } = useLazyLoad({ delay: 2000 });

  const { elementRef: outcomeDrivenStarIconRef, isVisible: isOutcomeDrivenStarIconVisible } = useLazyLoad({ delay: 2000 });
  const { elementRef: outcomeDrivenHeaderRef, isVisible: isOutcomeDrivenHeaderVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: outcomeDrivenSubheaderRef, isVisible: isOutcomeDrivenSubheaderVisible } = useLazyLoad({ delay: 600 });
  const { elementRef: outcomeDrivenDescriptionRef, isVisible: isOutcomeDrivenDescriptionVisible } = useLazyLoad({ delay: 2000 });

  const { elementRef: designPrinciplesStar1Ref, isVisible: isDesignPrinciplesStar1Visible } = useLazyLoad({ delay: 600 });
  const { elementRef: designPrinciplesStar2Ref, isVisible: isDesignPrinciplesStar2Visible } = useLazyLoad({ delay: 1200 });
  const { elementRef: designPrinciplesStar3Ref, isVisible: isDesignPrinciplesStar3Visible } = useLazyLoad({ delay: 1800 });
  const { elementRef: designPrinciplesFooterRef, isVisible: isDesignPrinciplesFooterVisible } = useLazyLoad({ delay: 2000 });

  const { elementRef: testimonialHeaderRef, isVisible: isTestimonialHeaderVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: testimonialSubheaderRef, isVisible: isTestimonialSubheaderVisible } = useLazyLoad({ delay: 800 });
  const { elementRef: testimonialCardsContainerRef, isVisible: isTestimonialCardsContainerVisible } = useLazyLoad({ delay: 2000 });

  const { elementRef: faqHeaderRef, isVisible: isFaqHeaderVisible } = useLazyLoad({ delay: 0 });
  const { elementRef: faqSubheaderRef, isVisible: isFaqSubheaderVisible } = useLazyLoad({ delay: 800 });
  const { elementRef: faqAccordionContainerRef, isVisible: isFaqAccordionContainerVisible } = useLazyLoad({ delay: 2000 });


  const sphere1ParallaxRef = useParallax<HTMLImageElement>(parallaxOptions);
  const sphere2ParallaxRef = useParallax<HTMLImageElement>(parallaxOptions);

  useEffect(() => {
     if (typeof window !== "undefined" && window.location.hash) {
      const id = window.location.hash.replace("#", "");
      const el = document.getElementById(id);
      
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, []);


  useEffect(() => {
    const fetchTestimonials = async () => {
      const response = await axios.get("/api/get-testimonials");
      setTestimonials([...testimonialCards, ...response.data]);
    }
    fetchTestimonials();
  }, []);

  useEffect(() => {
    let clicked = 0;
    let slider;
    let img;
    let w;
    let h;
    let subtitle;

    function initComparisons() {
      let x;
      let i;
      const image2 = document.getElementById("before-jia-image");
      if (image2) {
        const subtitle = document.createElement("div");
        subtitle.className = "image-slider-text";
        subtitle.innerHTML = "Before Jia";
        image2.appendChild(subtitle);
      }

      const image1 = document.getElementById("after-jia-image");
      if (image1) {
        const subtitle = document.createElement("div");
        subtitle.id = "after-jia-subtitle";
        subtitle.className = "image-slider-text";
        subtitle.innerHTML = "After Jia";
        image1.appendChild(subtitle);
      }

      /*find all elements with an "overlay" class:*/
      x = document.getElementsByClassName("image-comp-overlay");
      for (i = 0; i < x.length; i++) {
        /*once for each "overlay" element:
        pass the "overlay" element as a parameter when executing the compareImages function:*/
        compareImages(x[i]);
      }
    }

    function compareImages(imgElement) {
      img = imgElement;
      /*get the width and height of the img element*/
      w = img.offsetWidth;
      h = img.offsetHeight;
      /*set the width of the img element to 50%:*/
      img.style.width = (w / 2) + "px";
      /*create slider:*/
      slider = document.createElement("DIV");
      slider.setAttribute("class", "image-comp-slider");

      /*get reference to the subtitle element*/
      subtitle = document.getElementById("after-jia-subtitle");
      if (subtitle) {
        subtitle.style.width = (w / 2) + "px";
        // Move to other side of center of image
        subtitle.style.left = (w / 2) + (slider.offsetWidth / 2) + "px";
      }
      /*create left arrow*/
      const leftArrow = document.createElement("img");
      leftArrow.src = "/chevron-left.svg";
      leftArrow.setAttribute("class", "slider-arrow right-arrow");
      slider.appendChild(leftArrow);
      /*create right arrow*/
      const rightArrow = document.createElement("img");
      rightArrow.src = "/chevron-right.svg";
      rightArrow.setAttribute("class", "slider-arrow left-arrow");
      slider.appendChild(rightArrow);
      /*insert slider*/
      img.parentElement.insertBefore(slider, img);
      /*position the slider in the middle:*/
      slider.style.top = (h / 2) - (slider.offsetHeight / 2) + "px";
      slider.style.left = (w / 2) - (slider.offsetWidth / 2) + "px";
    }

    function slideReady(e) {
      /*prevent any other actions that may occur when moving over the image:*/
      e.preventDefault();
      /*the slider is now clicked and ready to move:*/
      clicked = 1;
    }

    function getCursorPos(e) {
      var a, x = 0;
      e = (e.changedTouches) ? e.changedTouches[0] : e;
      /*get the x positions of the image:*/
      a = img.getBoundingClientRect();
      /*calculate the cursor's x coordinate, relative to the image:*/
      x = e.clientX - a.left;
      /*account for any CSS zoom (combine all zoom levels):*/
      let totalZoom = 1;
      
      // Check html element zoom
      const htmlZoom = parseFloat(window.getComputedStyle(document.documentElement).zoom || '1');
      totalZoom *= htmlZoom;

      const homePageZoom = parseFloat(window.getComputedStyle(document.getElementsByClassName("homepage-wrapper")?.[0]).zoom || '1');
      totalZoom *= homePageZoom;
      
      // Check parent element zoom
      const parent = document.getElementsByClassName("strengths-section")?.[0];
      if (parent) {
        const parentZoom = parseFloat(window.getComputedStyle(parent).zoom || '1');
        totalZoom *= parentZoom;
      }
      
      // Adjust position for combined zoom
      if (totalZoom !== 1) {
        x = x / totalZoom;
      }
      return x;
    }
    function slide(x) {
      /*resize the image:*/
      img.style.width = x + "px";
      /*resize the subtitle to take remaining width:*/
      if (subtitle) {
        subtitle.style.width = (w - x) + "px";
        subtitle.style.left = x + "px";
      }
      /*position the slider:*/
      slider.style.left = img.offsetWidth - (slider.offsetWidth / 2) + "px";
    }

    function slideMove(e) {
      var pos;
      /*if the slider is no longer clicked, exit this function:*/
      if (clicked == 0) return false;
      /*get the cursor's x position:*/
      pos = getCursorPos(e)
      /*prevent the slider from being positioned outside the image:*/
      if (pos < 0) pos = 0;
      if (pos > w) pos = w;
      /*execute a function that will resize the overlay image according to the cursor:*/
      slide(pos);
    }
    function slideFinish() {
      /*the slider is no longer clicked:*/
      clicked = 0;
    }
    initComparisons();


    if (slider) {
      /*execute a function when the mouse button is pressed:*/
      slider.addEventListener("mousedown", slideReady);
      /*or touched (for touch screens:*/
      slider.addEventListener("touchstart", slideReady);
    }
    /*and released (for touch screens:*/
    window.addEventListener("touchend", slideFinish);
    /*and another function when the mouse button is released:*/
    window.addEventListener("mouseup", slideFinish);
    /*execute a function when the slider is moved:*/
    window.addEventListener("mousemove", slideMove);
    window.addEventListener("touchmove", slideMove);
    return () => {
      window.removeEventListener("touchend", slideFinish);
      window.removeEventListener("mouseup", slideFinish);
      window.removeEventListener("mousemove", slideMove);
      window.removeEventListener("touchmove", slideMove);
      if (slider) {
        slider.removeEventListener("mousedown", slideReady);
        slider.removeEventListener("touchstart", slideReady);
      }
    }
  }, []);

  useEffect(() => {
    let ticking = false;
    let currentState = ''; // Track current state to prevent unnecessary class changes
    
    const handleStrengthsSectionScroll = () => {
      // Disable on mobile/tablet
      if (window.innerWidth <= 850) {
        return;
      }

      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateStrengthsSectionScroll();
          ticking = false;
        });
        ticking = true;
      }
    }

    const updateStrengthsSectionScroll = () => {
      const wrapper = document.getElementById("strengths-section-wrapper");
      const strengthsSection = document.getElementById("strengths");
      
      if (!wrapper || !strengthsSection) return;

      const contentContainers = strengthsSection.querySelectorAll(".strengths-content-container");
      const numContainers = contentContainers.length;
      
      if (numContainers === 0) return;

      const windowYOffset = window.pageYOffset;
      const wrapperTop = wrapper.offsetTop;
      const windowHeight = window.innerHeight;
      const wrapperHeight = wrapper.offsetHeight;
      
      // More predictable scroll ranges with fixed offsets instead of percentages
      const scrollStart = wrapperTop - windowHeight * 1.2; // Start sticky earlier for smoother transition
      const scrollEnd = wrapperTop + wrapperHeight - windowHeight * 2.95; // End sticky later
      
      // Add hysteresis (different thresholds for entering vs leaving) to prevent flickering
      const hysteresis = 50; // 50px buffer zone
      
      // Determine new state
      let newState = currentState;
      
      if (windowYOffset >= scrollEnd + hysteresis) {
        newState = 'bottom';
      } else if (windowYOffset < scrollEnd - hysteresis && windowYOffset >= scrollStart + hysteresis) {
        newState = 'sticky';
      } else if (windowYOffset < scrollStart - hysteresis) {
        newState = 'top';
      }
      
      // Only update if state actually changed
      if (newState !== currentState) {
        let previousState = currentState;
        currentState = newState;
        
        if (currentState === 'bottom') {
          // After scrolling through all containers - unfix and show last container
          strengthsSection.classList.add("post-sticky");
          strengthsSection.classList.remove("sticky");
          strengthsSection.classList.remove("post-sticky-top");
          strengthsSection.scrollTop = strengthsSection.scrollHeight;
        } else if (currentState === 'sticky') {
          // In the sticky zone - fix the section and progress through containers
          strengthsSection.classList.remove("post-sticky-top");
          strengthsSection.classList.remove("post-sticky");
          strengthsSection.classList.add("sticky");

          if (previousState === 'bottom') {
            strengthsSection.scrollTop = scrollEnd;
            if (windowYOffset > scrollEnd - window.innerHeight) {
              window.scrollTo({
                top: scrollEnd - window.innerHeight,
                behavior: "smooth",
              });
            }
          } else if (previousState === 'top') {
            strengthsSection.scrollTop = 0;
          }
        } else {
          // Before entering the section - unfix and show first container
          strengthsSection.classList.add("post-sticky-top");
          strengthsSection.classList.remove("sticky");
          strengthsSection.classList.remove("post-sticky");
          
          // Reset to top
          strengthsSection.scrollTop = 0;
        }
      }
    }

    handleStrengthsSectionScroll();

    window.addEventListener("scroll", handleStrengthsSectionScroll, { passive: true });
    window.addEventListener("resize", handleStrengthsSectionScroll);

    return () => {
      window.removeEventListener("scroll", handleStrengthsSectionScroll);
      window.removeEventListener("resize", handleStrengthsSectionScroll);
    };
    
  }, []);

  useEffect(() => {
    let ticking = false;
    
    const handleFeatureListScroll = () => {
      // Disable on mobile/tablet
      if (window.innerWidth <= 850) {
        return;
      }
      
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateFeatureScroll();
          ticking = false;
        });
        ticking = true;
      }
    }
    
    const updateFeatureScroll = () => {
      const featureListWrapper = document.getElementById("features-wrapper");
      const featureListContainer = document.getElementById("features");
      const featureListContent = featureListContainer?.querySelector(".feature-list-container") as HTMLElement;
      
      if (!featureListWrapper || !featureListContainer || !featureListContent) return;
      
      const windowYOffset = window.pageYOffset;
      const wrapperTop = featureListWrapper.offsetTop;
      const wrapperHeight = featureListWrapper.offsetHeight;
      const windowHeight = window.innerHeight;
      
      const contentWidth = featureListContent.scrollWidth;
      const containerWidth = featureListContainer.offsetWidth;
      const maxScroll = contentWidth - containerWidth;
      
      const scrollStart = wrapperTop - windowHeight * 0.2;
      const scrollEnd = wrapperTop + wrapperHeight - windowHeight * 2.2;
      
      // Add small threshold to prevent flickering between states
      const threshold = 50;
      
      if (windowYOffset >= scrollEnd + threshold) {

        featureListContainer.classList.add("post-sticky");
        featureListContainer.classList.remove("sticky");
        // Keep the last frame visible
        featureListContent.style.transform = `translateX(-${maxScroll}px)`;
      } else if (windowYOffset >= scrollStart - threshold && windowYOffset < scrollEnd + threshold) {
        featureListContainer.classList.remove("post-sticky");
        featureListContainer.classList.add("sticky");
        
        const scrollProgress = Math.max(0, Math.min(1, (windowYOffset - scrollStart) / (scrollEnd - scrollStart)));
        
        const translateX = scrollProgress * maxScroll;
        featureListContent.style.transform = `translateX(-${translateX}px)`;
      } else {
        featureListContainer.classList.remove("post-sticky");
        featureListContainer.classList.remove("sticky");
        featureListContent.style.transform = `translateX(0)`;
      }
    }
    
    // Initial call
    handleFeatureListScroll();
    
    window.addEventListener("scroll", handleFeatureListScroll, { passive: true });
    window.addEventListener("resize", handleFeatureListScroll);
    
    return () => {
      window.removeEventListener("scroll", handleFeatureListScroll);
      window.removeEventListener("resize", handleFeatureListScroll);
    };
  }, []);

  const handleSubmitNewsletter = async () => {
    if (!validateEmail(email) || !email?.trim()) {
      setEmailError("Please enter a valid email address");
      return;
    } else {
      setEmailError("");
    }

    try {
      Swal.fire({
        title: "Subscribing to newsletter...",
        text: "Please wait while we subscribe you to our newsletter...",
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading();
        },
      });
      await axios.post("/api/add-newsletter-subscriber", { email });
      Swal.close();
      Swal.fire({
        title: "Success",
        text: "You have been subscribed to our newsletter. Thank you for subscribing!",
        icon: "success",
        confirmButtonText: "OK",
      })
      setEmail("");
      setEmailError("");
    } catch (error) {
      console.error(error);
      Swal.fire({
        title: "Error",
        text: "Something went wrong. Please try again.",
        icon: "error",
      })
    }
  }


    return (
      <div className="homepage-wrapper">
        <main className="homepage-main">
            <div className="homepage-container">
            <HomeNavBar isStickyMobileMenu={isStickyMobileMenu} />
            <div className="homepage-section-1">
            <section
              id="about"
              className="fade-in-hero"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "80px 0px 80px",
                minHeight: 700,
              }}
            >
            <div className="about-us-section">
                <div 
                  ref={heroRef}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                    opacity: isHeroVisible ? 1 : 0,
                    transform: isHeroVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                  }}
                >
                  <h1 className="meet-jia">Meet</h1>
                  <Image
                      className="jia-gradient"
                      src="/jia-gradient.png"
                      alt="Jia Logo"
                      width={164}
                      height={100}
                  />
                </div>
                
                <div 
                  ref={subheaderRef}
                  style={{
                    opacity: isSubheaderVisible ? 1 : 0,
                    transform: isSubheaderVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                  }}
                >
                  <h2 className="subheader">Your AI-Powered Hiring Suite</h2>
                </div>
                
                <div 
                  ref={subheader2Ref}
                  style={{
                    opacity: isSubheader2Visible ? 1 : 0,
                    transform: isSubheader2Visible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                  }}
                >
                  <h2 className="subheader-2">Modernize your hiring process with cutting-edge AI. Automate pre-screening and <br/>candidate communication in real-time. Eliminate manual tracking and generate<br/> real-time insights for faster and better hiring.</h2>
                </div>
                
                <div
                  ref={demoButtonRef}
                  style={{
                    opacity: isDemoButtonVisible ? 1 : 0,
                    transform: isDemoButtonVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                  }}
                  className="request-demo-btn"
                  onClick={() => {
                    window.location.href = "/?reasonForInquiry=Book_a_Demo#contact-us";
                  }}
                >
                  Book a Demo
                  <i className="la la-arrow-right" style={{ fontSize: 16, marginLeft: 8 }}></i>
                </div>
                
                <div 
                  ref={imagesContainerRef}
                  className="images-container"
                  style={{
                    opacity: isImagesContainerVisible ? 1 : 0,
                    transform: isImagesContainerVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                  }}
                >
                <Image
                    src="/sphere.png"
                    alt="Sphere"
                    width={100}
                    height={100}
                    className="sphere-1"
                    ref={sphere1ParallaxRef.ref}
                />
                <div
                ref={interviewScoreRef}
                style={{
                  opacity: isInterviewScoreVisible ? 1 : 0,
                  transform: isInterviewScoreVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                }}
                className="interview-score-container"
                >
                <Image src="/interview-score.svg" alt="Interview Score" width={232} height={232} className="interview-score" />
                </div>
                <div
                ref={interviewScoreMetricsRef}
                style={{
                  opacity: isInterviewScoreMetricsVisible ? 1 : 0,
                  transform: isInterviewScoreMetricsVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                }}
                className="interview-score-metrics-container"
                >
                <Image src="/interview-score-metrics.svg" alt="Interview Score Metrics" width={232} height={232} className="interview-score-metrics" />
                </div>
                <Lottie
                  animationData={meetJiaAnimation}
                  loop={false}
                  className="meet-jia-animation"
                />
                <Image
                    src="/sphere.png"
                    alt="Sphere"
                    width={230}
                    height={230}
                    ref={sphere2ParallaxRef.ref}
                    className="sphere-2"
                />
                </div>
            </div>
        </section>
        </div>
        </div>
        <div id="features-wrapper" className="features-wrapper">
          <section 
            id="features"
            className="features-section"
          >
          <div 
            ref={featureListHeaderRef}
            className="lazy-load-stagger"
            style={{
              opacity: isFeatureListHeaderVisible ? 1 : 0,
              transform: isFeatureListHeaderVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            }}
          >
            <h1 className="header">Jia is an <span style={{ background: "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>end-to-end hiring tool</span> <br /> for recruiters that combines:</h1>
          </div>
          <Image src="/small-star.svg" alt="Jia Star" width={40} height={40} className="star-1-icon" />
          <Image src="/small-star.svg" alt="Jia Star" width={40} height={40} className="star-2-icon" />
          <Image src="/big-star.svg" alt="Jia Star" width={40} height={40} className="star-3-icon" />

          <div
          id="feature-list-container"
          className="feature-list-container"
          ref={featureListContainerRef}
          style={{
            opacity: isFeatureListContainerVisible ? 1 : 0,
            transform: isFeatureListContainerVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
          >
            {features.map((feature, index) => (
              <div key={index} style={{ display: "flex", flexDirection: "row", alignItems: "center", position: "relative" }}>
                <div className="feature-list-item" 
                style={{ 
                  background: feature.styles.backgroundColor,
                  border: feature.styles.border
                  }}>
                  <h3>{feature.title}</h3>
                  <p dangerouslySetInnerHTML={{ __html: feature.description }}></p>
                  <div className="learn-more-btn" onClick={() => {
                    setDisplayLearnMoreModal(feature.title);
                  }}>Learn More <i className="la la-arrow-right"></i></div>
                </div>
                {index !== features.length - 1 && <Image src="/dashed-arrow-right.svg" alt="Dashed Arrow Right" width={91} height={48} className="arrow-icon" />}
              </div>
            ))}
          </div>
          </section>
        </div>

        <div id="strengths-section-wrapper" className="strengths-section-wrapper">
          <section id="strengths" className="strengths-section">
            <div className="strengths-content-container" data-section-index="0" style={{ background: "linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)" }}>
            <div className="strengths-container">
              <div 
              ref={hireFasterSpeedRef}
              style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                border: "1px solid #B2DDFF", 
                backgroundColor: "#EFF8FF", 
                borderRadius: "32px", 
                padding: "10px 20px", 
                fontSize: 24, 
                fontWeight: 700, color: "#175CD3", opacity: isHireFasterSpeedVisible ? 1 : 0, 
                transform: isHireFasterSpeedVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' 
                }}>
                Speed up your Hiring Cycle
              </div>
              <h1 
              ref={hireFasterTitleRef}
              className="header"
              style={{ 
                opacity: isHireFasterTitleVisible ? 1 : 0, 
                transform: isHireFasterTitleVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' 
              }}>
                Reduce Time-to-Hire by <span style={{ color: "#175CD3" }}>80%</span>
              </h1>
              <span 
              ref={hireFasterDescriptionRef}
              style={{ opacity: isHireFasterDescriptionVisible ? 1 : 0, 
              transform: isHireFasterDescriptionVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
              className="description">
                {"Jia's AI interviewer eliminates the bottleneck of manual scheduling. With asynchronous and on-demand screening, you can move top talent through your hiring pipeline instantly—no more back-and-forth emails for the first interview. Our Job Interview Assistant features ensure you never miss a great candidate due to scheduling constraints."}
              </span>

              <div className="strength-image-container">
              <div
                ref={hireFasterImageContainerRef}
                style={{ 
                  opacity: isHireFasterImageContainerVisible ? 1 : 0, 
                transform: isHireFasterImageContainerVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              }}
              className="hire-faster-lottie-animation-wrapper"
              >
              <Lottie
                animationData={hireFasterAnimation} 
                loop={true}
                className="lottie-animation"
              />
              </div>
              <div className="strength-image-gradient" />
              <div 
              ref={hireFasterTextContainerRef}
              className="text-container"
              style={{ opacity: isHireFasterTextContainerVisible ? 1 : 0, 
              transform: isHireFasterTextContainerVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
                <span className="header">Up to</span>
                <span className="bold-header">40% faster</span>
                <span className="header">time to shortlist*</span>
                <span className="subheader">*As seen in our early pilot</span>
              </div>
              </div>
            </div>
            </div>

            <div className="strengths-content-container" data-section-index="1" style={{ background: "linear-gradient(180deg, #F4F3FF 0%, #FEF6FB 100%)" }}>
            <div className="strengths-container">
              <div 
              ref={cutCostEfficiencyRef}
              style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                border: "1px solid #D9D6FE", 
                backgroundColor: "#F4F3FF", 
                borderRadius: "32px", 
                padding: "10px 20px", 
                fontSize: 24, 
                fontWeight: 700, color: "#5925DC", opacity: isCutCostEfficiencyVisible ? 1 : 0, 
                transform: isCutCostEfficiencyVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
                Efficiency in Recruitment
              </div>
              <h1 
              ref={cutCostTitleRef}
              className="header"
              style={{ opacity: isCutCostTitleVisible ? 1 : 0, 
              transform: isCutCostTitleVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
                Reduce <span style={{ color: "#5925DC" }}>Cost-Per-Hire</span></h1>
              <span 
              ref={cutCostDescriptionRef}
              style={{ opacity: isCutCostDescriptionVisible ? 1 : 0, 
              transform: isCutCostDescriptionVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
              className="description">
                {"Stop wasting hours on manual screening. Jia's AI Hiring automates up to 80% of initial candidate screening, allowing your team to focus exclusively on top-tier talent. Streamline your recruitment process and eliminate the bottleneck of early-stage evaluations using our advanced AI resume reader and parser."}</span>

              <div className="strength-image-container reverse-column">
              <div 
              ref={cutCostTextContainerRef}
              className="text-container align-right"
              style={{ 
                opacity: isCutCostTextContainerVisible ? 1 : 0, 
              transform: isCutCostTextContainerVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' 
              }}>
                <span className="header">Up to</span>
                <span className="bold-header">5 to 10 <br /> hrs saved</span>
                <span className="header">saved by each recruiter every week*</span>
                <span className="subheader">*As seen in our early pilot</span>
              </div>
              <div className="strength-image-gradient" />
              <div 
              ref={cutCostImageContainerRef}
              style={{ 
                opacity: isCutCostImageContainerVisible ? 1 : 0, 
              transform: isCutCostImageContainerVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              }}
              className="reduce-costs-lottie-animation-wrapper"
              >
              <Lottie 
                animationData={reduceCostsAnimation} 
                loop={true}
                className="lottie-animation"
              />
              </div>
              </div>
            </div>
            </div>

            <div className="strengths-content-container" data-section-index="2" style={{ background: "linear-gradient(180deg, #FEF6FB 0%, #FFFAF5 100%)" }}>
            <div className="strengths-container">
            <div
            ref={ensureFairnessNeutralityRef}
            style={{ 
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center", 
              border: "1px solid #FCCEEE", 
              backgroundColor: "#FDF2FA", 
              borderRadius: "32px", 
              padding: "10px 20px", 
              fontSize: 24, fontWeight: 700, color: "#C11574", opacity: isEnsureFairnessNeutralityVisible ? 1 : 0, 
              transform: isEnsureFairnessNeutralityVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
                Ethical & Bias-Free AI Hiring
              </div>
              <h1 
              ref={ensureFairnessTitleRef}
              className="header"
              style={{ opacity: isEnsureFairnessTitleVisible ? 1 : 0, 
              transform: isEnsureFairnessTitleVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
                Ensure <span style={{ color: "#841651" }}>Fairness</span></h1>
              <span 
              ref={ensureFairnessDescriptionRef}
              style={{ opacity: isEnsureFairnessDescriptionVisible ? 1 : 0, 
              transform: isEnsureFairnessDescriptionVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
              className="description">
                {"Build a diverse workforce with standardized AI scoring. Jia's AI job interview assistant uses contextual follow-ups to probe real competencies over surface-level traits. We prioritize ethical AI in HR, delivering consistent, bias-free evaluations to ensure the best talent wins, every time."}
                </span>
                <CandidateAnalysis 
                isEnsureFairnessTabBarVisible={isEnsureFairnessTabBarVisible} 
                ensureFairnessTabBarRef={ensureFairnessTabBarRef} 
                isEnsureFairnessImageContainerVisible={isEnsureFairnessImageContainerVisible} 
                ensureFairnessImageContainerRef={ensureFairnessImageContainerRef} 
                />
            </div>
            </div>

            <div className="strengths-content-container" data-section-index="3" style={{ background: "#FFFAF5" }}>
            <div className="strengths-container">
              <div 
              ref={betterDecisionsInsightsRef}
              style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                border: "1px solid #FDDCAB", 
                backgroundColor: "#FFF6ED", 
                borderRadius: "32px", 
                padding: "10px 20px", 
                fontSize: 24, 
                fontWeight: 700, color: "#C4320A", opacity: isBetterDecisionsInsightsVisible ? 1 : 0, 
                transform: isBetterDecisionsInsightsVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
                Recruitment Insights
              </div>
              <h1 
              ref={betterDecisionsTitleRef}
              className="header"
              style={{ opacity: isBetterDecisionsTitleVisible ? 1 : 0, 
              transform: isBetterDecisionsTitleVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
                Make Better <span style={{ color: "#7E2410" }}>Data-Driven Hiring Decisions</span></h1>
              <span 
              ref={betterDecisionsDescriptionRef}
              style={{ opacity: isBetterDecisionsDescriptionVisible ? 1 : 0, 
              transform: isBetterDecisionsDescriptionVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
              className="description">
                Access instant interview transcripts, automated scoring, and deep candidate insights. Jia as a Job Interview Assistant evaluates both technical and soft skills, ensuring every decision is backed by objective recruitment analytics, not gut feeling.
              </span>

              <div 
              // ref={betterDecisionsImageContainerRef}
              // style={{ opacity: isBetterDecisionsImageContainerVisible ? 1 : 0, 
              // transform: isBetterDecisionsImageContainerVisible ? 'translateY(0)' : 'translateY(20px)', 
              // transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
              className="image-slider-container"
              id="image-slider-container"
              >
              <div id="after-jia-image" className="image-slider-image">
                <Image id="better-decisions-2-image" className="image" src="/better-decisions-2.png" alt="Make Better Decisions" width={1200} height={604} />
              </div>
              <div id="before-jia-image" className="image-slider-image image-comp-overlay">
                <Image id="better-decisions-1-image" className="image" src="/better-decisions-1.png" alt="Make Better Decisions" width={1200} height={604} />
              </div>
              </div>
            </div>
            </div>
          </section>
        </div>

        <section 
          id="design-principles"
          className="design-principles-section"
        >
          <div className="design-principles-header"
          ref={designPrinciplesHeaderRef}
          style={{
            opacity: isDesignPrinciplesHeaderVisible ? 1 : 0,
            transform: isDesignPrinciplesHeaderVisible ? 'translateX(0)' : 'translateX(-40px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
          >
            <h1 className="header">3 Design Principles for Empowered Recruiting</h1>
          </div>
          <div className="design-principles-header"
          ref={designPrinciplesSubHeaderRef}
          style={{
            opacity: isDesignPrinciplesSubHeaderVisible ? 1 : 0,
            transform: isDesignPrinciplesSubHeaderVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
          >
            <span className="subheader">{"Jia's AI Hiring elevates recruiters by automating high-volume tasks like CV screening, initial interviews, and candidate communication. We handle the technical heavy lifting, empowering you to focus on the human side of hiring and make data-driven hires with confidence."}</span>
          </div>

          <div className="design-principles-items-container">
            <div className="design-principles-item">
              <div className="design-principles-item-header">
                <h3 
                className="header"
                ref={empowerRecruitersHeaderRef}
                style={{
                  opacity: isEmpowerRecruitersHeaderVisible ? 1 : 0, 
                  transform: isEmpowerRecruitersHeaderVisible ? 'translateY(0)' : 'translateY(20px)', 
                  transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' 
                }}
                >
                  1. Empower Recruiters,
                  <span 
                    className="header-reveal"
                    style={{
                      animationPlayState: isEmpowerRecruitersHeaderVisible ? 'running' : 'paused'
                    }}
                  ></span>
                </h3>
                <span 
                ref={empowerRecruitersSubheaderRef}
                style={{ 
                  opacity: isEmpowerRecruitersSubheaderVisible ? 1 : 0,
                  transform: isEmpowerRecruitersSubheaderVisible ? 'translateY(0)' : 'translateY(20px)', 
                  transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' 
                }}
                className="subheader"
                >
                  <span className="subheader-hidden">1.</span> Not Replace Them
                  <span 
                    className="header-reveal"
                    style={{
                      animationPlayState: isEmpowerRecruitersSubheaderVisible ? 'running' : 'paused'
                    }}
                  ></span>
                  </span>

                  <div
                ref={empowerRecruitersStarIconRef}
                style={{ 
                  opacity: isEmpowerRecruitersStarIconVisible ? 1 : 0, 
                  transform: isEmpowerRecruitersStarIconVisible ? 'translateY(0)' : 'translateY(20px)', 
                  transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' 
              }}
                >
                <Image src="/jia-star.png" alt="Jia Star" width={40} height={40} className="star-icon-hidden" />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <div
                ref={empowerRecruitersStarIconRef}
                style={{ 
                  opacity: isEmpowerRecruitersStarIconVisible ? 1 : 0, 
                  transform: isEmpowerRecruitersStarIconVisible ? 'translateY(0)' : 'translateY(20px)', 
                  transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' 
              }}
                >
                <Image src="/jia-star.png" alt="Jia Star" width={40} height={40} className="star-icon" />
                </div>
              <p 
              ref={empowerRecruitersDescriptionRef}
              style={{ 
                opacity: isEmpowerRecruitersDescriptionVisible ? 1 : 0,
                transform: isEmpowerRecruitersDescriptionVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' 
              }}
              className="description">
                {"Jia is an AI hiring tool built to elevate hiring teams, not replace them. By automating the most time-consuming parts of the hiring process, Jia provides recruiters the ultimate recruiter productivity tools. Focus on high-level talent acquisition strategy and collaborate with your team using the hiring platform."}
              </p>
              </div>
            </div>

            <div className="design-principles-item right">
              <div className="design-principles-item-header">
                <h3 
                className="header"
                ref={obsessedWithRecruitersHeaderRef}
                style={{ opacity: isObsessedWithRecruitersHeaderVisible ? 1 : 0, 
                transform: isObsessedWithRecruitersHeaderVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                lineHeight: 1.25,
              }}
                >
                  2. Obsessed with Recruiters, 
                  <span className="header-mobile"> Not Rivals</span>
                </h3>
                <span 
                  className="header-reveal reverse"
                  style={{
                    animationPlayState: isObsessedWithRecruitersHeaderVisible ? 'running' : 'paused'
                  }}
                ></span>
                <span 
                ref={obsessedWithRecruitersSubheaderRef}
                style={{ 
                  opacity: isObsessedWithRecruitersSubheaderVisible ? 1 : 0, 
                transform: isObsessedWithRecruitersSubheaderVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              }}
                className="subheader subheader-mobile">
                  <span className="subheader-hidden">2.</span> Not Rivals
                  <span 
                    className="header-reveal reverse"
                    style={{
                      animationPlayState: isObsessedWithRecruitersSubheaderVisible ? 'running' : 'paused'
                    }}
                  ></span>
                </span>

                <div
                ref={obsessedWithRecruitersStarIconRef}
                style={{ opacity: isObsessedWithRecruitersStarIconVisible ? 1 : 0, 
                transform: isObsessedWithRecruitersStarIconVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
                >
                <Image src="/jia-star.png" alt="Jia Star" width={40} height={40} className="star-icon-hidden" />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <div
               ref={obsessedWithRecruitersStarIconRef}
               style={{ opacity: isObsessedWithRecruitersStarIconVisible ? 1 : 0, 
               transform: isObsessedWithRecruitersStarIconVisible ? 'translateY(0)' : 'translateY(20px)', 
               transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
               >
               <Image src="/jia-star.png" alt="Jia Star" width={40} height={40} className="star-icon" />
               </div>
              <p 
              ref={obsessedWithRecruitersDescriptionRef}
              style={{ opacity: isObsessedWithRecruitersDescriptionVisible ? 1 : 0, 
              transform: isObsessedWithRecruitersDescriptionVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
              className="description">
                {"We don't build for the competition; we build for you. By constantly engaging with recruiters, we identify the specific hiring pain points that modern talent acquisition teams face. Our energy is focused on optimizing AI in recruitment to solve real-world frustrations, while maintaining a seamless Candidate Experience automation flow that respects the applicant's time."}
              </p>
              </div>
            </div>

            <div className="design-principles-item middle">
              <div className="design-principles-item-header middle">
                <h3 className="header"
                ref={outcomeDrivenHeaderRef}
                style={{ 
                  opacity: isOutcomeDrivenHeaderVisible ? 1 : 0, 
                transform: isOutcomeDrivenHeaderVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              }}
                >
                3. Outcome-Driven,
                <span 
                    className="header-reveal"
                    style={{
                      animationPlayState: isOutcomeDrivenHeaderVisible ? 'running' : 'paused'
                    }}
                  ></span>
                </h3>
                <span 
                ref={outcomeDrivenSubheaderRef}
                style={{ opacity: isOutcomeDrivenSubheaderVisible ? 1 : 0, 
                transform: isOutcomeDrivenSubheaderVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out', 
              }}
                className="subheader">
                  Never Over-Engineered
                  <span 
                    className="header-reveal downward"
                    style={{
                      animationPlayState: isOutcomeDrivenSubheaderVisible ? 'running' : 'paused'
                    }}
                  ></span>
                </span>
                <div
                ref={outcomeDrivenStarIconRef}
                style={{ opacity: isOutcomeDrivenStarIconVisible ? 1 : 0, 
                transform: isOutcomeDrivenStarIconVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
                >
                <Image src="/jia-star.png" alt="Jia Star" width={40} height={40} className="star-icon" />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <div
                ref={outcomeDrivenStarIconRef}
                style={{ opacity: isOutcomeDrivenStarIconVisible ? 1 : 0, 
                transform: isOutcomeDrivenStarIconVisible ? 'translateY(0)' : 'translateY(20px)', 
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
                >
                <Image src="/jia-star.png" alt="Jia Star" width={40} height={40} className="star-icon-hidden" />
              </div>
              <p 
              ref={outcomeDrivenDescriptionRef}
              style={{ 
                opacity: isOutcomeDrivenDescriptionVisible ? 1 : 0, 
              transform: isOutcomeDrivenDescriptionVisible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            }}
              className="description">
                {"Our North Star is recruiter productivity. Every feature of Jia is built for measurable impact—improving your hiring strategy, reducing time-to-hire, and building stronger teams. We don't chase tech trends; we leverage AI in recruitment to deliver defined outcomes."}
              </p>
              </div>
            </div>
          </div>


          <div style={{ display: "flex", flexDirection: "row", gap: 10 }}>
            <div
            ref={designPrinciplesStar1Ref}
            style={{
              opacity: isDesignPrinciplesStar1Visible ? 1 : 0, 
              transform: isDesignPrinciplesStar1Visible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
            >
            <Image src="/jia-star-3.png" alt="Jia Star" width={40} height={40} className="footer-star-icon" />
            </div>
            <div
            ref={designPrinciplesStar2Ref}
            style={{
              opacity: isDesignPrinciplesStar2Visible ? 1 : 0, 
              transform: isDesignPrinciplesStar2Visible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
            >
            <Image src="/jia-star.png" alt="Jia Star" width={40} height={40} className="footer-star-icon" />
            </div>
            <div
            ref={designPrinciplesStar3Ref}
            style={{
              opacity: isDesignPrinciplesStar3Visible ? 1 : 0, 
              transform: isDesignPrinciplesStar3Visible ? 'translateY(0)' : 'translateY(20px)', 
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
            >
            <Image src="/jia-star-2.png" alt="Jia Star" width={40} height={40} className="footer-star-icon" />
            </div>
          </div>

          <div 
          ref={designPrinciplesFooterRef} 
          style={{ 
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            opacity: isDesignPrinciplesFooterVisible ? 1 : 0, 
            transform: isDesignPrinciplesFooterVisible ? 'translateY(0)' : 'translateY(20px)', 
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' 
            }}
          >
          <span className="design-principles-footer">
            Explore our full platform with a free demo. See how Jia's high-volume recruitment software <br/>can slash your time-to-hire. Post jobs, interview faster, and streamline your entire recruitment process with Jia.
          </span>
          <div className="request-demo-btn secondary" onClick={() => {
            window.location.href = "/?reasonForInquiry=Book_a_Demo#contact-us";
          }}>
            Book a Demo
            <i className="la la-arrow-right" style={{ fontSize: 16, marginLeft: 8 }}></i>
          </div>
          </div>
        </section>

        {/* Testimonials */}
      <div
      style={{
        backgroundColor: "#FFFFFF",
        position: "relative",
        zIndex: 1,
      }}
      >
        <section 
          id="testimonials"
          className="testimonials-section"
        >
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            width: "100%",
            position: "relative",
            maxWidth: "1000px",
            overflow: "visible"
          }}>
            <div className="testimonial-header">
              <h1 className="header"
              ref={testimonialHeaderRef}
              style={{
                opacity: isTestimonialHeaderVisible ? 1 : 0,
                transform: isTestimonialHeaderVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
              }}
              >
                What <span style={{ background: "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>candidates</span> are <br/> saying about Jia
              </h1>
              <span 
              ref={testimonialSubheaderRef}
              style={{
                opacity: isTestimonialSubheaderVisible ? 1 : 0,
                transform: isTestimonialSubheaderVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
              }}
              className="subheader">
                Hear how our platform made finding a new job smoother, faster, and more personal for the people who matter most — the candidates.
              </span>
            </div>

            <div 
            ref={testimonialCardsContainerRef}
            style={{ 
              position: "relative", 
              opacity: isTestimonialCardsContainerVisible ? 1 : 0, 
              transition: 'opacity 0.6s ease-out'
              }}
            className="testimonials-wrapper">
              <div className="testimonials-container">
                {/* Render testimonials twice for infinite scroll effect */}
                {testimonials.map((testimonial, index) => {
                  const place = index % 4;
                  const cardStyle = testimonialCardStyles[place];
                  return (
                  <div key={index} 
                  className="testimonial-card"
                  style={{
                    background: cardStyle?.backgroundColor,
                    border: cardStyle?.border
                  }}
                  >
                    <div style={{ display: "flex", flexDirection: "row", gap: 4, marginBottom: 16 }}>
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <img
                          key={starIndex}
                          alt="star-rating"
                          style={{ width: 24, height: 24 }}
                          src={`/icons/${starIndex < parseInt(testimonial?.rating) ? "star-filled" : "star-empty"}.svg`}
                        />
                      ))}
                    </div>
                    <p>{testimonial.feedback}</p>
                    <div className="testimonial-card-footer">
                      <div style={{ display: "flex", alignItems: "center", backgroundColor: cardStyle?.iconBg, border: "1px solid #E0E0E0", borderRadius: 10, width: 48, height: 48, justifyContent: "center" }}>
                        <i className="la la-smile" style={{ fontSize: 32, color: cardStyle?.iconColor }}></i>
                      </div>
                      <div className="testimonial-card-footer-content">
                      <span className="testimonial-card-footer-name">{testimonial.interviewDetails.name}</span>
                      <span className="testimonial-card-footer-position">Applied for {testimonial.interviewDetails.jobTitle}</span>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
            
            </div>
        </section>

        {/* Contact Us */}
        <ContactUsForm />

        {/* FAQs */}
        <section id="faqs" className="faqs-section">
          <h1 className="header"
          ref={faqHeaderRef}
          style={{
            opacity: isFaqHeaderVisible ? 1 : 0,
            transform: isFaqHeaderVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
          >Frequently Asked Questions</h1>
          <span className="description"
          ref={faqSubheaderRef}
          style={{
            opacity: isFaqSubheaderVisible ? 1 : 0,
            transform: isFaqSubheaderVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
          >
            Here are the most common questions we get, all in one place. <br />
            We're here to help you get the most out of Jia.
          </span>

          <div 
          ref={faqAccordionContainerRef}
          style={{
            opacity: isFaqAccordionContainerVisible ? 1 : 0,
            transform: isFaqAccordionContainerVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
          className="faqs-container"
          >
            {faqs.map((faq, index) => (
              <div key={index} className={`faq-card ${faqAccordionIndex === index ? "active" : ""}`} onClick={() => {
                setFaqAccordionIndex(faqAccordionIndex === index ? null : index);
              }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                {faqAccordionIndex === index && <ChevronUpIcon />}
                {faqAccordionIndex !== index && <ChevronDownIcon />}
                <h3 className="faq-question">{faq.question}</h3>
                </div>
                <div
                  style={{
                    maxHeight: faqAccordionIndex === index ? 500 : 0,
                    opacity: faqAccordionIndex === index ? 1 : 0,
                    transition: "max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s linear",
                    overflow: "hidden"
                  }}
                >
                  <div className="faq-answer" dangerouslySetInnerHTML={{ __html: faq.answer }}></div>
                </div>
              </div>
            ))}
          </div>

          <div className="faq-card-footer">
            <div className="faq-card-footer-content">
            <span className="faq-card-footer-header">Still have questions?</span>
            <span className="faq-card-footer-description">Can’t find the answer you’re looking for? Please reach out to our friendly team. ☻</span>
            </div>

            <button className="request-demo-btn">
              Get in touch
              <i className="la la-arrow-right" style={{ marginLeft: 8 }}></i>
            </button>
          </div>
        </section>
        </div>

    </main>
     {/* Footer */}
     <Footer />
     {displayLearnMoreModal && <LearnMoreModal featureTitle={displayLearnMoreModal} setDisplayLearnMoreModal={setDisplayLearnMoreModal} />}
     </div>
    )
}

function LearnMoreModal({ featureTitle, setDisplayLearnMoreModal }: { featureTitle: string, setDisplayLearnMoreModal: (value: null | string) => void }) {
  return (
    <div className="modal-background fade-in-bottom">
      <div className="modal-container">
      <div 
      className="modal-content" 
      style={{ 
        position: "relative",
        overflowY: "auto", 
        maxHeight: "90vh", 
        width: "100%",
        maxWidth: "1200px",
        boxSizing: "border-box",
        background: "#fff", 
        border: `1.5px solid #E9EAEB`, 
        borderRadius: 14, 
        boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
        scrollbarWidth: "none",
        overscrollBehavior: "contain",
        }}
      >
          <div className="modal-body" style={{ padding: 0 }}>
          <button className="modal-close-button" onClick={() => setDisplayLearnMoreModal(null)}>
            <i className="la la-times"></i>
          </button>
            {featureTitle === "Smart CV Screener" && (
              <>
                <div className="learn-more-header">
                  <h3 className="header">{featureTitle}</h3>
                  <span className="subheader">Jia transforms the way recruiters handle resumes. Instead of manually scanning piles of mismatched CVs or relying on keyword searches, Jia instantly benchmarks every candidate against your job description—giving you clear, consistent, and unbiased fit scores in seconds.</span>
                </div>
                <div className="learn-more-section">
                  <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)" }}>
                    <div className="learn-more-container">
                      <h1 className="header">Instant, <br/><span style={{ color: "#175CD3"}}>Context Matching</span></h1>
                      <span className="description">Jia doesn’t just look for buzzwords. It <span className="bold">understands</span> the responsibilities, skills, and context in your job description, then evaluates candidates holistically — <span className="bold">surfacing</span>  <span className="career-fit strong-fit">Strong Fits</span> you might otherwise miss.</span>
                      <Image className="image" src="/context-matching.png" alt="Context Matching" width={1072} height={476} />
                    </div>
                  </div>
                  <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #F4F3FF 0%, #FFF6ED 100%)" }}>
                    <div className="learn-more-container">
                      <h1 className="header">Clear Fit Scores</h1>
                      <span className="description">Every CV is graded into one of four tiers:</span>
                      <span className="description"><span className="career-fit bad-fit">Bad Fit</span> <span className="career-fit maybe-fit">Maybe Fit</span> <span className="career-fit good-fit">Good Fit</span> <span className="career-fit strong-fit">Strong Fit</span></span>
                      <span className="description">This simple, transparent system lets recruiters prioritize at a glance while still seeing the reasoning behind each grade.</span>
                      <Image className="image" src="/fit-scores.png" alt="Clear Fit Scores" width={1072} height={476} />
                    </div>
                  </div>
                  <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)" }}>
                    <div className="learn-more-container">
                      <h1 className="header">Seamless <br/><span style={{ color: "#9E165F"}}>Resume Screening</span></h1>
                      <span className="description">Upload a CV in any format — Jia converts them into a <span className="bold">standardized CV</span> for better viewing. Then, each profile is <span className="bold">instantly compared against the role,</span> cutting hours of manual review into seconds.</span>
                      <Image className="image" src="/screening.png" alt="Seamless Resume Screening" width={1072} height={476} />
                    </div>
                  </div>
                  <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)" }}>
                    <div className="learn-more-container">
                      <h1 className="header">Customizable <br/><span style={{ color: "#C4320A"}}>Weighting</span></h1>
                      <span className="description">Every job is different. Jia lets you emphasize what matters most—whether it’s years of experience, technical certifications, leadership background, or industry expertise. The result: <span className="bold">scoring that reflects your priorities.</span></span>
                      <Image className="image" src="/weighting.png" alt="Customizable Weighting" width={1072} height={476} />
                    </div>
                  </div>
                  <div className="learn-more-content-container" 
                  style={{ background: "linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)", paddingBottom: 0 }}>
                    <div className="learn-more-container">
                      <h1 className="header">Bias-Free, <br/><span style={{ color: "#175CD3"}}>Fairer Shortlisting</span></h1>
                      <span className="description">By focusing on job relevance rather than unconscious human preference, Jia ensures <span className="bold">hidden talent gets noticed.</span></span>
                      <Image className="image" src="/bias-free.png" alt="Bias-Free, Fairer Shortlisting" width={1072} height={476} />
                    </div>
                  </div>
                </div>
                <div className="learn-more-footer">
                <h3><span className="bold">Cut through the noise of mismatched resumes.</span> <br/>Discover how Jia instantly finds your best-fit candidates.</h3>
                <button className="request-demo-btn" onClick={() => {
                  setDisplayLearnMoreModal(null);
                  window.location.href = "/?reasonForInquiry=Book_a_Demo#contact-us";
                }}>
                  Book a Demo
                  <i className="la la-arrow-right" style={{ marginLeft: 8 }}></i>
                </button>
                </div>
              </>
            )}
            {featureTitle === "AI Interview" && (
             <>
             <div className="learn-more-header">
               <h3 className="header">{featureTitle}</h3>
               <span className="subheader">Jia redefines what it means to conduct an AI interview. Unlike platforms that simply record a candidate answering scripted questions, Jia is a true conversational interviewer—smart, contextual, and uncompromisingly fair.</span>
             </div>
             <div className="learn-more-section">
               <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #FFFAF5 0%, #FEF6FB 100%)" }}>
                 <div className="learn-more-container">
                   <h1 className="header">Conversational, <br/><span style={{ color: "#C4320A"}}>Not Scripted</span></h1>
                   <span className="description">Jia listens and adapts in real-time. If a candidate exaggerates, gives vague answers, or presents inconsistencies, <span className="bold">Jia probes further—</span>just like a sharp human interviewer would. No fluff, no free passes. Every response is challenged and explored until the real competency shines through.</span>
                   <Image className="image" src="/conversational.png" alt="Conversational, Not Scripted" width={1072} height={476} />
                 </div>
               </div>
               <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #FEF6FB 0%, #F4F3FF 100%)" }}>
                 <div className="learn-more-container">
                   <h1 className="header">Powered by the <br/><span style={{ color: "#C11574"}}>most advanced AI</span></h1>
                   <span className="description">Backed by OpenAI’s <span className="bold">ChatGPT</span> and always running on the latest model, Jia delivers cutting-edge reasoning and natural dialogue—ensuring candidates experience the gold standard of AI interaction.</span>
                   <Image className="image" src="/powerful-ai.png" alt="Powerful AI" width={1072} height={476} />
                 </div>
               </div>
               <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #F4F3FF 0%, #F5FBFF 100%)" }}>
                 <div className="learn-more-container">
                   <h1 className="header">Human-Like <br/><span style={{ color: "#9E165F"}}>Candidate Experience</span></h1>
                   <span className="description">Candidates don’t feel like they’re talking to a machine. Jia’s tone, pacing, and contextual flow create a <span className="bold">professional yet natural experience.</span> This leaves applicants with a positive impression of your hiring process, strengthening your employer brand.</span>
                   <Image className="image" src="/candidate-experience.svg" alt="Candidate Experience" width={1072} height={476} />
                 </div>
               </div>
               <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)" }}>
                 <div className="learn-more-container">
                   <h1 className="header">Pre-Interview <br/><span style={{ color: "#175CD3"}}>System Checks</span></h1>
                   <span className="description">To keep the process fair, Jia tests everything before the interview begins: <span className="bold">internet stability, microphone clarity, audio output, camera permissions</span> — so candidates are never penalized for technical hiccups.</span>
                   <Image className="image" src="/interview-check.png" alt="Interview Check" width={1072} height={476} />
                 </div>
               </div>
               <div 
               className="learn-more-content-container" 
               style={{ 
                background: `
              #F4F3FF 0%,
                linear-gradient(180deg, #F5FBFF 100%, #F4F3FF 100%),
                linear-gradient(180deg, #F4F3FF 0%, #FEF6FB 100%)
                ` 
                }}
                >
                 <div className="learn-more-container">
                   <h1 className="header">Interview<br/><span style={{ color: "#175CD3"}}>Summaries</span></h1>
                   <span className="description">When the interview ends, candidates instantly receive a <span className="bold">structured summary of the conversation.</span> This builds trust in the process, showing them their answers were accurately captured and fairly considered.</span>
                   <Image className="image" src="/interview-summaries.svg" alt="Interview Summaries" width={1072} height={476} />
                 </div>
               </div>
               <div className="learn-more-content-container" 
               style={{ 
                background: `
                linear-gradient(180deg, #FEF6FB 0%, #FFFAF5 100%),
                linear-gradient(180deg, #F4F3FF 0%, #FEF6FB 100%),
                linear-gradient(180deg, #FFFAF5 0%, #FEF6FB 100%)
                ` 
              }}
               >
                 <div className="learn-more-container">
                   <h1 className="header">Flexible<br/><span style={{ color: "#9E165F"}}>Question Design</span></h1>
                   <span className="description">
                   Employers stay in full control. <span className="bold">Upload your own guide questions,</span> or let Jia generate <span className="bold">context-specific recommendations from your job description.</span> You can even build a pool of your “signature” questions or problems to ensure consistency across hires.
                   </span>
                   <Image className="image" src="/question-design.png" alt="Question Design" width={1072} height={476} />
                 </div>
               </div>
               <div className="learn-more-content-container" 
               style={{ 
                background: `
                linear-gradient(180deg, #FFFAF5 0%, #FEF6FB 100%)
                `,
                paddingBottom: 0 
                }}
                >
                 <div className="learn-more-container">
                   <h1 className="header">Unbiased,<br/><span style={{ color: "#9E165F"}}>Multi-Dimensional Scoring</span></h1>
                   <span className="description">
                   Every interview is scored across key hiring dimensions: <span className="bold">technical, behavioral, analytical,</span> and <span className="bold">communication.</span> Jia delivers objective insights with zero unconscious bias, helping you evaluate candidates holistically and confidently.
                   </span>
                   <Image className="image" src="/dimensional-scoring.png" alt="Dimensional Scoring" width={1072} height={476} />
                 </div>
               </div>
             </div>
             <div className="learn-more-footer">
             <h3>
             <span className="bold">Experience the difference of a true conversational AI interviewer.</span> <br/>See how Jia probes, challenges, and delivers insights you can trust.
             </h3>
             <button className="request-demo-btn" onClick={() => {
               setDisplayLearnMoreModal(null);
               window.location.href = "/?reasonForInquiry=Book_a_Demo#contact-us";
             }}>
               Book a Demo
               <i className="la la-arrow-right" style={{ marginLeft: 8 }}></i>
             </button>
             </div>
            </>
            )}
            {featureTitle === "Modern ATS" && (
              <>
              <div className="learn-more-header">
                <h3 className="header">Modern Applicant Tracking System</h3>
                <span className="subheader">Jia’s built-in Applicant Tracking System (ATS) is designed for speed, clarity, and efficiency. Forget clunky, outdated systems that slow recruiters down—Jia centralizes your entire hiring pipeline in one seamless, intuitive platform.</span>
              </div>
              <div className="learn-more-section">
                <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)" }}>
                  <div className="learn-more-container">
                    <h1 className="header">Organized Pipelines, <br/><span style={{ color: "#175CD3"}}>Clear Progress</span></h1>
                    <span className="description">
                    Move candidates through stages with drag-and-drop ease. From application to offer, <span className="bold">every step is tracked and visible,</span> so nothing falls through the cracks.
                    </span>
                    <Image className="image" src="/organized-pipelines.png" alt="Organized Pipelines, Clear Progress" width={1072} height={476} />
                  </div>
                </div>
                <div className="learn-more-content-container" 
                style={{ 
                  background: `
                  linear-gradient(180deg, #F4F3FF 0%, #FEF6FB 100%),
                  linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)
                  ` 
                }}>
                  <div className="learn-more-container">
                    <h1 className="header">Automation<br/><span style={{ color: "#5925DC"}}>That Saves Hours</span></h1>
                    <span className="description">
                    Jia automatically handles email notifications, interview reminders, and status updates—<span className="bold">freeing recruiters from repetitive admin work</span> and ensuring candidates always know where they stand.
                    </span>
                    <Image className="image" src="/automation.png" alt="Automation That Saves Hours" width={1072} height={476} />
                  </div>
                </div>
                <div className="learn-more-content-container"
                style={{ 
                  background: `
                  linear-gradient(180deg, #FEF6FB 0%, #FFFAF5 100%),
                  linear-gradient(180deg, #F4F3FF 0%, #FEF6FB 100%),
                  linear-gradient(180deg, #FFFAF5 0%, #FEF6FB 100%)
                  ` 
                }}>
                  <div className="learn-more-container">
                    <h1 className="header">Custom Workflows<br/><span style={{ color: "#9E165F"}}>For Every Role</span></h1>
                    <span className="description">
                    Every company hires differently. With Jia, you can create tailored pipelines that <span className="bold">match your hiring flow</span> — whether you’re hiring a developer, a marketer, or a senior executive.
                    </span>
                    <Image className="image" src="/custom-workflow.png" alt="Custom Workflows For Every Role" width={1072} height={476} />
                  </div>
                </div>
                <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #FFFAF5 0%, #F5FBFF 100%)" }}>
                  <div className="learn-more-container">
                    <h1 className="header">Integrated with<br/><span style={{ color: "#C4320A"}}>AI Insights</span></h1>
                    <span className="description">
                    Unlike standalone ATS platforms, Jia doesn’t just track candidates — it <span className="bold">enriches</span> them. <span className="bold">CV scores, interview transcripts,</span> <span className="bold">and competency breakdowns</span> are stored in the same place, ready for comparison and decision-making.
                    </span>
                    <Image className="image" src="/ai-insights.png" alt="AI Insights" width={1072} height={476} />
                  </div>
                </div>
                <div className="learn-more-content-container" style={{ background: "linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)" }}>
                  <div className="learn-more-container">
                    <h1 className="header">Collaborative <span style={{ color: "#175CD3"}}>Hiring</span></h1>
                    <span className="description">Hiring is a team sport. Jia lets managers, recruiters, and stakeholders share notes, review transcripts, and score candidates <span className="bold">together,</span> all within the <span className="bold">same platform.</span></span>
                    <Image className="image" src="/collab-hiring.png" alt="Collaborative Hiring" width={1072} height={476} />
                  </div>
                </div>
                <div className="learn-more-content-container" 
                style={{ 
                  background: `
                  linear-gradient(180deg, #F4F3FF 0%, #FEF6FB 100%),
                  linear-gradient(180deg, #F5FBFF 0%, #F4F3FF 100%)
                  `,
                  paddingBottom: 0
                }}>
                  <div className="learn-more-container">
                    <h1 className="header">Beautifully Designed, <span style={{ color: "#5925DC"}}>For Usability</span></h1>
                    <span className="description">
                    No more clunky legacy interfaces. Jia’s ATS is <span className="bold">modern, intuitive,</span> and <span className="bold">designed with a recruiter’s daily workflow in mind</span> — making adoption easy and productivity natural.
                    </span>
                    <Image className="image" src="/usability.png" alt="Collaborative Hiring" width={1072} height={476} />
                  </div>
                </div>
              </div>
              <div className="learn-more-footer">
              <h3>
              <span className="bold">Don’t settle for clunky tools.</span> See how Jia’s modern ATS transforms your hiring workflow into a seamless experience.
              </h3>
              <button className="request-demo-btn" onClick={() => {
                setDisplayLearnMoreModal(null);
                window.location.href = "/?reasonForInquiry=Book_a_Demo#contact-us";
              }}>
                Book a Demo
                <i className="la la-arrow-right" style={{ marginLeft: 8 }}></i>
              </button>
              </div>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CandidateAnalysis({ isEnsureFairnessTabBarVisible, ensureFairnessTabBarRef, isEnsureFairnessImageContainerVisible, ensureFairnessImageContainerRef }: { isEnsureFairnessTabBarVisible: boolean, ensureFairnessTabBarRef: React.RefObject<HTMLDivElement>, isEnsureFairnessImageContainerVisible: boolean, ensureFairnessImageContainerRef: React.RefObject<HTMLDivElement> }) {
  const [activeTab, setActiveTab] = useState("Bad Fit");
  const [activeAnalysis, setActiveAnalysis] = useState("transcript");

  const candidateAnalysisData = {
    "Bad Fit": {
      candidate: {
        name: "Amara Okafor",
        jobTitle: "Applying for Software Engineer - Fullstack",
        profilePicture: "/bad-fit-avatar.png"
      },
      transcript: {
        jia: `<span className="bold">Jia:</span> “How do you approach learning a new programming language or framework that you haven't worked with before?”</span>`,
        candidate: `<span className="bold">Amara:</span> "I usually just read about the new language or framework  <span className="underline">when I need it</span>. I’ll follow some articles or <span className="underline">skim</span> through documentation, and then I <span className="underline">try to use it directly</span> in my tasks. If it’s too complicated, I’ll <span className="underline">wait</span> until I get <span className="underline">proper training</span> or <span className="underline">guidance</span> from the team."</span>`
      },
      scoringFramework: {
        technical: {
          score: "52%",
          color: "#9FCAED",
          description: "The candidate skims resources and applies them superficially, suggesting limited technical depth and weak self-learning habits.",
          transition: "0s 0.5s ease-in-out, width 0.5s ease-in-out"
        },
        behavioral: {
          score: "52%",
          color: "#CEB6DA",
          description: "Her answer shows a tendency to wait for team guidance, which raises concerns about initiative and ownership.",
          transition: "width 0.5s ease-in-out"
        },
        analytical: {
          score: "50%",
          color: "#EBACC9",
          description: "There is no structured method beyond trial-and-error, which reflects weak problem decomposition.",
          transition: "width 0.5s ease-in-out"
        },
        communication: {
          score: "58%",
          color: "#FCCEC0",
          description: "While the answer is understandable, it is vague and passive, making it less persuasive.",
          transition: "width 0.5s ease-in-out"
        }
      }
    },
    "Maybe Fit": {
      candidate: {
        name: "Dylan Santos",
        jobTitle: "Applying for Software Engineer - Fullstack",
        profilePicture: "/maybe-fit-avatar.png"
      },
      transcript: {
        jia: `<span className="bold">Jia:</span> “How do you approach learning a new programming language or framework that you haven't worked with before?”`,
        candidate: `<span className="bold">Dylan:</span> "Usually I’ll start with the official documentation and some basic tutorials. I’ll try to practice with small projects to get the hang of it. But sometimes I find it hard to go deeper unless I have structured training or guidance from teammates."`
      },
      scoringFramework: {
        technical: {
          score: "68%",
          color: "#9FCAED",
          description: "The candidate shows initiative by using quick-starts and integrating features, but skipping documentation limits technical depth.",
          transition: "width 0.5s ease-in-out"
        },
        behavioral: {
          score: "65%",
          color: "#CEB6DA",
          description: "He demonstrates a willingness to try and adapt, but his effort appears conditional on immediate project needs rather than consistent initiative.",
          transition: "width 0.5s ease-in-out"
        },
        analytical: {
          score: "62%",
          color: "#EBACC9",
          description: "His approach of learning, applying, and adjusting provides some structure, but the lack of rigor suggests a tendency to cut corners.",
          transition: "width 0.5s ease-in-out"
        },
        communication: {
          score: "70%",
          color: "#FCCEC0",
          description: "He describes his process clearly enough, but the explanation lacks detail and completeness.",
          transition: "width 0.5s ease-in-out"
        }
      }
    },
    "Good Fit": {
      candidate: {
        name: "Mei Yu",
        jobTitle: "Applying for Software Engineer - Fullstack",
        profilePicture: "/good-fit-avatar.png"
      },
      transcript: {
        jia: `<span className="bold">Jia:</span> “How do you approach learning a new programming language or framework that you haven't worked with before?”`,
        candidate: `<span className="bold">Mei:</span> "I try to be systematic. First, I’ll go through the official docs, then check out forums or tutorials for extra context. I like to build small side projects to apply what I learn. If I get stuck, I’ll ask teammates for feedback. That way I understand the fundamentals and feel more confident before I use it in a real project."`
      },
      scoringFramework: {
        technical: {
          score: "76%",
          color: "#9FCAED",
          description: "The candidate demonstrates practical learning habits by using tutorials and small tasks, though the approach is less structured than building full projects.",
          transition: "width 0.5s ease-in-out"
        },
        behavioral: {
          score: "74%",
          color: "#CEB6DA",
          description: "She is open to asking teammates for help, showing collaboration, but relies on others more than on self-directed learning.",
          transition: "width 0.5s ease-in-out"
        },
        analytical: {
          score: "72%",
          color: "#EBACC9",
          description: "Her process has a logical sequence, but it appears more reactive than proactive, lacking deeper problem decomposition.",
          transition: "width 0.5s ease-in-out"
        },
        communication: {
          score: "78%",
          color: "#FCCEC0",
          description: "She explains her method clearly and concisely, but the answer lacks depth and does not highlight knowledge sharing.",
          transition: "width 0.5s ease-in-out"
        }
      }
    },
    "Strong Fit": {
      candidate: {
        name: "Gabriel Mendez",
        jobTitle: "Applying for Software Engineer - Fullstack",
        profilePicture: "/strong-fit-avatar.png"
      },
      transcript: {
        jia: `<span className="bold">Jia:</span> “How do you approach learning a new programming language or framework that you haven't worked with before?”`,
        candidate: `<span className="bold">Gabriel:</span> "I usually break it down into stages. I’ll start by understanding the basics from the docs, then do small test projects to apply it. I also take online courses, join community discussions, and look at open-source projects to see how it’s used in practice. I make sure to write down my learnings so I can share with the team."`
      },
      scoringFramework: {
        technical: {
          score: "92%",
          color: "#9FCAED",
          description: "The candidate demonstrates strong technical discipline by relying on documentation and reinforcing knowledge through small projects.",
          transition: "width 0.5s ease-in-out"
        },
        behavioral: {
          score: "90%",
          color: "#CEB6DA",
          description: "He shows initiative and emphasizes sharing knowledge with teammates, which reflects accountability and collaboration.",
          transition: "width 0.5s ease-in-out"
        },
        analytical: {
          score: "88%",
          color: "#EBACC9",
          description: "His process is structured into clear stages: learning, experimenting, and documenting, which demonstrates systematic problem-solving.",
          transition: "width 0.5s ease-in-out"
        },
        communication: {
          score: "90%",
          color: "#FCCEC0",
          description: "He communicates his learning process clearly and highlights the importance of team benefit, making his explanation engaging.",
          transition: "width 0.5s ease-in-out"
        }
      }
    }
  }
  
  return (
    <>
    <div 
    ref={ensureFairnessTabBarRef}
    style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: 8, 
      flexDirection: "row", 
      height: "44px", 
      maxWidth: "640px", 
      width: "100%", 
      backgroundColor: "#FCE7F6", 
      borderRadius: "60px", 
      padding: "5px", 
      border: "1px solid #FCCEEE", 
      marginBottom: 24, 
      opacity: isEnsureFairnessTabBarVisible ? 1 : 0, 
      transform: isEnsureFairnessTabBarVisible ? 'translateY(0)' : 'translateY(20px)', 
      transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}>
      {tabs.map((tab, index) => (
          <div 
          key={index}
          style={{ 
              display:"flex",
              flexDirection: "row", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: 8, 
              width: "50%", 
              height: "100%", 
              backgroundColor: activeTab === tab ? "#FFFFFF" : "#FCE7F6", 
              color: activeTab === tab ? "#414651" : "#717680",
              borderRadius: "60px",
              cursor: "pointer",
              transition: "all 0.3s ease"
              }}
              onClick={() => {
                setActiveTab(tab);
                setActiveAnalysis("transcript");
              }}
          >
              <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>{tab}</span>
          </div>
      ))}
    </div>
    <div
      ref={ensureFairnessImageContainerRef}
      style={{
        opacity: isEnsureFairnessImageContainerVisible ? 1 : 0, 
        transform: isEnsureFairnessImageContainerVisible ? 'translateY(0)' : 'translateY(20px)', 
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' }}
    >
    <div className="candidate-analysis-container">
        {/* Scoring Button */}
        <div className="see-scoring-btn" onClick={() => setActiveAnalysis(activeAnalysis === "transcript" ? "scoring" : "transcript")}>
        <i className="la la-redo-alt"></i>
          <span>{activeAnalysis === "transcript" ? "See Scoring" : "See Transcript"}</span>
        </div>
        <div className="analysis-row">
          <div className={`analysis-column ${activeAnalysis === "transcript" ? "" : "hidden"}`}>
            <h3>Candidate</h3>
            <div className="profile-content-container">
              <div className="profile-content-inner">
                <Image src={candidateAnalysisData[activeTab].candidate.profilePicture} alt="Profile Picture" width={46} height={46} />
                <div className="profile-details">
                  <h3 className="name">{candidateAnalysisData[activeTab].candidate.name}</h3>
                  <p className="job-title">{candidateAnalysisData[activeTab].candidate.jobTitle}</p>
                </div>
              </div>
              <div className={`career-fit ${activeTab.toLowerCase().replace(" ", "-")}`}>{activeTab}</div>
            </div>
            <h3>Interview Transcript</h3>
            <div className="jia-interview-text">
              <span className="interview-text" dangerouslySetInnerHTML={{ __html: candidateAnalysisData[activeTab].transcript.jia }} />
              </div>
            <div className="candidate-interview-text">
              <span className="interview-text" dangerouslySetInnerHTML={{ __html: candidateAnalysisData[activeTab].transcript.candidate }} />
            </div>
          </div>
          <div className={`analysis-column ${activeAnalysis === "scoring" ? "" : "hidden"}`}>
            <h3>Scoring Framework</h3>
            <div className="scoring-framework-container">
              <div className="scoring-framework-header">
                <div className="scoring-framework-icon">
                <i className="la la-award"></i>
                </div>
                <h3>Technical</h3>
                <div className="progress-bar">
                  <div 
                  className="progress-bar-fill"
                  style={{
                     backgroundColor: candidateAnalysisData[activeTab].scoringFramework.technical.color, 
                     width: candidateAnalysisData[activeTab].scoringFramework.technical.score,
                     }}>
                  </div>
                </div>
                <span>{candidateAnalysisData[activeTab].scoringFramework.technical.score}</span>
              </div>
              <span className="scoring-framework-description">
                {candidateAnalysisData[activeTab].scoringFramework.technical.description}
              </span>
            </div>

            <div className="scoring-framework-container">
              <div className="scoring-framework-header">
                <div className="scoring-framework-icon">
                <i className="la la-smile"></i>
                </div>
                <h3>Behavioral</h3>
                <div className="progress-bar">
                  <div 
                  className="progress-bar-fill" 
                  style={{ 
                    backgroundColor: candidateAnalysisData[activeTab].scoringFramework.behavioral.color, 
                    width: candidateAnalysisData[activeTab].scoringFramework.behavioral.score,
                    }}></div>
                </div>
                <span>54%</span>
              </div>
              <span className="scoring-framework-description">
                {candidateAnalysisData[activeTab].scoringFramework.behavioral.description}
              </span>
            </div>

            <div className="scoring-framework-container">
              <div className="scoring-framework-header">
                <div className="scoring-framework-icon">
                <i className="la la-lightbulb"></i>
                </div>
                <h3>Analytical</h3>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ 
                    backgroundColor: candidateAnalysisData[activeTab].scoringFramework.analytical.color, 
                    width: candidateAnalysisData[activeTab].scoringFramework.analytical.score,
                    }}></div>
                </div>
                <span>50%</span>
              </div>
              <span className="scoring-framework-description">
                {candidateAnalysisData[activeTab].scoringFramework.analytical.description}
                </span>
            </div>

            <div className="scoring-framework-container">
              <div className="scoring-framework-header">
                <div className="scoring-framework-icon">
                <i className="la la-microphone"></i>
                </div>
                <h3>Communication</h3>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ 
                    backgroundColor: candidateAnalysisData[activeTab].scoringFramework.communication.color, 
                    width: candidateAnalysisData[activeTab].scoringFramework.communication.score,
                    }}></div>
                </div>
                <span>58%</span>
              </div>
              <span className="scoring-framework-description">
                {candidateAnalysisData[activeTab].scoringFramework.communication.description}
                </span>
            </div>
          </div>
        </div>
    </div>
    </div>
    </>
  )
}