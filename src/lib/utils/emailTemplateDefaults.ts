export interface EmailTemplateDefault {
  subject: string;
  body: string;
  variables: string[];
}

export const DEFAULT_EMAIL_TEMPLATES: Record<string, EmailTemplateDefault> = {
  invite: {
    subject:
      "New Opportunity: [[Candidate Full Name]] @ [[Employer Company Name]]",
    body: `<p>Hi [[Candidate First Name]],</p>

<p>Following a review of your application, you have been added to the following job position(s) at [[Employer Company Name]]:</p>

[[Job Titles List]]

<p>Please visit the <a href="[[JIA Job Portal Link]]">Jia Job Portal</a> to proceed with any required steps.</p>

<p>Best Regards,<br/>[[Employer Company Name]] Recruitment Team</p>`,
    variables: [
      "Candidate First Name",
      "Candidate Full Name",
      "Employer Company Name",
      "Job Titles List",
      "JIA Job Portal Link",
    ],
  },
};

