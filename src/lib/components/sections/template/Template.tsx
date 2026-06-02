import styles from "./template.module.scss";

interface TemplateProps {
  subject: string;
  message: string;
}

export default function ({ subject, message }: TemplateProps) {
  const templateItems = [
    { label: "Subject", value: subject },
    { label: "Body", value: message },
  ];

  return (
    <div className={styles.template}>
      {templateItems.map((item) => (
        <div className={styles.contentGroup} key={item.label}>
          <span className={styles.label}>{item.label}</span>
          <div dangerouslySetInnerHTML={{ __html: item.value }} />
        </div>
      ))}
    </div>
  );
}
