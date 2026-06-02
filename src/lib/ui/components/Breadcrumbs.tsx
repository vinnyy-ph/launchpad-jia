import Link from "next/link";
import styles from "./Breadcrumbs.module.scss";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  iconSrc?: string;
  iconAlt?: string;
  current?: boolean;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

const ChevronRightIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M8 5L12 10L8 15"
      stroke="#A4A7AE"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <div className={styles.root}>
      <nav aria-label="breadcrumb">
        <ol
          className="breadcrumb breadcrumb-links"
          style={{
            backgroundColor: "transparent",
            padding: 0,
            marginBottom: 0,
          }}
        >
          {items.map((item, index) => {
            const isCurrent = item.current ?? index === items.length - 1;
            const content = (
              <>
                {item.iconSrc ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginRight: 10,
                    }}
                  >
                    <img
                      src={item.iconSrc}
                      alt={item.iconAlt || `${item.label} icon`}
                      style={{ width: 24, height: 24 }}
                    />
                  </div>
                ) : null}
                <h4
                  className={`${isCurrent ? "text-black" : "text-gray"} d-inline-block mb-0`}
                  style={{ fontSize: "16px", fontWeight: 550 }}
                >
                  {item.label}
                </h4>
              </>
            );

            return (
              <li key={`${item.label}-${index}`} className={styles.staticItem}>
                {isCurrent ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #F8F9FC",
                      borderRadius: 10,
                      padding: "5px 10px",
                      backgroundColor: "#F8F9FC",
                    }}
                  >
                    {content}
                  </div>
                ) : item.href ? (
                  <Link href={item.href} className={styles.activeLink}>
                    {content}
                  </Link>
                ) : (
                  <div className={styles.activeLink}>{content}</div>
                )}

                {index < items.length - 1 ? (
                  <div
                    aria-hidden="true"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      margin: "0 10px",
                    }}
                  >
                    <ChevronRightIcon />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
