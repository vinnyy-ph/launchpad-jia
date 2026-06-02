"use client";
import { useEffect, useState } from "react";

export default function TablePagination({ currentPage, totalPages, onPageChange, maxPagesToShow = 7 }: { currentPage: number, totalPages: number, onPageChange: (page: number) => void, maxPagesToShow?: number }) {
    const [pageNumbers, setPageNumbers] = useState<any[]>([{ value: 1, type: "number" }]);
  
    useEffect(() => {
      const formatPageNumbers = () => {
        const totalPageArray = Array.from<number>({ length: totalPages }).map((_, index) => index + 1);
        if (totalPages > maxPagesToShow) {
          const currentPageIndex = totalPageArray.findIndex((value) => value === currentPage);
          const lastIndex = totalPageArray.length - 1;
          // If current page is part of the first 3, show 1,2,3 ... 10
          if (currentPageIndex <= 2) {
            const pages = totalPageArray.slice(0, 3).map((value, index) => {
              return {
                value: value,
                type: "number"
              }
            });
            setPageNumbers([...pages, { value: "...", type: "ellipsis" }, { value: totalPages, type: "number" }])
          } else if (currentPageIndex >= (lastIndex - 2)) {
            // If current page is part of the last 3, show 1 ... 8, 9, 10
            const pages = totalPageArray.slice(lastIndex - 2).map((value, index) => {
              return {
                value: value,
                type: "number"
              }
            });
            setPageNumbers([{ value: 1, type: "number" }, { value: "...", type: "ellipsis" }, ...pages]);
          } else {
            // If current page is in the middle, show 1 ... 4, 5, 6 ... 10
            const pages = totalPageArray.slice(currentPageIndex - 1, currentPageIndex + 2).map((value) => {
              return {
                value: value,
                type: "number"
              }
            });
            setPageNumbers([
              { value: 1, type: "number" }, 
              { value: "...", type: "ellipsis" }, 
              ...pages, 
              { value: "...", type: "ellipsis" }, 
              { value: totalPages, type: "number" }
            ]);
          }
        } else {
          // Show all pages
          setPageNumbers(totalPageArray.map((page) => {
            return {
              value: page,
              type: "number"
            }
          }))
        }
      }
  
      if (totalPages > 0) {
        formatPageNumbers();
      }
  
    }, [totalPages, currentPage])
  
    return (
      <div>
      {pageNumbers.length > 0 && pageNumbers.map((page, index) => (
         <button 
         key={index} 
         className={`btn shadow-none ${currentPage === page.value ? "btn-primary" : ""}`} 
         style={{ backgroundColor: currentPage === page.value ? "#F8F9FC": "white", color: "black", border: "none", fontSize: "14px", fontWeight: 550, borderRadius: "8px" }}
         onClick={() => {
          if (page.type === "number") {
            onPageChange(page.value);
          }
         }}
         >
           {page.value}
         </button>
      ))}
    </div>
    )
  }