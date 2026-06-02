import { DEFAULT_EMAIL_TEMPLATES } from "./emailTemplateDefaults";

/**
 * Creates a virtual default automation for invite emails when no custom automations exist
 * This helper is used by both emailAutomation() and sendEmailV2() functions
 */
export function createVirtualInviteAutomation(
  stage_id: string,
  substage_id: string,
  careerId: string,
  orgID: string,
) {
  return {
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
  };
}

/**
 * Formats job titles as an HTML list for email display
 * Always renders as a list, even for single title
 */
export function formatJobTitlesList(titles: string[]): string {
  if (titles.length === 0) return "selected position";
  
  return `<ul style="margin: 12px 0; padding-left: 20px;">${titles
    .map((title) => `<li style="margin: 4px 0;">${title}</li>`)
    .join("")}</ul>`;
}

/**
 * Token replacement specifically for invite emails
 * Handles both [[Token Name]] format and <span data-token=""> format
 */
export function replaceTokenForInvite(
  html: string,
  interviews: any,
  organizations: any,
  careers: any,
  careerTitles: string[] | undefined,
  getTokenMapper: (interviews: any, organizations: any, careers: any) => Record<string, any>,
  replaceToken: (html: string, interviews: any, organizations: any, careers: any) => string,
): string {
  if (!html) return "";

  // First, replace [[Token Name]] format using helper
  let processedHtml = replaceSimpleBracketTokens(
    html,
    interviews,
    organizations,
    careers,
    careerTitles,
    getTokenMapper,
  );

  // Then, replace <span data-token=""> format using original logic
  return replaceToken(processedHtml, interviews, organizations, careers);
}

/**
 * Replace simple bracket tokens like [[Token Name]] with actual values
 * This is used for default templates that don't use the span data-token format
 */
export function replaceSimpleBracketTokens(
  html: string,
  interviews: any,
  organizations: any,
  careers: any,
  careerTitles?: string[],
  getTokenMapper?: (interviews: any, organizations: any, careers: any) => Record<string, any>,
): string {
  if (!html) return "";

  const tokenMapper = getTokenMapper ? getTokenMapper(interviews, organizations, careers) : {};

  // Format job titles list based on whether we have multiple careers
  const jobTitlesList = careerTitles && careerTitles.length > 0
    ? formatJobTitlesList(careerTitles)
    : careers?.jobTitle || "selected position";

  // Also add mappings for tokens that might not be in the standard mapper
  const extendedMapper: Record<string, string> = {
    ...tokenMapper,
    "Employer Company Name": organizations?.name || "[[Your Company]]",
    "Job Titles List": jobTitlesList,
    "JIA Job Portal Link": "https://hellojia.ai",
  };

  // Replace [[Token Name]] format
  return html.replace(/\[\[([^\]]+)\]\]/g, (match, tokenName) => {
    const replacement = extendedMapper[tokenName.trim()];
    return replacement !== undefined ? replacement : match;
  });
}

/**
 * Fetches email templates and maps them to automations
 * Handles virtual default templates that are already embedded
 */
export async function fetchAndMapTemplates(
  automationsArray: any[],
  emailTemplateModel: any,
  ObjectId: any,
) {
  const templateIds = automationsArray
    .map((a) => a.automation.template_id)
    .filter((id) => id !== "default-invite-template"); // Skip virtual template

  const emailTemplates = templateIds.length > 0
    ? await emailTemplateModel
        .find({ _id: { $in: templateIds.map((id) => new ObjectId(id)) } })
        .toArray()
    : [];

  const templateMap = new Map(
    emailTemplates.map((template) => [template._id.toString(), template]),
  );

  return automationsArray.map((automation) => {
    // If it's the virtual default automation, it already has emailTemplate embedded
    if (automation.automation.template_id === "default-invite-template") {
      return automation;
    }
    return {
      ...automation,
      emailTemplate:
        templateMap.get(automation.automation.template_id.toString()) || null,
    };
  });
}
