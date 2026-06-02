"use client";

import styles from "./email-templates.module.scss";
import { Button, Search, Tooltip } from "@/lib/components/ui";
import type { TemplateProps } from "@/lib/types/email.type";
import axios from "axios";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const Delete = dynamic(() => import("@/lib/components/sections/modal/Delete"), {
  ssr: false,
  loading: () => null,
});

const ManageTemplate = dynamic(
  () => import("@/lib/components/sections/modal/ManageTemplate"),
  {
    ssr: false,
    loading: () => null,
  }
);

const PreviewTemplate = dynamic(
  () => import("@/lib/components/sections/modal/PreviewTemplate"),
  {
    ssr: false,
    loading: () => null,
  }
);

const tabItems = [
  {
    key: "user",
    label: "User",
    tableLabels: ["Name", "Subject", "Message", "Delay", "Date Updated"],
    tooltip: {
      message:
        "User templates are private to you;\nonly you can add, edit, or delete them.",
      width: 239,
    },
  },
  {
    key: "global",
    label: "Global",
    tableLabels: ["Name", "Subject", "Message", "Creator", "Delay", "Date Updated"],
    tooltip: {
      message: "Only admin users can add and edit global templates.",
      width: 169,
    },
  },
  {
    key: "system",
    label: "System",
    tableLabels: ["Name / Event", "Subject", "Message"],
    tooltip: {
      message:
        "These templates are provided by the system and cannot be edited.",
      width: 209,
    },
  },
] as const;

interface OnChangeProps {
  id: string;
  value: string;
}

type ActiveModal = "add" | "delete" | "edit" | "preview" | null;
type Sort = "A - Z" | "Date Updated";
type TabItem = (typeof tabItems)[number];
type TabKey = TabItem["key"];

export default function () {
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIDFromSearchParams =
    searchParams.get("orgID") || searchParams.get("orgId");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeSort, setActiveSort] = useState<Sort>("A - Z");
  const tabFromUrl = searchParams.get("tab") as TabKey | null;
  const initialTab =
    tabItems.find((item) => item.key === tabFromUrl) || tabItems[0];
  const [activeTab, setActiveTab] = useState<TabItem>(initialTab);
  const [activeTemplate, setActiveTemplate] = useState<TemplateProps | null>(
    null
  );
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [formdata, setFormdata] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<TemplateProps[]>([]);
  const dropdownItems = [
    {
      icon: "/icons/edit-2.svg",
      label: "Edit",
      onClick: (template: TemplateProps) => {
        setActiveDropdown(null);
        setActiveModal("edit");
        setActiveTemplate(template);
        setFormdata((prev) => ({
          ...prev,
          template_name: template.template_name,
          subject: template.subject,
          message: template.message,
          enable_schedule_send: template.enable_schedule_send || "",
          schedule_delay: template.schedule_delay || "",
          schedule_delay_unit: template.schedule_delay_unit || "",
          enable_preferred_time: template.enable_preferred_time || "",
          preferred_time: template.preferred_time || "",
        }));
      },
    },
    {
      icon: "/icons/trash.svg",
      label: "Delete",
      onClick: (template: TemplateProps) => {
        setActiveDropdown(null);
        setActiveModal("delete");
        setActiveTemplate(template);
      },
    },
  ];

  const filteredSortedTemplates = useMemo(() => {
    const filtered = templates.filter((template) => {
      if (template.is_copy) return false;

      if (template.type.toLocaleLowerCase() !== activeTab.label.toLowerCase())
        return false;

      const query = debouncedSearch.toLowerCase();
      if (!query) return true;

      const baseMatch =
        template.template_name.toLowerCase().includes(query) ||
        template.subject.toLowerCase().includes(query) ||
        template.message.toLowerCase().includes(query);

      if (activeTab.label == "Global") {
        const userMatch =
          template.creator.name.toLowerCase().includes(query) ||
          template.creator.role.toLowerCase().includes(query);

        return baseMatch || userMatch;
      }

      return baseMatch;
    });

    return [...filtered].sort((a, b) => {
      if (activeSort === "A - Z" || activeTab.label === "System") {
        return a.template_name.localeCompare(b.template_name);
      }

      if (activeSort === "Date Updated") {
        return (
          new Date(b.date_updated).getTime() -
          new Date(a.date_updated).getTime()
        );
      }

      return 0;
    });
  }, [activeSort, activeTab, debouncedSearch, templates]);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
    setActiveTemplate(null);
  }, []);

  const handleDeleteTemplate = useCallback(() => {
    // TODO(Vince)
    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { token, orgID } = result;

    axios({
      method: "DELETE",
      data: { orgID, templateID: activeTemplate.template_id },
      headers: {
        Authorization: token,
      },
      url: "/api/emails/templates",
    })
      .then((res) => {
        setTemplates((prev) =>
          prev.filter(
            (template) => template.template_id != activeTemplate.template_id
          )
        );
      })
      .catch((err) => {
        alert(
          err?.response?.data?.error ||
            "An unexpected error occurred. Please try again later."
        );
      })
      .finally(() => {
        setActiveModal(null);
      });
  }, [activeTemplate]);

  const handleManageTemplate = useCallback(() => {
    // TODO(Vince)
    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { token, orgID } = result;

    let data: any = { ...formdata, orgID };
    let method = activeModal == "add" ? "POST" : "PATCH";

    if (activeModal == "edit") {
      data = { ...data, templateID: activeTemplate.template_id };
    }

    if (activeModal == "add") {
      data = { ...data, type: activeTab.label };
    }

    axios({
      method,
      data,
      headers: {
        Authorization: token,
      },
      url: "/api/emails/templates",
    })
      .then((res) => {
        if (activeModal == "add") {
          setTemplates((prev) => [
            ...prev,
            { ...res.data.data, ...formdata, type: activeTab.key },
          ]);
        }

        if (activeModal == "edit") {
          console.log("HERE");
          setTemplates((prev) => {
            const index = prev.findIndex(
              (item) => item.template_id === activeTemplate.template_id
            );

            if (index != 1) {
              const updated = [...prev];
              updated[index] = { ...activeTemplate, ...formdata };
              return updated;
            }
            return [...prev, { ...activeTemplate, ...formdata }];
          });
        }
      })
      .catch((err) => {
        alert(
          err?.response?.data?.error ||
            "An unexpected error occurred. Please try again later."
        );
      })
      .finally(() => {
        setActiveModal(null);
      });
  }, [formdata]);

  const handleModal = useCallback(() => {
    setActiveModal("add");
    setActiveTemplate(null);
    setFormdata({});
  }, []);

  const handleOnChange = useCallback(
    ({ id, value }: OnChangeProps) => {
      setFormdata((prev) => ({ ...prev, [id]: value }));
    },
    [formdata]
  );

  const handleSort = useCallback(() => {
    if (activeTab.label == "System") return;
    setActiveSort((prev) => (prev == "A - Z" ? "Date Updated" : "A - Z"));
  }, [activeTab]);

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDelay(template: TemplateProps) {
    if (!template.enable_schedule_send || template.enable_schedule_send !== "true") {
      return "-";
    }
    if (!template.schedule_delay || !template.schedule_delay_unit) {
      return "-";
    }
    const delayValue = parseInt(template.schedule_delay, 10);
    const unit = template.schedule_delay_unit;
    
    // Handle singular/plural forms
    let displayUnit = unit;
    if (delayValue === 1) {
      // Convert to singular: Days -> Day, Hours -> Hour, Minutes -> Minute
      if (unit === "Days") displayUnit = "Day";
      else if (unit === "Hours") displayUnit = "Hour";
      else if (unit === "Minutes") displayUnit = "Minute";
      else displayUnit = unit.endsWith("s") ? unit.slice(0, -1) : unit;
    } else {
      // Ensure plural form
      if (unit === "Day") displayUnit = "Days";
      else if (unit === "Hour") displayUnit = "Hours";
      else if (unit === "Minute") displayUnit = "Minutes";
      else if (!unit.endsWith("s")) displayUnit = `${unit}s`;
      else displayUnit = unit;
    }
    
    return `${delayValue} ${displayUnit}`;
  }

  function handleClickOutside(e: MouseEvent) {
    const currentRef = dropdownRef.current;

    if (currentRef && !currentRef.contains(e.target as Node)) {
      setActiveDropdown(null);
      setActiveTemplate(null);
    }
  }

  function handleTabClick(item: TabItem) {
    setActiveTab(item);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", item.key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function htmlToString(html: string) {
    if (typeof window == "undefined") return html;
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  function verify() {
    const token = localStorage.getItem("authToken");
    if (!token) {
      return "Your session has expired. Please sign in again.";
    }

    if (orgIDFromSearchParams) {
      return { token, orgID: orgIDFromSearchParams };
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

  useEffect(() => {
    getTemplates();

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [orgIDFromSearchParams]);

  useEffect(() => {
    if (activeTab.label == "System") {
      setActiveSort("A - Z");
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!tabFromUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", initialTab.key);
      router.push(`${pathname}?${params.toString()}`);
    }

    if (tabFromUrl && tabFromUrl !== activeTab.key) {
      const newTab = tabItems.find((item) => item.key === tabFromUrl);
      if (newTab) {
        setActiveTab(newTab);
      } else {
        setActiveTab(initialTab);

        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", initialTab.key);
        router.push(`${pathname}?${params.toString()}`);
      }
    }
  }, [tabFromUrl]);

  function getTemplates() {
    // TODO(Vince)
    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { token, orgID } = result;

    axios({
      headers: {
        Authorization: token,
      },
      method: "GET",
      url: `/api/emails/templates?orgID=${orgID}`,
    })
      .then((res) => {
        setTemplates(res.data.templates as TemplateProps[]);
      })
      .catch((err) => {
        alert(
          err?.response?.data?.error ||
            "An unexpected error occurred. Please try again later."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return (
    <div className={styles.emailTemplates}>
      <Delete
        description="Are you sure you want to delete this email template? This action cannot be undone."
        label="Delete Template"
        isVisible={activeModal == "delete" && !!activeTemplate}
        onClick={handleDeleteTemplate}
        onClose={handleCloseModal}
      />

      <PreviewTemplate
        isVisible={activeModal == "preview" && !!activeTemplate}
        template={activeTemplate}
        onClose={handleCloseModal}
      />

      <ManageTemplate
        formdata={formdata}
        isVisible={
          activeModal == "add" || (activeModal == "edit" && !!activeTemplate)
        }
        variant={
          activeModal == "add" || activeModal == "edit" ? activeModal : null
        }
        onChange={handleOnChange}
        onClick={handleManageTemplate}
        onClose={handleCloseModal}
      />

      <div className={styles.header}>
        <span className={styles.label}>Email Templates</span>
        <span className={styles.description}>
          Create, edit, and organize all your email templates in one place.
        </span>
      </div>

      <div className={styles.tabGroup}>
        {tabItems.map((item) => (
          <span
            className={activeTab.label == item.label ? styles.active : ""}
            key={item.key}
            onClick={() => handleTabClick(item)}
          >
            {item.label} Templates
            <hr />
          </span>
        ))}
      </div>

      <div
        className={`${styles.tableGroup}
        ${styles[activeTab.label.toLowerCase()]}`}
      >
        <div className={styles.tableHeader}>
          <span className={styles.label}>{activeTab.label} Templates</span>
          <Tooltip {...activeTab.tooltip} position="bottom" />
          <span className={styles.stats}>{filteredSortedTemplates.length}</span>
          <div className={styles.search}>
            <Search placeholder="Search" value={search} onChange={setSearch} />
          </div>
          <Button
            icon="/icons/sort.svg"
            label={`Sort By: ${activeSort}`}
            variant="secondary"
            onClick={handleSort}
          />
          {activeTab.label != "System" && (
            <Button
              icon="/icons/plus.svg"
              label="Add template"
              onClick={handleModal}
            />
          )}
        </div>

        <div className={styles.tableLabels}>
          {activeTab.tableLabels.map((item) => (
            <span key={item}>{item}</span>
          ))}
          <div />
        </div>

        <div className={styles.table}>
          {loading ? (
            <>{/* TODO(Vince): Add loading state */}</>
          ) : filteredSortedTemplates.length > 0 ? (
            <>
              {filteredSortedTemplates.map((template) => (
                <div className={styles.tableItems} key={template.template_id}>
                  <span className={styles.item}>{template.template_name}</span>

                  <span className={styles.item}>
                    {htmlToString(template.subject)}
                  </span>

                  <span className={styles.item}>
                    {htmlToString(template.message)}
                  </span>

                  {activeTab.label == "Global" && (
                    <div className={styles.userGroup}>
                      <img alt="" src={template.creator.picture} />
                      <div className={styles.userDetails}>
                        <span className={styles.name}>
                          {template.creator.name}
                        </span>
                        <span className={styles.role}>
                          {template.creator.role}
                        </span>
                      </div>
                    </div>
                  )}

                  {activeTab.label != "System" && (
                    <span className={styles.item}>
                      {formatDelay(template)}
                    </span>
                  )}

                  {activeTab.label != "System" && (
                    <span className={styles.item}>
                      {formatDate(template.date_updated)}
                    </span>
                  )}

                  <div className={styles.option}>
                    <div
                      className={`${styles.icon} ${
                        activeModal == "preview" &&
                        activeTemplate?.template_id == template.template_id
                          ? styles.active
                          : ""
                      }`}
                      onClick={() => {
                        setActiveModal("preview");
                        setActiveTemplate(template);
                      }}
                    >
                      <img alt="" src="/icons/eye.svg" />
                    </div>

                    {activeTab.label != "System" && (
                      <div className={styles.moreOption}>
                        <div
                          className={`${styles.icon}
                          ${
                            activeDropdown == template.template_id
                              ? styles.active
                              : ""
                          }`}
                          onClick={() =>
                            setActiveDropdown(template.template_id)
                          }
                        >
                          <img alt="" src="/icons/ellipsis.svg" />
                        </div>

                        <div
                          className={`${styles.dropdown} 
                           ${
                             activeDropdown == template.template_id
                               ? styles.active
                               : ""
                           }`}
                          ref={
                            activeDropdown == template.template_id
                              ? dropdownRef
                              : null
                          }
                        >
                          {dropdownItems.map((item) => (
                            <span
                              key={item.label}
                              onClick={() => item.onClick(template)}
                            >
                              <img alt="" src={item.icon} />
                              {item.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredSortedTemplates.length == 1 && (
                <div className={styles.tableItems} />
              )}
            </>
          ) : (
            <>{/* TODO(Vince): Empty State */}</>
          )}
        </div>
      </div>
    </div>
  );
}
