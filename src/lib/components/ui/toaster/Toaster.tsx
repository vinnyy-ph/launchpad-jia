"use client";

import { memo } from "react";
import { toast, type ToastContentProps, type ToastOptions } from "react-toastify";
import styles from "./toaster.module.scss";

export type ToasterType = "error" | "success";

export interface ToasterData {
  message?: string;
  type?: ToasterType;
  width?: number | string;
}

export interface ToasterProps extends Partial<ToastContentProps<ToasterData>>, ToasterData {}

export interface ShowToasterOptions
  extends Omit<ToastOptions<ToasterData>, "data" | "render" | "type"> {
  message: string;
  type?: ToasterType;
  width?: number | string;
}

function resolveWidth(width?: number | string) {
  if (width === undefined) {
    return undefined;
  }
  return typeof width === "number" ? `${width}px` : width;
}

function Toaster({ message, type, width, data, closeToast }: ToasterProps) {
  const resolvedType = data?.type ?? type ?? "success";
  const resolvedMessage = data?.message ?? message;
  const resolvedWidth = resolveWidth(data?.width ?? width);

  return (
    <div className={styles.toaster} style={resolvedWidth ? { width: resolvedWidth } : undefined}>
      <img alt="" src={`/icons/${resolvedType}.svg`} className={styles.icon} />
      <span className={styles.message}>{resolvedMessage}</span>
      {closeToast && (
        <button
          type="button"
          aria-label="Dismiss notification"
          className={styles.closeButton}
          onClick={() => closeToast()}
        >
          <img alt="" src="/icons/x.svg" />
        </button>
      )}
    </div>
  );
}

const MemoizedToaster = memo(Toaster);

export function showToaster({ message, type = "success", width, ...options }: ShowToasterOptions) {
  return toast<ToasterData>(
    (toastProps) => <MemoizedToaster {...toastProps} />,
    {
      position: "top-center",
      autoClose: 2500,
      pauseOnHover: false,
      hideProgressBar: true,
      closeOnClick: true,
      draggable: true,
      icon: false,
      closeButton: false,
      className: styles.toastWrapper,
      type,
      data: { message, type, width },
      ...options,
    },
  );
}

export default MemoizedToaster;
