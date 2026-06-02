"use client";

import React, { useState } from "react";
import DropdownModal, { DropdownOption } from "@/lib/components/common/DropdownModal";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";

interface EmailFilterButtonsProps {
    readFilter: string;
    typeFilter: string;
    roleFilter: string;
    careers: Array<{ title: string; id: string }>;
    onReadFilterChange: (value: string) => void;
    onTypeFilterChange: (value: string) => void;
    onRoleFilterChange: (value: string) => void;
}

export default function EmailFilterButtons({
    readFilter,
    typeFilter,
    roleFilter,
    careers,
    onReadFilterChange,
    onTypeFilterChange,
    onRoleFilterChange,
}: EmailFilterButtonsProps) {

    const readFilterOptions: DropdownOption[] = [
        { label: "All Emails", value: "All Emails" },
        { label: "Unread Only", value: "Unread Only" },
    ];

    const roleFilterOptions: DropdownOption[] = [
        { label: "Role", value: "Role" },
        ...careers
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((career) => ({
                label: career.title,
                // value: career.title,
                value: career.id,
            })),
    ];


    const typeFilterOptions: DropdownOption[] = [
        { label: "Type", value: "Type" },
        { label: "Manual", value: "Manual" },
        { label: "Automated", value: "Automated" },
    ];

    const filterIcon = (
        <i className="la la-filter la-lg"></i>
    );

    return (
        <div className={styles.filterContainer}>
            <div className={styles.filterWrapper}>

                <div className={styles.filterButtonWrapper}>
                    <DropdownModal
                        value={readFilter}
                        options={readFilterOptions}
                        onSelect={onReadFilterChange}
                        displayLabelFormatter={(label, value) => {
                            if (value === "Unread Only") {
                                return `Status: ${label}`;
                            }
                            return label;
                        }}
                    />
                </div>


                <div className={styles.filterButtonWrapper}>
                    <DropdownModal
                        value={roleFilter}
                        options={roleFilterOptions}
                        onSelect={onRoleFilterChange}
                        icon={filterIcon}
                        displayLabelFormatter={(label, value) => {
                            if (value !== "Role") {
                                // Find the career title for the selected job ID
                                const selectedCareer = careers.find(c => c.id === value);
                                const displayTitle = selectedCareer ? selectedCareer.title : label;
                                return `Role: ${displayTitle}`;
                            }
                            return label;
                        }}
                    />
                </div>

                <div className={styles.filterButtonWrapper}>
                    <DropdownModal
                        value={typeFilter}
                        options={typeFilterOptions}
                        onSelect={onTypeFilterChange}
                        icon={filterIcon}
                        displayLabelFormatter={(label, value) => {
                            if (value !== "Type") {
                                return `Type: ${label}`;
                            }
                            return label;
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

