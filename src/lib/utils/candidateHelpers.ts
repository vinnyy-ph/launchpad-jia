import { getCVSection } from "@/lib/Utils";

export type CandidateStatus = "Ongoing" | "Dropped" | "Cancelled" | "Hired" | "Inactive";

export interface Interview {
    location?: string;
    jobLocation?: string;
    city?: string;
    province?: string;
    jobTitle?: string;
    workSetup?: string;
    [key: string]: any;
}

export interface Candidate {
    _id?: string;
    id?: string;
    email: string;
    name?: string;
    image?: string;
    candidateStatus?: CandidateStatus;
    activeAt?: Date | string;
    cvData?: string | Record<string, any>;
    interviews?: Interview[];
    salary?: number | string;
    expectedSalary?: number | string;
    askingSalary?: number | string;
    availability?: string;
    availableFrom?: string;
    workSetup?: string;
    preferredWorkSetup?: string;
    skills?: string[]; // Skills from org-candidate-skills metadata (uploaded/extracted in manage-cv)
    // Denormalized fields returned by `/api/get-candidates` for fast table rendering
    currentPosition?: string;
    location?: string;
    experienceYears?: number | null;
}

// Invalid location values (work setup options that should not appear as locations)
const invalidLocations = ['Remote', 'Hybrid', 'On-site', 'Onsite', 'Fully Remote'];

export const isInvalidLocation = (location: string): boolean => {
    if (!location) return false;
    const normalized = location.trim().toLowerCase();
    return invalidLocations.some(invalid => normalized === invalid.toLowerCase());
};

// Helper function to get candidate location (full location with region for search/filtering)
export const getCandidateLocation = (candidate: Candidate | null | undefined): string => {
    if (!candidate) return "-";

    // Fast path: use denormalized field from API when available
    if (typeof candidate.location === "string") {
        const loc = candidate.location.trim();
        if (loc && loc !== "-" && !isInvalidLocation(loc)) {
            return loc;
        }
    }

    // Try to get from CV data first - prioritize Address from Contact Info
    if (candidate.cvData) {
        // First try Contact Info section for Address
        const contactInfo = getCVSection(candidate.cvData, "Contact Info");
        if (contactInfo) {
            // Try to match Address field (supports both markdown **Address:** and plain Address: formats)
            const addressPatterns = [
                /\*\*Address:\*\*\s*([^\n]+)/i,  // Markdown format: **Address:** address
                /Address:\s*([^\n]+)/i,           // Plain format: Address: address
            ];
            
            for (const pattern of addressPatterns) {
                const addressMatch = contactInfo.match(pattern);
                if (addressMatch && addressMatch[1]) {
                    const address = addressMatch[1].trim();
                    if (address && !isInvalidLocation(address)) {
                        return address;
                    }
                }
            }
            // If Contact Info exists but no Address found, return "-" (don't check other sources)
            return "-";
        }
        
        // Then try Location section as fallback (only if Contact Info doesn't exist)
        const locationSection = getCVSection(candidate.cvData, "Location");
        if (locationSection) {
            const location = locationSection.trim();
            if (location && !isInvalidLocation(location)) {
                return location;
            }
        }
    }
    
    // Finally, try to get from interviews as last resort (only if CV data doesn't exist or has no Contact Info)
    const interviews = Array.isArray(candidate.interviews)
        ? candidate.interviews.filter((interview: any) => interview && Object.keys(interview || {}).length > 0)
        : [];

    for (const interview of interviews) {
        const location =
            interview?.location ||
            interview?.jobLocation ||
            interview?.city ||
            interview?.province;
        if (location && !isInvalidLocation(location)) {
            return location;
        }
    }

    return "-";
};

// Helper function to get candidate location for table display (city name only, without region)
export const getCandidateLocationForDisplay = (candidate: Candidate | null | undefined): string => {
    const fullLocation = getCandidateLocation(candidate);
    if (!fullLocation || fullLocation === "-") return "-";
    
    // Extract city name (first part before comma)
    const parts = fullLocation.split(',').map(p => p.trim());
    const cityName = parts[0];
    
    // Return "-" if the location is a work setup option
    if (isInvalidLocation(cityName)) {
        return "-";
    }
    
    return cityName;
};

// Helper function to get current position
export const getCurrentPosition = (candidate: Candidate | null | undefined): string => {
    if (!candidate) return "-";

    // Fast path: use denormalized field from API when available
    if (typeof candidate.currentPosition === "string") {
        const pos = candidate.currentPosition.trim();
        if (pos && pos !== "-") {
            return pos;
        }
    }
    
    // Try to get from CV data
    if (candidate.cvData) {
        const currentPosition = getCVSection(candidate.cvData, "Current Position");
        if (currentPosition) {
            // Extract first line or job title
            const lines = currentPosition.split('\n').filter((line: string) => line.trim());
            if (lines.length > 0) {
                // Remove markdown formatting
                return lines[0].replace(/\*\*/g, '').trim();
            }
        }
    }

    // Try to get from interviews
    const interviews = Array.isArray(candidate.interviews)
        ? candidate.interviews.filter((interview: any) => interview && Object.keys(interview || {}).length > 0)
        : [];
    
    for (const interview of interviews) {
        if (interview?.jobTitle) {
            return interview.jobTitle;
        }
    }

    return "-";
};

// Helper function to get experience years as number (for filtering and display)
export const getExperienceYears = (candidate: Candidate | null | undefined): number | null => {
    if (!candidate) return null;

    // Use only the denormalized experienceYears field from API (sourced from applicant-cv.numExperience)
    const expYears = (candidate as any).experienceYears;
    if (typeof expYears === "number" && !Number.isNaN(expYears)) {
        return expYears;
    }
    
    return null;
};

// Helper function to get candidate salary as number (for filtering)
export const getCandidateSalary = (candidate: Candidate | null | undefined): number | null => {
    if (!candidate) return null;
    
    // Try to get from CV data
    if (candidate.cvData) {
        const salary = getCVSection(candidate.cvData, "Salary") || getCVSection(candidate.cvData, "Expected Salary") || getCVSection(candidate.cvData, "Asking Salary");
        if (salary) {
            // Try to extract salary number (remove currency symbols, commas, etc.)
            const salaryMatch = salary.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
            if (salaryMatch) {
                return parseInt(salaryMatch[1].replace(/,/g, ''), 10);
            }
        }
    }
    
    // Try to get from candidate object directly
    if (candidate.salary || candidate.expectedSalary || candidate.askingSalary) {
        const salaryValue = candidate.salary || candidate.expectedSalary || candidate.askingSalary;
        if (typeof salaryValue === 'number') {
            return salaryValue;
        }
        if (typeof salaryValue === 'string') {
            const salaryMatch = salaryValue.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
            if (salaryMatch) {
                return parseInt(salaryMatch[1].replace(/,/g, ''), 10);
            }
        }
    }
    
    return null;
};

// Helper function to get candidate availability
export const getCandidateAvailability = (candidate: Candidate | null | undefined): string | null => {
    if (!candidate) return null;
    
    // Try to get from CV data
    if (candidate.cvData) {
        const availability = getCVSection(candidate.cvData, "Availability") || getCVSection(candidate.cvData, "Available From");
        if (availability) {
            // Return first line if available
            const lines = availability.split('\n').filter((line: string) => line.trim());
            if (lines.length > 0) {
                return lines[0].replace(/\*\*/g, '').trim();
            }
        }
    }
    
    // Try to get from candidate object directly
    if (candidate.availability || candidate.availableFrom) {
        return candidate.availability || candidate.availableFrom;
    }
    
    return null;
};

// Helper function to get candidate work setup
export const getCandidateWorkSetup = (candidate: Candidate | null | undefined): string | null => {
    if (!candidate) return null;
    
    // Try to get from interviews
    const interviews = Array.isArray(candidate.interviews)
        ? candidate.interviews.filter((interview: any) => interview && Object.keys(interview || {}).length > 0)
        : [];
    
    for (const interview of interviews) {
        if (interview?.workSetup) {
            return interview.workSetup;
        }
    }
    
    // Try to get from CV data
    if (candidate.cvData) {
        const workSetup = getCVSection(candidate.cvData, "Work Setup") || getCVSection(candidate.cvData, "Preferred Work Setup");
        if (workSetup) {
            // Return first line if available
            const lines = workSetup.split('\n').filter((line: string) => line.trim());
            if (lines.length > 0) {
                return lines[0].replace(/\*\*/g, '').trim();
            }
        }
    }
    
    // Try to get from candidate object directly
    if (candidate.workSetup || candidate.preferredWorkSetup) {
        return candidate.workSetup || candidate.preferredWorkSetup;
    }
    
    return null;
};

// Helper function to get experience (for display)
// Uses only experienceYears from API (sourced from applicant-cv.numExperience)
export const getExperience = (candidate: Candidate | null | undefined): string => {
    if (!candidate) return "Not provided";
    
    const years = getExperienceYears(candidate);
    if (years !== null) {
        return `${years} years`;
    }
    
    return "Not provided";
};

// Helper function to get skills
export const getSkills = (candidate: Candidate | null | undefined): string[] => {
    if (!candidate) return [];
    
    // Priority 1: Get skills from metadata (org-candidate-skills) - skills uploaded/extracted in manage-cv
    // The API now includes skills array directly in the candidate object
    if (candidate.skills && Array.isArray(candidate.skills) && candidate.skills.length > 0) {
        return candidate.skills.filter((skill: string) => skill && skill.trim().length > 0);
    }

    // EDGE CASE when cvData is an array of skills
    const cvSection = (candidate.cvData as any)?.find((section: any) => section.name === "Skills");
    if (cvSection?.content && Array.isArray(cvSection.content) && cvSection?.content?.length > 0) {
        return cvSection.content.filter((skill: string) => skill && skill.trim().length > 0);
    }
    
    // Priority 2: Fallback to CV data parsing (for backward compatibility)
    if (candidate.cvData) {
        const skills = getCVSection(candidate.cvData, "Skills");
        if (skills) {
            // Extract first few skills or first line
            const lines = skills.split('\n').filter((line: string) => line.trim());
            if (lines.length > 0) {
                const headingRegex = /^(technical|soft)\s+skills:?$/i;
                const skillList = lines
                    .map((line: string) => line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').trim())
                    .filter((skill: string) => skill.length > 0 && !headingRegex.test(skill));
                
                if (skillList.length > 0) {
                    return skillList;
                }
            }
        }
    }

    return [];
};

// Helper function to get pre-screening answer for a specific question
export const getCandidatePreScreeningAnswer = (candidate: Candidate | null | undefined, questionId: string): any[] => {
    if (!candidate) return [];
    
    const interviews = Array.isArray(candidate.interviews)
        ? candidate.interviews.filter((interview: any) => interview && Object.keys(interview || {}).length > 0)
        : [];
    
    // Check all interviews for this question
    for (const interview of interviews) {
        if (interview?.preScreeningQuestions && Array.isArray(interview.preScreeningQuestions)) {
            const question = interview.preScreeningQuestions.find((q: any) => q.id === questionId);
            if (question && question.selectedAnswers && Array.isArray(question.selectedAnswers)) {
                return question.selectedAnswers;
            }
        }
    }
    
    return [];
};

// Helper function to check if candidate has any asking salary pre-screening answers
// Returns the answers if found, empty array if not found
export const getCandidateAskingSalaryPreScreeningAnswers = (candidate: Candidate | null | undefined): any[] => {
    if (!candidate) return [];
    
    const interviews = Array.isArray(candidate.interviews)
        ? candidate.interviews.filter((interview: any) => interview && Object.keys(interview || {}).length > 0)
        : [];
    
    // Check all interviews for asking salary questions
    for (const interview of interviews) {
        if (interview?.preScreeningQuestions && Array.isArray(interview.preScreeningQuestions)) {
            // Find asking salary question (questionType === "Asking Salary")
            const askingSalaryQuestion = interview.preScreeningQuestions.find(
                (q: any) => q.questionType === "Asking Salary" && q.selectedAnswers && Array.isArray(q.selectedAnswers)
            );
            if (askingSalaryQuestion && askingSalaryQuestion.selectedAnswers.length > 0) {
                return askingSalaryQuestion.selectedAnswers;
            }
        }
    }
    
    return [];
};

// Helper function to check if candidate has any pre-screening answers for a specific questionType
// Returns true if candidate has answers for that questionType, false otherwise
// Used to determine if candidate applied to a job with that predefined question type
export const hasCandidatePreScreeningAnswerByType = (candidate: Candidate | null | undefined, questionType: string): boolean => {
    if (!candidate || !questionType) return false;
    
    // Custom questions should always require strict matching
    if (questionType === "Custom Question") return false;
    
    const interviews = Array.isArray(candidate.interviews)
        ? candidate.interviews.filter((interview: any) => interview && Object.keys(interview || {}).length > 0)
        : [];
    
    // Check all interviews for questions with the specified questionType
    for (const interview of interviews) {
        if (interview?.preScreeningQuestions && Array.isArray(interview.preScreeningQuestions)) {
            const question = interview.preScreeningQuestions.find(
                (q: any) => q.questionType === questionType && q.selectedAnswers && Array.isArray(q.selectedAnswers) && q.selectedAnswers.length > 0
            );
            if (question) {
                return true;
            }
        }
    }
    
    return false;
};

// Helper function to format relative time
export const formatRelativeTime = (date: Date | string): string => {
    const now = new Date();
    const past = new Date(date);
    const diffInMs = now.getTime() - past.getTime();
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInWeeks = Math.floor(diffInDays / 7);

    if (diffInWeeks > 0) {
        return `${diffInWeeks}w ago`;
    } else if (diffInDays > 0) {
        return `${diffInDays}d ago`;
    } else if (diffInHours > 0) {
        return `${diffInHours}h ago`;
    } else if (diffInMinutes > 0) {
        return `${diffInMinutes}m ago`;
    } else {
        return "just now";
    }
};


