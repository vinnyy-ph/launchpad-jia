"use client";

import styles from "./search.module.scss";
import { memo } from "react";

interface SearchProps {
  placeholder: string;
  size?: "default" | "small";
  value: string;
  onChange: (value: string) => void;
}

function Search({
  placeholder,
  size = "default",
  value,
  onChange,
}: SearchProps) {
  return (
    <div className={`${styles.search} ${styles[size]}`}>
      <img alt="" src="/icons/search.svg" />
      <input
        name="search"
        placeholder={placeholder}
        value={value}
        onBlur={(e) => (e.target.placeholder = placeholder)}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => (e.target.placeholder = "")}
      />
    </div>
  );
}

export default memo(Search);
