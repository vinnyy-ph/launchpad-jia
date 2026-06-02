"use client";

import styles from "./email-automation.module.scss";
import { Button, Toggle, Tooltip } from "@/lib/components/ui";
import { defaultEmailAutomations } from "@/lib/data/emailAutomation";
import type {
  TemplateProps,
  EmailAutomationCardProps,
  EmailAutomationProps,
} from "@/lib/types/email.type";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/utils/apiClient";

const Delete = dynamic(() => import("@/lib/components/sections/modal/Delete"), {
  ssr: false,
  loading: () => null,
});

const ManageAutomation = dynamic(
  () => import("@/lib/components/sections/modal/ManageAutomation"),
  {
    ssr: false,
    loading: () => null,
  }
);

const PreviewAutomation = dynamic(
  () => import("@/lib/components/sections/modal/PreviewAutomation"),
  {
    ssr: false,
    loading: () => null,
  }
);

interface IDProps {
  stage_id: string;
  substage_id: string;
  automation_id: string;
}

type Modal = "add" | "delete" | "edit" | "view" | null;

export default function ({
  timelineStages,
  setEmailAutomation,
  careerId: careerIdProp,
  embedded = false,
}: {
  setEmailAutomation: (emailAutomation: boolean) => void;
  timelineStages: any[];
  careerId?: string;
  embedded?: boolean;
}) {
  const { slug } = useParams();
  const careerId = careerIdProp || (slug as string);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [activeAutomation, setActiveAutomation] = useState<
    (EmailAutomationCardProps & { template?: TemplateProps | null }) | null
  >(null);
  const [automations, setAutomations] = useState(timelineStages);
  const [dropdown, setDropdown] = useState<IDProps>({
    stage_id: "",
    substage_id: "",
    automation_id: "",
  });
  const [modal, setModal] = useState<Modal>(null);
  const [templates, setTemplates] = useState<TemplateProps[]>([]);
  const dropdownItems = [
    {
      icon: "/icons/eye.svg",
      label: "View Automation",
      onClick: () => {
        setModal("view");
      },
    },
    {
      icon: "/icons/edit-2.svg",
      label: "Edit",
      onClick: () => {
        setModal("edit");
      },
    },
    {
      icon: "/icons/trash.svg",
      label: "Delete",
      onClick: () => {
        setModal("delete");
      },
    },
  ];

  const handleCloseModal = useCallback(() => {
    setActiveAutomation(null);
    setDropdown({
      automation_id: "",
      stage_id: "",
      substage_id: "",
    });
    setModal(null);
  }, []);

  const handleDeleteAutomation = useCallback(() => {
    if (!activeAutomation || !activeAutomation.automation_id) {
      alert("No automation selected for deletion");
      return;
    }

    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { orgID } = result;

    api
      .delete(`/api/emails/automation?automation_id=${activeAutomation.automation_id}&orgID=${orgID}`)
      .then((res) => {
        if (res.data.success) {
          handleCloseModal();
          getAutomation();
        } else {
          alert(res.data.error || "Failed to delete automation");
        }
      })
      .catch((err) => {
        console.error("Error deleting automation:", err);
        alert(
          err?.response?.data?.error ||
            "An unexpected error occurred. Please try again later."
        );
      });
  }, [activeAutomation, handleCloseModal]);

  const handleDroppedCandidates = useCallback(() => {
    // TODO(Vince)
  }, []);

  const handleToggle = useCallback(
    ({ stage_id, substage_id, automation_id }: IDProps) => {
      // Find the current automation to get its current active status
      const currentAutomation = automations
        .find((stage) => stage.stage_id === stage_id)
        ?.substages.find((substage) => substage.substage_id === substage_id)
        ?.automations.find(
          (automation) => automation.automation_id === automation_id
        );

      if (!currentAutomation) {
        alert("Automation not found");
        return;
      }

      const newActiveStatus = !currentAutomation.active;

      // Optimistically update the UI
      setAutomations((prev) =>
        prev.map((stage) => {
          if (stage.stage_id !== stage_id) return stage;

          return {
            ...stage,
            substages: stage.substages.map((substage) => {
              if (substage.substage_id !== substage_id) return substage;

              return {
                ...substage,
                automations: substage.automations.map((automation) => {
                  if (automation.automation_id !== automation_id)
                    return automation;

                  return {
                    ...automation,
                    active: newActiveStatus,
                  };
                }),
              };
            }),
          };
        })
      );

      // Verify authentication
      const result = verify();

      if (typeof result == "string") {
        alert(result);
        // Revert the optimistic update
        setAutomations((prev) =>
          prev.map((stage) => {
            if (stage.stage_id !== stage_id) return stage;

            return {
              ...stage,
              substages: stage.substages.map((substage) => {
                if (substage.substage_id !== substage_id) return substage;

                return {
                  ...substage,
                  automations: substage.automations.map((automation) => {
                    if (automation.automation_id !== automation_id)
                      return automation;

                    return {
                      ...automation,
                      active: currentAutomation.active, // Revert to original
                    };
                  }),
                };
              }),
            };
          })
        );
        return;
      }

      const { orgID } = result;

      // Make API call to update the automation status
      api
        .patch("/api/emails/automation", {
          automation_id,
          orgID,
          active: newActiveStatus,
          careerId,
        })
        .then((res) => {
          if (res.data && res.data.success) {
            // Refetch so default automations get real _id from DB after first toggle
            if (String(automation_id).toLowerCase().includes("default")) {
              getAutomation();
            }
          } else {
            alert(res.data?.error || "Failed to update automation status");
            // Revert the optimistic update
            setAutomations((prev) =>
              prev.map((stage) => {
                if (stage.stage_id !== stage_id) return stage;

                return {
                  ...stage,
                  substages: stage.substages.map((substage) => {
                    if (substage.substage_id !== substage_id) return substage;

                    return {
                      ...substage,
                      automations: substage.automations.map((automation) => {
                        if (automation.automation_id !== automation_id)
                          return automation;

                        return {
                          ...automation,
                          active: currentAutomation.active, // Revert to original
                        };
                      }),
                    };
                  }),
                };
              })
            );
          }
        })
        .catch((err) => {
          console.error("Error updating automation status:", err);
          const errorMessage =
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            "An unexpected error occurred. Please try again later.";
          alert(errorMessage);

          // Revert the optimistic update
          setAutomations((prev) =>
            prev.map((stage) => {
              if (stage.stage_id !== stage_id) return stage;

              return {
                ...stage,
                substages: stage.substages.map((substage) => {
                  if (substage.substage_id !== substage_id) return substage;

                  return {
                    ...substage,
                    automations: substage.automations.map((automation) => {
                      if (automation.automation_id !== automation_id)
                        return automation;

                      return {
                        ...automation,
                        active: currentAutomation.active, // Revert to original
                      };
                    }),
                  };
                }),
              };
            })
          );
        });
    },
    [automations]
  );

  const manageAutomation = useCallback(() => {
    // TODO(Vince)
  }, []);

  function handleCloseDropdown(e: MouseEvent) {
    const currentRef = dropdownRef.current;

    if (currentRef && !currentRef.contains(e.target as Node)) {
      setActiveAutomation(null);
      setDropdown({
        stage_id: "",
        substage_id: "",
        automation_id: "",
      });
    }
  }

  useEffect(() => {
    getAutomation();
    getTemplates();

    document.addEventListener("mousedown", handleCloseDropdown);
    return () => document.removeEventListener("mousedown", handleCloseDropdown);
  }, []);

  function getAutomation() {
    // TODO(Vince)

    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { orgID } = result;

    api
      .get(`/api/emails/automation?orgID=${orgID}&careerId=${careerId}`)
      .then((res) => {
        const result = res.data as (EmailAutomationProps & {
          automation: {
            default_automation_id: string;
          };
        })[];
        const updated = structuredClone(timelineStages);
        const apiDefaultIDs = new Set(
          result
            .filter((item) => item.automation?.default_automation_id)
            .map((item) => item.automation?.default_automation_id)
        );
        const filteredDefaultAutomations = defaultEmailAutomations.filter(
          (item) => !apiDefaultIDs.has(item.automation?.default_automation_id)
        );
        const mergedAutomations = [...filteredDefaultAutomations, ...result];

        mergedAutomations.forEach((item) => {
          const stage = updated.find((s) => s.stage_id === item.stage_id);
          if (!stage) return;

          const substage = stage.substages.find(
            (ss) => ss.substage_id === item.substage_id
          );
          if (!substage) return;

          substage.automations.push({
            automation_id: item.automation_id,
            ...item.automation,
          });
        });

        setAutomations(updated);
      })
      .catch((err) => {});
  }

  function verify() {
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
    } catch (err) {
      return "Failed to load organization information. Please check your session.";
    }
  }

  function getTemplates() {
    // TODO(Vince)
    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { orgID } = result;

    api
      .get(`/api/emails/templates?orgID=${orgID}`)
      .then((res) => {
        setTemplates(res.data.templates as TemplateProps[]);
      })
      .catch((err) => {
        alert(
          err?.response?.data?.error ||
            "An unexpected error occurred. Please try again later."
        );
      });
  }

  const modals = (
    <>
      <Delete
        description="Are you sure you want to delete this email automation? This action cannot be undone."
        label="Delete Automation"
        isVisible={modal == "delete" && !!activeAutomation}
        onClick={handleDeleteAutomation}
        onClose={handleCloseModal}
      />

      <ManageAutomation
        timelineStages={timelineStages}
        activeID={dropdown}
        isVisible={modal == "add" || modal == "edit"}
        templates={templates}
        onClose={handleCloseModal}
        onSuccess={getAutomation}
        existingAutomation={modal == "edit" ? activeAutomation : null}
      />

      <PreviewAutomation
        automation={activeAutomation}
        isVisible={modal == "view" && !!activeAutomation}
        onClose={handleCloseModal}
      />
    </>
  );

  const stageGroups = automations.map((automation) => (
          <div className={styles.stageGroup} key={automation.stage_id}>
            <div className={styles.stageHeader}>
              <span className={styles.stageLabel}>{automation.stage_name}</span>
              <span className={styles.stats}>{0}</span>
              <Button
                icon="/icons/user-x.svg"
                label={`${0} Dropped Candidates`}
                variant="secondary"
                onClick={handleDroppedCandidates}
              />
            </div>
            <div className={styles.substageGroup}>
              {automation.substages.map((substage) => (
                <div className={styles.substage} key={substage.substage_id}>
                  <div className={styles.substageHeader}>
                    {substage.automations.some(
                      (automation) => automation.active
                    ) && (
                      <div className={styles.icon}>
                        <img alt="" src="/icons/zap.svg" />
                      </div>
                    )}
                    <span className={styles.substageLabel}>
                      {substage.substage_name}
                    </span>
                    <span className={styles.stats}>{0}</span>
                    <img alt="" src="/icons/ellipsis.svg" />
                  </div>

                  <div className={styles.cardGroup}>
                    {substage.automations.length > 0 &&
                      substage.automations.map((card) => (
                        <div className={styles.card} key={card.automation_id}>
                          <div className={styles.toggleGroup}>
                            <span className={card.active ? styles.active : ""}>
                              {card.active && (
                                <img alt="" src="/icons/zap.svg" />
                              )}
                              {card.active ? "Active" : "Inactive"}
                            </span>
                            <Toggle
                              checked={card.active}
                              onChange={() =>
                                handleToggle({
                                  stage_id: automation.stage_id,
                                  substage_id: substage.substage_id,
                                  automation_id: card.automation_id,
                                })
                              }
                            />
                          </div>

                          <div className={styles.nameGroup}>
                            <span>{card.automation_name}</span>
                            <img
                              alt=""
                              className={styles.ellipsis}
                              src="/icons/ellipsis.svg"
                              onClick={() => {
                                const template = templates.find(
                                  (t) => t.template_id == card.template_id
                                );
                                setActiveAutomation({
                                  ...card,
                                  template: template ?? null,
                                });
                                setDropdown({
                                  stage_id: automation.stage_id,
                                  substage_id: substage.substage_id,
                                  automation_id: card.automation_id,
                                });
                              }}
                            />

                            <div
                              className={`${styles.dropdown} ${
                                dropdown.automation_id == card.automation_id &&
                                dropdown.stage_id == automation.stage_id &&
                                dropdown.substage_id == substage.substage_id
                                  ? styles.active
                                  : ""
                              }`}
                              ref={
                                dropdown.automation_id == card.automation_id &&
                                dropdown.stage_id == automation.stage_id &&
                                dropdown.substage_id == substage.substage_id
                                  ? dropdownRef
                                  : null
                              }
                            >
                              {dropdownItems.map((item) => (
                                <span
                                  className={
                                    card?.default_automation_id &&
                                    item.label != "View Automation"
                                      ? styles.disabled
                                      : ""
                                  }
                                  key={item.label}
                                  onClick={() => {
                                    item.onClick();
                                    // Only reset dropdown if not editing (edit needs to preserve state)
                                    if (item.label !== "Edit") {
                                      setDropdown({
                                        stage_id: "",
                                        substage_id: "",
                                        automation_id: "",
                                      });
                                    }
                                  }}
                                >
                                  <img alt="" src={item.icon} />
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className={styles.textGroup}>
                            <span className={styles.label}>
                              Trigger on Event
                            </span>
                            <span
                              className={`${styles.value} ${
                                styles[card.trigger_on_event.toLowerCase()]
                              }`}
                            >
                              {card.trigger_on_event}
                            </span>
                          </div>

                          <div className={styles.textGroup}>
                            <span className={styles.label}>From Stage</span>
                            <span className={styles.value}>
                              {card.from_stage || "N/A"}
                            </span>
                          </div>

                          <div className={styles.textGroup}>
                            <span className={styles.label}>To Stage</span>
                            <span className={styles.value}>
                              {card.to_stage || "N/A"}
                            </span>
                          </div>

                          <hr className={styles.divider} />

                          <span className={styles.creator}>
                            Created by
                            <span className={styles.value}>{card.sender}</span>
                            {card.sender == "System" && (
                              <Tooltip
                                message="System-created automations cannot be edited and deleted, but can be toggled off or overridden."
                                width={215}
                              />
                            )}
                          </span>
                        </div>
                      ))}
                  </div>

                  <span
                    className={styles.add}
                    onClick={() => {
                      setModal("add");
                      setDropdown({
                        stage_id: automation.stage_id,
                        substage_id: substage.substage_id,
                        automation_id: "",
                      });
                    }}
                  >
                    <img alt="" src="/icons/plus-2.svg" />
                    Add Automation
                  </span>
                </div>
              ))}
            </div>
          </div>
  ));

  if (embedded) {
    return (
      <div className={styles.emailAutomation} style={{ height: '100%', overflow: 'visible' }}>
        {modals}
        <div className={styles.automationGroup} style={{ overflow: 'visible', height: '100%' }}>
          {stageGroups}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.emailAutomation}>
      {modals}

      <div className={styles.header}>
        <span className={styles.label}>Manage Email Automation</span>
        <Button
          icon="/icons/check.svg"
          label="Done"
          onClick={() => setEmailAutomation(false)}
        />
      </div>

      <div className={styles.automationGroup}>
        {stageGroups}
      </div>
    </div>
  );
}
