import styles from "@/app/(talent-vault)/styles/modules/help-banner.module.scss";

type HelpBannerProps = {
  title: string;
  message: string;
  iconSrc?: string;
  iconAlt?: string;
};

export function HelpBanner({
  title,
  message,
  iconSrc = "/iconsV3/help-circle.svg",
  iconAlt = "Help icon",
}: HelpBannerProps) {
  return (
    <div className={styles.helpBanner}>
      <img src={iconSrc} alt={iconAlt} className={styles.helpIcon} />
      <div>
        <div className={styles.title}><strong>{title}</strong></div>
        <p className={styles.message}>{message}</p>
      </div>
    </div>
  );
}
