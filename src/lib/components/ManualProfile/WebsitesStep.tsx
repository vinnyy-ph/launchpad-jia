"use client";

import { useEffect, useState } from "react";
import { Select } from "@/lib/components/ui";
import { ChevronDown, ChevronUp, Trash02 } from "@untitledui/icons";
import type { ContactWebsite } from "@/lib/utils/structuredCV";
import styles from "./manual-profile.module.scss";

const WEBSITE_TYPES = ["Linkedin", "Personal", "Company", "Portfolio", "Blog"];

export function createWebsite(): ContactWebsite {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: "",
    type: "",
  };
}

interface WebsitesStepProps {
  value: ContactWebsite[];
  onChange: (value: ContactWebsite[]) => void;
}

export default function WebsitesStep({ value, onChange }: WebsitesStepProps) {
  // Collapse state keyed by website id; a missing/false entry means expanded, so
  // new and initial cards open by default and each card toggles independently.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Always keep at least one card on screen (e.g. after deleting the last one).
  useEffect(() => {
    if (value.length === 0) {
      onChange([createWebsite()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.length]);

  function update(id: string, patch: Partial<ContactWebsite>) {
    onChange(value.map((website) => (website.id === id ? { ...website, ...patch } : website)));
  }

  function remove(id: string) {
    onChange(value.filter((website) => website.id !== id));
    setCollapsed((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function toggle(id: string) {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className={styles.websitesList}>
      {value.map((website, index) => {
        const open = !collapsed[website.id];
        const label = website.type ? `Website: ${website.type}` : `Website ${index + 1}`;

        return (
          <div key={website.id} className={styles.websiteCard}>
            <button
              type="button"
              className={styles.websiteHeader}
              aria-expanded={open}
              onClick={() => toggle(website.id)}
            >
              <span className={styles.websiteHeaderLabel}>{label}</span>
              {open ? (
                <ChevronUp className={styles.websiteChevron} aria-hidden />
              ) : (
                <ChevronDown className={styles.websiteChevron} aria-hidden />
              )}
            </button>

            {open && (
              <div className={styles.websiteBody}>
                <div className={styles.websiteRow}>
                  <div className={styles.websiteCol}>
                    <label className={styles.websiteFieldLabel} htmlFor={`url-${website.id}`}>
                      URL
                    </label>
                    <div className={styles.urlField}>
                      <span className={styles.urlPrefix}>https://</span>
                      <input
                        id={`url-${website.id}`}
                        className={styles.urlInput}
                        placeholder="www.website.com"
                        value={website.url}
                        onChange={(event) => update(website.id, { url: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.websiteCol}>
                    <label className={styles.websiteFieldLabel}>Website Type</label>
                    <Select
                      data={WEBSITE_TYPES}
                      value={website.type || null}
                      placeholder="Select a website type"
                      onChange={(next) => update(website.id, { type: next ?? "" })}
                    />
                  </div>
                </div>

                <div className={styles.websiteDeleteRow}>
                  <button
                    type="button"
                    className={styles.websiteDelete}
                    aria-label="Delete website"
                    onClick={() => remove(website.id)}
                  >
                    <Trash02 className={styles.websiteDeleteIcon} aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
