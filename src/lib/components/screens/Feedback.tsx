"use client";

import Loader from "../common/Loader";
import styles from "@/lib/styles/screens/feedback.module.scss";
import { FIGMA_DIMENSIONS } from "@/lib/utils/constants";
import { getWidthPercentage } from "@/lib/utils/helpers";
import { api } from "@/lib/utils/apiClient";
import Fuse from "fuse.js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CandidateModal from "../CandidateComponents/CandidateModal";
import { Button } from "../ui";
import useDebounce from "@/lib/hooks/useDebounceHook";

export default function () {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const orgID = searchParams.get("orgID");
  const pageFromUrl = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const currentPage = pageFromUrl;
  const [feedbackData, setFeedbackData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState("All Ratings");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("Newest");
  const [viewDropdown, setViewDropdown] = useState(null);
  const columnDetails = [
    { name: "Name", width: 250 },
    { name: "Position Applied", width: 215 },
    { name: "Rating", width: 148 },
    { name: "Publicize", width: 84 },
    { name: "Feedback", width: 283 },
    { name: "Date", width: 132 },
  ];
  const itemsPerPage = 10;
  const ratingList = ["All Ratings", "5", "4", "3", "2", "1"];
  const sortList = ["Newest", "Oldest"];
  const tableWidth = FIGMA_DIMENSIONS.TABLE.WIDTH;
  const [totalPages, setTotalPages] = useState(0);
  const [candidateDetailsOpen, setCandidateDetailsOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const debouncedSearch = useDebounce(searchQuery, 500);

  const navigateToPage = useCallback((page: number, mode: "push" | "replace" = "push") => {
    const nextPage = Math.max(1, Math.floor(page));
    const params = new URLSearchParams(searchParamsString);
    if (nextPage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }
    const currentQuery = searchParamsString;
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    if (nextUrl === currentUrl) return;
    if (mode === "replace") {
      router.replace(nextUrl, { scroll: false });
    } else {
      router.push(nextUrl, { scroll: false });
    }
  }, [pathname, router, searchParamsString]);

  function getPaginationRange(currentPage, totalPages, maxPagesToShow = 5) {
    const pages = [];

    if (totalPages <= maxPagesToShow) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // More pages than maxPagesToShow - need ellipses

      const leftSiblingIndex = Math.max(currentPage - 1, 1);
      const rightSiblingIndex = Math.min(currentPage + 1, totalPages);

      const showLeftEllipsis = leftSiblingIndex > 2;
      const showRightEllipsis = rightSiblingIndex < totalPages - 1;

      if (!showLeftEllipsis && showRightEllipsis) {
        // No left ellipsis, but right ellipsis needed
        for (let i = 1; i <= 3; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (showLeftEllipsis && !showRightEllipsis) {
        // Left ellipsis needed, no right ellipsis
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 2; i <= totalPages; i++) pages.push(i);
      } else if (showLeftEllipsis && showRightEllipsis) {
        // Both ellipses needed
        pages.push(1);
        pages.push("...");
        for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++)
          pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else {
        // Fallback (should not occur)
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      }
    }

    return pages;
  }

  function handleDropdown(type) {
    setViewDropdown(type);
  }

  function handleRating(rating) {
    setRating(rating);
    navigateToPage(1, "replace");
    setViewDropdown(null);
  }

  // function handleSelectFeedback() {}

  function handleSort(sort) {
    setSort(sort);
    navigateToPage(1, "replace");
    setViewDropdown(null);
  }

  function downloadFeedback() {
    if (feedbackData.length > 0) {
      const headers = columnDetails.map((col) => col.name).join(",") + "\n";
      const rows = feedbackData.map((obj) =>
        columnDetails
          .map(
            (col) => obj[col.name.toLowerCase().replaceAll(" ", "_")] || "N/A"
          )
          .join(",")
      );
      const csvContent = headers + rows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = Date.now();

      link.href = url;
      link.setAttribute("download", `feedback-${date}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  function processDate(date) {
    const newDate = new Date(date);

    const formatted = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(newDate);

    return formatted;
  }

  useEffect(() => {
    // const activeOrg = localStorage.getItem("activeOrg");

    if (orgID) {
      // const parsedActiveOrg = JSON.parse(activeOrg);
      fetchFeedback(orgID);
    }
  }, [orgID, rating, sort, debouncedSearch, currentPage]);

  async function fetchFeedback(orgID) {
    setLoading(true);
    await api.post("/api/fetch-feedback", { 
      orgID, 
      page: currentPage, 
      limit: itemsPerPage,
      rating,
      sort,
      searchQuery: debouncedSearch,
    })
      .then(async (res) => {
        const result = await res.data;
        const feedbackData = result.feedback;
        const total = result.total;

        if (feedbackData.length > 0) {
          const data = feedbackData.map((item) => ({
            image: item.interviewDetails?.image,
            name: item.interviewDetails?.name,
            email: item.interviewDetails?.email,
            position_applied: item.interviewDetails?.jobTitle,
            rating: item?.rating,
            publicize: item?.allowTestimonial,
            feedback: item?.feedback,
            date: processDate(item?.createdAt),
          }));

          setFeedbackData(data);
          setTotalPages(Math.ceil(total / itemsPerPage));
          setTotalCount(total);
        }
      })
      .catch((err) => {
        alert("Error on fetching feedback data.");
        console.log(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return (
    <div className={styles.feedbackContainer}>
      <div className={styles.headerContainer}>
        <div className={styles.textContainer}>
          <span className={styles.title}>Feedback</span>
          <span className={styles.description}>
            Check interview feedbacks provided by the applicants here.
          </span>
        </div>

        <div className={styles.actionBar}>
          <div className={styles.inputContainer}>
            <img alt="search" src="/icons/search.svg" />
            <input
              placeholder="Search"
              value={searchQuery}
              onBlur={(e) => {
                (e.target as HTMLInputElement).placeholder = "Search";
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                navigateToPage(1, "replace");
              }}
              onClick={(e) => {
                (e.target as HTMLInputElement).placeholder = "";
              }}
            />
          </div>

          <Button 
          onClick={downloadFeedback} 
          variant="secondary"
          label="Download"
          icon="/download.svg"
          >
          </Button>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.bg} />

        <div className={styles.tableHeader}>
          <span className={styles.title}>Feedbacks</span>
          <span className={styles.count}>{totalCount}</span>
          <button className="button-v2 secondary"
            onBlur={() => handleDropdown(null)}
            onClick={() => handleDropdown("rating")}
          >
            <img alt="star" src="/icons/star.svg" />
            {rating}
          </button>
          <button className="button-v2 secondary"
            onBlur={() => handleDropdown(null)}
            onClick={() => handleDropdown("sort")}
          >
            <img alt="sort" src="/icons/sort.svg" />
            Sort By: {sort} First
          </button>

          {viewDropdown != null && (
            <div
              className={`${styles.dropdownContainer} ${styles[viewDropdown]}`}
            >
              {viewDropdown == "rating" &&
                ratingList.map((item, index) => (
                  <span
                    key={index}
                    className={rating == item ? styles.active : ""}
                    onClick={() => handleRating(item)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {index == 0 ? item : `${item} star`}
                    {rating == item && (
                      <img alt="check" src="/icons/checkV4.svg" />
                    )}
                  </span>
                ))}

              {viewDropdown == "sort" &&
                sortList.map((item, index) => (
                  <span
                    key={index}
                    className={sort == item ? styles.active : ""}
                    onClick={() => handleSort(item)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {item} First
                    {sort == item && (
                      <img alt="check" src="/icons/checkV4.svg" />
                    )}
                  </span>
                ))}
            </div>
          )}
        </div>

        <div className={styles.tableDetails}>
          {columnDetails.map((item, index) => (
            <span
              key={index}
              style={{
                width: `${getWidthPercentage(
                  item.width,
                  FIGMA_DIMENSIONS.TABLE.WIDTH
                )}%`,
              }}
            >
              {item.name}
            </span>
          ))}
        </div>

        <div className={styles.tableContents}>
          {loading && (
            <Loader
              loaderType={"feedback"}
              loaderData={{ length: 10, columnDetails }}
            />
          )}

          {!loading && feedbackData.length == 0 && (
            <div className={styles.emptyState}>
              <img alt="reviews" src="/icons/reviews.svg" />
              <span className={styles.title}>No Feedback Yet</span>
              <span className={styles.description}>
                Feedback from applicants will appear here once it's submitted.
              </span>
            </div>
          )}

          {!loading &&
            feedbackData.length > 0 &&
            feedbackData
              .map((data, index) => (
                <div
                  className={styles.contentContainer}
                  key={index}
                  // onClick={() => handleSelectFeedback(data.email)}
                >
                  <div
                    className={styles.userContainer}
                    style={{
                      width: `${getWidthPercentage(
                        columnDetails[0].width,
                        tableWidth
                      )}%`,
                    }}
                    onClick={() => {
                      setSelectedCandidate(data);
                      setCandidateDetailsOpen(true);
                    }}
                  >
                    <img alt="user" src={data?.image} />
                    <div className={styles.userDetails}>
                      <span className={styles.name}>{data?.name}</span>
                      <span className={styles.email}>{data?.email}</span>
                    </div>
                  </div>
                  <span
                    className={styles.position}
                    style={{
                      width: `${getWidthPercentage(
                        columnDetails[1].width,
                        tableWidth
                      )}%`,
                    }}
                  >
                    {data?.position_applied}
                  </span>
                  <div
                    className={styles.ratingContainer}
                    style={{
                      width: `${getWidthPercentage(
                        columnDetails[2].width,
                        tableWidth
                      )}%`,
                    }}
                  >
                    {Array.from({ length: 5 }).map((_, index) => (
                      <img
                        key={index}
                        alt="star-rating"
                        src={`/icons/${
                          index < parseInt(data?.rating)
                            ? "star-filled"
                            : "star-empty"
                        }.svg`}
                      />
                    ))}
                  </div>
                  <span
                    className={styles.publicize}
                    style={{
                      width: `${getWidthPercentage(
                        columnDetails[3].width,
                        tableWidth
                      )}%`,
                    }}
                  >
                    {data.publicize && (
                      <img alt="" src="/iconsV3/checkV7.svg" />
                    )}
                  </span>
                  <span
                    className={styles.feedback}
                    style={{
                      width: `${getWidthPercentage(
                        columnDetails[4].width,
                        tableWidth
                      )}%`,
                    }}
                  >
                    {data?.feedback || "-"}
                  </span>
                  <span
                    className={styles.date}
                    style={{
                      width: `${getWidthPercentage(
                        columnDetails[5].width,
                        tableWidth
                      )}%`,
                    }}
                  >
                    {data?.date}
                  </span>
                </div>
              ))}
        </div>

        <div className={styles.tablePagination}>
          <Button
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage === 1}
            variant="secondary"
            label="Previous"
            icon={`/icons/arrow${currentPage === 1 ? "-disabled" : ""}.svg`}
          >
          </Button>

          <div className={styles.pagination}>
            {getPaginationRange(currentPage, totalPages).map((page, index) =>
              page === "..." ? (
                <span key={index} className={styles.ellipsis}>
                  &hellip;
                </span>
              ) : (
                <span
                  key={index}
                  className={currentPage === page ? styles.active : ""}
                  onClick={() => navigateToPage(page as number)}
                  style={{ cursor: "pointer" }}
                >
                  {page}
                </span>
              )
            )}
          </div>

          <Button
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            variant="secondary"
            label="Next"
            icon={`/icons/arrow${
              currentPage >= totalPages ? "-disabled" : ""
            }.svg`}
            iconPosition="right"
          >
          </Button>
        </div>
      </div>
      {candidateDetailsOpen && (
        <CandidateModal
          candidate={selectedCandidate}
          setShowCandidateModal={setCandidateDetailsOpen}
        />
      )}
    </div>
  );
}
