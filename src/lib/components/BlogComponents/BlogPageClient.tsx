"use client";

import Footer from "@/lib/PageComponent/Footer";
import HomeNavBar from "@/lib/PageComponent/HomeNavBar";
import { useMobileMenu } from "@/lib/hooks/useMobileMenu";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAllBlogs, type BlogPagination, type BlogPost } from "@/lib/blog/client";
import { formatDate } from "@/lib/blog/strapi";
import TagChip from "./TagChip";
import { validateEmail } from "@/lib/Utils";

type Props = {
  initialPosts?: BlogPost[] | null;
  initialPagination?: BlogPagination | null;
  initialPage?: number;
  pageSize?: number;
};

function getPaginationItems(current: number, total: number): Array<number | "..."> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "..."> = [];
  const siblings = 1;
  const left = Math.max(2, current - siblings);
  const right = Math.min(total - 1, current + siblings);

  out.push(1);
  if (left > 2) out.push("...");
  for (let p = left; p <= right; p += 1) out.push(p);
  if (right < total - 1) out.push("...");
  out.push(total);
  return out;
}

export default function BlogPageClient({
  initialPosts,
  initialPagination,
  pageSize: pageSizeProp,
}: Props) {
  const { isStickyMobileMenu } = useMobileMenu();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = pageSizeProp ?? 7;
  const mobileNavOffset = "calc(84px + env(safe-area-inset-top))";

  const [posts, setPosts] = useState<BlogPost[]>(initialPosts ?? []);
  const [pagination, setPagination] = useState<BlogPagination | null>(initialPagination ?? null);
  const [loading, setLoading] = useState(!initialPosts);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [gridCols, setGridCols] = useState<number>(1);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    function computeCols() {
      const w = typeof window !== "undefined" ? window.innerWidth : 1200;
      if (w >= 1024) return 3;
      if (w >= 720) return 2;
      return 1;
    }
    const apply = () => setGridCols(computeCols());
    apply();
    window.addEventListener("resize", apply, { passive: true } as any);
    return () => window.removeEventListener("resize", apply as any);
  }, []);

  useEffect(() => {
    const apply = () => setIsNarrow((typeof window !== "undefined" ? window.innerWidth : 1200) < 520);
    apply();
    window.addEventListener("resize", apply, { passive: true } as any);
    return () => window.removeEventListener("resize", apply as any);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (initialPosts) {
      setPosts(initialPosts);
      setPagination(initialPagination ?? null);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getAllBlogs({ page: currentPage, pageSize });
        if (!cancelled) {
          setPosts(res.posts);
          setPagination(res.pagination);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load blog posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialPosts, initialPagination, currentPage, pageSize]);

  const featured = posts[0] ?? null;
  const rest = posts.length > 1 ? posts.slice(1) : [];
  const restGridCols = Math.max(1, Math.min(gridCols, rest.length));

  const pageCount = pagination?.pageCount ?? 1;
  const hasPagination = pageCount > 1;
  const paginationItems = hasPagination ? getPaginationItems(currentPage, pageCount) : [];

  function goToPage(p: number) {
    if (!Number.isFinite(p) || p < 1) return;
    if (pagination?.pageCount && p > pagination.pageCount) return;
    const url = p === 1 ? "/blog" : `/blog?page=${p}`;
    router.push(url, { scroll: false });
    // Smoothly scroll back to top after changing pages.
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  async function submitNewsletter(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !validateEmail(trimmed)) {
      setEmailFeedback("Please enter a valid email address.");
      return;
    }

    try {
      setIsSubmittingEmail(true);
      setEmailFeedback(null);
      const res = await fetch("/api/add-newsletter-subscriber", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to subscribe");
      setEmail("");
      setEmailFeedback("Subscribed. Thank you!");
    } catch {
      setEmailFeedback("Something went wrong. Please try again.");
    } finally {
      setIsSubmittingEmail(false);
    }
  }

  return (
    <>
      <main className="landing-page-container">
        <div style={{ width: "100%", background: "#ffffff", minHeight: "calc(100dvh + 80px)" }}>
          <HomeNavBar isStickyMobileMenu={isStickyMobileMenu} />
          {/* HomeNavBar becomes fixed on mobile; add a spacer so content doesn't sit underneath it. */}
          <div aria-hidden="true" style={{ height: isStickyMobileMenu ? mobileNavOffset : 0 }} />
          <div
            style={{
              width: "100%",
              // Match a 1440px desktop layout while keeping comfortable gutters on smaller screens.
              maxWidth: 1440,
              margin: "0 auto",
              padding: "40px clamp(20px, 5vw, 80px) 60px",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "30px",
                  padding: "0px clamp(16px, 3vw, 44px)",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px 12px",
                    borderRadius: 999,
                    border: "1px solid #C7D7FE",
                    color: "#3538CD",
                    background: "#EEF4FF",
                    fontSize: 13,
                    fontWeight: 500,
                    margin: "0 auto",
                  }}
                >
                  Our Blog
                </div>
                <h1 
                  style={{ 
                    fontWeight: 500,
                    fontSize: '48px',
                    lineHeight: '60px',
                    textAlign: 'center',
                    letterSpacing: '-0.02em',
                    color: "#181D27",
                    }}>
                  Resources and insights
                </h1>
                <p
                  style={{
                    maxWidth: '768px',
                    fontWeight: 300,
                    fontSize: '20px',
                    lineHeight: '30px',
                    textAlign: 'center',
                    color: "#717680",
                  }}
                >
                  The blog is the best source of information for interviews, tips, guides, industry best practices, and
                  news. Subscribe for updates in your inbox every week.
                </p>
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              {loading ? (
                <p style={{ color: "#717680", textAlign: "center", padding: "60px 20px"}}>Loading posts…</p>
              ) : error ? (
                <p style={{ color: "#b42318", textAlign: "center", padding: "60px 20px" }}>{error}</p>
              ) : posts.length === 0 ? (
                <p style={{ color: "#717680", textAlign: "center", padding: "60px 20px" }}>No posts yet.</p>
              ) : (
                <>
                  {featured ? (
                    <div>
                      <Link
                        href={`/blog/${featured.slug}`}
                        style={{
                          display: "block",
                          background: "#ffffff",
                          borderRadius: 16,
                          overflow: "hidden",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        {featured.coverImageUrl ? (
                          <img
                            src={featured.coverImageUrl}
                            alt={featured.title}
                            style={{
                              width: "100%",
                              height: "auto",
                              aspectRatio: "16 / 9",
                              objectFit: "cover",
                              background: "#f2f4f7",
                              display: "block",
                              borderBottomLeftRadius: 16,
                              borderBottomRightRadius: 16,
                            }}
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            style={{
                              width: "100%",
                              aspectRatio: "16 / 9",
                              background: "#f2f4f7",
                              borderBottomLeftRadius: 18,
                              borderBottomRightRadius: 18,
                            }}
                          />
                        )}

                        <div style={{ padding: "20px 10px 22px 10px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              color: "#444CE7",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            <span
                              style={{
                                fontStyle: 'normal',
                                fontWeight: 400,
                                lineHeight: '20px',
                                color: "#444CE7",
                              }}
                            >{featured.author?.name ?? "HireJIA"}</span>
                            <span
                              aria-hidden="true"
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: 999,
                                background: "#444CE7",
                                display: "inline-block",
                              }}
                            />
                            <span
                              style={{
                                fontWeight: 400,
                                lineHeight: '20px',
                                color: "#444CE7",
                              }}>{formatDate(featured.publishedAt ?? featured.updatedAt) ?? ""}</span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 14,
                              marginTop: 10,
                            }}
                          >
                            <h2 
                              style={{ 
                                fontWeight: 500,
                                fontSize: 24,
                                lineHeight: "32px",
                                color: "#181D27",
                                margin: 0,
                              }}>
                              {featured.title}
                            </h2>
                            <span style={{ color: "#A4A7AE", fontSize: 18, lineHeight: 1, marginTop: 4 , width: 24, height: 24}} aria-hidden="true">
                              <svg width="12" height="12"  fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 11L11 1M11 1H1M11 1V11" stroke="#A4A7AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </span>
                          </div>
                          

                          {featured.excerpt ? (
                            <p 
                              style={{ 
                                marginTop: 10, 
                                color: "#717680", 
                                lineHeight: "24px",
                                padding: "0px",
                                fontSize: 16,
                                fontWeight: 400,
                              }}>
                              {featured.excerpt}
                            </p>
                          ) : null}

                          {featured.tags?.length ? (
                            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }} aria-label="Tags">
                              {featured.tags.map((t) => (
                                <TagChip key={`${t.name}-${t.category ?? "unknown"}`} tag={t} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    </div>
                  ) : null}

                  {rest.length ? (
                    <div
                      style={{
                        marginTop: featured ? 22 : 0,
                        display: "grid",
                        gridTemplateColumns: `repeat(${restGridCols}, minmax(0, 1fr))`,
                        gap: 22,
                      }}
                    >
                      {rest.map((p) => (
                        <div
                          key={String(p.id)}
                        >
                          <Link
                            href={`/blog/${p.slug}`}
                            style={{
                              display: "block",
                              background: "#ffffff",
                              borderRadius: 16,
                              overflow: "hidden",
                              textDecoration: "none",
                              color: "inherit",
                            }}
                          >
                            {p.coverImageUrl ? (
                              <img
                                src={p.coverImageUrl}
                                alt={p.title}
                                style={{
                                  width: "100%",
                                  aspectRatio: "16 / 10",
                                  objectFit: "cover",
                                  background: "#f2f4f7",
                                  display: "block",
                                  borderBottomLeftRadius: 16,
                                  borderBottomRightRadius: 16,
                                }}
                              />
                            ) : (
                              <div
                                aria-hidden="true"
                                style={{
                                  width: "100%",
                                  aspectRatio: "16 / 10",
                                  background: "#f2f4f7",
                                }}
                              />
                            )}

                            <div style={{ padding: "14px 10px 16px 10px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  color: "#7a5af8",
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                <span
                                   style={{
                                    fontStyle: 'normal',
                                    fontWeight: 400,
                                    lineHeight: '20px',
                                    color: "#444CE7",
                                  }}
                                >{p.author?.name ?? "HireJIA"}</span>
                                <span
                                  aria-hidden="true"
                                  style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: 999,
                                    background: "#7a5af8",
                                    display: "inline-block",
                                  }}
                                />
                                <span
                                  style={{
                                    fontWeight: 400,
                                    lineHeight: '20px',
                                    color: "#444CE7",
                                  }}
                                >{formatDate(p.publishedAt ?? p.updatedAt) ?? ""}</span>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 12,
                                  marginTop: 8,
                                }}
                              >
                                <h3 
                                  style={{ 
                                    fontWeight: 500,
                                    fontSize: 18,
                                    lineHeight: "28px",
                                    color: "#181D27",
                                    margin: 0,
                                  }}>
                                    {p.title}
                                </h3>
                                <span style={{ color: "#A4A7AE", fontSize: 18, lineHeight: 1, marginTop: 2 }} aria-hidden="true">
                                  <svg width="12" height="12"  fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 11L11 1M11 1H1M11 1V11" stroke="#A4A7AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg >
                                </span>
                              </div>

                              {p.excerpt ? (
                                <p 
                                  style={{ 
                                  marginTop: 8, 
                                  color: "#717680", 
                                  lineHeight: "24px",
                                  padding: "0px",
                                  fontSize: 16,
                                  fontWeight: 400,
                                  }}>
                                  {p.excerpt}
                                </p>
                              ) : null}
                              {p.tags?.length ? (
                                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }} aria-label="Tags">
                                  {p.tags.map((t) => (
                                    <TagChip key={`${p.slug}-${t.name}-${t.category ?? "unknown"}`} tag={t} />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {hasPagination ? (
                    <div
                      style={{
                        borderTop: "1px solid #E4E7EC",
                        marginTop: 26,
                        paddingTop: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        color: "#E9EAEB",
                        fontSize: 14,
                      }}
                      aria-label="Pagination"
                    >
                      <button
                        type="button"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: "#ffffff",
                          color: "#717680",
                          fontWeight: 600,
                          border: "none",
                          cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                          opacity: currentPage <= 1 ? 0.45 : 1,
                        }}
                        onClick={() => goToPage(currentPage - 1)}
                        aria-disabled={currentPage <= 1}
                        disabled={currentPage <= 1}
                      >
                        ← Previous
                      </button>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                        {paginationItems.map((it, idx) =>
                          it === "..." ? (
                            <span
                              key={`e-${idx}`}
                              style={{ padding: "0 6px", color: "#98a2b3", fontWeight: 700 }}
                              aria-hidden="true"
                            >
                              …
                            </span>
                          ) : (
                            <button
                              key={`p-${it}`}
                              type="button"
                              style={{
                                minWidth: 36,
                                height: 36,
                                borderRadius: 8,
                                outline: "none",
                                boxShadow: "none",
                                border: it === currentPage ? "1px solid #F9F9FB" : "1px solid transparent",
                                background: it === currentPage ? "#F9F9FB" : "transparent",
                                color:it === currentPage ? "#414651" : "#A4A7AE",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                              onClick={() => goToPage(it)}
                              aria-current={it === currentPage ? "page" : undefined}
                            >
                              {it}
                            </button>
                          ),
                        )}
                      </div>

                      <button
                        type="button"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "none",
                          background: "#ffffff",
                          color: "#717680",
                          fontWeight: 600,
                          cursor: currentPage >= pageCount ? "not-allowed" : "pointer",
                          opacity: currentPage >= pageCount ? 0.45 : 1,
                        }}
                        onClick={() => goToPage(currentPage + 1)}
                        aria-disabled={currentPage >= pageCount}
                        disabled={currentPage >= pageCount}
                      >
                        Next →
                      </button>
                    </div>
                  ) : null}

                  <div style={{ marginTop: hasPagination ? 100 : 40, textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 48,
                        lineHeight: "60px",
                        fontWeight: 500,
                        color: "#181D27",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      Newsletter
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        fontSize: 20,
                        lineHeight: "30px",
                        fontWeight: 400,
                        color: "#717680",
                      }}
                    >
                      Subscribe for updates in your inbox every week.
                    </div>
                  </div>

                  <form
                    onSubmit={submitNewsletter}
                    style={{
                      marginTop: 28,
                      display: "flex",
                      flexDirection: isNarrow ? "column" : "row",
                      alignItems: isNarrow ? "stretch" : "center",
                      justifyContent: "center",
                      gap: 12,
                      flexWrap: isNarrow ? "nowrap" : "wrap",
                      width: isNarrow ? "min(540px, 92vw)" : "auto",
                      marginLeft: isNarrow ? "auto" : undefined,
                      marginRight: isNarrow ? "auto" : undefined,
                    }}
                  >
                    <input
                      placeholder="Enter your email"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      inputMode="email"
                      autoComplete="email"
                      aria-label="Email address"
                      style={{
                        width: isNarrow ? "100%" : "min(420px, 92vw)",
                        height: 48,
                        borderRadius: 8,
                        border: "1px solid #D5D7DA",
                        boxShadow: "0px 1px 2px 0px #0A0D120D",
                        padding: "12px 14px",
                        fontSize: 16,
                        fontWeight: 500,
                        lineHeight: "24px",
                        outline: "none",
                        background: "#ffffff",
                        color: "#101828",
                      }}
                    />

                    {isNarrow ? (
                      <div
                        style={{
                          width: "100%",
                          textAlign: "left",
                          fontSize: 14,
                          color: "#717680",
                          fontWeight: 500,
                          lineHeight: "20px",
                          marginTop: -4,
                        }}
                      >
                        We care about your data in our{" "}
                        <Link
                          href="/privacy-policy"
                          style={{
                            color: "#717680",
                            textDecoration: "underline",
                            textUnderlineOffset: 3,
                            fontWeight: 400,
                            lineHeight: "20px",
                          }}
                        >
                          privacy policy
                        </Link>
                        .
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      aria-disabled={isSubmittingEmail}
                      style={{
                        height: 56,
                        width: isNarrow ? "100%" : "auto",
                        padding: isNarrow ? "0 18px" : "0 18px",
                        borderRadius: 999,
                        border: "1px solid #101828",
                        background: "#101828",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: 16,
                        cursor: isSubmittingEmail ? "not-allowed" : "pointer",
                        opacity: isSubmittingEmail ? 0.55 : 1,
                      }}
                    >
                      {isSubmittingEmail ? "Submitting…" : "Get started"}
                    </button>
                  </form>

                  {emailFeedback ? (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        color:
                          emailFeedback.toLowerCase().includes("valid") || emailFeedback.toLowerCase().includes("wrong")
                            ? "#b42318"
                            : "#667085",
                        textAlign: "center",
                      }}
                    >
                      {emailFeedback}
                    </div>
                  ) : null}

                  {!isNarrow ? (
                    <div
                      style={{
                        marginTop: 10,
                        // Align with the left edge of the email input
                        width: "min(540px, 92vw)",
                        marginLeft: "auto",
                        marginRight: "auto",
                        textAlign: "left",
                        fontSize: 14,
                        color: "#717680",
                        fontWeight: 500,
                        lineHeight: "20px",
                      }}
                    >
                      We care about your data in our{" "}
                      <Link
                        href="/privacy-policy"
                        style={{
                          color: "#717680",
                          textDecoration: "underline",
                          textUnderlineOffset: 3,
                          fontWeight: 400,
                          lineHeight: "20px",
                        }}
                      >
                        privacy policy
                      </Link>
                      .
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

