"use client";
import { useEffect, useState } from "react";
import { COMPANY_SIZE_OPTIONS, REASON_FOR_INQUIRY_OPTIONS } from "../../utils/constants";
import { candidateActionToast, errorToast } from "../../Utils";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import TablePagination from "../TablePagination";
import CustomDropdown from "../CareerComponents/CustomDropdown";
import useDebounce from "../../hooks/useDebounceHook";
import DatePickerDropdown from "../Dropdown/DatePickerDropdown";
import MultiSelectDropdown from "../Dropdown/MultiDropdown";
import { Button } from "../ui";

const tableHeaderStyle: any = {
    textTransform: "none",
    fontWeight: 700,
    fontSize: 12,
    color: "#717680",
}

const limitPerPageOptions = [
    {
        name: "10 per page",
        value: 10
    },
    {
        name: "20 per page",
        value: 20
    },
    {
        name: "30 per page",
        value: 30
    },
    {
        name: "40 per page",
        value: 40
    },
    {
        name: "50 per page",
        value: 50
    },
]

const boldColumnStyle: any = { fontSize: "14px", fontWeight: 700, color: "#181D27" };
const regularColumnStyle: any = { fontSize: "14px", fontWeight: 500, color: "#717680" };

export default function InquiriesTable() {

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 500);
    const [companySizeFilters, setCompanySizeFilters] = useState([]);
    const [reasonForInquiryFilters, setReasonForInquiryFilters] = useState([]);
    const [page, setPage] = useState(1);
    const [limitPerPage, setLimitPerPage] = useState(10);
    const [isLoading, setIsLoading] = useState(false);
    const [inquiries, setInquiries] = useState([]);
    const [totalInquiries, setTotalInquiries] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [displayInquiryModal, setDisplayInquiryModal] = useState(false);
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const [dateRangeFilter, setDateRangeFilter] = useState({
        startDate: null,
        endDate: null
    });

    useEffect(() => {
        const fetchInquiries = async () => {
            try {
                setIsLoading(true);
                const response = await api.get("/api/fetch-inquiries", {
                    params: {
                        search: debouncedSearch,
                        page: page,
                        limit: limitPerPage,
                        companySizeFilters: companySizeFilters.join(","),
                        reasonForInquiryFilters: reasonForInquiryFilters.join(","),
                        startDate: dateRangeFilter.startDate ? dateRangeFilter.startDate.toISOString() : null,
                        endDate: dateRangeFilter.endDate ? dateRangeFilter.endDate.toISOString() : null
                    }
                });
                const data = response.data;
                setInquiries(data.inquiries);
                setTotalInquiries(data.totalInquiries);
                setTotalPages(Math.ceil(data.totalInquiries / limitPerPage));
            } catch (error) {
                console.log(error);
                errorToast("Failed to fetch inquiries", 1300);
            } finally {
                setIsLoading(false);
            } 
        }
        fetchInquiries();
    },[page, companySizeFilters, reasonForInquiryFilters, debouncedSearch, limitPerPage, dateRangeFilter]);

    return (
        <>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: "20px"}}>
                <div>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}>Inquiries</h1>
                    <div style={{ borderRadius: "20px", border: "1px solid #D5D9EB", backgroundColor: "#F8F9FC", color: "#363F72", fontSize: "12px", padding: "0 10px" }}>{totalInquiries}</div>
                    </div>
                <span style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}>Review inquiries and responses submitted through your contact form.</span>
                </div>

                <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Button 
                    variant="primary" 
                    style={{ backgroundColor: "#FFFFFF", color: "#000000" }} 
                    disabled={inquiries.length === 0}
                    onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8,NAME,EMAIL,PHONE NUMBER,COMPANY NAME,COMPANY SIZE,REASON FOR INQUIRY,MESSAGE,SOURCE OF INQUIRY,DATE & TIME" + "\n" + inquiries.map((inquiry: any) => {
                            return [
                                inquiry.firstName && inquiry.lastName ? `${inquiry.firstName} ${inquiry.lastName}` : "N/A",
                                inquiry.email?.replace(/,/g, ""),
                                inquiry.phoneNumber || "N/A",
                                inquiry.companyName?.replace(/,/g, "") || "N/A",
                                inquiry.companySize || "N/A",
                                inquiry.reasonForInquiry || "N/A",
                                inquiry.message?.replace(/,/g, "") || "N/A",
                                inquiry.sourceOfInquiry?.replace(/,/g, "") || "N/A",
                                inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleString()?.replace(/,/g, "") : "N/A"
                            ]
                        }).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `Inquiries-${new Date().toLocaleDateString()}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    label="Export Inquiries"
                    icon="/export-file.svg"
                    >
                    </Button>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: "16px", width: "100%"}}>
                <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center", width: "70%" }}>
                <div className="table-search-bar" style={{ minWidth: "240px" }}>
                <div className="icon mr-2">
                    <i className="la la-search"></i>
                </div>
                <input
                    type="search"
                    className="form-control ml-auto search-input"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                    }}
                />
                </div>
                <DatePickerDropdown date={dateRangeFilter} setDate={setDateRangeFilter} />
                <MultiSelectDropdown
                label={
                    <>
                        <span>Company Size</span>
                        <i className="la la-chevron-down"></i>
                    </>
                } 
                options={COMPANY_SIZE_OPTIONS.map((option) => option.name)} 
                selectedOptions={companySizeFilters} 
                onApply={(filters) => {
                    setCompanySizeFilters(filters);
                }} 
                />
                <MultiSelectDropdown
                label={
                    <>
                        <span>Reason for Inquiry</span>
                        <i className="la la-chevron-down"></i>
                    </>
                } 
                options={REASON_FOR_INQUIRY_OPTIONS.map((option) => option.name).concat(["Subscribe to newsletter"])} 
                selectedOptions={reasonForInquiryFilters} 
                onApply={(filters) => {
                    setReasonForInquiryFilters(filters);
                }} 
                />
                </div>

                <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: "14px", color: "#414651", fontWeight: 700, textWrap: "nowrap" }}>Go to page:</span>
                    <input
                        style={{ width: "60px" }}
                        type="number"
                        className="form-control"
                        placeholder="Page"
                        value={page}
                        onChange={(e) => {
                            const parsedPage = parseInt(e.target.value);
                            if ((!isNaN(parsedPage) && parsedPage > 0 && parsedPage <= totalPages)) {
                                setPage(parsedPage)
                            }
                        }}
                    />
                    <CustomDropdown 
                    screeningSetting={`${limitPerPage} per page`}
                    onSelectSetting={(limit) => {
                        const value = limitPerPageOptions.find((option) => option.name === limit)?.value;
                        setLimitPerPage(value || 10);
                        setPage(1);
                    }} 
                    settingList={limitPerPageOptions} 
                    />
                </div>
            </div>

            <span style={{ fontSize: "14px", color: "#A4A7AE", fontWeight: 500 }}>Showing {inquiries.length} of {totalInquiries} inquiries</span>

            <div className="table-responsive" style={{ height: "fit-content", background: "#FFFFFF", borderRadius: "20px", marginTop: "16px" }}>
            <table className="table align-items-center table-flush" style={{ border: "1px solid #E9EAEB" }}>
                <thead style={{ background: "#F8F9FC", borderRadius: "20px" }}>
                    <tr>
                    <th scope="col" className="sort" data-sort="name" style={tableHeaderStyle}>
                        Name
                    </th>
                    <th scope="col" className="sort" data-sort="assessment" style={tableHeaderStyle}>
                        Work Email
                    </th>
                    <th scope="col" className="sort" data-sort="assessment" style={tableHeaderStyle}>
                        Phone Number
                    </th>
                    <th scope="col" className="sort" data-sort="dropped-by" style={tableHeaderStyle}>
                        Company Name
                    </th>
                    <th scope="col" className="sort" data-sort="dropped-by" style={tableHeaderStyle}>
                        Company Position
                    </th>
                    <th scope="col" className="sort" data-sort="date-dropped" style={tableHeaderStyle}>
                        Company Size
                    </th>
                    <th scope="col" className="sort" data-sort="date-dropped" style={tableHeaderStyle}>
                        Monthly Hiring Volume
                    </th>
                    <th scope="col" className="sort" data-sort="date-dropped" style={tableHeaderStyle}>
                        Number of Recruiters
                    </th>
                    <th scope="col" className="sort" data-sort="date-dropped" style={tableHeaderStyle}>
                        Reason for Inquiry
                    </th>
                    <th scope="col" className="sort" data-sort="date-dropped" style={tableHeaderStyle}>
                        Message
                    </th>
                    <th scope="col" className="sort" data-sort="date-dropped" style={tableHeaderStyle}>
                        How did you learn about us?
                    </th>
                    <th scope="col" className="sort" data-sort="date-dropped" style={tableHeaderStyle}>
                        Date & Time <i className="la la-arrow-down"></i>
                    </th>
                    </tr>
                </thead>
                <tbody>
                    {isLoading ? (
                        <>
                        {Array.from({ length: limitPerPage }).map((_, idx) => (
                            <tr key={idx}>
                            {Array.from({ length: 12 }).map((_, idx) => (
                                <td key={idx}>
                                <div
                                className="bg-gray-300 rounded blink-2"
                                style={{ width: "150px", height: "16px" }}
                                >
                                <div
                                    className="skeleton-bar blink-2"
                                    style={{ width: "150px" }}
                                ></div>
                                </div>
                            </td>
                            ))}
                            </tr>
                        ))}
                        </>
                    ) : inquiries.length > 0 ? inquiries.map((inquiry: any) => (
                        <tr key={inquiry._id} onClick={() => {
                            setSelectedInquiry(inquiry);
                            setDisplayInquiryModal(true);
                        }}>
                            <td style={boldColumnStyle}>
                                {inquiry.firstName && inquiry.lastName ? `${inquiry.firstName} ${inquiry.lastName}` : "N/A"}
                            </td>
                            <td style={regularColumnStyle}>{inquiry.email}</td>
                            <td style={regularColumnStyle}>
                                {inquiry.phoneNumber || "N/A"}
                            </td>
                            <td style={boldColumnStyle}>{inquiry.companyName || "N/A"}</td>
                            <td style={regularColumnStyle}>{inquiry.companyPosition || "N/A"}</td>
                            <td style={regularColumnStyle}>{inquiry.companySize || "N/A"}</td>
                            <td style={regularColumnStyle}>{inquiry.monthlyHiringVolume || "N/A"}</td>
                            <td style={regularColumnStyle}>{inquiry.recruiterCount || "N/A"}</td>
                            <td style={regularColumnStyle}>{inquiry.reasonForInquiry || "N/A"}</td>
                            <td style={regularColumnStyle}>{inquiry.message || "N/A"}</td>
                            <td style={regularColumnStyle}>{inquiry.sourceOfInquiry || "N/A"}</td>
                            <td style={regularColumnStyle}>{inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleString() : "N/A"}</td>
                        </tr>
                    )) : (
                        <tr style={{ cursor: "default", pointerEvents: "none" }}>
                            <td colSpan={5} className="text-center">No inquiries found</td>
                        </tr>
                    )}
                </tbody>
            </table>
            </div>
            <TablePagination currentPage={page} totalPages={totalPages} setCurrentPage={setPage} />
            {displayInquiryModal && <InquiryModal 
            inquiry={selectedInquiry}
            onClose={() => {
                setDisplayInquiryModal(false);
                setSelectedInquiry(null);
            }} />}
        </>
    )
}

function InquiryModal({ inquiry, onClose }: { inquiry: any, onClose: () => void }) {
    return (
       <div className="modal-background fade-in-bottom">
            <div className="modal-container">
            <div className="modal-content" style={{ overflowY: "auto", height: "fit-content", width: "fit-content", background: "#fff", border: `1.5px solid #E9EAEB`, borderRadius: 14, boxShadow: "0 8px 32px rgba(30,32,60,0.18)", padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 className="modal-title">Inquiry Details</h3>
                    <button className="button-v2 primary" style={{ backgroundColor: "#FFFFFF", color: "#000000", border: "none", padding: 0, margin: 0 }} onClick={onClose}>
                    <i className="la la-times" />
                    </button>
                </div>
                <div style={{ height: "1px", width: "592px", background: "#EAECF5", margin: "16px 0" }} />
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, width: "50%" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>Name</span>
                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>{inquiry.firstName && inquiry.lastName ? `${inquiry.firstName} ${inquiry.lastName}` : "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>Phone Number</span>
                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>{inquiry.phoneNumber || "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>Company Name</span>
                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>{inquiry.companyName || "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>Reason for Inquiry</span>
                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>{inquiry.reasonForInquiry || "N/A"}</span>
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, width: "50%" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>Work Email</span>
                        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>{inquiry.email || "N/A"}</span>
                        {/* Copy button */}
                        <button style={{ 
                            backgroundColor: "#FFFFFF", 
                            color: "#000000", 
                            border: "1px solid #D5D7DA", 
                            borderRadius: "50%", 
                            height: "24px", 
                            width: "24px", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            padding: 0,
                            margin: 0,
                            cursor: "pointer",
                        }} 
                        onClick={() => {
                            navigator.clipboard.writeText(inquiry.email);
                            candidateActionToast(
                                "Email Copied to Clipboard",
                                1300,
                                <i className="la la-link mr-1 text-info"></i>
                            );
                        }}>
                        <i className="la la-copy" />
                        </button>
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>Date Submitted</span>
                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>{inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleString() : "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>Company Size</span>
                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>{inquiry.companySize || "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>How did you learn about us?</span>
                        <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>{inquiry.sourceOfInquiry || "N/A"}</span>
                    </div>
                </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid #E9EAEB", borderRadius: 12, padding: "16px 20px", background: "#F8F9FC", marginTop: "16px" }}>
                    <span style={{ fontSize: "14px", color: "#717680", fontWeight: 500 }}>Message</span>
                    <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>{inquiry.message || "N/A"}</span>
                </div> 
            </div>
            </div>
        </div>
    )
}
