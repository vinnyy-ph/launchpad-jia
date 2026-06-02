"use client";

import OrgDetailsCard from "../Cards/OrgDetailsCard";
import BusinessDocumentsCard from "../Cards/BusinessDocumentsCard";
import EmailDomainsCard from "../Cards/EmailDomainsCard";

import { Organization } from "@/lib/types/organization";

interface OrgProfileTabProps {
  organization: Organization;
  onUpdate: (updates: Partial<Organization>) => void;
}

export default function OrgProfileTab({ organization, onUpdate }: OrgProfileTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <OrgDetailsCard organization={organization} onUpdate={onUpdate} />
      <BusinessDocumentsCard organization={organization} onUpdate={onUpdate} />
      <EmailDomainsCard organization={organization} onUpdate={onUpdate} />

    </div>
  );
}
