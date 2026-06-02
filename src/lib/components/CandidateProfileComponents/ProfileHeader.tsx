"use client";

import styles from "@/lib/styles/candidate-profile.module.scss";

interface Props {
  user: { name: string, image: string };
  jobTitle: string;
  company: { name: string, image: string };
}

export default function ProfileHeader({
  user,
  jobTitle,
  company,
}: Props) {
  return (
    <div className={styles.userInfo}>
      <img 
        src={user.image} 
        alt="User Profile" 
        style={user.image.includes('user-profile') || user.image.includes('placeholder') ? {
          backgroundColor: '#F8F9FC',
          border: '1px solid #E9EAEB',
          padding: '8px',
          objectFit: 'contain',
          filter: 'grayscale(100%) opacity(50%)'
        } : { objectFit: 'cover' }}
      />
      <div>
        <h1>{user.name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span>
            for <span className={styles.jobTitle}>{jobTitle}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
