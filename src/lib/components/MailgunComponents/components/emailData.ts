// Dummy data
export const threads = [
  {
    id: "1",
    applicantId: "Hector Castro",
    organizationId: "White Cloak Technologies",
    careerId: "Software Engineer",
    subject: "Application Received - Hector Castro",
    stage: "CV Screening",
  },
  {
    id: "2",
    applicantId: "Jane Doe",
    organizationId: "White Cloak Technologies",
    careerId: null,
    subject: "Follow-up: Portfolio Review",
    stage: null,
  },
];

export const messages = [
  {
    id: "m-1",
    threadId: "1",
    avatar: null,
    senderName: "Sabine Beatrix Dy",
    senderEmail: "sabine@bluepixelcloak.com",
    receiverName: "Hector Castro",
    receiverEmail: "hector.castro@gmail.com",
    timestamp: "2025-11-28T01:44:15.341+00:00",
    subject: "Application Received - Hector Castro",
    isAutomated: true,
    content: `
      <p>Hi Hector,</p>
      <p>Thank you for applying for the Software Engineer position at White Cloak Technologies.</p>
      <p>Please submit your CV via <a href="#">https://www.hirejia.ai</a> at your earliest convenience. We are looking forward to your submission.</p>
    `,
    attachments: [
      { fileName: "Hector_Castro_CV.pdf", fileSize: "256 KB", fileType: "pdf" },
    ],
  },
  {
    id: "m-2",
    threadId: "2",
    avatar: null,
    senderName: "Recruiter Bot",
    senderEmail: "noreply@hirejia.ai",
    receiverName: "Jane Doe",
    receiverEmail: "jane.doe@gmail.com",
    timestamp: "2025-11-25T09:00:00.000+00:00",
    subject: "Reminder: Submit your portfolio",
    isAutomated: true,
    content: `
      <p>Hi Jane,</p>
      <p>This is a friendly reminder to submit your portfolio for the Frontend Developer position.</p>
      <p>Upload via <a href="#">https://www.hirejia.ai</a>. Thank you!</p>
    `,
    attachments: [],
  },
  {
    id: "m-3",
    threadId: "2",
    avatar: null,
    senderName: "Jane Doe",
    senderEmail: "jane.doe@gmail.com",
    receiverName: "Recruitment Team",
    receiverEmail: "recruitment@hirejia.ai",
    timestamp: "2025-11-26T10:30:00.000+00:00",
    subject: "Re: Reminder: Submit your portfolio",
    isAutomated: false,
    content: `
      <p>Hi team,</p>
      <p>I've uploaded my portfolio and CV as requested.</p>
      <p>Looking forward to your feedback.</p>
    `,
    attachments: [
      {
        fileName: "Jane_Doe_Portfolio.zip",
        fileSize: "1.2 MB",
        fileType: "zip",
      },
    ],
  },
];

export const templates = [
  {
    id: "t-1",
    type: "user",
    delay: "3 days",
    title: "Candidate Applied",
    content:
      "Hi {{Candidate_First_Name}}, Thank you for applying for {{Job_Title}} at {{Employer_Company_Name}}. Please submit your CV via {{Job_Portal_Link}} at your earliest convenience. We are looking forward to your submission. Best Regards,",
  },
  {
    id: "t-2",
    type: "global",
    title: "Application Received",
    content:
      "Hi {{Candidate_First_Name}}, We have successfully received your application for the {{Job_Title}} position at {{Employer_Company_Name}}. Our recruitment team will review your profile and get back to you shortly. Thank you for your interest. Best Regards,",
  },
  {
    id: "t-3",
    type: "system",
    delay: "2 hours",
    title: "Interview Invitation",
    content:
      "Hi {{Candidate_First_Name}}, We are pleased to invite you for an interview for the {{Job_Title}} role at {{Employer_Company_Name}}. Please select a suitable time using the following link: {{Interview_Scheduling_Link}}. We look forward to speaking with you. Best Regards,",
  },
  {
    id: "t-4",
    type: "user",
    title: "Interview Reminder",
    content:
      "Hi {{Candidate_First_Name}}, This is a reminder for your upcoming interview for the {{Job_Title}} position at {{Employer_Company_Name}} scheduled on {{Interview_Date}}. Please let us know if you have any questions. Best Regards,",
  },
  {
    id: "t-5",
    type: "global",
    title: "Interview Rescheduled",
    content:
      "Hi {{Candidate_First_Name}}, Your interview for the {{Job_Title}} role at {{Employer_Company_Name}} has been rescheduled to {{Interview_Date}}. Please confirm your availability at your earliest convenience. Best Regards,",
  },
  {
    id: "t-6",
    type: "user",
    delay: "1 day",
    title: "Shortlisted Candidate",
    content:
      "Hi {{Candidate_First_Name}}, Congratulations! You have been shortlisted for the {{Job_Title}} position at {{Employer_Company_Name}}. Our team will contact you soon with the next steps. Best Regards,",
  },
  {
    id: "t-7",
    type: "user",
    title: "Offer Extended",
    content:
      "Hi {{Candidate_First_Name}}, We are excited to extend an offer to you for the {{Job_Title}} role at {{Employer_Company_Name}}. Please review the offer details sent to your email and let us know your decision. Best Regards,",
  },
  {
    id: "t-8",
    type: "user",
    delay: "1 day",
    title: "Offer Accepted",
    content:
      "Hi {{Candidate_First_Name}}, Thank you for accepting the offer for the {{Job_Title}} position at {{Employer_Company_Name}}. We are delighted to welcome you to the team and will share onboarding details shortly. Best Regards,",
  },
  {
    id: "t-9",
    type: "user",
    title: "Application Rejected",
    content:
      "Hi {{Candidate_First_Name}}, Thank you for your interest in the {{Job_Title}} position at {{Employer_Company_Name}}. After careful consideration, we will not be moving forward with your application at this time. We wish you all the best in your job search. Best Regards,",
  },
  {
    id: "t-10",
    type: "user",
    title: "Onboarding Instructions",
    content:
      "Hi {{Candidate_First_Name}}, Welcome to {{Employer_Company_Name}}! Please complete your onboarding tasks using the following link: {{Onboarding_Portal_Link}} before your start date {{Start_Date}}. We are excited to have you on board. Best Regards,",
  },
];

export const recipientOptions = [
  {
    value: "hector.castro@gmail.com",
    label: "Hector Castro",
    imageSrc: "https://i.pravatar.cc/150?img=1",
  },
  {
    value: "jane.doe@gmail.com",
    label: "Jane Doe",
    imageSrc: "https://i.pravatar.cc/150?img=2",
  },
  {
    value: "sabine@bluepixelcloak.com",
    label: "Sabine Beatrix Dy",
    imageSrc: "https://i.pravatar.cc/150?img=3",
  },
  {
    value: "john.smith@techcorp.com",
    label: "John Smith",
    imageSrc: "https://i.pravatar.cc/150?img=4",
  },
  {
    value: "sarah.williams@innovate.io",
    label: "Sarah Williams",
    imageSrc: "https://i.pravatar.cc/150?img=5",
  },
  {
    value: "michael.johnson@enterprise.com",
    label: "Michael Johnson",
    imageSrc: "https://i.pravatar.cc/150?img=6",
  },
  {
    value: "emily.brown@startup.dev",
    label: "Emily Brown",
    imageSrc: "https://i.pravatar.cc/150?img=7",
  },
  {
    value: "david.chen@company.org",
    label: "David Chen",
    imageSrc: "https://i.pravatar.cc/150?img=8",
  },
  {
    value: "recruitment@hirejia.ai",
    label: "Recruitment Team",
  },
  {
    value: "noreply@hirejia.ai",
    label: "Recruiter Bot",
  },
];

export const careerOptions = [
  {
    value: "software-engineer-001",
    label: "Software Engineer",
  },
  {
    value: "frontend-developer-002",
    label: "Frontend Developer",
  },
  {
    value: "backend-developer-003",
    label: "Backend Developer",
  },
  {
    value: "fullstack-developer-004",
    label: "Full Stack Developer",
  },
  {
    value: "product-manager-005",
    label: "Product Manager",
  },
  {
    value: "ux-designer-006",
    label: "UX/UI Designer",
  },
  {
    value: "data-scientist-007",
    label: "Data Scientist",
  },
  {
    value: "devops-engineer-008",
    label: "DevOps Engineer",
  },
  {
    value: "marketing-specialist-009",
    label: "Marketing Specialist",
  },
  {
    value: "hr-manager-010",
    label: "HR Manager",
  },
];
