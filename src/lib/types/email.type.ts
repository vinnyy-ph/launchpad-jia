import { GoogleScopesMapping } from "@/lib/data/googleScope";

export interface EmailAutomationProps {
  automation_id: string;
  stage_id: string;
  stage_name: string;
  substage_id: string;
  substage_name: string;
  automation: {
    active: boolean;
    automation_name: string;
    trigger_on_event: string;
    from_stage: string;
    to_stage: string;
    sender: string;
    template_id: string;
  };
}

export interface EmailAutomationCardProps {
  automation_id: string;
  active: boolean;
  automation_name: string;
  trigger_on_event: string;
  from_stage: string;
  to_stage: string;
  sender: string;
  template_id: string;
  default_automation_id?: string;
  reminder_delay?: string;
  reminder_delay_unit?: string;
  creator_email?: string;
}

export interface EmailSettingsProps {
  user: {
    name: string;
    email: string;
    picture: string;
  };
  connected: boolean;
  dateSync: string;
  enableGmailSending: boolean;
  permission: (keyof typeof GoogleScopesMapping)[];
  preferGmail: boolean;
  signature: string;
  outlookUser?: {
    name?: string;
    email?: string;
    picture?: string;
  } | null;
  outlookEmail?: string;
  outlookConnected?: boolean;
  outlookDateSync?: string;
  outlookTokens?: unknown;
  enableOutlookSending?: boolean;
}

export interface TemplateProps {
  template_id: string;
  template_name: string;
  subject: string;
  message: string;
  orgID?: string;
  creator: {
    email?: string;
    id?: string;
    picture: string;
    name: string;
    role: string;
  };
  date_updated: string;
  type: "user" | "global" | "system";
  // Schedule sending fields (optional)
  enable_schedule_send?: string;
  schedule_delay?: string;
  schedule_delay_unit?: string;
  // Preferred time fields (optional)
  enable_preferred_time?: string;
  preferred_time?: string;
  // Copy flag (optional)
  is_copy?: boolean;
}
