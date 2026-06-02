import { Db } from "mongodb";
import { logActivity } from "@/lib/utils/activityLogger";

type EmailAutomationActivityAction =
  | "Created Email Automation"
  | "Updated Email Automation"
  | "Activated Email Automation"
  | "Deactivated Email Automation"
  | "Deleted Email Automation";

interface EmailAutomationActor {
  uid?: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function recordEmailAutomationActivity({
  db,
  orgID,
  careerId,
  actor,
  action,
  automationName,
  stageName,
}: {
  db: Db;
  orgID: string;
  careerId?: string;
  actor: EmailAutomationActor;
  action: EmailAutomationActivityAction;
  automationName: string;
  stageName: string;
}) {
  const kindMap = {
    "Created Email Automation": "recruiter_created_email_automation",
    "Updated Email Automation": "recruiter_updated_email_automation",
    "Activated Email Automation": "recruiter_activated_email_automation",
    "Deactivated Email Automation": "recruiter_deactivated_email_automation",
    "Deleted Email Automation": "recruiter_deleted_email_automation",
  } as const;

  await logActivity({
    db,
    kind: kindMap[action],
    orgID: String(orgID),
    careerId: careerId ? String(careerId) : undefined,
    actor: {
      type: "recruiter",
      id: actor?.uid,
      email: actor?.email,
      name: actor?.name || actor?.email || "Recruiter",
      image: actor?.picture,
    },
    extraMetadata: {
      automationName: automationName || "Untitled",
      stageName: stageName || "selected",
    },
  });
}
