"use client"
import { useState } from "react";
import { Button } from "../ui";

export default function DatePickerDropdown({ date, setDate, align = "left" }: { date: any, setDate: (date: any) => void, align?: "left" | "right" }) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedStartDate, setSelectedStartDate] = useState(date.startDate || "");
    const [selectedEndDate, setSelectedEndDate] = useState(date.endDate || "");
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [nextMonth, setNextMonth] = useState(new Date(new Date().setMonth(new Date().getMonth() + 1)));

    const formatDateForInput = (date: Date | null) => {
        if (!date) return "";
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
    };

    const isDateInRange = (date: Date) => {
        if (!selectedStartDate || !selectedEndDate) return false;
        return date >= selectedStartDate && date <= selectedEndDate;
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        const days = [];
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }
        
        return days;
    };

    const isDateSelected = (date: Date) => {
        if (!selectedStartDate && !selectedEndDate) return false;
        if (selectedStartDate && !selectedEndDate) return date.getTime() === selectedStartDate.getTime();
        if (selectedStartDate && selectedEndDate) {
            return date.getTime() === selectedStartDate.getTime() || date.getTime() === selectedEndDate.getTime();
        }
        return false;
    };

    const handleDateClick = (date: Date) => {
        if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
            // Start new selection
            setSelectedStartDate(date);
            setSelectedEndDate(null);
        } else if (selectedStartDate && !selectedEndDate) {
            // Complete the selection
            if (date < selectedStartDate) {
                setSelectedEndDate(selectedStartDate);
                setSelectedStartDate(date);
            } else {
                setSelectedEndDate(date);
            }
        }
    };

    const navigateMonth = (direction: 'prev' | 'next', calendar: 'left' | 'right') => {
        if (calendar === 'left') {
            const newMonth = new Date(currentMonth);
            if (direction === 'prev') {
                newMonth.setMonth(newMonth.getMonth() - 1);
            } else {
                newMonth.setMonth(newMonth.getMonth() + 1);
            }
            setCurrentMonth(newMonth);
            setNextMonth(new Date(newMonth.getTime() + 30 * 24 * 60 * 60 * 1000));
        } else {
            const newMonth = new Date(nextMonth);
            if (direction === 'prev') {
                newMonth.setMonth(newMonth.getMonth() - 1);
            } else {
                newMonth.setMonth(newMonth.getMonth() + 1);
            }
            setNextMonth(newMonth);
            setCurrentMonth(new Date(newMonth.getTime() - 30 * 24 * 60 * 60 * 1000));
        }
    };


    const getDatePosition = (date: Date) => {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const startingDayOfWeek = firstDay.getDay();
        const dayOfMonth = date.getDate();
        return startingDayOfWeek + dayOfMonth - 1;
    };

    // Helper function to determine border radius for connected appearance
    const getBorderRadius = (day: Date, isInRange: boolean, isStartDate: boolean, isEndDate: boolean) => {
        if (isStartDate || isEndDate) {
            return '50%';
        }
        if (!isInRange) {
            return '0';
        }
        
        // For dates in range, determine if they should have rounded corners
        const currentPos = getDatePosition(day);
        
        // Check if this is the first or last day in the range for this row
        const rowStart = Math.floor(currentPos / 7) * 7;
        const rowEnd = rowStart + 6;
        
        let borderRadius = '0';
        
        // Left edge (start of row or after a gap)
        if (currentPos === rowStart || (currentPos > rowStart && !isDateInRange(new Date(day.getTime() - 24 * 60 * 60 * 1000)))) {
            borderRadius = '50% 0 0 50%';
        }
        // Right edge (end of row or before a gap)
        else if (currentPos === rowEnd || (currentPos < rowEnd && !isDateInRange(new Date(day.getTime() + 24 * 60 * 60 * 1000)))) {
            borderRadius = '0 50% 50% 0';
        }
        
        return borderRadius;
    };

    const renderCalendar = (month: Date, isLeftCalendar: boolean) => {
        const days = getDaysInMonth(month);
        const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        return (
            <div style={{ width: '50%', padding: '16px' }}>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '16px' 
                }}>
                    <button
                        onClick={() => navigateMonth('prev', isLeftCalendar ? 'left' : 'right')}
                        style={{
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            background: '#F5F5F5',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#666'
                        }}
                    >
                        <i className="la la-chevron-left" />
                    </button>
                    <span style={{ 
                        fontWeight: 'bold', 
                        fontSize: '16px',
                        color: '#181D27'
                    }}>
                        {monthName}
                    </span>
                    <button
                        onClick={() => navigateMonth('next', isLeftCalendar ? 'left' : 'right')}
                        style={{
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            background: '#F5F5F5',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#666'
                        }}
                    >
                        <i className="la la-chevron-right" />
                    </button>
                </div>
                
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, 1fr)', 
                    gap: '0px',
                    marginBottom: '8px'
                }}>
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} style={{ 
                            textAlign: 'center', 
                            fontSize: '12px', 
                            fontWeight: '500',
                            color: '#717680',
                            padding: '8px 0'
                        }}>
                            {day}
                        </div>
                    ))}
                </div>
                
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, 1fr)', 
                    gap: '4px 0px'
                }}>
                    {days.map((day, index) => {
                        if (!day) {
                            return <div key={index} style={{ height: '32px' }} />;
                        }
                        
                        const isInRange = isDateInRange(day);
                        const isSelected = isDateSelected(day);
                        const isStartDate = selectedStartDate && day.getTime() === selectedStartDate.getTime();
                        const isEndDate = selectedEndDate && day.getTime() === selectedEndDate.getTime();
                        
                        return (
                            <button
                                key={index}
                                onClick={() => handleDateClick(day)}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    minWidth: "42px",
                                    minHeight: "32px",
                                    border: 'none',
                                    borderRadius: getBorderRadius(day, isInRange, isStartDate, isEndDate),
                                    background: isStartDate || isEndDate 
                                        ? 'linear-gradient(135deg, #FCCEC0, #EBACC9, #CEB6DA, #9FCAED)' 
                                        : isInRange 
                                            ? '#E0E7FF' 
                                            : 'transparent',
                                    color: isStartDate || isEndDate ? '#FFFFFF' : '#181D27',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                    margin: '0',
                                    position: 'relative',
                                    zIndex: isInRange ? 1 : 0,
                                }}
                                onMouseEnter={(e) => {
                                    if (!isStartDate && !isEndDate && !isInRange) {
                                        e.currentTarget.style.background = '#F3F4F6';
                                        e.currentTarget.style.borderRadius = '50%';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isStartDate && !isEndDate && !isInRange) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.borderRadius = '0';
                                    }
                                }}
                            >
                                {day.getDate()}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };
    
    return (
        <div className="dropdown">
            <div 
            onClick={() => {
                setDropdownOpen(!dropdownOpen);
            }}
            style={{ 
                display: "flex", 
                flexDirection: "row", 
                alignItems: "center", 
                gap: 8, 
                border: "1px solid #D5D7DA", 
                borderRadius: 60, 
                padding: "5px 10px", 
                cursor: "pointer", 
                width: "fit-content", 
                height: "fit-content",
                color: date.startDate && date.endDate ? "#FFFFFF" : "#181D27",
                background: date.startDate && date.endDate ? "#181D27" : "#FFFFFF",
                fontSize: "14px",
                fontWeight: 500,
                whiteSpace: "nowrap",
            }}>
                {date.startDate && date.endDate ? (
                    <>
                    <span>{formatDateForInput(date.startDate)} - {formatDateForInput(date.endDate)}</span>
                    <i className="la la-times" style={{ cursor: "pointer", marginLeft: "8px" }} onClick={(event) => {
                        event.stopPropagation();
                        setSelectedStartDate(null);
                        setSelectedEndDate(null);
                        setDate({
                            startDate: null,
                            endDate: null
                        });
                        if (dropdownOpen) {
                            setDropdownOpen(false);
                        }
                    }} />
                    </>
                ) : (
                    <>
                        <i className="la la-calendar"></i>
                        <span>Date Range</span>
                    </>
                )}
            </div>

            {dropdownOpen && (
            <div className={`dropdown-menu ${align === "right" ? "dropdown-menu-right" : "dropdown-menu-left"} mt-1 org-dropdown-anim${
                dropdownOpen ? " show" : ""
                }`}
                style={{
                    width: "653px",
                }}
            >
                {/* Calendar Section */}
                <div 
                style={{ 
                    display: 'flex', 
                    flexDirection: 'row',
                    borderBottom: '1px solid #E9EAEB'
                }}>
                    {renderCalendar(currentMonth, true)}
                    {renderCalendar(nextMonth, false)}
                </div>
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", padding: "0 16px", marginTop: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <input type="text" 
                        placeholder="Select Start Date" 
                        disabled={true} 
                        value={formatDateForInput(selectedStartDate)} 
                        />
                        <span>To</span>
                        <input 
                        type="text" 
                        placeholder="Select End Date" 
                        disabled={true} 
                        value={formatDateForInput(selectedEndDate)} 
                        />
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Button 
                        variant="secondary" 
                        onClick={() => {
                            setSelectedStartDate(date.startDate || "");
                            setSelectedEndDate(date.endDate || "");
                            setDropdownOpen(false);
                        }}
                        label="Cancel"
                        >
                        </Button>
                        <Button 
                        variant="primary"
                        style={{ backgroundColor: !selectedStartDate || !selectedEndDate ? "#D5D7DA" : "#181D27" }}
                        disabled={!selectedStartDate || !selectedEndDate}
                        onClick={() => {
                            setDate({
                                startDate: new Date(selectedStartDate),
                                endDate: new Date(selectedEndDate)
                            });
                            setDropdownOpen(false);
                        }}
                        label="Apply"
                        >
                        </Button>
                    </div>
                </div>
            </div>
            )}
        </div>
    )
}