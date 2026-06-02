"use client";

import styles from "@/lib/styles/candidate-profile.module.scss";
import { useState } from "react";
import type { CSSProperties } from "react";
import { Chevron } from "@/app/(talent-vault)/components/icons/Chevron";

interface Props {
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  title: string | React.ReactNode;
  outerStyle?: CSSProperties;
  children?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export default function SectionCard({
  icon,
  badge,
  title,
  outerStyle,
  children,
  collapsible = false,
  defaultExpanded = true,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggle = () => {
    if (collapsible) setIsExpanded(!isExpanded);
  };

  return (
    <div className={styles.sectionCard} style={outerStyle || { backgroundColor: "#F6F7FB", boxShadow: "0px 1px 2px rgba(10, 13, 18, 0.05)" }}>
      <div 
        className={styles.sectionTitle} 
        onClick={toggle}
        style={collapsible ? { cursor: 'pointer' } : undefined}
      >
        {collapsible && (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 4, width: 20, height: 20 }}>
            <Chevron direction={isExpanded ? "up" : "down"} size={20} color="#717680" />
          </span>
        )}
        <span className={styles.sectionIcon}>{icon}</span>
        <span>{title}</span>
        <span className={styles.sectionBadge}>{badge}</span>
      </div>
      {(!collapsible || isExpanded) && (
      <div className={styles.sectionContent}>
        {children}
      </div>
      )}
    </div>
  )
}

