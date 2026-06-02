"use client";

import Footer from "@/lib/PageComponent/Footer";
import HomeNavBar from "@/lib/PageComponent/HomeNavBar";
import { useMobileMenu } from "@/lib/hooks/useMobileMenu";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import sanitizeHtml from "sanitize-html";
import { ArticleJsonLd } from "next-seo";
import { getBlogBySlug, type BlogPost } from "@/lib/blog/client";
import { formatDate } from "@/lib/blog/strapi";
import TagChip from "./TagChip";

type StrapiBlock = { type: string; [key: string]: any };

function isStrapiBlocks(value: unknown): value is StrapiBlock[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v === "object" && typeof (v as any).type === "string")
  );
}

function applyMarks(text: string, node: any): ReactNode {
  let out: ReactNode = text;
  if (node?.code) out = <code>{out}</code>;
  if (node?.bold) out = <strong>{out}</strong>;
  if (node?.italic) out = <em>{out}</em>;
  if (node?.underline) out = <u>{out}</u>;
  if (node?.strikethrough) out = <s>{out}</s>;
  return out;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toAbsoluteContentUrl(
  url: string | null | undefined,
  strapiBaseUrl?: string | null,
): string | null {
  if (!url) return null;
  const base =
    strapiBaseUrl ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    (typeof window !== "undefined" ? window.location.origin : undefined);
  if (!base) return null;
  try {
    const abs = new URL(url, base).toString();
    return isSafeUrl(abs) ? abs : null;
  } catch {
    return null;
  }
}

function extractPlainTextFromInline(nodes: any[] = []): string {
  return nodes
    .map((n) => {
      if (!n) return "";
      if (typeof n?.text === "string") return n.text;
      if (Array.isArray(n?.children)) return extractPlainTextFromInline(n.children);
      return "";
    })
    .join("");
}

function splitQuoteAndAuthor(raw: string): { quote: string; author: string | null } {
  const text = String(raw ?? "").trim();
  if (!text) return { quote: "", author: null };

  // Prefer newline-delimited author line: "\n— Name, Title"
  const newlineIdx = text.search(/\n\s*[—-]\s+/);
  if (newlineIdx >= 0) {
    const quote = text.slice(0, newlineIdx).trim();
    const author = text.slice(newlineIdx).replace(/^\s*\n\s*[—-]\s+/, "").trim();
    return { quote, author: author || null };
  }

  // Fallback: last em-dash with spaces: "… — Name"
  const lastDash = text.lastIndexOf(" — ");
  if (lastDash >= 0) {
    const quote = text.slice(0, lastDash).trim();
    const author = text.slice(lastDash + 3).trim();
    return { quote, author: author || null };
  }

  return { quote: text, author: null };
}

function CreditLine({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "#667085",
        fontSize: 14,
        lineHeight: "20px",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.38316 11.1544L6.44036 12.0972C5.13861 13.399 3.02806 13.399 1.72631 12.0972C0.424563 10.7955 0.424563 8.68491 1.72631 7.38317L2.66912 6.44036M11.1544 7.38316L12.0972 6.44036C13.399 5.13861 13.399 3.02806 12.0972 1.72631C10.7955 0.424563 8.68491 0.424563 7.38316 1.72631L6.44036 2.66912M4.57843 9.24508L9.24509 4.57841" stroke="#717680" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#717680", stroke: "#717680" }}/>
      </svg>

      <span>{trimmed}</span>
    </div>
  );
}

function renderInline(nodes: any[] = []): ReactNode[] {
  return nodes.map((n, i) => {
    if (!n) return null;

    if (typeof n?.text === "string") {
      return <span key={i}>{applyMarks(n.text, n)}</span>;
    }

    if (n?.type === "link" && typeof n?.url === "string") {
      if (!isSafeUrl(n.url)) return null;
      return (
        <a key={i} href={n.url} target="_blank" rel="noreferrer noopener">
          {renderInline(n.children)}
        </a>
      );
    }

    return null;
  });
}

function renderBlocks(
  blocks: StrapiBlock[],
  strapiBaseUrl?: string | null,
  mode: "default" | "closing_remark" = "default",
): ReactNode[] {
  function ClosingRemarkCard({
    headline,
    children,
  }: {
    headline?: string | null;
    children?: ReactNode;
  }) {
    return (
      <div
        style={{
          margin: "28px 0",
          padding: 32,
          borderRadius: 16,
          background: "#F9FAFB",
          border: "1px solid #F9F9FB",
        }}
      >
        {headline ? (
          <div
            style={{
              fontSize: 24,
              lineHeight: "32px",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              marginBottom: 12,
              color: "#181D27",
            }}
          >
            {headline}
          </div>
        ) : null}

          <div 
            style={{ 
              fontSize: 18, 
              lineHeight: "28px", 
              }}>
                {children}
          </div>
      </div>
    );
  }

  const paragraphColor = "#717680";
  const paragraphWeight = 400;

  function renderOne(b: StrapiBlock, key: string | number): ReactNode {
    switch (b.type) {
      case "paragraph":
        {
          return (
            <p
              key={key}
              style={{
                margin: "0 0 14px 0",
                fontWeight: paragraphWeight,
                fontSize: 18,
                lineHeight: "28px",
                color: paragraphColor,
              }}
            >
              {renderInline(b.children)}
            </p>
          );
        }

      case "heading": {
        const level = Math.min(Math.max(Number(b.level ?? 2), 1), 6);
        const style =
          level === 1
            ? { margin: "22px 0 20px 0", fontSize: 30, fontWeight: 500, lineHeight: "38px", color: "#181D27" }
            : level === 2
              ? { margin: "22px 0 20px 0", fontSize: 30, fontWeight: 500, lineHeight: "38px", color: "#181D27" }
              : { margin: "18px 0 20px 0", fontSize: 30, fontWeight: 500, lineHeight: "38px", color: "#181D27" };

        const content = renderInline(b.children);
        if (level === 1) return <h1 key={key} style={style}>{content}</h1>;
        if (level === 2) return <h2 key={key} style={style}>{content}</h2>;
        if (level === 3) return <h3 key={key} style={style}>{content}</h3>;
        if (level === 4) return <h4 key={key} style={style}>{content}</h4>;
        if (level === 5) return <h5 key={key} style={style}>{content}</h5>;
        return <h6 key={key} style={style}>{content}</h6>;
      }

      case "list": {
        const ordered = b.format === "ordered";
        const ListTag = ordered ? "ol" : "ul";
        const items = Array.isArray(b.children) ? b.children : [];
        return (
          <ListTag
            key={key}
            style={{
              margin: "0 0 14px 0",
              paddingLeft: 40,
              fontWeight: paragraphWeight,
              fontSize: 18,
              lineHeight: "28px",
              color: paragraphColor,
            }}
          >
            {items.map((li: any, j: number) => (
              <li
                key={j}
                style={{
                  marginBottom: 8,
                  fontWeight: paragraphWeight,
                  fontSize: 18,
                  lineHeight: "28px",
                  color: paragraphColor,
                }}
              >
                {renderInline(li?.children)}
              </li>
            ))}
          </ListTag>
        );
      }

      case "quote": {
        const explicitAuthor =
          typeof (b as any)?.author === "string"
            ? String((b as any).author)
            : typeof (b as any)?.cite === "string"
              ? String((b as any).cite)
              : null;
        const raw = extractPlainTextFromInline(Array.isArray(b.children) ? b.children : []);
        const trimmed = raw.trim();

        const { quote, author } = splitQuoteAndAuthor(trimmed);
        const authorLabel = explicitAuthor || author;
        return (
          <div
            key={key}
            style={{
              margin: "28px 0",
              display: "flex",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: "3px",
                borderRadius: 999,
                background: "linear-gradient(180deg, #9FCAED 0%, #CEB6DA 100%, #EBACC9 100%, #FCCEC0 100%)",
                alignSelf: "stretch",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 24,
                  lineHeight: "32px",
                  fontWeight: 500,
                  fontStyle: "italic",
                  color: "#181D27",
                }}
              >
                {quote ? `“${quote}”` : ""}
              </p>
              {authorLabel ? (
                <p style={{ margin: "14px 0 0 0", fontSize: 16, lineHeight: "24px", color: "#717680", fontWeight: 500 }}>
                  — {authorLabel}
                </p>
              ) : null}
            </div>
          </div>
        );
      }

      case "image": {
        const src =
          typeof b?.url === "string"
            ? b.url
            : typeof (b as any)?.image?.url === "string"
              ? (b as any).image.url
              : null;
        const absoluteSrc = toAbsoluteContentUrl(src, strapiBaseUrl);
        const caption =
          typeof (b as any)?.caption === "string"
            ? String((b as any).caption)
            : typeof (b as any)?.image?.caption === "string"
              ? String((b as any).image.caption)
              : null;
        const alt =
          (b as any)?.alt ??
          (b as any)?.image?.alternativeText ??
          (b as any)?.image?.caption ??
          "Image";
        if (!absoluteSrc) {
          return (
            <div key={key} style={{ margin: "14px 0", color: "#b42318" }}>
              Image unavailable
            </div>
          );
        }
        const width = Number((b as any)?.image?.width) || undefined;
        const height = Number((b as any)?.image?.height) || undefined;
        return (
          <figure key={key} style={{ margin: "28px 0" }}>
            <img
              src={absoluteSrc}
              alt={alt || "Image"}
              width={width}
              height={height}
              loading="lazy"
              style={{
                maxWidth: "100%",
                width: "100%",
                height: "auto",
                borderRadius: 16,
                background: "#f2f4f7",
                display: "block",
              }}
            />
            {caption ? <figcaption><CreditLine text={caption} /></figcaption> : null}
          </figure>
        );
      }

      case "callout":
      
      case "code": {
        const codeText = Array.isArray((b as any)?.children)
          ? (b as any).children
              .map((n: any) => (typeof n?.text === "string" ? n.text : ""))
              .join("")
          : "";
        return (
          <pre
            key={key}
            style={{
              margin: "14px 0",
              padding: "12px 14px",
              background: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 8,
              overflowX: "auto",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <code>{codeText}</code>
          </pre>
        );
      }

      default:
        return (
          <div key={key} style={{ margin: "14px 0", color: "#b42318" }}>
            Unsupported block type: {b?.type || "unknown"}
          </div>
        );
    }
  }

  const out: ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    // Closing remark grouping: Heading 3 starts a gray card, including subsequent blocks until the next heading of level 1–3.
    if (b?.type === "heading") {
      const level = Math.min(Math.max(Number(b.level ?? 2), 1), 6);
      if (level === 3) {
        const headline = extractPlainTextFromInline(Array.isArray(b.children) ? b.children : []).trim() || null;
        const inner: StrapiBlock[] = [];
        let j = i + 1;
        while (j < blocks.length) {
          const next = blocks[j];
          if (next?.type === "heading") {
            const nextLevel = Math.min(Math.max(Number(next.level ?? 2), 1), 6);
            if (nextLevel <= 3) break;
          }
          inner.push(next);
          j++;
        }

        out.push(
          <ClosingRemarkCard key={`closing-${i}`} headline={headline}>
            {renderBlocks(inner, strapiBaseUrl, "closing_remark")}
          </ClosingRemarkCard>,
        );

        i = j - 1;
        continue;
      }
    }

    out.push(renderOne(b, i));
  }

  return out;
}

type Props = {
  slug: string;
  siteUrl: string;
  initialPost?: BlogPost | null;
};

export default function BlogPostClient({ slug, siteUrl, initialPost }: Props) {
  const { isStickyMobileMenu } = useMobileMenu();
  const mobileNavOffset = "calc(84px + env(safe-area-inset-top))";
  const pageGutter = "clamp(20px, 5vw, 80px)";

  const [post, setPost] = useState<BlogPost | null>(initialPost ?? null);
  const [loading, setLoading] = useState(initialPost === undefined);
  const [error, setError] = useState<string | null>(null);

  const canonicalUrl = `${siteUrl}/blog/${slug}`;
  const contentBaseUrl =
    post?.strapiBaseUrl || process.env.NEXT_PUBLIC_STRAPI_URL || null;

  // Sync post state when initialPost changes (including null when not found)
  useEffect(() => {
    setPost(initialPost ?? null);
    setLoading(initialPost === undefined);
    setError(null);
  }, [initialPost]);

  useEffect(() => {
    let cancelled = false;

    if (!slug || initialPost !== undefined) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getBlogBySlug(slug);
        if (!cancelled) setPost(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load post");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, initialPost]);

  const title = post?.seoTitle || post?.title || "Blog | HireJIA";
  const description = post?.seoDescription || post?.excerpt || "HireJIA blog post.";
  const jsonLdImages = post?.coverImageUrl ? [post.coverImageUrl] : [];
  const datePublished = post?.publishedAt ?? post?.updatedAt ?? new Date().toISOString();
  const dateLabel = formatDate(post?.publishedAt ?? post?.updatedAt) ?? null;

  return (
    <>
      <main className="landing-page-container">
        <div
          style={{
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            minHeight: "calc(100dvh + 80px)",
            backgroundColor: "#FFFFFF",
            boxSizing: "border-box",
          }}
        >
          <HomeNavBar isStickyMobileMenu={isStickyMobileMenu} />
          {/* HomeNavBar becomes fixed on mobile; add a spacer so content doesn't sit underneath it. */}
          <div aria-hidden="true" style={{ height: isStickyMobileMenu ? mobileNavOffset : 0 }} />

          {/* Full-width wrapper so the header image can reach the Figma width on large screens. */}
          <div style={{ width: "100%", margin: "0 auto", padding: `40px ${pageGutter}` }}>
            <div>

              {loading ? (
                <p style={{ marginTop: 18, color: "#717680", textAlign: "center", padding: "60px 20px"}}>Loading post…</p>
              ) : error ? (
                <p style={{ marginTop: 18, color: "#b42318", textAlign: "center", padding: "60px 20px" }}>{error}</p>
              ) : !post ? (
                <>
                  <h1 style={{ marginTop: 18, fontSize: 34, fontWeight: 800, color: "#181d27", textAlign: "center" }}>
                    Post not found
                  </h1>
                  <p style={{ marginTop: 10, color: "#717680", textAlign: "center", padding: "60px 20px" }}>
                    The post may have been moved or unpublished.
                  </p>
                </>
              ) : (
                <>
                  <ArticleJsonLd
                    useAppDir
                    url={canonicalUrl}
                    title={title}
                    images={jsonLdImages}
                    datePublished={datePublished}
                    dateModified={post?.updatedAt ?? datePublished}
                    description={description}
                    authorName="HireJIA"
                    publisherName="HireJIA"
                    publisherLogo={`${siteUrl}/jia-logo-white-bg.svg`}
                  />

                  <div
                    style={{
                      width: "100%",
                      // Match a 1440px desktop layout while keeping comfortable gutters.
                      maxWidth: 1440,
                      margin: "0 auto",
                      padding: "0px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ marginTop: 18 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          color: "#444CE7",
                          lineHeight: "24px",
                          fontSize: "16px",
                          fontWeight: 500,
                        }}
                      >
                        <span>{dateLabel ? `Published ${dateLabel}` : "Published"}</span>
                      </div>
                    </div>

                    <h1 
                      style={{ 
                        marginTop: 10, 
                        fontSize: "48px", 
                        fontWeight: 500, 
                        lineHeight: "60px", 
                        color: "#181d27",
                        letterSpacing: "-0.02em",
                        textAlign: "center",
                        maxWidth: 960,
                      }}>
                      {post.title}
                    </h1>

                    {post.excerpt ? (
                      <p 
                        style={{ 
                          marginTop: 14, 
                          fontSize: 20, 
                          lineHeight: "30px", 
                          fontWeight: 400,
                          color: "#717680",
                          textAlign: "center",
                          maxWidth: 760,
                        }}>
                        {post.excerpt}
                      </p>
                    ) : null}

                    {post.tags?.length ? (
                      <div
                        style={{
                          marginTop: 14,
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "center",
                          padding: "2px 10px",
                          gap: 8,
                          maxWidth: 960,
                        }}
                        aria-label="Tags"
                      >
                        {post.tags.map((t) => (
                          <TagChip key={`${t.name}-${t.category ?? "unknown"}`} tag={t} />
                        ))}
                      </div>
                    ) : null}

                    {post.coverImageUrl ? (
                      <div style={{ marginTop: 48, width: "100%", display: "flex", justifyContent: "center" }}>
                        <img
                          src={post.coverImageUrl}
                          alt={post.title ? `${post.title} cover image` : "Blog cover image"}
                          loading="eager"
                          style={{
                            width: "100%",
                            maxWidth: 1220,
                            height: "auto",
                            background: "#f2f4f7",
                            borderRadius: 16,
                            display: "block",
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  
                  {/* Constrain article body for readability */}
                  <div style={{ width: "100%", maxWidth: 780, margin: "0 auto", marginTop: 48, fontSize: 18, lineHeight: "28px", fontWeight: 500, color: "#717680" }}>
                    {isStrapiBlocks(post.content) ? (
                      <div>{renderBlocks(post.content, contentBaseUrl)}</div>
                    ) : typeof post.content === "string" && post.content.trim().startsWith("<") ? (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(post.content, {
                            allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
                            allowedAttributes: {
                              ...sanitizeHtml.defaults.allowedAttributes,
                              a: ["href", "name", "target", "rel"],
                              img: ["src", "alt", "title", "width", "height", "loading"],
                            },
                            transformTags: {
                              a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener" }),
                              img: (_tagName, attribs) => {
                                const src = typeof attribs.src === "string" ? attribs.src : "";
                                const abs = toAbsoluteContentUrl(src, contentBaseUrl);
                                return {
                                  tagName: "img",
                                  attribs: {
                                    ...attribs,
                                    src: abs ?? attribs.src,
                                    loading: attribs.loading ?? "lazy",
                                  },
                                };
                              },
                            },
                          }),
                        }}
                      />
                    ) : (
                      <ReactMarkdown
                        components={{
                          img({ node: _node, ...props }) {
                            const src = typeof props.src === "string" ? props.src : "";
                            const abs = toAbsoluteContentUrl(src, contentBaseUrl);
                            if (!abs) {
                              return (
                                <span style={{ color: "#b42318" }}>
                                  Image unavailable
                                </span>
                              );
                            }
                            return (
                              <figure style={{ margin: "28px 0" }}>
                              <img
                                {...props}
                                src={abs}
                                loading={props.loading ?? "lazy"}
                                  style={{
                                    maxWidth: "100%",
                                    width: "100%",
                                    height: "auto",
                                    borderRadius: 16,
                                    background: "#f2f4f7",
                                    display: "block",
                                  }}
                                />
                                {typeof props.title === "string" && props.title.trim() ? (
                                  <figcaption>
                                    <CreditLine text={props.title} />
                                  </figcaption>
                                ) : null}
                              </figure>
                            );
                          },
                          blockquote({ node: _node, ...props }) {
                            // Heuristic:
                            // Render as a pull quote with gradient bar (and optional "— author" parsing).
                            const raw = Array.isArray(props.children) ? props.children.map((c) => (typeof c === "string" ? c : "")).join("") : "";
                            const text = raw.trim();

                            const split = splitQuoteAndAuthor(text);
                            return (
                              <div
                                style={{
                                  margin: "28px 0",
                                  display: "flex",
                                  gap: 18,
                                  alignItems: "stretch",
                                }}
                              >
                                <div
                                  aria-hidden="true"
                                  style={{
                                    width: 4,
                                    borderRadius: 999,
                                    background: "linear-gradient(180deg, #C7D7FE 0%, #E9D7FE 100%)",
                                    alignSelf: "stretch",
                                    flexShrink: 0,
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: 24,
                                      lineHeight: "34px",
                                      fontWeight: 500,
                                      fontStyle: "italic",
                                      color: "#101828",
                                    }}
                                  >
                                    {split.quote ? `“${split.quote}”` : props.children}
                                  </p>
                                  {split.author ? (
                                    <p style={{ margin: "14px 0 0 0", fontSize: 16, lineHeight: "24px", color: "#667085" }}>
                                      — {split.author}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          },
                        }}
                      >
                        {typeof post.content === "string" ? post.content : ""}
                      </ReactMarkdown>
                    )}
                  </div>

                  {post.author ? (
                    <div style={{ width: "100%", maxWidth: 780, margin: "0 auto", marginTop: 44 }}>
                      <div style={{ height: 1, background: "#E9EAEB", width: "100%" }} />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          paddingTop: 18,
                        }}
                      >
                        {post.author.avatarUrl ? (
                          <img
                            src={post.author.avatarUrl}
                            alt={post.author.name}
                            width={48}
                            height={48}
                            style={{ width: 48, height: 48, borderRadius: 999, objectFit: "cover", background: "#F2F4F7" }}
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 999,
                              background: "#EEF4FF",
                              border: "1px solid #C7D7FE",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: "#3538CD",
                            }}
                          >
                            {(post.author.name || "A").trim().slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 16, lineHeight: "24px", fontWeight: 500, color: "#181D27" }}>
                            {post.author.name}
                          </div>
                          {post.author.title ? (
                            <div style={{ fontSize: 14, lineHeight: "20px", fontWeight: 400, color: "#717680" }}>
                              {post.author.title}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

