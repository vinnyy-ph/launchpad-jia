"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";
import { errorToast } from "@/lib/Utils";
import { CreditTransaction } from "@/lib/types/organization";
import DatePickerDropdown from "@/lib/components/Dropdown/DatePickerDropdown";
import Tooltip from "@/lib/components/ui/tooltip/Tooltip";

interface CreditTransactionTableProps {
  orgId: string;
}

export default function CreditTransactionTable({ orgId }: CreditTransactionTableProps) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: null,
    endDate: null,
  });
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchTransactions = useCallback(async (cursor?: string, reset = false) => {
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const params: Record<string, string> = { orgId, limit: "10" };
      if (cursor) params.cursor = cursor;
      if (dateRange.startDate) {
        params.startDate = dateRange.startDate.toISOString();
      }
      if (dateRange.endDate) {
        params.endDate = dateRange.endDate.toISOString();
      }

      const response = await api.get("/api/pricing-plan/get-credit-transactions", { params });

      if (reset) {
        setTransactions(response.data.transactions);
      } else {
        setTransactions((prev) => [...prev, ...response.data.transactions]);
      }
      setNextCursor(response.data.nextCursor);
      setHasMore(response.data.hasMore);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      errorToast("Error fetching transactions", 1300);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [orgId, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    if (orgId) {
      fetchTransactions(undefined, true);
    }
  }, [orgId, fetchTransactions]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && nextCursor) {
      fetchTransactions(nextCursor);
    }
  }, [isLoadingMore, hasMore, nextCursor, fetchTransactions]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [handleLoadMore]);

  const handleDateRangeChange = (date: { startDate: Date | null; endDate: Date | null }) => {
    setDateRange(date);
  };

  const handleRefresh = () => {
    fetchTransactions(undefined, true);
  };

  const formatDateTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).replace(",", "");
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      used: "Used",
      refunded: "Refunded",
      renewal: "Renewal",
      adjusted: "Adjusted",
    };
    return labels[type] || type;
  };

  const SkeletonRow = () => (
    <tr style={{ borderTop: "1px solid #E9EAEB" }}>
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} style={{ padding: "12px 16px" }}>
          <div
            style={{
              height: 16,
              background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              borderRadius: 4,
              width: i === 1 ? "120px" : i === 4 || i === 5 ? "100px" : "80px",
            }}
          />
        </td>
      ))}
    </tr>
  );

  return (
    <>
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
      <div>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
              Credit Transaction History
            </h3>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#717680", margin: 0, marginTop: 4 }}>
              See when credits were added, used, or adjusted, along with remaining balances.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <DatePickerDropdown date={dateRange} setDate={handleDateRangeChange} align="right" />
            <button
              type="button"
              onClick={handleRefresh}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                border: "1px solid #D5D7DA",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <i className="la la-sync" style={{ color: "#535862" }} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            marginTop: 16,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #E9EAEB",
            overflow: "hidden",
          }}
        >
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <i className="la la-spinner la-spin" style={{ fontSize: 32, color: "#717680" }} />
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <i className="la la-receipt" style={{ fontSize: 48, color: "#E9EAEB" }} />
              <p style={{ color: "#717680", marginTop: 12 }}>No transactions found</p>
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8F9FC" }}>
                    {[
                      "Date & Time",
                      "Reference ID",
                      "Transaction Type",
                      "Career",
                      "Candidate Name",
                      "Credits ±",
                      "Credit Balance",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#717680",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id} style={{ borderTop: "1px solid #E9EAEB" }}>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#717680" }}>
                        {formatDateTime(tx.timestamp)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#717680" }}>
                        {tx.referenceId}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#717680" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {getTypeLabel(tx.type)}
                          {tx.type === "adjusted" && tx.adjustmentReason && (
                            <Tooltip
                              message={`Reason: ${tx.adjustmentReason}`}
                              width={240}
                              position="top"
                            />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#717680" }}>
                        {tx.careerTitle || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#717680" }}>
                        {tx.candidateName || "-"}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 14,
                          fontWeight: 700,
                          color: tx.amount > 0 ? "#027A48" : "#B42318",
                        }}
                      >
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#717680" }}>
                        {tx.balanceAfter}
                      </td>
                    </tr>
                  ))}
                  {isLoadingMore && (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  )}
                </tbody>
              </table>
              {hasMore && !isLoadingMore && (
                <div ref={loadMoreRef} style={{ height: 1 }} />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
