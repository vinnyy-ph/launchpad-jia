"use client";

import styles from "./field.module.scss";
import {
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  memo,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type FieldSize = "xs" | "sm" | "md" | "lg" | "xl";
type FieldRadius = "xs" | "sm" | "md" | "lg" | "xl" | number | string;
type InputWrapperOrder = "label" | "description" | "input" | "error";

interface FieldClassNames {
  root?: string;
  label?: string;
  description?: string;
  inputWrapper?: string;
  input?: string;
  section?: string;
  sectionLeft?: string;
  sectionRight?: string;
  error?: string;
}

export interface OnChangeProps {
  id: string;
  value: string;
}

type FieldOnChange =
  | ((event: ChangeEvent<HTMLInputElement>) => void)
  | ((payload: OnChangeProps) => void);

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  classNames?: FieldClassNames;
  description?: ReactNode;
  error?: ReactNode;
  formdata?: Record<string, string>;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  inputWrapperOrder?: InputWrapperOrder[];
  section?: ReactNode;
  sectionLeft?: ReactNode;
  sectionRight?: ReactNode;
  sectionDivider?: boolean;
  sectionPosition?: "left" | "right";
  sectionPointerEvents?: CSSProperties["pointerEvents"];
  sectionWidth?: number | string;
  sectionLeftDivider?: boolean;
  sectionRightDivider?: boolean;
  sectionLeftPointerEvents?: CSSProperties["pointerEvents"];
  sectionRightPointerEvents?: CSSProperties["pointerEvents"];
  sectionLeftWidth?: number | string;
  sectionRightWidth?: number | string;
  label?: ReactNode;
  onChange?: FieldOnChange;
  radius?: FieldRadius;
  size?: FieldSize;
  withAsterisk?: boolean;
}

const defaultInputWrapperOrder: InputWrapperOrder[] = [
  "label",
  "description",
  "input",
  "error",
];

const radiusMap = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
} as const;

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function resolveCssValue(value: string | number) {
  return typeof value === "number" ? `${value}px` : value;
}

function resolveRadius(radius: FieldRadius) {
  if (typeof radius === "number") {
    return `${radius}px`;
  }

  if (typeof radius === "string" && radius in radiusMap) {
    return radiusMap[radius as keyof typeof radiusMap];
  }

  return radius;
}

function Field({
  className,
  classNames = {},
  description,
  disabled = false,
  error,
  formdata,
  id,
  section,
  sectionLeft,
  sectionRight,
  sectionDivider = false,
  sectionPosition = "left",
  sectionPointerEvents = "none",
  sectionWidth,
  sectionLeftDivider,
  sectionRightDivider,
  sectionLeftPointerEvents,
  sectionRightPointerEvents,
  sectionLeftWidth,
  sectionRightWidth,
  inputClassName,
  inputStyle,
  inputWrapperOrder = defaultInputWrapperOrder,
  label,
  onBlur,
  onChange,
  onFocus,
  placeholder = "",
  radius = "md",
  readOnly = false,
  required = false,
  size = "md",
  style,
  value,
  withAsterisk = false,
  ...inputProps
}: FieldProps) {
  const generatedId = useId();
  const leftSectionRef = useRef<HTMLDivElement>(null);
  const rightSectionRef = useRef<HTMLDivElement>(null);
  const [measuredLeftSectionWidth, setMeasuredLeftSectionWidth] = useState(0);
  const [measuredRightSectionWidth, setMeasuredRightSectionWidth] = useState(0);
  const inputId = id || generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(" ");
  const showAsterisk = withAsterisk || required;
  const normalizedOrder = Array.from(
    new Set([...inputWrapperOrder, ...defaultInputWrapperOrder]),
  ) as InputWrapperOrder[];

  const hasLegacyFormdata = Boolean(formdata);
  const legacyId =
    typeof label === "string" ? label.toLowerCase().replaceAll(" ", "_") : inputId;
  const inputName = inputProps.name ?? (id || (typeof label === "string" ? legacyId : undefined));
  const resolvedValue =
    value !== undefined
      ? value
      : hasLegacyFormdata
        ? (formdata?.[legacyId] ?? "")
        : undefined;

  const resolvedSectionLeft = sectionPosition === "left" ? section ?? sectionLeft : sectionLeft;
  const resolvedSectionRight =
    sectionPosition === "right" ? section ?? sectionRight : sectionRight;
  const resolvedSectionLeftDivider =
    sectionPosition === "left" ? sectionDivider : (sectionLeftDivider ?? false);
  const resolvedSectionRightDivider =
    sectionPosition === "right" ? sectionDivider : (sectionRightDivider ?? false);
  const resolvedSectionLeftPointerEvents =
    sectionPosition === "left" ? sectionPointerEvents : (sectionLeftPointerEvents ?? "none");
  const resolvedSectionRightPointerEvents =
    sectionPosition === "right" ? sectionPointerEvents : (sectionRightPointerEvents ?? "none");
  const resolvedSectionLeftWidth =
    sectionPosition === "left" ? sectionWidth : sectionLeftWidth;
  const resolvedSectionRightWidth =
    sectionPosition === "right" ? sectionWidth : sectionRightWidth;

  useEffect(() => {
    if (!resolvedSectionLeft || resolvedSectionLeftWidth !== undefined) {
      setMeasuredLeftSectionWidth(0);
      return;
    }

    const node = leftSectionRef.current;
    if (!node) return;

    const updateWidth = () => {
      setMeasuredLeftSectionWidth(node.offsetWidth);
    };

    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [resolvedSectionLeft, resolvedSectionLeftWidth]);

  useEffect(() => {
    if (!resolvedSectionRight || resolvedSectionRightWidth !== undefined) {
      setMeasuredRightSectionWidth(0);
      return;
    }

    const node = rightSectionRef.current;
    if (!node) return;

    const updateWidth = () => {
      setMeasuredRightSectionWidth(node.offsetWidth);
    };

    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [resolvedSectionRight, resolvedSectionRightWidth]);

  const leftWidthValue = resolvedSectionLeft
    ? resolvedSectionLeftWidth !== undefined
      ? resolveCssValue(resolvedSectionLeftWidth)
      : measuredLeftSectionWidth > 0
        ? `${measuredLeftSectionWidth}px`
        : "0px"
    : "0px";
  const rightWidthValue = resolvedSectionRight
    ? resolvedSectionRightWidth !== undefined
      ? resolveCssValue(resolvedSectionRightWidth)
      : measuredRightSectionWidth > 0
        ? `${measuredRightSectionWidth}px`
        : "0px"
    : "0px";
  const leftPaddingBaseValue =
    resolvedSectionLeft && !resolvedSectionLeftDivider ? "0px" : "14px";
  const rightPaddingBaseValue =
    resolvedSectionRight && !resolvedSectionRightDivider ? "0px" : "14px";

  const rootStyle = {
    "--field-input-padding-left-base": leftPaddingBaseValue,
    "--field-input-padding-right-base": rightPaddingBaseValue,
    "--field-left-section-width": leftWidthValue,
    "--field-radius": resolveRadius(radius),
    "--field-right-section-width": rightWidthValue,
  } as CSSProperties;

  const inputNode = (
    <div key="input" className={cx(styles.inputWrapper, classNames.inputWrapper)}>
      {resolvedSectionLeft && (
        <div
          ref={leftSectionRef}
          className={cx(
            styles.leftSection,
            resolvedSectionLeftDivider && styles.withSectionDivider,
            classNames.section,
            classNames.sectionLeft,
          )}
          style={{
            pointerEvents: resolvedSectionLeftPointerEvents,
            width: resolvedSectionLeftWidth !== undefined ? leftWidthValue : undefined,
          }}
        >
          {resolvedSectionLeft}
        </div>
      )}

      {resolvedSectionRight && (
        <div
          ref={rightSectionRef}
          className={cx(
            styles.rightSection,
            resolvedSectionRightDivider && styles.withSectionDivider,
            classNames.section,
            classNames.sectionRight,
          )}
          style={{
            pointerEvents: resolvedSectionRightPointerEvents,
            width: resolvedSectionRightWidth !== undefined ? rightWidthValue : undefined,
          }}
        >
          {resolvedSectionRight}
        </div>
      )}

      <input
        id={inputId}
        name={inputName}
        className={cx(styles.input, inputClassName, classNames.input)}
        style={inputStyle}
        value={resolvedValue}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={!!error || undefined}
        aria-describedby={ariaDescribedBy || undefined}
        onBlur={(event) => {
          if (hasLegacyFormdata) {
            event.target.placeholder = placeholder;
          }
          onBlur?.(event);
        }}
        onChange={(event) => {
          if (hasLegacyFormdata) {
            (onChange as ((payload: OnChangeProps) => void) | undefined)?.({
              id: legacyId,
              value: event.target.value,
            });
            return;
          }

          (onChange as ((nextEvent: ChangeEvent<HTMLInputElement>) => void) | undefined)?.(
            event,
          );
        }}
        onFocus={(event) => {
          if (hasLegacyFormdata) {
            event.target.placeholder = "";
          }
          onFocus?.(event);
        }}
        {...inputProps}
      />

    </div>
  );

  const nodes: Record<InputWrapperOrder, ReactNode | null> = {
    label: label ? (
      <label key="label" htmlFor={inputId} className={cx(styles.label, classNames.label)}>
        {label}
        {showAsterisk && <span className={styles.required}> *</span>}
      </label>
    ) : null,
    description: description ? (
      <p
        key="description"
        id={descriptionId}
        className={cx(styles.description, classNames.description)}
      >
        {description}
      </p>
    ) : null,
    input: inputNode,
    error: error ? (
      <p key="error" id={errorId} className={cx(styles.error, classNames.error)}>
        {error}
      </p>
    ) : null,
  };

  return (
    <div
      className={cx(
        styles.root,
        styles[`size-${size}`],
        !!error && styles.hasError,
        disabled && styles.disabled,
        readOnly && styles.readOnly,
        className,
        classNames.root,
      )}
      style={{ ...rootStyle, ...(style as CSSProperties) }}
    >
      {normalizedOrder.map((sectionName) => nodes[sectionName])}
    </div>
  );
}

export default memo(Field);
