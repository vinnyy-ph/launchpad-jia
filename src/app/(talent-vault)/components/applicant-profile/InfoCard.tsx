"use client";

import styles from "@/app/(talent-vault)/styles/modules/info-card.module.scss";

interface InfoCardProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  actionButton?: React.ReactNode;
  children: React.ReactNode;
  glow?: boolean;
}

export function InfoCard({ title, icon, actionButton, children, glow = false }: InfoCardProps) {
  return (
    <div className={styles.gradient}>
      <div className={styles.card}>
        <span className={styles.title}>
          {icon && (
            <div className={styles.icon}>
              {icon}
            </div>
          )}
          {title}
          {actionButton && (
            <div className={styles.actionButton}>
              {actionButton}
            </div>
          )}
        </span>
        <div 
          className={styles.content}
          style={glow ? {
            background: "linear-gradient(-179deg, rgba(252, 206, 192, 0.4) 0%, rgba(235, 172, 201, 0.4) 25%, rgba(206, 182, 218, 0.4) 44%, rgba(159, 202, 237, 0.4) 62%, rgba(255, 255, 255, 0.4) 100%)",
            borderRadius: "12px",
            boxShadow: "inset 0px 0px 2px 0px rgba(0, 16, 53, 0.16)"
          } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
