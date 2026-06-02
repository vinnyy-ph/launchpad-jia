"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./dialog.module.scss";
import { X } from "@untitledui/icons";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog");
  }
  return context;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <DialogContext.Provider value={{ open, onOpenChange, titleId, descriptionId }}>
      {children}
    </DialogContext.Provider>
  );
}

interface DialogPortalProps {
  children: ReactNode;
}

export function DialogPortal({ children }: DialogPortalProps) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

interface DialogOverlayProps {
  className?: string;
}

export function DialogOverlay({ className }: DialogOverlayProps) {
  const { onOpenChange } = useDialogContext();

  return (
    <div
      className={`${styles.overlay} ${className || ""}`}
      onClick={() => onOpenChange(false)}
      aria-hidden="true"
    />
  );
}

interface DialogContentProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  showCloseButton?: boolean;
}

export function DialogContent({
  children,
  className,
  size = "sm",
  showCloseButton = false,
}: DialogContentProps) {
  const { onOpenChange, titleId, descriptionId } = useDialogContext();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  return (
    <DialogPortal>
      <div className={styles.dialogWrapper}>
        <DialogOverlay />
        <div
          ref={contentRef}
          className={`${styles.content} ${styles[size]} ${className || ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          {showCloseButton && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => onOpenChange(false)}
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          )}
          {children}
        </div>
      </div>
    </DialogPortal>
  );
}

interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return <div className={`${styles.header} ${className || ""}`}>{children}</div>;
}

interface DialogIconProps {
  children: ReactNode;
  variant?: "warning" | "error" | "success" | "info";
  className?: string;
}

export function DialogIcon({ children, variant = "info", className }: DialogIconProps) {
  return (
    <div className={`${styles.iconWrapper} ${styles[variant]} ${className || ""}`}>
      {children}
    </div>
  );
}

interface DialogTextGroupProps {
  children: ReactNode;
  className?: string;
}

export function DialogTextGroup({ children, className }: DialogTextGroupProps) {
  return <div className={`${styles.textGroup} ${className || ""}`}>{children}</div>;
}

interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  const { titleId } = useDialogContext();
  return <h2 id={titleId} className={`${styles.title} ${className || ""}`}>{children}</h2>;
}

interface DialogDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  const { descriptionId } = useDialogContext();
  return <p id={descriptionId} className={`${styles.description} ${className || ""}`}>{children}</p>;
}

interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return <div className={`${styles.footer} ${className || ""}`}>{children}</div>;
}
