"use client";

import styles from "./textarea.module.scss";
import {
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  type TextareaHTMLAttributes,
  memo,
  useEffect,
  useId,
  useRef,
} from "react";

type TextareaSize = "xs" | "sm" | "md" | "lg" | "xl";
type TextareaRadius = "xs" | "sm" | "md" | "lg" | "xl" | number | string;
type InputWrapperOrder = "label" | "description" | "input" | "error";

interface TextareaClassNames {
  root?: string;
  label?: string;
  description?: string;
  inputWrapper?: string;
  input?: string;
  error?: string;
}

export interface TextareaOnChangeProps {
  id: string;
  value: string;
}

type TextareaOnChange =
  | ((event: ChangeEvent<HTMLTextAreaElement>) => void)
  | ((payload: TextareaOnChangeProps) => void);

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size" | "onChange"> {
  autosize?: boolean;
  classNames?: TextareaClassNames;
  description?: ReactNode;
  error?: ReactNode;
  formdata?: Record<string, string>;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  inputWrapperOrder?: InputWrapperOrder[];
  label?: ReactNode;
  maxRows?: number;
  minRows?: number;
  onChange?: TextareaOnChange;
  radius?: TextareaRadius;
  size?: TextareaSize;
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

function resolveRadius(radius: TextareaRadius) {
  if (typeof radius === "number") {
    return `${radius}px`;
  }

  if (typeof radius === "string" && radius in radiusMap) {
    return radiusMap[radius as keyof typeof radiusMap];
  }

  return radius;
}

function getLineHeight(node: HTMLTextAreaElement) {
  if (typeof window === "undefined") return 24;
  const computed = window.getComputedStyle(node);
  const parsed = Number.parseFloat(computed.lineHeight);
  return Number.isFinite(parsed) ? parsed : 24;
}

function resizeTextarea(node: HTMLTextAreaElement, minRows: number, maxRows?: number) {
  const lineHeight = getLineHeight(node);
  const minHeight = lineHeight * minRows;
  const maxHeight = maxRows ? lineHeight * maxRows : Infinity;

  node.style.height = "auto";
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, node.scrollHeight));
  node.style.height = `${nextHeight}px`;
  node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
}

function Textarea({
  autosize = false,
  className,
  classNames = {},
  description,
  disabled = false,
  error,
  formdata,
  id,
  inputClassName,
  inputStyle,
  inputWrapperOrder = defaultInputWrapperOrder,
  label,
  maxRows,
  minRows = 4,
  onBlur,
  onChange,
  onFocus,
  placeholder = "",
  radius = "md",
  readOnly = false,
  required = false,
  rows,
  size = "md",
  style,
  value,
  withAsterisk = false,
  ...inputProps
}: TextareaProps) {
  const generatedId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  const resolvedValue =
    value !== undefined
      ? value
      : hasLegacyFormdata
        ? (formdata?.[legacyId] ?? "")
        : undefined;

  useEffect(() => {
    if (!autosize || !textareaRef.current) return;
    resizeTextarea(textareaRef.current, minRows, maxRows);
  }, [autosize, maxRows, minRows, resolvedValue]);

  const rootStyle = {
    "--textarea-radius": resolveRadius(radius),
    ...style,
  } as CSSProperties;

  const inputNode = (
    <div key="input" className={cx(styles.inputWrapper, classNames.inputWrapper)}>
      <textarea
        id={inputId}
        ref={textareaRef}
        className={cx(styles.input, autosize && styles.autosize, inputClassName, classNames.input)}
        style={inputStyle}
        value={resolvedValue}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        rows={autosize ? minRows : (rows ?? minRows)}
        aria-invalid={!!error || undefined}
        aria-describedby={ariaDescribedBy || undefined}
        onBlur={(event) => {
          if (hasLegacyFormdata) {
            event.target.placeholder = placeholder;
          }
          onBlur?.(event);
        }}
        onChange={(event) => {
          if (autosize) {
            resizeTextarea(event.currentTarget, minRows, maxRows);
          }

          if (hasLegacyFormdata) {
            (onChange as ((payload: TextareaOnChangeProps) => void) | undefined)?.({
              id: legacyId,
              value: event.target.value,
            });
            return;
          }

          (onChange as ((nextEvent: ChangeEvent<HTMLTextAreaElement>) => void) | undefined)?.(
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
      )}
      style={rootStyle}
    >
      {normalizedOrder.map((nodeKey) => nodes[nodeKey])}
    </div>
  );
}

export default memo(Textarea);
