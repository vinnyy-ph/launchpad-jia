"use client";

import styles from "./modal.module.scss";
import {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  memo,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const ANIMATION_DURATION_MS = 280;

const MODAL_SIZES = {
  xs: "320px",
  sm: "380px",
  md: "440px",
  lg: "620px",
  xl: "780px",
} as const;

type ModalSize = keyof typeof MODAL_SIZES | number | string;
type ModalRadius = number | string;

interface ModalOverlayProps {
  backgroundColor?: string;
  blur?: number;
  className?: string;
  opacity?: number;
}

interface ModalClassNames {
  portal?: string;
  overlay?: string;
  inner?: string;
  content?: string;
  header?: string;
  title?: string;
  body?: string;
  closeButton?: string;
}

interface ModalProps {
  opened: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  centered?: boolean;
  className?: string;
  classNames?: ModalClassNames;
  closeButtonLabel?: string;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  keepMounted?: boolean;
  lockScroll?: boolean;
  overlayProps?: ModalOverlayProps;
  portalTarget?: Element | null;
  radius?: ModalRadius;
  returnFocus?: boolean;
  size?: ModalSize;
  trapFocus?: boolean;
  withCloseButton?: boolean;
  withinPortal?: boolean;
  zIndex?: number;
}

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function resolveSize(size: ModalSize) {
  if (typeof size === "number") {
    return `${size}px`;
  }

  if (typeof size === "string" && size in MODAL_SIZES) {
    return MODAL_SIZES[size as keyof typeof MODAL_SIZES];
  }

  return String(size);
}

function resolveRadius(radius: ModalRadius) {
  return typeof radius === "number" ? `${radius}px` : radius;
}

function getFocusableElements(element: HTMLElement) {
  const focusables = element.querySelectorAll<HTMLElement>(
    'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );

  return Array.from(focusables).filter((node) => {
    return !node.getAttribute("aria-hidden");
  });
}

function Modal({
  opened,
  onClose,
  children,
  title,
  centered = false,
  className,
  classNames = {},
  closeButtonLabel = "Close modal",
  closeOnClickOutside = true,
  closeOnEscape = true,
  keepMounted = false,
  lockScroll = true,
  overlayProps = {},
  portalTarget = null,
  radius = 12,
  returnFocus = true,
  size = "md",
  trapFocus = true,
  withCloseButton = true,
  withinPortal = true,
  zIndex = 200,
}: ModalProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(opened || keepMounted);
  const [isVisible, setIsVisible] = useState(opened);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let openFrameOne = 0;
    let openFrameTwo = 0;
    let closeTimeoutId = 0;

    if (keepMounted) {
      setShouldRender(true);
      setIsVisible(opened);
      return () => {
        if (openFrameOne) window.cancelAnimationFrame(openFrameOne);
        if (openFrameTwo) window.cancelAnimationFrame(openFrameTwo);
        if (closeTimeoutId) window.clearTimeout(closeTimeoutId);
      };
    }

    if (opened) {
      setShouldRender(true);
      setIsVisible(false);
      openFrameOne = window.requestAnimationFrame(() => {
        openFrameTwo = window.requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      return () => {
        if (openFrameOne) window.cancelAnimationFrame(openFrameOne);
        if (openFrameTwo) window.cancelAnimationFrame(openFrameTwo);
        if (closeTimeoutId) window.clearTimeout(closeTimeoutId);
      };
    }

    setIsVisible(false);
    closeTimeoutId = window.setTimeout(() => {
      setShouldRender(false);
    }, ANIMATION_DURATION_MS);

    return () => {
      if (openFrameOne) window.cancelAnimationFrame(openFrameOne);
      if (openFrameTwo) window.cancelAnimationFrame(openFrameTwo);
      if (closeTimeoutId) window.clearTimeout(closeTimeoutId);
    };
  }, [keepMounted, opened]);

  useEffect(() => {
    if (!opened || typeof document === "undefined") return;

    lastActiveElementRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => modalRef.current?.focus());

    return () => {
      if (!returnFocus) return;
      lastActiveElementRef.current?.focus?.();
    };
  }, [opened, returnFocus]);

  useEffect(() => {
    if (!opened || !lockScroll || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockScroll, opened]);

  useEffect(() => {
    if (!opened || !closeOnEscape || typeof document === "undefined") return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeOnEscape, onClose, opened]);

  if (!mounted || !shouldRender) {
    return null;
  }

  const overlayOpacity = overlayProps.opacity ?? 0.55;
  const overlayStyle: CSSProperties = {
    background:
      overlayProps.backgroundColor ?? `rgba(10, 13, 18, ${overlayOpacity})`,
    backdropFilter: overlayProps.blur ? `blur(${overlayProps.blur}px)` : undefined,
    WebkitBackdropFilter: overlayProps.blur
      ? `blur(${overlayProps.blur}px)`
      : undefined,
  };

  const contentStyle: CSSProperties = {
    borderRadius: resolveRadius(radius),
    maxWidth: resolveSize(size),
  };

  function handleOverlayClick() {
    if (closeOnClickOutside) {
      onClose();
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!trapFocus || event.key !== "Tab" || !modalRef.current) return;

    const focusableElements = getFocusableElements(modalRef.current);

    if (!focusableElements.length) {
      event.preventDefault();
      modalRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  const modalNode = (
    <div
      className={cx(styles.portal, isVisible ? styles.opened : styles.closed, classNames.portal)}
      style={{ zIndex }}
      aria-hidden={!isVisible}
    >
      <div
        className={cx(styles.overlay, overlayProps.className, classNames.overlay)}
        style={overlayStyle}
        onClick={handleOverlayClick}
      />

      <div className={cx(styles.inner, centered && styles.centered, classNames.inner)}>
        <div
          ref={modalRef}
          className={cx(styles.content, className, classNames.content)}
          style={contentStyle}
          role="dialog"
          aria-modal={isVisible}
          aria-labelledby={title ? titleId : undefined}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {(title || withCloseButton) && (
            <div className={cx(styles.header, classNames.header)}>
              {title ? (
                <h2 id={titleId} className={cx(styles.title, classNames.title)}>
                  {title}
                </h2>
              ) : (
                <span />
              )}

              {withCloseButton && (
                <button
                  type="button"
                  className={cx(styles.closeButton, classNames.closeButton)}
                  onClick={onClose}
                  aria-label={closeButtonLabel}
                >
                  <span aria-hidden>×</span>
                </button>
              )}
            </div>
          )}

          <div className={cx(styles.body, classNames.body)}>{children}</div>
        </div>
      </div>
    </div>
  );

  if (!withinPortal) {
    return modalNode;
  }

  const target = portalTarget ?? document.body;
  return createPortal(modalNode, target);
}

export default memo(Modal);
