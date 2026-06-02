"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export interface Tag {
  id: string | number;
  label: string;
  [key: string]: any; // Allow additional properties
}

export interface ResponsiveTagListProps {
  tags: Tag[];
  className?: string;
  tagClassName?: string;
  overflowClassName?: string;
  renderTag?: (tag: Tag) => React.ReactNode;
  renderOverflow?: (count: number, hiddenTags: Tag[]) => React.ReactNode;
  gap?: number;
  maxWidth?: string | number;
  width?: string | number;
  onTagClick?: (tag: Tag) => void;
  onOverflowClick?: (hiddenTags: Tag[]) => void;
}

export default function ResponsiveTagList({
  tags,
  className = "",
  tagClassName = "",
  overflowClassName = "",
  renderTag,
  renderOverflow,
  gap = 8,
  maxWidth,
  width,
  onTagClick,
  onOverflowClick,
}: ResponsiveTagListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const overflowIndicatorRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tags.length);
  const [isCalculating, setIsCalculating] = useState(true);
  const [isHoveringOverflow, setIsHoveringOverflow] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const calculateVisibleTags = useCallback(() => {
    if (!containerRef.current || !measureRef.current || tags.length === 0) {
      setVisibleCount(0);
      setIsCalculating(false);
      return;
    }

    const wrapper = containerRef.current; // This is now the wrapper
    const measureContainer = measureRef.current;
    
    // Get parent element (table cell) to measure available width
    const parentElement = wrapper?.parentElement;
    if (!parentElement || !wrapper) {
      setVisibleCount(tags.length);
      setIsCalculating(false);
      return;
    }

    // Get available width directly from parent (table cell) for more accurate measurement
    // This ensures we measure against the actual available space, not the wrapper
    const parentStyle = window.getComputedStyle(parentElement);
    const parentPaddingLeft = parseFloat(parentStyle.paddingLeft) || 0;
    const parentPaddingRight = parseFloat(parentStyle.paddingRight) || 0;
    let containerWidth = parentElement.clientWidth - parentPaddingLeft - parentPaddingRight;
    
    // Subtract a small buffer (2px) to ensure tags fit and allow for rounding errors
    // This helps prevent the column from being unable to shrink
    containerWidth = Math.max(0, containerWidth - 2);
    
    // Force a reflow to ensure accurate measurements
    void parentElement.offsetWidth;
    
    // Ensure measurement container is visible for accurate measurements
    measureContainer.style.display = "flex";
    measureContainer.style.gap = `${gap}px`;

    // Get all tag elements from measurement container
    const tagElements = Array.from(
      measureContainer.querySelectorAll('[data-tag-element]')
    ) as HTMLDivElement[];
    const overflowElement = measureContainer.querySelector(
      '[data-overflow-indicator]'
    ) as HTMLDivElement;

    if (tagElements.length === 0) {
      setVisibleCount(0);
      setIsCalculating(false);
      return;
    }

    // Measure individual tag widths
    const tagWidths = tagElements.map((el) => el.offsetWidth);
    
    // Helper function to measure overflow indicator width
    const measureOverflowWidth = (count: number): number => {
      if (count <= 0) return 0;
      const tempOverflow = document.createElement("div");
      tempOverflow.setAttribute("data-overflow-indicator", "");
      tempOverflow.textContent = `+${count}`;
      tempOverflow.style.display = "inline-flex";
      tempOverflow.style.alignItems = "center";
      tempOverflow.style.justifyContent = "center";
      tempOverflow.style.paddingTop = "2px";
      tempOverflow.style.paddingRight = "8px";
      tempOverflow.style.paddingBottom = "2px";
      tempOverflow.style.paddingLeft = "8px";
      tempOverflow.style.background = "#F8F9FC";
      tempOverflow.style.color = "#363F72";
      tempOverflow.style.borderRadius = "16px";
      tempOverflow.style.fontSize = "12px";
      tempOverflow.style.fontWeight = "500";
      tempOverflow.style.fontStyle = "normal";
      tempOverflow.style.lineHeight = "18px";
      tempOverflow.style.letterSpacing = "0%";
      tempOverflow.style.textAlign = "center";
      tempOverflow.style.whiteSpace = "nowrap";
      tempOverflow.style.flexShrink = "0";
      if (overflowClassName) {
        tempOverflow.className = overflowClassName;
      }
      tempOverflow.style.position = "absolute";
      tempOverflow.style.visibility = "hidden";
      measureContainer.appendChild(tempOverflow);
      const width = tempOverflow.offsetWidth;
      measureContainer.removeChild(tempOverflow);
      return width;
    };

    // Binary search to find how many tags fit
    // We need to ensure the overflow indicator always fits when there are hidden tags
    let left = 0;
    let right = tags.length;
    let bestFit = -1; // Start at -1 to check if overflow indicator alone fits

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      let testWidth = 0;

      // Sum widths of first mid tags
      for (let i = 0; i < mid && i < tagWidths.length; i++) {
        testWidth += tagWidths[i];
      }
      // Add gaps between tags
      if (mid > 0) {
        testWidth += (mid - 1) * gap;
      }

      // Always add overflow indicator width if there are hidden tags
      if (mid < tags.length) {
        const overflowCount = tags.length - mid;
        const overflowWidth = measureOverflowWidth(overflowCount);
        // Add gap before overflow only if there are visible tags
        if (mid > 0) {
          testWidth += gap + overflowWidth;
        } else {
          // If no tags visible, just check if overflow indicator fits
          testWidth = overflowWidth;
        }
      }

      if (testWidth <= containerWidth) {
        bestFit = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // If bestFit is still -1, it means even the overflow indicator doesn't fit
    // In that case, show 0 tags (overflow will still show if there are tags)
    const finalCount = Math.max(0, bestFit);
    
    // Always update the count, even if it's the same, to ensure React re-renders
    setVisibleCount((prevCount) => {
      if (prevCount !== finalCount) {
        return finalCount;
      }
      // Force update even if same to ensure recalculation on next resize
      return finalCount;
    });
    setIsCalculating(false);
  }, [tags, gap, overflowClassName]);

  useEffect(() => {
    if (tags.length === 0) {
      setVisibleCount(0);
      setIsCalculating(false);
      return;
    }

    setIsCalculating(true);
    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      // Double RAF to ensure layout is complete
      requestAnimationFrame(() => {
        calculateVisibleTags();
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [tags, calculateVisibleTags]);

  const updateTooltipPosition = useCallback(() => {
    if (!overflowIndicatorRef.current) return;
    
    const rect = overflowIndicatorRef.current.getBoundingClientRect();
    setTooltipPosition({
      top: rect.bottom + 8, // 8px gap below, using viewport coordinates for fixed positioning
      left: rect.left,
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const parentElement = container.parentElement;
    
    // Observe parent element to detect when it resizes
    if (!parentElement) return;

    let rafId: number | null = null;
    
    const handleResize = () => {
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      
      // Use requestAnimationFrame to ensure layout is complete
      rafId = requestAnimationFrame(() => {
        // Double RAF to ensure layout is fully complete after resize
        requestAnimationFrame(() => {
          // Small additional delay to ensure DOM has fully updated
          setTimeout(() => {
            // Force recalculation
            setIsCalculating(true);
            calculateVisibleTags();
            // Update tooltip position if it's visible
            if (isHoveringOverflow) {
              updateTooltipPosition();
            }
            rafId = null;
          }, 10);
        });
      });
    };

    // Use ResizeObserver for parent element (table cell)
    const resizeObserver = new ResizeObserver((entries) => {
      // Always trigger on resize - check all entries to ensure we catch the change
      for (const entry of entries) {
        // Trigger resize handler for any size change
        handleResize();
        break;
      }
    });

    // Observe parent element to detect size changes
    resizeObserver.observe(parentElement);

    // Add window resize listener as fallback for browser window resizing
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateVisibleTags, isHoveringOverflow, updateTooltipPosition]);

  // Update tooltip position on scroll
  useEffect(() => {
    if (!isHoveringOverflow) return;

    const handleScroll = () => {
      updateTooltipPosition();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isHoveringOverflow, updateTooltipPosition]);

  if (tags.length === 0) {
    return null;
  }

  const visibleTags = tags.slice(0, visibleCount);
  const hiddenTags = tags.slice(visibleCount);
  const overflowCount = hiddenTags.length;

  const defaultRenderTag = (tag: Tag) => (
    <div
      key={tag.id}
      data-tag-element
      className={tagClassName}
      onClick={() => onTagClick?.(tag)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 12px",
        backgroundColor: "var(--Tag-bg-primary, #f0f0f0)",
        color: "var(--Tag-text-primary, #181d27)",
        borderRadius: "16px",
        fontSize: "14px",
        fontWeight: 500,
        lineHeight: "1.4",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "background-color 0.2s ease, color 0.2s ease",
        cursor: onTagClick ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        if (!onTagClick) return;
        e.currentTarget.style.backgroundColor = "var(--Tag-bg-hover, #e0e0e0)";
      }}
      onMouseLeave={(e) => {
        if (!onTagClick) return;
        e.currentTarget.style.backgroundColor = "var(--Tag-bg-primary, #f0f0f0)";
      }}
    >
      {tag.label}
    </div>
  );

  const handleOverflowMouseEnter = useCallback(() => {
    setIsHoveringOverflow(true);
    // Use requestAnimationFrame to ensure DOM is ready before calculating position
    requestAnimationFrame(() => {
      updateTooltipPosition();
    });
  }, [updateTooltipPosition]);

  const handleOverflowMouseLeave = useCallback(() => {
    setIsHoveringOverflow(false);
  }, []);

  const defaultRenderOverflow = (count: number, hidden: Tag[]) => (
    <div
      ref={overflowIndicatorRef}
      data-overflow-indicator
      className={overflowClassName}
      onClick={() => onOverflowClick?.(hidden)}
      onMouseEnter={handleOverflowMouseEnter}
      onMouseLeave={handleOverflowMouseLeave}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "2px",
        paddingRight: "8px",
        paddingBottom: "2px",
        paddingLeft: "8px",
        background: "#F8F9FC",
        color: "#363F72",
        borderRadius: "16px",
        fontSize: "12px",
        fontWeight: 500,
        fontStyle: "normal",
        lineHeight: "18px",
        letterSpacing: "0%",
        textAlign: "center",
        whiteSpace: "nowrap",
        flexShrink: 0,
        cursor: "pointer",
      }}
    >
      +{count}
    </div>
  );

  return (
    <>
      {/* Hidden measurement container */}
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          visibility: "hidden",
          top: "-9999px",
          left: "-9999px",
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: -9999,
          width: "auto",
          height: 0,
          overflow: "hidden",
        }}
      >
        {tags.map((tag) => {
          if (renderTag) {
            const rendered = renderTag(tag);
            // Ensure the rendered element has data-tag-element for measurement
            if (React.isValidElement(rendered)) {
              // Clone element and ensure data-tag-element attribute is set
              const props = rendered.props as any;
              if (!props['data-tag-element']) {
                return React.cloneElement(rendered as React.ReactElement, {
                  key: `measure-${tag.id}`,
                  'data-tag-element': '',
                } as any);
              }
              // If it already has the attribute, just update the key
              return React.cloneElement(rendered as React.ReactElement, {
                key: `measure-${tag.id}`,
              });
            }
            return <React.Fragment key={`measure-${tag.id}`}>{rendered}</React.Fragment>;
          }
          return (
            <div
              key={`measure-${tag.id}`}
              data-tag-element
              className={tagClassName}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px 12px",
                backgroundColor: "var(--Tag-bg-primary, #f0f0f0)",
                color: "var(--Tag-text-primary, #181d27)",
                borderRadius: "16px",
                fontSize: "14px",
                fontWeight: 500,
                lineHeight: "1.4",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {tag.label}
            </div>
          );
        })}
        {tags.length > 0 && (
          <div
            data-overflow-indicator
            className={overflowClassName}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              paddingTop: "2px",
              paddingRight: "8px",
              paddingBottom: "2px",
              paddingLeft: "8px",
              background: "#F8F9FC",
              color: "#363F72",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: 500,
              fontStyle: "normal",
              lineHeight: "18px",
              letterSpacing: "0%",
              textAlign: "center",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            +0
          </div>
        )}
      </div>

      {/* Wrapper to constrain width */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          maxWidth: maxWidth ? (typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth) : "100%",
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* Visible container */}
        <div
          className={className}
          style={{
            display: "flex",
            flexWrap: "nowrap",
            alignItems: "center",
            width: width ? (typeof width === "number" ? `${width}px` : width) : "100%",
            maxWidth: "100%",
            minWidth: 0,
            position: "relative",
            boxSizing: "border-box",
            overflow: "hidden",
            gap: `${gap}px`,
          }}
        >
          {!isCalculating && (
            <>
              {visibleTags.map((tag) =>
                renderTag ? (
                  <React.Fragment key={tag.id}>{renderTag(tag)}</React.Fragment>
                ) : (
                  defaultRenderTag(tag)
                )
              )}
              {overflowCount > 0 &&
                (renderOverflow
                  ? renderOverflow(overflowCount, hiddenTags)
                  : defaultRenderOverflow(overflowCount, hiddenTags))}
            </>
          )}
        </div>
      </div>

      {/* Hover tooltip for overflow indicator */}
      {isHoveringOverflow && overflowCount > 0 && (
        <div
          ref={tooltipRef}
          className="responsive-tag-list-tooltip"
          style={{
            position: "fixed",
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            width: "226px",
            borderRadius: "8px",
            border: "1px solid var(--Border-primary, #E9EAEB)",
            padding: "12px",
            background: "var(--Surface-white, #FFFFFF)",
            boxShadow: "0px 32px 64px -12px #0A0D1224",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
          onMouseEnter={handleOverflowMouseEnter}
          onMouseLeave={handleOverflowMouseLeave}
        >
          {/* Title header */}
          <div
            style={{
              textAlign: "left",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontStyle: "normal",
                fontSize: "12px",
                lineHeight: "18px",
                letterSpacing: "0%",
                color: "var(--Text-text-secondary, #414651)",
              }}
            >
              More Skills:
            </span>
          </div>
          {/* Tags container */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: "8px",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              overflow: "hidden",
              maxWidth: "100%",
            }}
          >
            {hiddenTags.map((tag) => {
              const maxTagWidth = "calc(100% - 0px)"; // Full width minus gap handling
              return renderTag ? (
                <div
                  key={tag.id}
                  style={{
                    maxWidth: maxTagWidth,
                    minWidth: 0,
                    overflow: "hidden",
                    flexShrink: 1,
                  }}
                >
                  {React.isValidElement(renderTag(tag)) ? (() => {
                    const renderedTag = renderTag(tag) as React.ReactElement;
                    const props = renderedTag.props as any;
                    const originalChildren = props?.children;
                    const originalStyle = props?.style || {};
                    
                    // Wrap text/number content in a span for ellipsis to work
                    // Only wrap if children is a primitive (string, number) and not a React element
                    const isPrimitive = typeof originalChildren === 'string' || typeof originalChildren === 'number';
                    const isReactElement = React.isValidElement(originalChildren);
                    const shouldWrap = isPrimitive && !isReactElement;
                    
                    const wrappedChildren = shouldWrap ? (
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                          display: "block",
                        }}
                      >
                        {originalChildren}
                      </span>
                    ) : originalChildren;
                    
                    return React.cloneElement(renderedTag, {
                      style: {
                        ...originalStyle,
                        maxWidth: "100%",
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        flexShrink: 1,
                      },
                      children: wrappedChildren,
                    } as any);
                  })() : (
                    <div style={{ maxWidth: "100%", overflow: "hidden" }}>
                      {renderTag(tag)}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  key={tag.id}
                  className={tagClassName}
                  onClick={() => onTagClick?.(tag)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 12px",
                    backgroundColor: "var(--Tag-bg-primary, #f0f0f0)",
                    color: "var(--Tag-text-primary, #181d27)",
                    borderRadius: "16px",
                    fontSize: "14px",
                    fontWeight: 500,
                    lineHeight: "1.4",
                    whiteSpace: "nowrap",
                    flexShrink: 1,
                    minWidth: 0,
                    maxWidth: maxTagWidth,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "background-color 0.2s ease, color 0.2s ease",
                    cursor: onTagClick ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) => {
                    if (!onTagClick) return;
                    e.currentTarget.style.backgroundColor = "var(--Tag-bg-hover, #e0e0e0)";
                  }}
                  onMouseLeave={(e) => {
                    if (!onTagClick) return;
                    e.currentTarget.style.backgroundColor = "var(--Tag-bg-primary, #f0f0f0)";
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                      display: "block",
                    }}
                  >
                    {tag.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

