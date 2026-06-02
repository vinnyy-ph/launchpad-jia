import React from "react";
import styles from "@/lib/styles/screens/settings.module.scss";

interface ScrollProps {
  id: string;
  label: string;
  data: {
    min: number;
    max: number;
    step: number;
  };
  value: number;
  onChange: (id: string, value: number) => void;
}

export default function Scroll({
  id,
  label,
  data,
  value,
  onChange,
}: ScrollProps) {
  return (
    <div className={styles.selection}>
      <span>
        <img alt="" src="/icons/help.svg" />
        {label}
        {value}
      </span>

      <input
        type="range"
        min={data.min}
        max={data.max}
        step={data.step}
        value={value}
        onChange={(e) => onChange(id, Number(e.target.value))}
      />
    </div>
  );
}
