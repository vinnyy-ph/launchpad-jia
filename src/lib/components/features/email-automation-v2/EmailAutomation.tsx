"use client";

import styles from "./email-automation.module.scss";
import { ButtonV2 as Button, ToggleV2 as Toggle } from "@/lib/components/ui";
import { defaultEmailAutomations } from "@/lib/data/emailAutomation";
import type {
  EmailAutomationCardProps,
  EmailAutomationProps as StoredAutomationProps,
  TemplateProps,
} from "@/lib/types/email.type";
import type { Member } from "@/lib/types/projects";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import axios from "axios";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface EmailAutomationScreenProps {
  careerName?: string;
  careerId?: string;
  timelineStages: Record<string, any>[];
  setEmailAutomation: Dispatch<SetStateAction<boolean>>;
}

type ModalType = "create" | "delete" | "edit" | "preview" | null;

interface ActiveIds {
  stage_id: string;
  substage_id: string;
  automation_id: string;
}

type ActiveAutomation = EmailAutomationCardProps & {
  template?: TemplateProps | null;
};

const emptyIds: ActiveIds = {
  stage_id: "",
  substage_id: "",
  automation_id: "",
};

const Delete = dynamic(
  () => import("@/lib/components/sections/modal-v2/Delete"),
  { ssr: false },
);
const ManageAutomation = dynamic(
  () => import("@/lib/components/sections/modal-v2/ManageAutomation"),
  { ssr: false },
);
const PreviewAutomation = dynamic(
  () => import("@/lib/components/sections/modal-v2/PreviewAutomation"),
  { ssr: false },
);

function cloneTimelineStages(
  timelineStages: Record<string, any>[],
): Record<string, any>[] {
  return timelineStages.map((stage) => ({
    ...stage,
    substages: stage.substages.map((substage: Record<string, any>) => ({
      ...substage,
      automations: [],
    })),
  }));
}

function findAutomation(
  stages: Record<string, any>[],
  matcher: (automation: EmailAutomationCardProps) => boolean,
) {
  for (const stage of stages) {
    for (const substage of stage.substages) {
      for (const automation of substage.automations as EmailAutomationCardProps[]) {
        if (matcher(automation)) {
          return {
            automation,
            ids: {
              stage_id: stage.stage_id,
              substage_id: substage.substage_id,
              automation_id: automation.automation_id,
            },
          };
        }
      }
    }
  }

  return null;
}

function formatTemplateType(template?: TemplateProps | null, sender?: string, members: { email?: string; name?: string }[] = []) {
  if (template?.type) {
    const value = String(template.type);
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  if (!sender || sender === "System") return "System";

  const member = members.find(
    (m) => m.email?.toLowerCase() === sender.toLowerCase(),
  );
  if (member?.name) return member.name;

  return sender.includes("@")
    ? sender.split("@")[0].replace(/[._+]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : sender;
}

function formatTriggerLabel(automation: EmailAutomationCardProps) {
  if (automation.trigger_on_event !== "Reminder") {
    return automation.trigger_on_event;
  }

  if (automation.reminder_delay && automation.reminder_delay_unit) {
    const unit = automation.reminder_delay_unit.toLowerCase();
    const pluralized =
      automation.reminder_delay === "1" ? unit.replace(/s$/, "") : unit;
    return `Reminder after ${automation.reminder_delay} ${pluralized}`;
  }

  return "Reminder";
}

function getAutomationTone(trigger?: string) {
  if (trigger === "Drop") {
    return "danger";
  }

  if (trigger === "Reminder") {
    return "warning";
  }

  return "positive";
}

function sortAutomationsByActive(automations: EmailAutomationCardProps[]) {
  return [...automations].sort((a, b) => Number(b.active) - Number(a.active));
}

export default function EmailAutomation({
  careerName,
  careerId: careerIdProp,
  timelineStages,
  setEmailAutomation,
}: EmailAutomationScreenProps) {
  const { slug } = useParams();
  const careerId = careerIdProp || String(slug || "");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeAutomationRef = useRef<ActiveAutomation | null>(null);
  const templatesRef = useRef<TemplateProps[]>([]);
  const careerLabel = useMemo(() => {
    if (careerName?.trim()) {
      return careerName.trim();
    }

    return decodeURIComponent(careerId).replace(/-/g, " ");
  }, [careerId, careerName]);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeAutomation, setActiveAutomation] =
    useState<ActiveAutomation | null>(null);
  const [activeIds, setActiveIds] = useState<ActiveIds>(emptyIds);
  const [automations, setAutomations] = useState<Record<string, any>[]>(() =>
    cloneTimelineStages(timelineStages),
  );
  const [templates, setTemplates] = useState<TemplateProps[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [senderInfoMap, setSenderInfoMap] = useState<Map<string, { name: string; image: string }>>(new Map());

  const timelineStagesRef = useRef(timelineStages);
  useEffect(() => {
    timelineStagesRef.current = timelineStages;
  }, [timelineStages]);

  const getTemplate = useCallback(
    (templateId?: string, sourceTemplates?: TemplateProps[]) =>
      (sourceTemplates || templatesRef.current).find(
        (item) => item.template_id === templateId,
      ) || null,
    [],
  );

  const resetSelection = useCallback(() => {
    setActiveAutomation(null);
    setActiveIds(emptyIds);
  }, []);

  useEffect(() => {
    activeAutomationRef.current = activeAutomation;
  }, [activeAutomation]);

  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
    resetSelection();
  }, [resetSelection]);

  const handleCreateModal = useCallback(() => {
    setActiveModal("create");
  }, []);

  const handleDeleteModal = useCallback(() => {
    setActiveModal("delete");
  }, []);

  const handleEditModal = useCallback(() => {
    setActiveModal("edit");
  }, []);

  const handleEmailAutomation = useCallback(() => {
    setEmailAutomation(false);
  }, []);

  const handlePreviewModal = useCallback(() => {
    setActiveModal("preview");
  }, []);

  const setSelectedAutomation = useCallback(
    ({
      automation,
      stage_id,
      substage_id,
    }: {
      automation: EmailAutomationCardProps;
      stage_id: string;
      substage_id: string;
    }) => {
      const isSameAutomation =
        activeIds.automation_id === automation.automation_id &&
        activeIds.stage_id === stage_id &&
        activeIds.substage_id === substage_id;

      if (isSameAutomation && activeModal === null) {
        resetSelection();
        return;
      }

      setActiveAutomation({
        ...automation,
        template: getTemplate(automation.template_id),
      });
      setActiveIds({
        stage_id,
        substage_id,
        automation_id: automation.automation_id,
      });
    },
    [activeIds.automation_id, activeIds.stage_id, activeIds.substage_id, activeModal, getTemplate, resetSelection],
  );

  const updateAutomationState = useCallback(
    (
      ids: ActiveIds,
      updater: (automation: EmailAutomationCardProps) => EmailAutomationCardProps,
    ) => {
      setAutomations((prev) =>
        prev.map((stage) => {
          if (stage.stage_id !== ids.stage_id) return stage;

          return {
            ...stage,
            substages: stage.substages.map((substage: Record<string, any>) => {
              if (substage.substage_id !== ids.substage_id) return substage;

              return {
                ...substage,
                automations: substage.automations.map(
                  (automation: EmailAutomationCardProps) =>
                    automation.automation_id === ids.automation_id
                      ? updater(automation)
                      : automation,
                ),
              };
            }),
          };
        }),
      );
    },
    [],
  );

  const verify = useCallback(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      return "Your session has expired. Please sign in again.";
    }

    const activeOrg = localStorage.getItem("activeOrg");
    if (!activeOrg) {
      return "Failed to load organization information. Please check your session.";
    }

    try {
      const parsedOrg = JSON.parse(activeOrg);
      if (!parsedOrg._id) {
        return "Failed to load organization information. Please check your session.";
      }

      return { token, orgID: parsedOrg._id };
    } catch (error) {
      return "Failed to load organization information. Please check your session.";
    }
  }, []);

  const getTemplates = useCallback(async () => {
    const result = verify();

    if (typeof result === "string") {
      alert(result);
      return null;
    }

    try {
      const response = await api.get(
        `/api/emails/templates?orgID=${result.orgID}&includeAllOrgTemplates=true`,
      );
      const nextTemplates = response.data.templates as TemplateProps[];
      setTemplates(nextTemplates);
      return nextTemplates;
    } catch (error: any) {
      alert(
        error?.response?.data?.error ||
          "An unexpected error occurred. Please try again later.",
      );
      return null;
    }
  }, [verify]);

  const getMembers = useCallback(async () => {
    const result = verify();
    if (typeof result === "string") return;

    try {
      const token = localStorage.getItem("authToken");
      const headers = { Authorization: `Bearer ${token}` };
      const orgId = result.orgID;

      const [mailgunRes, gmailRes, membersRes] = await Promise.all([
        axios.get(`/api/mailgun-module/mg-fetch-org-accounts?orgId=${orgId}`, { headers }).catch(() => ({ data: {} })),
        axios.get(`/api/gmail/users?orgID=${orgId}`, { headers }).catch(() => ({ data: {} })),
        api.post("/api/fetch-members", { orgID: orgId }).catch(() => ({ data: [] })),
      ]);

      const membersData = Array.isArray(membersRes.data) ? membersRes.data as Member[] : [];
      setMembers(membersData);

      const membersByEmail = new Map<string, Member>();
      membersData.forEach((m) => { if (m.email) membersByEmail.set(m.email.toLowerCase(), m); });

      const map = new Map<string, { name: string; image: string }>();

      // Seed from members collection
      membersData.forEach((m) => {
        if (m.email) map.set(m.email.toLowerCase(), { name: m.name || "", image: m.image || "" });
      });

      // Enrich/override with mailgun accounts
      if (Array.isArray(mailgunRes.data?.accounts)) {
        mailgunRes.data.accounts.forEach((item: { email?: string; image?: string; name?: string; displayName?: string; sender_name?: string }) => {
          if (!item.email) return;
          const member = membersByEmail.get(item.email.toLowerCase());
          map.set(item.email.toLowerCase(), {
            name: item.displayName || item.name || item.sender_name || member?.name || "",
            image: item.image || member?.image || "",
          });
        });
      }

      // Enrich/override with gmail accounts
      if (Array.isArray(gmailRes.data?.result)) {
        gmailRes.data.result.forEach((item: { userDetails?: { email?: string; image?: string; name?: string } }) => {
          const email = item.userDetails?.email;
          if (!email) return;
          const member = membersByEmail.get(email.toLowerCase());
          map.set(email.toLowerCase(), {
            name: item.userDetails?.name || member?.name || "",
            image: item.userDetails?.image || member?.image || "",
          });
        });
      }

      setSenderInfoMap(map);
    } catch {
      // non-critical — silently fail
    }
  }, [verify]);  const getAutomation = useCallback(async (templateSource?: TemplateProps[] | null) => {
    const result = verify();

    if (typeof result === "string") {
      alert(result);
      return;
    }

    try {
      const response = await api.get(
        `/api/emails/automation?orgID=${result.orgID}&careerId=${careerId}`,
      );
      const storedAutomations = response.data as (StoredAutomationProps & {
        automation: EmailAutomationCardProps;
      })[];
      const updated = cloneTimelineStages(timelineStagesRef.current);
      const persistedDefaultIds = new Set(
        storedAutomations
          .filter((item) => item.automation?.default_automation_id)
          .map((item) => item.automation?.default_automation_id),
      );
      const mergedAutomations = [
        ...defaultEmailAutomations.filter(
          (item) => !persistedDefaultIds.has(item.automation.default_automation_id),
        ),
        ...storedAutomations,
      ];

      mergedAutomations.forEach((item) => {
        const stage = updated.find((entry) => entry.stage_id === item.stage_id);
        const substage = stage?.substages.find(
          (entry: Record<string, any>) => entry.substage_id === item.substage_id,
        );

        if (!substage) return;

        substage.automations.push({
          automation_id: String(item.automation_id),
          ...item.automation,
        });
      });

      setAutomations(updated);

      const currentActiveAutomation = activeAutomationRef.current;
      if (!currentActiveAutomation) {
        return;
      }

      const match = findAutomation(
        updated,
        (automation) =>
          String(automation.automation_id) ===
            String(currentActiveAutomation.automation_id) ||
          (Boolean(currentActiveAutomation.default_automation_id) &&
            automation.default_automation_id ===
              currentActiveAutomation.default_automation_id),
      );

      if (!match) {
        setActiveModal(null);
        resetSelection();
        return;
      }

      setActiveAutomation({
        ...match.automation,
        template: getTemplate(match.automation.template_id, templateSource || undefined),
      });
      setActiveIds(match.ids);
    } catch (error) {}
  }, [
    careerId,
    getTemplate,
    resetSelection,
    verify,
  ]);

  useEffect(() => {
    const handleCloseDropdown = (event: MouseEvent) => {
      if (activeModal !== null) {
        return;
      }

      const currentRef = dropdownRef.current;
      if (currentRef && !currentRef.contains(event.target as Node)) {
        resetSelection();
      }
    };

    document.addEventListener("mousedown", handleCloseDropdown);
    return () => document.removeEventListener("mousedown", handleCloseDropdown);
  }, [activeModal, resetSelection]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const nextTemplates = await getTemplates();
      if (cancelled) return;
      await getAutomation(nextTemplates);
      if (cancelled) return;
      await getMembers();
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [careerId, getAutomation, getTemplates, getMembers]);

  useEffect(() => {
    if (!activeAutomation) return;

    setActiveAutomation((prev) =>
      prev
        ? {
            ...prev,
            template: getTemplate(prev.template_id),
          }
        : prev,
    );
  }, [getTemplate, activeAutomation?.automation_id]);

  const handleDeleteAutomation = useCallback(() => {
    if (!activeAutomation?.automation_id) {
      alert("No automation selected for deletion");
      return;
    }

    const result = verify();

    if (typeof result === "string") {
      alert(result);
      return;
    }

    api
      .delete(
        `/api/emails/automation?automation_id=${activeAutomation.automation_id}&orgID=${result.orgID}`,
      )
      .then((response) => {
        if (!response.data?.success) {
          throw new Error(response.data?.error || "Failed to delete automation");
        }

        handleCloseModal();
        getAutomation();
      })
      .catch((error) => {
        alert(
          error?.response?.data?.error ||
            error?.message ||
            "An unexpected error occurred. Please try again later.",
        );
      });
  }, [activeAutomation?.automation_id, getAutomation, handleCloseModal, verify]);

  const handleToggle = useCallback(
    (
      { stage_id, substage_id, automation_id }: ActiveIds,
      checked?: boolean,
    ) => {
      const currentAutomation = findAutomation(
        automations,
        (automation) => automation.automation_id === automation_id,
      )?.automation;

      if (!currentAutomation) {
        alert("Automation not found");
        return;
      }

      const nextActive =
        typeof checked === "boolean" ? checked : !currentAutomation.active;

      if (nextActive === currentAutomation.active) {
        return;
      }
      updateAutomationState(
        { stage_id, substage_id, automation_id },
        (automation) => ({
          ...automation,
          active: nextActive,
        }),
      );
      setActiveAutomation((prev) =>
        prev?.automation_id === automation_id
          ? { ...prev, active: nextActive }
          : prev,
      );

      const result = verify();
      if (typeof result === "string") {
        alert(result);
        updateAutomationState(
          { stage_id, substage_id, automation_id },
          (automation) => ({
            ...automation,
            active: currentAutomation.active,
          }),
        );
        setActiveAutomation((prev) =>
          prev?.automation_id === automation_id
            ? { ...prev, active: currentAutomation.active }
            : prev,
        );
        return;
      }

      api
        .patch("/api/emails/automation", {
          automation_id,
          orgID: result.orgID,
          active: nextActive,
          careerId,
        })
        .then((response) => {
          if (!response.data?.success) {
            throw new Error(
              response.data?.error || "Failed to update automation status",
            );
          }

          if (String(automation_id).toLowerCase().includes("default")) {
            getAutomation();
          }
        })
        .catch((error) => {
          const errorMessage =
            error?.response?.data?.error ||
            error?.response?.data?.message ||
            error?.message ||
            "An unexpected error occurred. Please try again later.";

          alert(errorMessage);
          updateAutomationState(
            { stage_id, substage_id, automation_id },
            (automation) => ({
              ...automation,
              active: currentAutomation.active,
            }),
          );
          setActiveAutomation((prev) =>
            prev?.automation_id === automation_id
              ? { ...prev, active: currentAutomation.active }
              : prev,
          );
        });
    },
    [automations, careerId, getAutomation, updateAutomationState, verify],
  );

  const refreshAutomationData = useCallback(async () => {
    const nextTemplates = await getTemplates();
    await getAutomation(nextTemplates);
  }, [getAutomation, getTemplates]);

  return (
    <div className={styles.emailAutomation}>
      <Delete
        description="Are you sure you want to delete this email automation? This action cannot be undone."
        isVisible={activeModal == "delete"}
        label="Delete automation"
        onClose={handleCloseModal}
        onManage={handleDeleteAutomation}
      />

      <ManageAutomation
        activeID={activeIds}
        careerId={careerId}
        existingAutomation={activeModal === "edit" ? activeAutomation : null}
        isVisible={activeModal == "create" || activeModal == "edit"}
        onClose={handleCloseModal}
        onSuccess={refreshAutomationData}
        onTemplatesRefresh={getTemplates}
        templates={templates}
        timelineStages={timelineStages}
      />

      <PreviewAutomation
        automation={activeAutomation}
        isVisible={activeModal == "preview"}
        onClose={handleCloseModal}
        onDelete={() => setActiveModal("delete")}
        onEdit={() => setActiveModal("edit")}
        onToggle={(checked) => {
          if (activeIds.automation_id) {
            handleToggle(activeIds, checked);
          }
        }}
      />

      <div className={styles.header}>
        <Button
          icon="/icons/circle-arrow-left.svg"
          label="Back"
          variant="secondary"
          onClick={handleEmailAutomation}
        />
        <span className={styles.label}>Manage Automations</span>
        <span className={styles.career}>{typeof window !== "undefined" ? new DOMParser().parseFromString(careerLabel, "text/html").body.textContent : careerLabel}</span>
      </div>

      <div className={styles.stageContainer}>
        {automations.map((stage) => (
          <div className={styles.stageGroup} key={stage.stage_id}>
            <span className={styles.stageTitle}>{stage.stage_name}</span>

            <div className={styles.substageContainer}>
              {stage.substages.map((substage: Record<string, any>) => (
                <div
                  className={styles.substageGroup}
                  key={substage.substage_id}
                >
                  <div className={styles.substageHeader}>
                    {substage.automations.some(
                      (automation: EmailAutomationCardProps) => automation.active,
                    ) && (
                      <div>
                        <img alt="" src="/figma-assets/email-automation/zap.svg" />
                      </div>
                    )}
                    <span className={styles.substageTitle}>
                      {substage.substage_name}
                    </span>
                    <span className={styles.stats}>
                      {substage.automations.length}
                    </span>
                  </div>

                  <div className={styles.cardContainer}>
                    {sortAutomationsByActive(substage.automations).map(
                      (card: EmailAutomationCardProps) => {
                        const isActiveDropdown =
                          activeIds.automation_id === card.automation_id &&
                          activeIds.stage_id === stage.stage_id &&
                          activeIds.substage_id === substage.substage_id;
                        const template = getTemplate(card.template_id);
                        const isDefaultAutomation = Boolean(
                          card.default_automation_id,
                        );
                        const tone = getAutomationTone(card.trigger_on_event);

                        return (
                          <div
                            className={`${styles.card} ${
                              card.active
                                ? styles[`tone-${tone}`]
                                : styles.inactiveCard
                            }`}
                            key={card.automation_id}
                          >
                            <span
                              className={`${styles.trigger} ${
                                card.active
                                  ? styles[`trigger-${tone}`]
                                  : styles.inactiveTrigger
                              }`}
                            >
                              {formatTriggerLabel(card)}
                            </span>

                            <div className={styles.contentGroup}>
                              <div className={styles.controlGroup}>
                                <span
                                  className={`${styles.status} ${
                                    card.active
                                      ? styles.activeStatus
                                      : styles.inactiveStatus
                                  }`}
                                >
                                  {card.active && (
                                    <img
                                      alt=""
                                      src="/figma-assets/email-automation/zap.svg"
                                    />
                                  )}
                                  {card.active ? "Active" : "Inactive"}
                                </span>
                                <Toggle
                                  checked={card.active}
                                  onChange={(checked) =>
                                    handleToggle({
                                      stage_id: stage.stage_id,
                                      substage_id: substage.substage_id,
                                      automation_id: card.automation_id,
                                    }, checked)
                                  }
                                />
                              </div>

                              <div className={styles.controlGroup}>
                                <span className={styles.cardTitle}>
                                  {card.automation_name}
                                </span>

                                <div
                                  className={`${styles.icon} ${
                                    isActiveDropdown ? styles.active : ""
                                  }`}
                                  onClick={() =>
                                    setSelectedAutomation({
                                      automation: card,
                                      stage_id: stage.stage_id,
                                      substage_id: substage.substage_id,
                                    })
                                  }
                                >
                                  <img alt="" src="/icons/ellipsis.svg" />
                                </div>

                                <div
                                  className={`${styles.dropdown} ${
                                    isActiveDropdown ? styles.active : ""
                                  }`}
                                  ref={isActiveDropdown ? dropdownRef : null}
                                >
                                  <span>Options</span>
                                  <span
                                    className={
                                      isDefaultAutomation ? styles.disabled : ""
                                    }
                                    onClick={() => {
                                      if (isDefaultAutomation) return;
                                      setActiveModal("edit");
                                    }}
                                  >
                                    Edit
                                  </span>
                                  <span
                                    className={
                                      isDefaultAutomation ? styles.disabled : ""
                                    }
                                    onClick={() => {
                                      if (isDefaultAutomation) return;
                                      setActiveModal("delete");
                                    }}
                                  >
                                    Delete
                                  </span>
                                </div>
                              </div>

                              <hr />

                              <div className={styles.detailsGroup}>
                                {card.trigger_on_event === "Endorse" && (
                                  <div className={styles.textGroup}>
                                    <span className={styles.label}>From</span>
                                    <div>
                                      <span className={styles.value}>
                                        {card.from_stage || "Any stage"}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                <div className={styles.textGroup}>
                                  <span className={styles.label}>Template</span>
                                  <div>
                                    <span className={styles.value}>
                                      {template?.template_name || "Unknown template"}
                                    </span>
                                    <span className={styles.type}>
                                      {formatTemplateType(template, card.sender, members)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <Button
                                icon="/figma-assets/email-automation/eye.svg"
                                label="Preview automation"
                                variant="secondary"
                                onClick={() => {
                                  setActiveAutomation({
                                    ...card,
                                    template: getTemplate(card.template_id),
                                  });
                                  setActiveIds({
                                    stage_id: stage.stage_id,
                                    substage_id: substage.substage_id,
                                    automation_id: card.automation_id,
                                  });
                                  handlePreviewModal();
                                }}
                              />

                              <span className={styles.creator}>
                                Created by{" "}
                                {(() => {
                                  if (!card.sender || card.sender === "System") {
                                    return (
                                      <>
                                        <img
                                          alt="System"
                                          className={styles.creatorAvatar}
                                          src="/jia-dashboard-logo.png"
                                        />
                                        <span className={styles.creatorName}>System</span>
                                      </>
                                    );
                                  }
                                  const senderKey = card.sender.toLowerCase();
                                  const senderInfo = senderInfoMap.get(senderKey);
                                  const member = members.find(
                                    (m) => m.email?.toLowerCase() === senderKey,
                                  );
                                  const image = senderInfo?.image || member?.image || "";
                                  const name =
                                    senderInfo?.name ||
                                    member?.name ||
                                    (card.sender.includes("@")
                                      ? card.sender
                                          .split("@")[0]
                                          .replace(/[._+]/g, " ")
                                          .replace(/\b\w/g, (c) => c.toUpperCase())
                                      : card.sender);
                                  return (
                                    <>
                                      {image && (
                                        <img
                                          alt={name}
                                          className={styles.creatorAvatar}
                                          src={image}
                                        />
                                      )}
                                      <span className={styles.creatorName}>{name}</span>
                                    </>
                                  );
                                })()}
                              </span>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>

                  <span
                    className={styles.add}
                    onClick={() => {
                      setActiveAutomation(null);
                      setActiveIds({
                        stage_id: stage.stage_id,
                        substage_id: substage.substage_id,
                        automation_id: "",
                      });
                      handleCreateModal();
                    }}
                  >
                    <img alt="" src="/figma-assets/email-automation/plus.svg" />
                    Add automation
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
