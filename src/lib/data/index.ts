export const emailAutomationData = [
  {
    activeCandidate: 0,
    droppedCandidate: 0,
    name: "CV Screening",
    subStages: [
      {
        activeCandidate: 0,
        name: "Waiting Submission",
        automationSettings: [
          {
            createdBy: "System",
            emailTemplate: {
              body: `Hi {Candidate First Name},

Thank you for applying for {Career Title} role at {Employer Company Name}.

Please submit your CV via {Job Portal Link} at your earliest convenience. We are looking forward to your submission.

Best Regards,`,
              html: `<div>
              <p>Hi {Candidate First Name},</p>
              <p>Thank you for applying for {Career Title} role at {Employer Company Name}.</p>
              <p>Please submit your CV via <a href="{Job Portal Link}">Job Portal Link</a> at your earliest convenience. We are looking forward to your submission.</p>
              <p>Best Regards,</p>
              </div>`,
              subject: `{Career Title} @ {Employer Company Name} - {Candidate Full Name}`,
              variables: [
                "{Career Title}",
                "{Employer Company Name}",
                "{Candidate Full Name}",
                "{Candidate First Name}",
                "{Job Portal Link}",
              ],
            },
            fromStage: null,
            isActive: false,
            name: "Application Received",
            trigger: "Applied",
            toStage: "CV Screening: Waiting Submission",
          },
        ],
      },
      {
        activeCandidate: 0,
        name: "For Review",
        automationSettings: [
          {
            createdBy: "System",
            emailTemplate: {
              body: `Hi {Candidate First Name},

We have received your CV for the job {Career Title}. Your CV is now being reviewed. We will send and email update soon.

Best Regards,`,
              html: `<div>
              <p>Hi {Candidate First Name},</p>
              <p>We have received your CV for the job {Career Title}. Your CV is now being reviewed. We will send and email update soon.</p>
              <p>Best Regards,</p>
              </div>`,
              subject: `{Career Title} @ {Employer Company Name} - {Candidate Full Name}`,
              variables: [
                "{Career Title}",
                "{Employer Company Name}",
                "{Candidate Full Name}",
                "{Candidate First Name}",
              ],
            },
            fromStage: "CV Screening: Waiting Submission",
            isActive: false,
            name: "Received CV",
            trigger: "Endorse",
            toStage: "CV Screening: For Review",
          },
          {
            createdBy: "System",
            emailTemplate: {
              body: `Hi {Candidate First Name},

We have received your CV for the job {Career Title}. Unfortunately, you have not met the strictest criteria set for this position.

Here's a constructive feedback:
{CV Feedback}

That said, we would love for you to apply again in the future. Wishin you success in your job hunt.

Best Regards,`,
              html: `<div>
              <p>Hi {Candidate First Name},</p>
              <p>We have received your CV for the job {Career Title}. Unfortunately, you have not met the strictest criteria set for this position.</p>
              <p>Here's a constructive feedback:</p>
              <p>{CV Feedback}</p>
              <p>That said, we would love for you to apply again in the future. Wishin you success in your job hunt.</p>
              <p>Best Regards,</p>
              </div>`,
              subject: `{Career Title} @ {Employer Company Name} - {Candidate Full Name}`,
              variables: [
                "{Career Title}",
                "{Employer Company Name}",
                "{Candidate Full Name}",
                "{Candidate First Name}",
                "{CV Feedback}",
              ],
            },
            fromStage: "CV Screening: Waiting Submission", // Original: CV Screening: For Review
            isActive: false,
            name: "Dropped from CV",
            trigger: "Drop",
            toStage: null,
          },
        ],
      },
    ],
  },
  {
    activeCandidate: 0,
    droppedCandidate: 0,
    name: "AI Interview",
    subStages: [
      {
        activeCandidate: 0,
        name: "Waiting Interview",
        automationSettings: [
          {
            createdBy: "System",
            emailTemplate: {
              body: `Hi {Candidate First Name},

Great news! You have been shortlisted for the {Career Title} role. Your are one step closer to getting this role.

Important info on the next step: Please finish your AI Interview on or before {Date}.

Reminders
  • The interview will take around 20 minutes, which widely varies based on the length of your answers.
  • The interview recording will be reviewed by a human recruiter.
  • Please take it in a quiet, distraction-free environment.
  • Make sure your internet connection is good and stable.
  • Allow mic and video permissions before proceeding.
  • Be as authentic as possible in your answers.
  • Take the interview at your earliest availability to get ahead of other candidates.
  
You may login to the {Job Portal Link} to take your AI Interview. Best of luck!

Best Regards,`,
              html: `<div>
              <p>Hi {Candidate First Name},</p>
              <p>Great news! You have been shortlisted for the {Career Title} role. Your are one step closer to getting this role.</p>
              <p>Important info on the next step: Please finish your AI Interview on or before {Date}.</p>
              <p>Reminders</p>
              <ul>
              <li>The interview will take around 20 minutes, which widely varies based on the length of your answers.</li>
              <li>The interview recording will be reviewed by a human recruiter.</li>
              <li>Please take it in a quiet, distraction-free environment.</li>
              <li>Make sure your internet connection is good and stable.</li>
              <li>Allow mic and video permissions before proceeding.</li>
              <li>Be as authentic as possible in your answers.</li>
              <li>Take the interview at your earliest availability to get ahead of other candidates.</li>
              </ul>
              <p>You may login to the <a href="{Job Portal Link}">Job Portal Link</a> to take your AI Interview. Best of luck!</p>
              <p>Best Regards,</p>
              </div>`,
              subject: `{Career Title} @ {Employer Company Name} - {Candidate Full Name}`,
              variables: [
                "{Career Title}",
                "{Employer Company Name}",
                "{Candidate Full Name}",
                "{Candidate First Name}",
                "{Date}",
                "{Job Portal Link}",
              ],
            },
            fromStage: "CV Screening: Waiting Submission", // Original: null
            isActive: false,
            name: "Shortlisted for AI Interview",
            trigger: "Endorse",
            toStage: "AI Interview: Waiting Interview",
          },
          // {
          //   createdBy: "System",
          //   fromStage: "AI Interview: Waiting Interview",
          //   isActive: false,
          //   name: "AI Interview Dropped",
          //   trigger: "Drop",
          //   toStage: "N/A",
          // },
        ],
      },
      // {
      //   activeCandidate: 0,
      //   name: "For Review",
      //   automationSettings: [
      //     // {
      //     //   createdBy: "System",
      //     //   fromStage: "AI Interview: Waiting Interview",
      //     //   isActive: false,
      //     //   name: "AI Interview for Review",
      //     //   trigger: "Endorse",
      //     //   toStage: "AI Interview: For Review",
      //     // },
      //     // {
      //     //   createdBy: "System",
      //     //   fromStage: "AI Interview: For Review",
      //     //   isActive: false,
      //     //   name: "AI Interview Dropped",
      //     //   trigger: "Drop",
      //     //   toStage: "N/A",
      //     // },
      //     // {
      //     //   createdBy: "System",
      //     //   fromStage: "AI Interview: For Review",
      //     //   isActive: false,
      //     //   name: "Retake Requested",
      //     //   trigger: "Retake Requested",
      //     //   toStage: "N/A",
      //     // },
      //     // {
      //     //   createdBy: "System",
      //     //   fromStage: "AI Interview: For Review",
      //     //   isActive: false,
      //     //   name: "Retake Declined",
      //     //   trigger: "Retake Declined",
      //     //   toStage: "N/A",
      //     // },
      //     // {
      //     //   createdBy: "System",
      //     //   fromStage: "AI Interview: For Review",
      //     //   isActive: false,
      //     //   name: "Retake Approved",
      //     //   trigger: "Retake Approved",
      //     //   toStage: "AI Interview: Waiting Interview",
      //     // },
      //     // {
      //     //   createdBy: "System",
      //     //   fromStage: "AI Interview: For Review",
      //     //   isActive: false,
      //     //   name: "AI Interview Passed",
      //     //   trigger: "Endorse",
      //     //   toStage: "N/A",
      //     // },
      //   ],
      // },
    ],
  },
];
