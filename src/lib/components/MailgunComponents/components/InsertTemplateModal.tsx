import React, { useState } from "react";
import styles from "@/lib/components/MailgunComponents/email.module.scss";
import Button from "@/lib/components/ui/button/Button";
import { api } from "@/lib/utils/apiClient";

const tabs = ["user", "global", "system"];

const InsertTemplateModal = ({ isOpen, onClose, onSelectTemplate }) => {
  const [activeTab, setActiveTab] = useState<"user" | "global" | "system">(
    "user",
  );
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(
    new Set(),
  );
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Utility to clean up template content: remove unnecessary tags, replace span tokens with {{token}}
  function cleanTemplateContent(html) {
    if (!html) return "";
    let out = html;
    // Replace <span ... data-token="...">...</span> with {{token}}
    out = out.replace(
      /<span[^>]*data-token=["']([^"']+)["'][^>]*>(.*?)<\/span>/gi,
      (match, token, text) => {
        const tokenName = token.split("-").slice(1).join("-") || token;
        return `{{${tokenName.trim()}}}`;
      },
    );
    // Replace <br> and <div> with newlines
    out = out.replace(/<br\s*\/?>/gi, "\n");
    out = out.replace(/<div[^>]*>/gi, "\n");
    out = out.replace(/<\/div>/gi, "");
    // Remove all other tags (e.g., <b>, <span> left)
    out = out.replace(/<[^>]+>/g, "");
    // Convert HTML entities for nbsp to space
    out = out.replace(/&nbsp;/gi, " ");
    // Collapse multiple newlines to max 2
    out = out.replace(/\n{3,}/g, "\n\n");
    // Trim leading/trailing whitespace and newlines
    out = out.trim();
    return out;
  }

  React.useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    const fetchTemplates = async () => {
      try {
        let orgId = null;
        if (typeof window !== "undefined") {
          const orgRaw = localStorage.getItem("activeOrg");
          if (orgRaw) {
            try {
              const parsed = JSON.parse(orgRaw);
              orgId = parsed?._id || parsed?.id || null;
            } catch {}
          }
        }
        let url = "/api/mailgun-module/mg-fetch-templates";
        if (orgId) url += `?orgID=${orgId}`;
        // Use api.get so Bearer token is included
        const res = await api.get(url);
        const data = res?.data || {};
        const raw = data?.templates || [];
        setTemplates(
          raw.map((t: any) => ({
            id: t.template_id || t._id || t.id || "",
            title: t.template_name || t.name || t.title || "",
            subject: t.subject || "",
            content: t.message || t.content || t.body || "",
            type: (t.type || "user").toLowerCase(),
            delay:
              typeof t.schedule_delay !== "undefined" &&
              t.schedule_delay !== null
                ? `${t.schedule_delay} ${String(t.schedule_delay_unit || "").toLowerCase()}`
                : t.delay,
          })),
        );
      } catch (e: any) {
        setError(e?.message || "Failed to fetch templates");
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [isOpen]);

  const filteredTemplates = templates.filter((t) => t.type === activeTab);

  if (!isOpen) return null;

  return (
    <div
      className={styles.emailModalOverlay}
      onClick={onClose}
      style={{ background: "transparent" }}
    >
      <div
        className={`${styles.emailModalContainer} ${styles.template}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.icon}>
            <img src="/icons/layout.svg" />
          </div>
          <div className={styles.modalTitleWrapper}>
            <span className={styles.modalTitle}>Insert Template</span>
            <span className={styles.modalSubtitle}>
              Insert reusable message formats that let you quickly send common
              messages and replies.
            </span>
          </div>
          <img
            src="/iconsV3/x.svg"
            alt="close"
            onClick={onClose}
            style={{ alignSelf: "flex-start", cursor: "pointer" }}
          />
        </div>

        {/* Content */}
        <div className={`${styles.modalContent} ${styles.template}`}>
          {/* Tab Selector */}
          <div className={styles.templateTabGroup}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <span
                  key={tab}
                  className={`${styles.templateTab} ${isActive ? styles.active : ""}`}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)} Templates
                  <hr />
                </span>
              );
            })}
          </div>

          <div className={styles.templateList}>
            {loading ? (
              <span className={styles.templateListEmpty}>
                Loading templates...
              </span>
            ) : error ? (
              <span
                className={styles.templateListEmpty}
                style={{ color: "#b91c1c" }}
              >
                {error}
              </span>
            ) : filteredTemplates.length === 0 ? (
              <span className={styles.templateListEmpty}>
                No templates available.
              </span>
            ) : (
              filteredTemplates.map((t) => {
                const isExpanded = expandedTemplates.has(t.id);
                const toggleExpand = () => {
                  const newExpanded = new Set(expandedTemplates);
                  if (newExpanded.has(t.id)) {
                    newExpanded.delete(t.id);
                  } else {
                    newExpanded.add(t.id);
                  }
                  setExpandedTemplates(newExpanded);
                };
                return (
                  <div key={t.id} className={styles.templateCard}>
                    <div className={styles.templateCardPreview}>
                      <div className={styles.templateCardHeader}>
                        <span className={styles.templateTitle}>{t.title}</span>
                        {t.delay && (
                          <div className={styles.badge}>
                            <img
                              src="/icons/scheduled.svg"
                              style={{ width: 12, height: 12, marginRight: 2 }}
                            />
                            Schedule send after {t.delay}
                          </div>
                        )}
                      </div>
                      <span
                        className={`${styles.templateContent} ${isExpanded ? styles.expanded : ""}`}
                        dangerouslySetInnerHTML={{
                          __html: cleanTemplateContent(t.content),
                        }}
                      ></span>
                    </div>
                    <div className={styles.templateCardActions}>
                      <img
                        src="/icons/chevron-up.svg"
                        style={{
                          cursor: "pointer",
                          transform: isExpanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                        onClick={toggleExpand}
                      />
                      <Button
                        label=""
                        icon="/icons/plus-grey.svg"
                        variant="secondary"
                        style={{ width: 32, height: 32 }}
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.event?.stopPropagation?.();
                          }
                          onSelectTemplate({
                            ...t,
                            subject: t.subject || "",
                            body: cleanTemplateContent(t.content),
                            template: t,
                          });
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsertTemplateModal;
