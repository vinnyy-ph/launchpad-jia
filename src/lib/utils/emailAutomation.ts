// import { emailAutomationData } from "../data";
// import Mailgun from "mailgun.js";
// import formData from "form-data";

// // emailDetails - in order please check the variables in the emailAutomation.tsx
// // fromStage
// // recipientEmail
// // stageName
// // substageName
// // toStage
// // trigger

// interface EmailAutomationProps {
//   emailDetails: string[];
//   fromStage: string;
//   recipientEmail: string;
//   stageName: string;
//   substageName: string;
//   toStage: string;
//   trigger: "Applied" | "Drop" | "Endorse";
// }

// export default async function ({
//   emailDetails,
//   fromStage,
//   recipientEmail,
//   stageName,
//   substageName,
//   toStage,
//   trigger,
// }: EmailAutomationProps) {
//   const currentStage = emailAutomationData.find(
//     (item) => item.name == stageName
//   );

//   if (!currentStage) {
//     console.log("Stage not found");
//     return false;
//   }

//   const currentSubstage = currentStage.subStages.find(
//     (item) => item.name == substageName
//   );

//   if (!currentSubstage) {
//     console.log("Substage not found");
//     return false;
//   }

//   const automationSettings = currentSubstage.automationSettings.find(
//     (item) =>
//       item.fromStage == fromStage &&
//       item.toStage == toStage &&
//       item.trigger == trigger
//   );

//   if (!automationSettings) {
//     console.log("Automation settings not found");
//     return false;
//   }

//   if (!automationSettings.isActive) {
//     console.log("Automation settings not active");
//     return false;
//   }

//   if (
//     emailDetails.length != automationSettings.emailTemplate.variables.length
//   ) {
//     console.log("Error on details length");
//     return false;
//   }

//   const tokenMapper = Object.fromEntries(
//     automationSettings.emailTemplate.variables
//       .entries()
//       .map(([index, key]) => [key, emailDetails[index]])
//   );

//   try {
//     const replaceToken = (text: string) => {
//       let output = text;

//       for (const key in tokenMapper) {
//         output = output.split(key).join(tokenMapper[key]);
//       }

//       return output;
//     };

//     if (automationSettings.createdBy == "System") {
//       const mailgun = new Mailgun(formData);
//       const mg = mailgun.client({
//         username: "api",
//         key: process.env.MAILGUN_API_KEY,
//       });
//       const messageData = {
//         from: "noreply@hellojia.ai",
//         to: recipientEmail,
//         subject: replaceToken(automationSettings.emailTemplate.subject),
//         html: replaceToken(automationSettings.emailTemplate.html),
//       };
//       const msg = await mg.messages.create("hellojia.ai", messageData);

//       console.log(msg);
//       return true;
//     } else {
//     }
//   } catch (err) {
//     console.log("Error occurred in email automation");
//     return false;
//   }
// }

// export const tokenMapping: Record<string, string> = {
//   // Format: "Type-Value": "replacement value"
//   "Candidate-Candidate First Name": "",
//   "Candidate-Candidate Last Name": "",
//   "Candidate-Candidate Full Name": "",
//   "Candidate-Candidate Email Address": "",
//   "Organization-Organization Name": "",
//   "Organization-Organization Description": "",
//   "Organization-Organization Location": "",
//   "Careers-Job Title": "",
//   "Careers-Job Description": "",
// };

// /**
//  * Replaces tokens in HTML content based on data-token attributes
//  * @param html - HTML string containing tokens with data-token attributes
//  * @param mapping - Optional custom token mapping, defaults to tokenMapping
//  * @returns HTML string with tokens replaced
//  */
// export function replaceTokens(
//   html: string,
//   mapping: Record<string, string> = tokenMapping
// ): string {
//   if (!html) return "";

//   // Find all data-token attributes and replace them
//   return html.replace(
//     /<span[^>]*data-token="([^"]+)"[^>]*>.*?<\/span>/g,
//     (match, tokenKey) => {
//       // Extract the token key (e.g., "Candidate-Candidate First Name")
//       const replacement = mapping[tokenKey] || "";

//       // If no replacement found, return the original match
//       if (!replacement) return match;

//       // Replace the entire span with the replacement value
//       return replacement;
//     }
//   );
// }

import connectMongoDB from "../mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import Mailgun from "mailgun.js";
import formData from "form-data";
import { decrypt, encrypt } from "./cryptography";
import { toIdString } from "./dataTransform";
import { DEFAULT_EMAIL_TEMPLATES } from "./emailTemplateDefaults";
import { replaceTokenForInvite } from "./inviteEmailHelpers";

interface EmailAutomationProps {
  stage_id: string;
  substage_id: string;
  trigger_on_event: string;
  from_stage: string;
  to_stage: string;
  career_id: string;
  org_id: string;
  interview_id: string;
  selectedAccountId?: string | null; // Optional: account ID from EmailModule
  userId?: string | null; // Optional: logged-in user ID for "User" sender
}

function getTokenMapper(
  interviews: any,
  organizations: any,
  careers: any,
): Record<string, string | undefined> {
  return {
    "Job Title": careers?.jobTitle,
    "Job Description": careers?.description,

    "Organization Name": organizations?.name,
    "Organization Description": organizations?.description,
    "Organization Location": `${organizations?.city}, ${organizations?.province}, ${organizations?.country}`,

    "Candidate First Name": interviews?.name?.split(" ")[0],
    "Candidate Last Name": interviews?.name?.split(" ")[1],
    "Candidate Full Name": interviews?.name,
    "Candidate Email Address": interviews?.email,
    "Candidate CV Screening Reasoning": interviews?.cvScreeningReason,

    "AI Interview Date": new Date(
      new Date().getTime() + 3 * 24 * 60 * 60 * 1000,
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

/**
 * Get sender account and mode based on automation sender field and selected account
 */
async function getSenderAccountAndMode(
  db: any,
  automation: any,
  org_id: string,
  career_id: string,
  selectedAccountId?: string | null,
  loggedInUserId?: string | null,
): Promise<{
  sender: string;
  mode: "mailgun" | "gmail";
  accountId?: string;
  userId?: string;
}> {
  const sender = automation.automation?.sender || "System";

  // If selectedAccountId is provided, use it (from EmailModule)
  if (selectedAccountId) {
    // Check if it's a fallback mailgun account
    if (selectedAccountId.startsWith("fallback:")) {
      const email = selectedAccountId.split(":")[1] || "noreply@hellojia.ai";
      return { sender: email, mode: "mailgun", accountId: selectedAccountId };
    }

    // Try to find in mailgun-accounts
    if (ObjectId.isValid(selectedAccountId)) {
      const mailgunAccount = await db.collection("mailgun-accounts").findOne({
        _id: new ObjectId(selectedAccountId),
        $or: [
          { organizationId: new ObjectId(org_id) },
          { organizationId: org_id },
        ],
      });

      if (mailgunAccount) {
        return {
          sender: mailgunAccount.email,
          mode: "mailgun",
          accountId: selectedAccountId,
          userId: mailgunAccount.userId
            ? String(mailgunAccount.userId)
            : undefined,
        };
      }

      // Try to find in email-settings (for Gmail accounts)
      // Gmail accounts from EmailModule have _id from email-settings collection
      const emailSettings = await db.collection("email-settings").findOne({
        _id: new ObjectId(selectedAccountId),
        $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
      });

      if (emailSettings && emailSettings.userID && emailSettings.tokens) {
        // Look up member to get email
        const member = await db.collection("members").findOne({
          _id: new ObjectId(emailSettings.userID),
        });

        if (member && member.email) {
          return {
            sender: member.email,
            mode: "gmail",
            accountId: selectedAccountId,
            userId: String(emailSettings.userID),
          };
        }
      }
    }
  }

  // Fallback based on automation sender field
  if (sender === "System") {
    return { sender: "noreply@hellojia.ai", mode: "mailgun" };
  }

  if (sender === "User") {
    // If creator_email exists, use it to resolve member and mailgun account as sender
    const creatorEmail = automation?.automation?.creator_email;
    if (creatorEmail) {
      const memberByEmail = await db.collection("members").findOne({
        email: creatorEmail,
        $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
      });

      if (memberByEmail) {
        const mailgunAccount = await db.collection("mailgun-accounts").findOne({
          userId: memberByEmail._id,
          $or: [
            { organizationId: new ObjectId(org_id) },
            { organizationId: org_id },
          ],
        });

        if (mailgunAccount) {
          return {
            sender: mailgunAccount.email,
            mode: "mailgun",
            accountId: String(mailgunAccount._id),
            userId: String(memberByEmail._id),
          };
        }

        // Try Gmail account for this member
        const emailSettings = await db.collection("email-settings").findOne({
          userID: String(memberByEmail._id),
          $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
        });

        if (emailSettings && emailSettings.tokens) {
          return {
            sender: memberByEmail.email,
            mode: "gmail",
            accountId: String(emailSettings._id),
            userId: String(memberByEmail._id),
          };
        }
      }
    }

    // Fall back to logged-in user's account when no creator_email or resolution failed
    if (loggedInUserId) {
      // Get logged-in user's email and account
      // Build query conditions for finding member
      const idConditions: any[] = [
        { firebaseUID: loggedInUserId },
        { id: loggedInUserId },
      ];

      // Only add ObjectId condition if it's a valid ObjectId
      if (ObjectId.isValid(loggedInUserId)) {
        idConditions.push({ _id: new ObjectId(loggedInUserId) });
      }

      // Try to find member by different ID formats, with orgID filter
      let member = await db.collection("members").findOne({
        $and: [
          { $or: idConditions },
          {
            $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
          },
        ],
      });

      // If not found, try without orgID filter (in case user is in multiple orgs)
      if (!member) {
        member = await db.collection("members").findOne({
          $or: idConditions,
        });
      }

      if (member) {
        // Try to find user's mailgun account first
        const mailgunAccount = await db.collection("mailgun-accounts").findOne({
          userId: member._id,
          $or: [
            { organizationId: new ObjectId(org_id) },
            { organizationId: org_id },
          ],
        });

        if (mailgunAccount) {
          return {
            sender: mailgunAccount.email,
            mode: "mailgun",
            accountId: String(mailgunAccount._id),
            userId: String(member._id),
          };
        }

        // Try Gmail account (check email-settings)
        const emailSettings = await db.collection("email-settings").findOne({
          userID: String(member._id),
          $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
        });

        if (emailSettings && emailSettings.tokens) {
          return {
            sender: member.email,
            mode: "gmail",
            accountId: String(emailSettings._id),
            userId: String(member._id),
          };
        }

        // If no account found, fall back to system
        // Don't return here - let it fall through to system fallback
      }
      // If member not found or no account, fall back to system
    }
  }

  if (sender === "Job Creator" && career_id) {
    // Get job creator from career
    const career = await db.collection("careers").findOne({
      $or: [{ _id: new ObjectId(career_id) }, { id: career_id }],
    });

    if (career?.createdBy?.email) {
      // Try to find user's mailgun account first
      const member = await db.collection("members").findOne({
        email: career.createdBy.email,
        $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
      });

      if (member) {
        const mailgunAccount = await db.collection("mailgun-accounts").findOne({
          userId: member._id,
          $or: [
            { organizationId: new ObjectId(org_id) },
            { organizationId: org_id },
          ],
        });

        if (mailgunAccount) {
          return {
            sender: mailgunAccount.email,
            mode: "mailgun",
            accountId: String(mailgunAccount._id),
            userId: String(member._id),
          };
        }

        // Try Gmail account (check email-settings)
        const emailSettings = await db.collection("email-settings").findOne({
          userID: String(member._id),
          $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
        });

        if (emailSettings && emailSettings.tokens) {
          return {
            sender: member.email || career.createdBy.email,
            mode: "gmail",
            accountId: String(emailSettings._id),
            userId: String(member._id),
          };
        }

        // If no account found, fall back to system
        // Don't return here - let it fall through to system fallback
      }
    }
    // If career not found, createdBy not found, member not found, or no account, fall back to system
  }

  // Check if sender is a mailgun account email address
  if (
    sender &&
    sender !== "System" &&
    sender !== "User" &&
    sender !== "Job Creator" &&
    sender.includes("@")
  ) {
    // Try to find mailgun account by email
    const mailgunAccount = await db.collection("mailgun-accounts").findOne({
      email: sender,
      $or: [
        { organizationId: new ObjectId(org_id) },
        { organizationId: org_id },
      ],
      isActive: true,
    });

    if (mailgunAccount) {
      return {
        sender: mailgunAccount.email,
        mode: "mailgun",
        accountId: String(mailgunAccount._id),
        userId: mailgunAccount.userId
          ? String(mailgunAccount.userId)
          : undefined,
      };
    }

    // If not found in mailgun-accounts, try Gmail: find member by email, then email-settings by userID (email-settings has no email field)
    const memberBySenderEmail = await db.collection("members").findOne({
      email: sender,
      $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
    });

    if (memberBySenderEmail) {
      const emailSettings = await db.collection("email-settings").findOne({
        userID: String(memberBySenderEmail._id),
        $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
      });

      if (emailSettings && emailSettings.tokens) {
        return {
          sender: memberBySenderEmail.email,
          mode: "gmail",
          accountId: String(emailSettings._id),
          userId: String(emailSettings.userID),
        };
      }
    }
  }

  // Default fallback
  return { sender: "noreply@hellojia.ai", mode: "mailgun" };
}

export async function emailAutomation({
  stage_id,
  substage_id,
  trigger_on_event,
  from_stage,
  to_stage,
  career_id,
  org_id,
  interview_id,
  selectedAccountId,
  userId,
}: EmailAutomationProps) {
  const { db } = await connectMongoDB();
  const automationModel = db.collection("automations");
  const emailTemplateModel = db.collection("email-templates");
  let automations = await automationModel
    .find({
      stage_id,
      substage_id,
      careerId: career_id,
      orgID: org_id,
    })
    .toArray();

  // If no automations exist for "invite" trigger, create a virtual default automation
  if (
    automations.length === 0 &&
    trigger_on_event?.toLowerCase() === "invite"
  ) {
    automations = [
      {
        _id: "default-invite-automation",
        automation: {
          active: true,
          trigger_on_event: "Invite",
          sender: "System",
          template_id: "default-invite-template",
          automation_name: "Default Invite Email",
        },
        emailTemplate: {
          _id: "default-invite-template",
          subject: DEFAULT_EMAIL_TEMPLATES.invite.subject,
          message: DEFAULT_EMAIL_TEMPLATES.invite.body,
          enable_schedule_send: false,
          enable_preferred_time: false,
        },
        stage_id,
        substage_id,
        careerId: career_id,
        orgID: org_id,
      } as any,
    ];
  }

  if (automations.length > 0) {
    const templateIds = automations
      .map((a) => a.automation.template_id)
      .filter((id) => id !== "default-invite-template");

    const emailTemplates =
      templateIds.length > 0
        ? await emailTemplateModel
            .find({ _id: { $in: templateIds.map((id) => new ObjectId(id)) } })
            .toArray()
        : [];

    const templateMap = new Map(
      emailTemplates.map((template) => [template._id.toString(), template]),
    );

    const automationsWithTemplates = automations.map((automation) => {
      if (automation.automation.template_id === "default-invite-template") {
        return automation;
      }
      return {
        ...automation,
        emailTemplate:
          templateMap.get(automation.automation.template_id.toString()) || null,
      };
    });

    // Filter automations by to_stage, from_stage, and trigger_on_event
    // If automation has to_stage and from_stage values, they must match the received values
    // If automation has no to_stage and from_stage values, include it
    // trigger_on_event from the body must match the trigger_on_event from the automation (case-insensitive)
    const filteredAutomations = automationsWithTemplates.filter(
      (automation) => {
        const automationFromStage = (automation as any).automation?.from_stage;
        const automationToStage = (automation as any).automation?.to_stage;
        const automationTriggerOnEvent = (automation as any).automation
          ?.trigger_on_event;

        // Check trigger_on_event first (body must include automation's trigger if automation has it)
        if (automationTriggerOnEvent) {
          const bodyTriggerLower = trigger_on_event?.toLowerCase() || "";
          const automationTriggerLower = String(
            automationTriggerOnEvent,
          ).toLowerCase();
          if (!bodyTriggerLower.includes(automationTriggerLower)) {
            return false;
          }
        }

        // If automation has no from_stage and to_stage, include it (if trigger_on_event matched or doesn't exist)
        if (!automationFromStage && !automationToStage) {
          return true;
        }

        // If automation has from_stage and to_stage, they must match
        if (automationFromStage && automationToStage) {
          return (
            automationFromStage === from_stage && automationToStage === to_stage
          );
        }

        // If only one is set, check if it matches
        if (automationFromStage && !automationToStage) {
          return automationFromStage === from_stage;
        }

        if (!automationFromStage && automationToStage) {
          return automationToStage === to_stage;
        }

        return false;
      },
    );

    console.log(filteredAutomations);

    // Collect all unique tokens from all automations first
    const allDataTokens = new Set<string>();

    filteredAutomations.forEach((automation) => {
      [
        automation.emailTemplate.subject,
        automation.emailTemplate.message,
      ].forEach((text) => {
        if (!text) return;
        // Create a new regex instance for each text to avoid state issues
        const regex = /data-token="([^"]+)"/g;
        let match;
        while ((match = regex.exec(text))) {
          allDataTokens.add(match[1]);
        }
      });
    });

    // Fetch all required data once before processing automations
    let interviews: any = null;
    let organizations: any = null;
    let careers: any = null;

    const dataTokenArray = Array.from(allDataTokens);

    for (const token of dataTokenArray) {
      if (token.includes("Careers") && !careers) {
        careers = await db
          .collection("careers")
          .findOne({ _id: new ObjectId(career_id) });
      }

      if (token.includes("Candidate") && !interviews) {
        interviews = await db
          .collection("interviews")
          .findOne({ interviewID: interview_id });
      }

      if (token.includes("Organization") && !organizations) {
        organizations = await db
          .collection("organizations")
          .findOne({ _id: new ObjectId(org_id) });
      }
    }

    // Ensure interviews is always fetched if we have any automations (needed for email address)
    if (!interviews) {
      interviews = await db
        .collection("interviews")
        .findOne({ interviewID: interview_id });
    }

    // Process each automation sequentially
    for (const automation of filteredAutomations) {
      // Skip if automation is not active
      if (
        (automation as any).automation?.active === false ||
        (automation as any).automation?.active === "false"
      ) {
        console.log(
          `Automation ${automation._id} is not active, skipping email send`,
        );
        continue;
      }

      if (!interviews?.email) {
        console.error(`No email found for interview_id: ${interview_id}`);
        continue;
      }

      const emailTemplate = automation.emailTemplate;
      const subject = htmlToPlainText(
        replaceToken(emailTemplate.subject, interviews, organizations, careers),
      );
      const html = replaceToken(
        emailTemplate.message,
        interviews,
        organizations,
        careers,
      );
      const recipientEmail = interviews.email;

      // Get sender account and mode based on automation settings
      const senderInfo = await getSenderAccountAndMode(
        db,
        automation,
        org_id,
        career_id,
        selectedAccountId,
        userId, // Pass userId for "User" sender
      );
      const { sender, mode, accountId, userId: senderUserId } = senderInfo;

      // Check if schedule sending is enabled
      const isScheduled =
        emailTemplate.enable_schedule_send === "true" ||
        emailTemplate.enable_schedule_send === true;
      const hasPreferredTime =
        emailTemplate.enable_preferred_time === "true" ||
        emailTemplate.enable_preferred_time === true;
      const preferredTime = hasPreferredTime
        ? emailTemplate.preferred_time
        : undefined;

      if (
        isScheduled &&
        emailTemplate.schedule_delay &&
        emailTemplate.schedule_delay_unit
      ) {
        // Calculate send date based on delay + preferred time
        const sendDate = calculateSendDate(
          emailTemplate.schedule_delay,
          emailTemplate.schedule_delay_unit,
          preferredTime,
        );

        // Save to schedule-email collection
        const scheduleEmailData = {
          body: html,
          subject: subject,
          to: recipientEmail,
          sender: sender,
          mode: mode,
          status: "active",
          sendDate: sendDate,
          // Sender account information
          accountId: accountId || null,
          userId: userId || null,
          // Schedule configuration
          scheduleDelay: emailTemplate.schedule_delay,
          scheduleDelayUnit: emailTemplate.schedule_delay_unit,
          enablePreferredTime: hasPreferredTime,
          preferredTime: emailTemplate.preferred_time || null,
          // Additional important fields
          orgID: org_id,
          careerId: career_id,
          interviewId: interview_id,
          stageId: stage_id,
          substageId: substage_id,
          automationId: automation._id?.toString() || null,
          templateId: emailTemplate._id?.toString() || null,
          triggerOnEvent: trigger_on_event,
          fromStage: from_stage,
          toStage: to_stage,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          await db.collection("schedule-email").insertOne(scheduleEmailData);
          console.log(
            `Scheduled email saved for ${recipientEmail} to be sent on ${sendDate}`,
          );
        } catch (error) {
          console.error("Error saving scheduled email:", error);
          // Continue processing other automations even if one fails
        }
      } else if (hasPreferredTime && preferredTime) {
        // Preferred time only (no schedule delay) - schedule for preferred time today/tomorrow
        const sendDate = calculateSendDate(0, "days", preferredTime);

        // Save to schedule-email collection
        const scheduleEmailData = {
          body: html,
          subject: subject,
          to: recipientEmail,
          sender: sender,
          mode: mode,
          status: "active",
          sendDate: sendDate,
          // Sender account information
          accountId: accountId || null,
          userId: userId || null,
          // Schedule configuration
          scheduleDelay: null,
          scheduleDelayUnit: null,
          enablePreferredTime: true,
          preferredTime: preferredTime,
          // Additional important fields
          orgID: org_id,
          careerId: career_id,
          interviewId: interview_id,
          stageId: stage_id,
          substageId: substage_id,
          automationId: automation._id?.toString() || null,
          templateId: emailTemplate._id?.toString() || null,
          triggerOnEvent: trigger_on_event,
          fromStage: from_stage,
          toStage: to_stage,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          await db.collection("schedule-email").insertOne(scheduleEmailData);
          console.log(
            `Scheduled email saved for ${recipientEmail} to be sent at preferred time ${preferredTime} on ${sendDate}`,
          );
        } catch (error) {
          console.error("Error saving scheduled email:", error);
          // Continue processing other automations even if one fails
        }
      } else {
        // Send immediately
        if (mode === "mailgun") {
          const mailgun = new Mailgun(formData);
          const mg = mailgun.client({
            username: "api",
            key: process.env.MAILGUN_API_KEY,
          });
          const messageData = {
            from: sender,
            to: recipientEmail,
            subject: subject,
            html: html,
          };
          const msg = await mg.messages.create("hellojia.ai", messageData);
          console.log(msg);
        } else if (mode === "gmail" && senderUserId) {
          // Save subject and details to DB first, then send via Gmail API
          const orgObjectId = new ObjectId(org_id);
          let thread: any = null;
          let insertedMessageId: ObjectId | null = null;

          try {
            const normSubject = subject;
            const threadQuery: any = {
              organizationId: orgObjectId,
              normalizedSubject: normSubject,
            };
            if (careers?.id) {
              threadQuery.careerId = careers.id;
            } else {
              threadQuery.$or = [
                { careerId: null },
                { careerId: { $exists: false } },
              ];
            }

            thread = await db
              .collection("mailgun-threads")
              .findOne(threadQuery);

            if (!thread) {
              const threadIdStr = new ObjectId().toHexString();
              const insertThread = {
                applicantId: null,
                organizationId: orgObjectId,
                subject,
                normalizedSubject: normSubject,
                threadId: threadIdStr,
                careerId: careers?.id || null,
                lastUpdated: new Date(),
                participants: [accountId || "fallback:noreply@hellojia.ai"],
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any;
              const tRes = await db
                .collection("mailgun-threads")
                .insertOne(insertThread);
              thread = await db
                .collection("mailgun-threads")
                .findOne({ _id: tRes.insertedId });
            } else {
              const participantId = accountId || "fallback:noreply@hellojia.ai";
              await db.collection("mailgun-threads").updateOne(
                { _id: thread._id },
                {
                  $set: { lastUpdated: new Date(), updatedAt: new Date() },
                  $addToSet: { participants: participantId },
                },
              );
            }

            const messageDoc: any = {
              threadId: thread._id,
              from: sender,
              to: [recipientEmail],
              cc: [],
              bcc: [],
              html: html || null,
              text: null,
              attachments: [],
              careerId: careers?.id || null,
              direction: "outbound",
              isAutomated: true,
              mailgunMessageId: null,
              gmailMessageId: null,
              mailgunAccountId: accountId || "fallback:noreply@hellojia.ai",
              mailgunReferencesRaw: null,
              mailgunReferences: null,
              recruiterId: ObjectId.isValid(senderUserId)
                ? new ObjectId(senderUserId)
                : null,
              applicantId: null,
              organizationId: orgObjectId,
              receivedAt: null,
              sentAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const msgRes = await db
              .collection("mailgun-messages")
              .insertOne(messageDoc);
            insertedMessageId = msgRes.insertedId;

            const { gmailMessageId } = await sendGmailEmail(db, {
              senderUserId,
              orgId: org_id,
              sender,
              to: recipientEmail,
              subject,
              html,
              careerId: career_id,
            });

            if (gmailMessageId && insertedMessageId) {
              await db.collection("mailgun-messages").updateOne(
                { _id: insertedMessageId },
                {
                  $set: {
                    gmailMessageId,
                    sentAt: new Date(),
                    updatedAt: new Date(),
                  },
                },
              );
            }
            console.log(
              `Email sent via Gmail for ${recipientEmail}. Thread ID: ${thread._id}, Gmail Message ID: ${gmailMessageId}`,
            );
          } catch (gmailErr: any) {
            console.error("Error sending Gmail automation email:", gmailErr);
            if (insertedMessageId) {
              await db.collection("mailgun-messages").updateOne(
                { _id: insertedMessageId },
                {
                  $set: {
                    updatedAt: new Date(),
                    error: gmailErr?.message || "Gmail send failed",
                  },
                },
              );
            }
          }
        }
      }
    }
  }
}

function calculateSendDate(
  delay: string | number,
  unit: string,
  preferredTime?: string,
): Date {
  const delayValue = typeof delay === "string" ? parseInt(delay, 10) : delay;
  const now = new Date();
  const sendDate = new Date(now);
  const unitLower = unit.toLowerCase();
  const isDayUnit = unitLower === "days" || unitLower === "day";
  const isHourUnit = unitLower === "hours" || unitLower === "hour";
  const isMinuteUnit = unitLower === "minutes" || unitLower === "minute";

  // Step 1: Calculate the base send date based on delay
  if (isDayUnit) {
    sendDate.setDate(sendDate.getDate() + delayValue);
  } else if (isHourUnit) {
    sendDate.setHours(sendDate.getHours() + delayValue);
  } else if (isMinuteUnit) {
    sendDate.setMinutes(sendDate.getMinutes() + delayValue);
  } else {
    // Default to days if unit is not recognized
    sendDate.setDate(sendDate.getDate() + delayValue);
  }

  // Step 2: Apply preferred time if set
  if (preferredTime) {
    // preferredTime format: "HH:MM" (24-hour) or "h:mm AM/PM" (12-hour)
    const timeMatch = preferredTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (timeMatch) {
      let preferredHours = parseInt(timeMatch[1], 10);
      const preferredMinutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3]?.toUpperCase();

      // Handle 12-hour format
      if (ampm === "PM" && preferredHours !== 12) {
        preferredHours += 12;
      } else if (ampm === "AM" && preferredHours === 12) {
        preferredHours = 0;
      }

      // If delay is in days, set preferred time on that day
      if (isDayUnit) {
        sendDate.setHours(preferredHours, preferredMinutes, 0, 0);
      } else {
        // For hours/minutes delay: set preferred time, but if it's in the past, add one day
        const preferredTimeDate = new Date(sendDate);
        preferredTimeDate.setHours(preferredHours, preferredMinutes, 0, 0);

        // If preferred time on the calculated date is in the past, move to next day
        if (preferredTimeDate < sendDate) {
          preferredTimeDate.setDate(preferredTimeDate.getDate() + 1);
        }

        sendDate.setTime(preferredTimeDate.getTime());
      }
    }
  }

  return sendDate;
}

/**
 * Send email via Gmail API using OAuth tokens from email-settings.
 * Saves subject and metadata to gmail-subject after successful send.
 */
async function sendGmailEmail(
  db: any,
  params: {
    senderUserId: string;
    orgId: string;
    sender: string;
    to: string;
    subject: string;
    html: string;
    careerId?: string | null;
  },
): Promise<{ gmailMessageId: string | null }> {
  const { senderUserId, orgId, sender, to, subject, html, careerId } = params;

  const emailSettings = await db.collection("email-settings").findOne({
    userID: toIdString(senderUserId),
    $or: [{ orgID: orgId }, { orgID: new ObjectId(orgId) }],
  });

  if (!emailSettings?.tokens) {
    throw new Error("Gmail tokens not found. Please reconnect Gmail account.");
  }

  const decrypted = decrypt(emailSettings.tokens);
  if (!decrypted) {
    throw new Error("Failed to decrypt Gmail tokens");
  }

  const tokens = JSON.parse(decrypted) as {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
  };

  if (!tokens.refresh_token) {
    throw new Error("Missing refresh token. Please reconnect Gmail.");
  }

  let accessToken = tokens.access_token;
  const now = Date.now();
  const isExpired =
    !tokens.access_token ||
    !tokens.expiry_date ||
    now >= Number(tokens.expiry_date) - 60_000;

  if (isExpired) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh access token");
    }
    const refreshData = await refreshResponse.json();
    accessToken = refreshData.access_token;
    const updatedTokens = {
      ...tokens,
      access_token: refreshData.access_token,
      expiry_date: Date.now() + refreshData.expires_in * 1000,
    };
    await db
      .collection("email-settings")
      .updateOne(
        { userID: toIdString(senderUserId), orgID: emailSettings.orgID },
        { $set: { tokens: encrypt(JSON.stringify(updatedTokens)) } },
      );
  }

  function encodeSubject(subject: string) {
    const utf8Bytes = Buffer.from(subject, "utf-8");
    const base64 = utf8Bytes.toString("base64");
    return `=?UTF-8?B?${base64}?=`;
  }

  const emailContent = [
    `From: ${sender}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
  ].join("\r\n");

  const encodedEmail = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const gmailResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedEmail }),
    },
  );

  if (!gmailResponse.ok) {
    const errorData = await gmailResponse.text();
    throw new Error(`Gmail API Error: ${gmailResponse.status} - ${errorData}`);
  }

  const gmailResult = await gmailResponse.json();
  const gmailMessageId = gmailResult.id ?? gmailResult.messageId ?? null;

  // Save subject and metadata to gmail-subject for inbox sync
  const normalizedOrgId =
    orgId && ObjectId.isValid(String(orgId))
      ? new ObjectId(String(orgId))
      : orgId;
  const subjectStr = String(subject).trim();
  const senderEmailStr = String(sender).toLowerCase();
  try {
    await db.collection("gmail-subject").updateOne(
      {
        orgID: normalizedOrgId,
        senderEmail: senderEmailStr,
        subject: subjectStr,
      },
      {
        $set: {
          userId: toIdString(senderUserId),
          careerId: careerId || null,
          date: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          subject: subjectStr,
          orgID: normalizedOrgId,
          senderEmail: senderEmailStr,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (saveErr) {
    console.error("Failed to save to gmail-subject", saveErr);
  }

  return { gmailMessageId };
}

function replaceToken(
  html: string,
  interviews: any,
  organizations: any,
  careers: any,
): string {
  if (!html) return "";

  const tokenMapper = getTokenMapper(interviews, organizations, careers);

  return html.replace(
    /<span([^>]*data-token="([^"]+)"[^>]*)>(.*?)<\/span>/g,
    (match, attributes, tokenKey, originalText) => {
      // Extract the value part from token format "Type-Value" (e.g., "Candidate-Candidate First Name" -> "Candidate First Name")
      const tokenValue = tokenKey.includes("-")
        ? tokenKey.split("-").slice(1).join("-")
        : tokenKey;

      // Get the replacement value from tokenMapper
      const replacement = tokenMapper[tokenValue] || originalText;

      // Replace only the text content, keeping the span structure
      return `<span${attributes}>${replacement}</span>`;
    },
  );
}

function htmlToPlainText(html: string): string {
  if (!html) return "";

  // Replace HTML entities
  let text = html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&#x3D;/g, "=");

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Decode numeric HTML entities (e.g., &#123;)
  text = text.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });

  // Decode hex HTML entities (e.g., &#x27;)
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Clean up multiple spaces and trim
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

interface SendEmailV2Props {
  stage_id: string;
  substage_id: string;
  trigger_on_event: string;
  from_stage: string;
  to_stage: string;
  careerId: string;
  orgID: string;
  email: string;
  userId?: string | null; // Optional: logged-in user ID for "User" sender
  automationIdsToUse?: string[] | null; // When provided, only run these automation IDs (from candidate action modal toggles)
  careerIds?: string[]; // Optional: multiple career IDs for invite emails
  careerTitles?: string[]; // Optional: multiple career titles for invite emails
}

export async function sendEmailV2({
  email,
  stage_id,
  substage_id,
  trigger_on_event,
  from_stage,
  to_stage,
  careerId,
  orgID,
  userId,
  automationIdsToUse,
  careerIds,
  careerTitles,
}: SendEmailV2Props) {
  const { db } = await connectMongoDB();
  const automationModel = db.collection("automations");
  const emailTemplateModel = db.collection("email-templates");
  let automations = await automationModel
    .find({
      stage_id,
      substage_id,
      careerId,
      orgID,
    })
    .toArray();

  // If no automations exist for "invite" trigger, create a virtual default automation
  if (
    automations.length === 0 &&
    trigger_on_event?.toLowerCase() === "invite"
  ) {
    automations = [
      {
        _id: "default-invite-automation",
        automation: {
          active: true,
          trigger_on_event: "Invite",
          sender: "System",
          template_id: "default-invite-template",
          automation_name: "Default Invite Email",
        },
        emailTemplate: {
          _id: "default-invite-template",
          subject: DEFAULT_EMAIL_TEMPLATES.invite.subject,
          message: DEFAULT_EMAIL_TEMPLATES.invite.body,
          enable_schedule_send: false,
          enable_preferred_time: false,
        },
        stage_id,
        substage_id,
        careerId,
        orgID,
      } as any,
    ];
  }

  if (automations.length > 0) {
    const templateIds = automations
      .map((a) => a.automation.template_id)
      .filter((id) => id !== "default-invite-template");

    const emailTemplates =
      templateIds.length > 0
        ? await emailTemplateModel
            .find({ _id: { $in: templateIds.map((id) => new ObjectId(id)) } })
            .toArray()
        : [];

    const templateMap = new Map(
      emailTemplates.map((template) => [template._id.toString(), template]),
    );

    const automationsWithTemplates = automations.map((automation) => {
      if (automation.automation.template_id === "default-invite-template") {
        return automation;
      }
      return {
        ...automation,
        emailTemplate:
          templateMap.get(automation.automation.template_id.toString()) || null,
      };
    });

    // Filter automations by to_stage, from_stage, and trigger_on_event
    // If automation has to_stage and from_stage values, they must match the received values
    // If automation has no to_stage and from_stage values, include it
    // trigger_on_event from the body must match the trigger_on_event from the automation (case-insensitive)
    const filteredAutomations = automationsWithTemplates.filter(
      (automation) => {
        const automationFromStage = (automation as any).automation?.from_stage;
        const automationToStage = (automation as any).automation?.to_stage;
        const automationTriggerOnEvent = (automation as any).automation
          ?.trigger_on_event;

        // Check trigger_on_event first (body must include automation's trigger if automation has it)
        if (automationTriggerOnEvent) {
          const bodyTriggerLower = trigger_on_event?.toLowerCase() || "";
          const automationTriggerLower = String(
            automationTriggerOnEvent,
          ).toLowerCase();
          if (!bodyTriggerLower.includes(automationTriggerLower)) {
            return false;
          }
        }

        // If automation has no from_stage and to_stage, include it (if trigger_on_event matched or doesn't exist)
        if (!automationFromStage && !automationToStage) {
          return true;
        }

        // If automation has from_stage and to_stage, they must match
        if (automationFromStage && automationToStage) {
          return (
            automationFromStage === from_stage && automationToStage === to_stage
          );
        }

        // If only one is set, check if it matches
        if (automationFromStage && !automationToStage) {
          return automationFromStage === from_stage;
        }

        if (!automationFromStage && automationToStage) {
          return automationToStage === to_stage;
        }

        return false;
      },
    );

    // When automationIdsToUse is provided, only run those automations (candidate action modal state)
    // Empty array = run none; undefined = run all matching (backward compatibility)
    const automationIdsSet =
      automationIdsToUse != null && Array.isArray(automationIdsToUse)
        ? new Set(automationIdsToUse.map((id) => String(id)))
        : null;
    const automationsToRun =
      automationIdsSet !== null
        ? automationIdsSet.size > 0
          ? filteredAutomations.filter((a: any) => {
              const id = a._id?.toString?.() ?? String(a._id);
              return automationIdsSet.has(id);
            })
          : []
        : filteredAutomations;

    console.log(automationsToRun);

    // Collect all unique tokens from all automations first
    const allDataTokens = new Set<string>();

    automationsToRun.forEach((automation) => {
      // Skip automations without valid email templates
      if (!automation.emailTemplate) {
        console.warn(
          `Automation ${automation._id} has no valid email template, skipping token collection`,
        );
        return;
      }

      [
        automation.emailTemplate.subject,
        automation.emailTemplate.message,
      ].forEach((text) => {
        if (!text) return;
        // Create a new regex instance for each text to avoid state issues
        const regex = /data-token="([^"]+)"/g;
        let match;
        while ((match = regex.exec(text))) {
          allDataTokens.add(match[1]);
        }
      });
    });

    // Fetch all required data once before processing automations
    let interviews: any = null;
    let organizations: any = null;
    let careers: any = null;

    const dataTokenArray = Array.from(allDataTokens);

    // Try to find interview by email
    interviews = await db.collection("interviews").findOne({ email: email });

    // For invite emails, always fetch organization and career data
    const isInviteTrigger = trigger_on_event?.toLowerCase() === "invite";
    if (isInviteTrigger) {
      if (!careers) {
        careers = await db
          .collection("careers")
          .findOne({ _id: new ObjectId(careerId) });
      }
      if (!organizations) {
        organizations = await db
          .collection("organizations")
          .findOne({ _id: new ObjectId(orgID) });
      }
    }

    for (const token of dataTokenArray) {
      if (token.includes("Careers") && !careers) {
        careers = await db
          .collection("careers")
          .findOne({ _id: new ObjectId(careerId) });
      }

      if (token.includes("Candidate") && !interviews) {
        // If interview not found by email, try to find by careerId and email
        interviews = await db
          .collection("interviews")
          .findOne({ email: email, id: careerId });
      }

      if (token.includes("Organization") && !organizations) {
        organizations = await db
          .collection("organizations")
          .findOne({ _id: new ObjectId(orgID) });
      }
    }

    // If interview still not found, create a minimal interview object with just email
    if (!interviews) {
      interviews = { email: email, name: email.split("@")[0] };
    }

    // Ensure we have email in interviews object
    if (!interviews.email) {
      interviews.email = email;
    }

    // Process each automation sequentially
    for (const automation of automationsToRun) {
      // Skip if automation is not active
      if (
        (automation as any).automation?.active === false ||
        (automation as any).automation?.active === "false"
      ) {
        console.log(
          `Automation ${automation._id} is not active, skipping email send`,
        );
        continue;
      }

      // Skip if automation has no valid email template
      if (!automation.emailTemplate) {
        console.warn(
          `Automation ${automation._id} has no valid email template (template ID: ${(automation as any).automation?.template_id}), skipping send`,
        );
        continue;
      }

      if (!interviews?.email) {
        console.error(`No email found for email: ${email}`);
        continue;
      }

      const emailTemplate = automation.emailTemplate;

      const isInviteEmail = trigger_on_event?.toLowerCase() === "invite";

      const subject = htmlToPlainText(
        isInviteEmail
          ? replaceTokenForInvite(
              emailTemplate.subject,
              interviews,
              organizations,
              careers,
              careerTitles,
              getTokenMapper,
              replaceToken,
            )
          : replaceToken(
              emailTemplate.subject,
              interviews,
              organizations,
              careers,
            ),
      );

      const html = isInviteEmail
        ? replaceTokenForInvite(
            emailTemplate.message,
            interviews,
            organizations,
            careers,
            careerTitles,
            getTokenMapper,
            replaceToken,
          )
        : replaceToken(
            emailTemplate.message,
            interviews,
            organizations,
            careers,
          );
      const recipientEmail = interviews.email;

      // Get sender account and mode based on automation settings
      const senderInfo = await getSenderAccountAndMode(
        db,
        automation,
        orgID,
        careerId,
        undefined,
        userId, // Pass userId for "User" sender
      );
      const { sender, mode, accountId, userId: senderUserId } = senderInfo;

      // Check if schedule sending is enabled
      const isScheduled =
        emailTemplate.enable_schedule_send === "true" ||
        emailTemplate.enable_schedule_send === true;
      const hasPreferredTime =
        emailTemplate.enable_preferred_time === "true" ||
        emailTemplate.enable_preferred_time === true;
      const preferredTime = hasPreferredTime
        ? emailTemplate.preferred_time
        : undefined;

      if (
        isScheduled &&
        emailTemplate.schedule_delay &&
        emailTemplate.schedule_delay_unit
      ) {
        // Calculate send date based on delay + preferred time
        const sendDate = calculateSendDate(
          emailTemplate.schedule_delay,
          emailTemplate.schedule_delay_unit,
          preferredTime,
        );

        // Save to schedule-email collection
        const scheduleEmailData = {
          to: [recipientEmail],
          cc: [],
          bcc: [],
          subject: subject,
          body: html,
          sender: sender,
          sendDate: sendDate,
          orgID: orgID,
          careerId: careers?.id || null,
          threadId: null,
          accountId: accountId || null,
          userId: userId || null,
          status: "active",
          mode: mode,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          await db.collection("schedule-email").insertOne(scheduleEmailData);
          console.log(
            `Scheduled email saved for ${recipientEmail} to be sent on ${sendDate}`,
          );
        } catch (error) {
          console.error("Error saving scheduled email:", error);
          // Continue processing other automations even if one fails
        }
      } else if (hasPreferredTime && preferredTime) {
        // Preferred time only (no schedule delay) - schedule for preferred time today/tomorrow
        const sendDate = calculateSendDate(0, "days", preferredTime);

        // Save to schedule-email collection
        const scheduleEmailData = {
          to: [recipientEmail],
          cc: [],
          bcc: [],
          subject: subject,
          body: html,
          sender: sender,
          sendDate: sendDate,
          orgID: orgID,
          careerId: careers?.id || null,
          threadId: null,
          accountId: accountId || null,
          userId: userId || null,
          status: "active",
          mode: mode,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          await db.collection("schedule-email").insertOne(scheduleEmailData);
          console.log(
            `Scheduled email saved for ${recipientEmail} to be sent at preferred time ${preferredTime} on ${sendDate}`,
          );
        } catch (error) {
          console.error("Error saving scheduled email:", error);
          // Continue processing other automations even if one fails
        }
      } else {
        // Send immediately
        if (mode === "mailgun") {
          const mailgun = new Mailgun(formData);
          const mg = mailgun.client({
            username: "api",
            key: process.env.MAILGUN_API_KEY,
          });
          const messageData = {
            from: sender,
            to: recipientEmail,
            subject: subject,
            html: html,
          };
          const msg = await mg.messages.create("hellojia.ai", messageData);
          console.log(msg);

          // Save to mailgun-threads and mailgun-messages collections
          try {
            const orgObjectId = new ObjectId(orgID);

            // Manage thread record
            const normSubject = subject;
            const threadQuery: any = {
              organizationId: orgObjectId,
              normalizedSubject: normSubject,
            };
            if (careers?.id) {
              threadQuery.careerId = careers.id;
            } else {
              threadQuery.$or = [
                { careerId: null },
                { careerId: { $exists: false } },
              ];
            }

            let thread = await db
              .collection("mailgun-threads")
              .findOne(threadQuery);

            if (!thread) {
              const threadIdStr = new ObjectId().toHexString();
              const insertThread = {
                applicantId: null,
                organizationId: orgObjectId,
                subject,
                normalizedSubject: normSubject,
                threadId: threadIdStr,
                careerId: careers?.id || null,
                lastUpdated: new Date(),
                participants: [accountId || "fallback:noreply@hellojia.ai"],
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any;
              const tRes = await db
                .collection("mailgun-threads")
                .insertOne(insertThread);
              thread = await db
                .collection("mailgun-threads")
                .findOne({ _id: tRes.insertedId });
            } else {
              // Ensure mailgun account is listed in participants
              const participantId = accountId || "fallback:noreply@hellojia.ai";
              await db.collection("mailgun-threads").updateOne(
                { _id: thread._id },
                {
                  $set: { lastUpdated: new Date(), updatedAt: new Date() },
                  $addToSet: { participants: participantId },
                },
              );
            }

            // Persist mailgun message record
            const messageDoc: any = {
              threadId: thread._id,
              from: sender,
              to: [recipientEmail],
              cc: [],
              bcc: [],
              html: html || null,
              text: null,
              attachments: [],
              careerId: careers?.id || null,
              direction: "outbound",
              isAutomated: true,
              mailgunMessageId: msg?.id || msg?.message || null,
              mailgunAccountId: accountId || "fallback:noreply@hellojia.ai",
              mailgunReferencesRaw: null,
              mailgunReferences: null,
              recruiterId: senderUserId
                ? ObjectId.isValid(senderUserId)
                  ? new ObjectId(senderUserId)
                  : null
                : null,
              applicantId: null,
              organizationId: orgObjectId,
              receivedAt: null,
              sentAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            await db.collection("mailgun-messages").insertOne(messageDoc);
            console.log(
              `Email sent and saved to database for ${recipientEmail}. Thread ID: ${thread._id}, Mailgun Message ID: ${msg?.id || msg?.message}`,
            );
          } catch (dbError) {
            console.error("Error saving email to database:", dbError);
            // Don't fail the email sending if DB save fails
          }
        } else if (mode === "gmail" && senderUserId) {
          // Save subject and details to DB first, then send via Gmail API
          const orgObjectId = new ObjectId(orgID);
          let thread: any = null;
          let insertedMessageId: ObjectId | null = null;

          try {
            const normSubject = subject;
            const threadQuery: any = {
              organizationId: orgObjectId,
              normalizedSubject: normSubject,
            };
            if (careers?.id) {
              threadQuery.careerId = careers.id;
            } else {
              threadQuery.$or = [
                { careerId: null },
                { careerId: { $exists: false } },
              ];
            }

            thread = await db
              .collection("mailgun-threads")
              .findOne(threadQuery);

            if (!thread) {
              const threadIdStr = new ObjectId().toHexString();
              const insertThread = {
                applicantId: null,
                organizationId: orgObjectId,
                subject,
                normalizedSubject: normSubject,
                threadId: threadIdStr,
                careerId: careers?.id || null,
                lastUpdated: new Date(),
                participants: [accountId || "fallback:noreply@hellojia.ai"],
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any;
              const tRes = await db
                .collection("mailgun-threads")
                .insertOne(insertThread);
              thread = await db
                .collection("mailgun-threads")
                .findOne({ _id: tRes.insertedId });
            } else {
              const participantId = accountId || "fallback:noreply@hellojia.ai";
              await db.collection("mailgun-threads").updateOne(
                { _id: thread._id },
                {
                  $set: { lastUpdated: new Date(), updatedAt: new Date() },
                  $addToSet: { participants: participantId },
                },
              );
            }

            const messageDoc: any = {
              threadId: thread._id,
              from: sender,
              to: [recipientEmail],
              cc: [],
              bcc: [],
              html: html || null,
              text: null,
              attachments: [],
              careerId: careers?.id || null,
              direction: "outbound",
              isAutomated: true,
              mailgunMessageId: null,
              gmailMessageId: null,
              mailgunAccountId: accountId || "fallback:noreply@hellojia.ai",
              mailgunReferencesRaw: null,
              mailgunReferences: null,
              recruiterId: ObjectId.isValid(senderUserId)
                ? new ObjectId(senderUserId)
                : null,
              applicantId: null,
              organizationId: orgObjectId,
              receivedAt: null,
              sentAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const msgRes = await db
              .collection("mailgun-messages")
              .insertOne(messageDoc);
            insertedMessageId = msgRes.insertedId;

            const { gmailMessageId } = await sendGmailEmail(db, {
              senderUserId,
              orgId: orgID,
              sender,
              to: recipientEmail,
              subject,
              html,
              careerId: careerId || careers?.id || null,
            });

            if (gmailMessageId && insertedMessageId) {
              await db.collection("mailgun-messages").updateOne(
                { _id: insertedMessageId },
                {
                  $set: {
                    gmailMessageId,
                    sentAt: new Date(),
                    updatedAt: new Date(),
                  },
                },
              );
            }
            console.log(
              `Email sent via Gmail for ${recipientEmail}. Thread ID: ${thread._id}, Gmail Message ID: ${gmailMessageId}`,
            );
          } catch (gmailErr: any) {
            console.error(
              "Error sending Gmail automation email (sendEmailV2):",
              gmailErr,
            );
            if (insertedMessageId) {
              await db.collection("mailgun-messages").updateOne(
                { _id: insertedMessageId },
                {
                  $set: {
                    updatedAt: new Date(),
                    error: gmailErr?.message || "Gmail send failed",
                  },
                },
              );
            }
          }
        }
      }
    }
  }
}
