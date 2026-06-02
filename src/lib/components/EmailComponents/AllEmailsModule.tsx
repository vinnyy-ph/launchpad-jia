"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "@/lib/context/AppContext";
import { errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import ComposeEmailModuleV2 from "./ComposeEmailModuleV2";
import GmailIntegrationPrompt from "./components/GmailIntegrationPrompt";
import CandidateHeader from "./components/CandidateHeader";
import EmailSidebar from "./components/EmailSidebar";
import EmailViewer from "./components/EmailViewer";
import EmailViewerHeader from "./components/EmailViewerHeader";
import { useGmailIntegration } from "./hooks/useGmailIntegration";
import { useCandidateInfo } from "./hooks/useCandidateInfo";
import { useEmailData } from "./hooks/useEmailData";
import { getTabStats } from "./utils/emailFilters";
import { extractCandidateEmail } from "./utils/emailUtils";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";
import HeaderBar from "@/lib/PageComponent/HeaderBar";

export default function AllEmailsModule({ careerId, careertab, setCandidatename }: { careerId?: string, careertab?: boolean, setCandidatename?: (candidatename: string) => void }) {
    const { user, orgID } = useAppContext();
    const [selectedTab, setSelectedTab] = useState("inbox");
    const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showComposeModal, setShowComposeModal] = useState(false);
    const [composeDraftData, setComposeDraftData] = useState<any>(null);
    const [showReplyForwardBox, setShowReplyForwardBox] = useState(false);
    const [replyForwardData, setReplyForwardData] = useState<{ replyData?: any; forwardData?: any } | null>(null);
    const [readFilter, setReadFilter] = useState("All Emails");
    const [typeFilter, setTypeFilter] = useState("Type");
    const [roleFilter, setRoleFilter] = useState("Role");
    const [currentTime, setCurrentTime] = useState(new Date());
    const [fullThreadData, setFullThreadData] = useState<any>(null);
    const [isLoadingThread, setIsLoadingThread] = useState(false);
    const [showBanner, setShowBanner] = useState(false);

    // Gmail integration hook
    const { isLoading, hasGmailToken, isEnablingGmail, handleEnableGmailIntegration } =
        useGmailIntegration(user?.email);

    // Update current time every second for time ago display
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // State to hold emailThreads for candidate info hook
    const [currentEmailThreads, setCurrentEmailThreads] = useState<any[]>([]);

    // Candidate info hook - initialized with empty array, will update when emailThreads change
    const {
        viewingCandidate,
        viewingCandidateEmail,
        candidateCareerMap,
        candidateEmails,
        careers,
        buildCandidateCareerMap,
    } = useCandidateInfo(orgID, user?.email, currentEmailThreads, selectedEmail, selectedTab);


    useEffect(() => {
        if (setCandidatename) {
            setCandidatename(viewingCandidate?.name || "");
        }
    }, [viewingCandidate?.name, setCandidatename]);

    // Email data hook - uses candidateEmails from candidate info hook
    const {
        allEmails,
        emailThreads,
        isLoadingEmails,
        lastSyncTime,
        fetchAllEmails,
        handleEmailSent,
        handleMarkAsRead,
    } = useEmailData({
        userEmail: user?.email,
        user,
        orgID,
        hasGmailToken,
        candidateEmails,
        selectedTab,
        readFilter,
        typeFilter,
        roleFilter,
        candidateCareerMap,
        buildCandidateCareerMap,
        viewingCandidate,
        viewingCandidateEmail,
        careerId,
    });

    // Sync emailThreads to candidate info hook
    useEffect(() => {
        setCurrentEmailThreads(emailThreads);
    }, [emailThreads]);

    // Update selectedEmail when switching tabs/filters if it's not in the filtered list
    useEffect(() => {
        if (selectedEmail && !emailThreads.find((e: any) => e.id === selectedEmail)) {
            setSelectedEmail(null);
        }
    }, [emailThreads, selectedEmail]);

    // Handle reply functionality
    const handleReply = (emailData: any) => {
        const firstMessage = emailData.emailContent.messages[0];
        const lastMessage = emailData.emailContent.messages[emailData.emailContent.messages.length - 1];

        // Ensure we have a threadId - it's critical for maintaining the thread
        if (!emailData.threadId) {
            console.error("Warning: No threadId found in emailData:", emailData);
        }

        //! Find candidate email from the thread - prioritize candidate email
        let replyToEmail = firstMessage.sender.email;

        if (candidateEmails.length > 0) {
            const candidateEmail = extractCandidateEmail(emailData, candidateEmails, selectedTab);
            if (candidateEmail) {
                replyToEmail = candidateEmail;
            } else {
                const userLower = user?.email?.toLowerCase();

                for (const m of emailData.emailContent.messages) {
                    const s = m.sender?.email?.toLowerCase();
                    const r = m.recipient?.email?.toLowerCase();
                    if (s && s !== userLower) { replyToEmail = m.sender.email; break; }
                    if (r && r !== userLower) { replyToEmail = m.recipient.email; break; }
                }
            }
        }


        const replyData = {
            to: replyToEmail,
            subject: emailData.emailContent.subject.startsWith("Re:")
                ? emailData.emailContent.subject
                : `Re: ${emailData.emailContent.subject}`,
            threadId: emailData.threadId, // This must be preserved for thread continuity
            messageId: lastMessage.id, // Message ID for In-Reply-To header
            originalEmail: emailData,
            isReply: true,
        };

        console.log("Reply data prepared:", {
            to: replyData.to,
            subject: replyData.subject,
            threadId: replyData.threadId,
            isReply: replyData.isReply,
        });

        setReplyForwardData({ replyData });
        setShowReplyForwardBox(true);
        setShowComposeModal(false);
    };

    // Handle forward functionality
    const handleForward = (emailData: any) => {
        const forwardData = {
            subject: emailData.emailContent.subject,
            originalEmail: emailData,
            isForward: true,
        };

        console.log("Forward data prepared:", {
            subject: forwardData.subject,
            isForward: forwardData.isForward,
        });

        setReplyForwardData({ forwardData });
        setShowReplyForwardBox(true);
        setShowComposeModal(false);
    };

    // Handle draft click - fetch full draft details with attachments
    const handleDraftClick = async (emailData: any) => {
        try {
            const emailToUse = selectedEmailData || emailData;
            const senderEmail = emailToUse.recruiterEmail ||
                emailToUse.emailContent?.messages?.[0]?.sender?.email ||
                user?.email;

            const response = await api.post("/api/email-module/gm-fetch-draft", {
                messageId: emailData.id,
                email: senderEmail,
                orgID: orgID,
                // email: user?.email,
                // _id:
            });
            // alert("Draft fetched");

            const data = response.data.data;

            setComposeDraftData({
                draftData: {
                    to: data.to || "",
                    subject: data.subject || "",
                    message: data.message || "",
                    threadId: data.threadId || emailData.threadId,
                    draftId: emailData.id,
                    attachments: data.attachments || [],
                }
            });
            setShowComposeModal(true);
            setShowReplyForwardBox(false);
        } catch (error) {
            console.error("Error fetching draft:", error);
            errorToast("Failed to load draft", "top-center");
        }
    };

    // handleEmailSent is now handled by the useEmailData hook

    // Calculate tab stats
    const inboxStats = getTabStats(allEmails, "inbox", readFilter, typeFilter, roleFilter, candidateCareerMap, user?.email, careerId);
    const sentStats = getTabStats(allEmails, "sent", readFilter, typeFilter, roleFilter, candidateCareerMap, user?.email, careerId);
    const draftsStats = getTabStats(
        allEmails,
        "drafts",
        readFilter,
        typeFilter,
        roleFilter,
        candidateCareerMap,
        user?.email,
        careerId
    );

    // Fetch full thread data when an email is selected
    useEffect(() => {
        const fetchThreadData = async () => {
            if (!selectedEmail || !user?.email) {
                setFullThreadData(null);
                return;
            }

            const email = emailThreads.find((e) => e.id === selectedEmail);
            if (!email) {
                setFullThreadData(null);
                return;
            }

            // If no threadId, just use the email data directly (don't fetch thread)
            if (!email.threadId) {
                console.log("No threadId found, using email data directly:", email);
                setFullThreadData(email);
                return;
            }

            setIsLoadingThread(true);
            try {
                // Use the recruiter's email who owns this email thread, not the current user's email
                // This ensures we fetch the thread from the correct Gmail account
                const emailToUse = email.recruiterEmail || user.email;

                const response = await api.post("/api/email-module/gm-fetch-thread", {
                    email: emailToUse,
                    threadId: email.threadId,
                });

                if (response.data?.success) {
                    const threadData = response.data.data;
                    // Merge thread data with the selected email data
                    // IMPORTANT: Preserve the threadId from the original email
                    setFullThreadData({
                        ...email,
                        threadId: email.threadId, // Explicitly preserve threadId
                        emailContent: {
                            subject: threadData.subject,
                            messages: threadData.messages,
                            draftCount: threadData.draftCount || 0,
                            conversationId: threadData.conversationId,
                        },
                    });
                } else {
                    // Fallback to single message if thread fetch fails
                    setFullThreadData(email);
                }
            } catch (error) {
                console.error("Error fetching thread:", error);
                // Fallback to single message on error
                setFullThreadData(email);
            } finally {
                setIsLoadingThread(false);
            }
        };

        fetchThreadData();
    }, [selectedEmail, emailThreads, user?.email]);

    // Memoize selectedEmailData to use full thread data if available
    const selectedEmailData = useMemo(() => {
        if (!selectedEmail) return null;
        // Use full thread data if available, otherwise fallback to email from list
        return fullThreadData || emailThreads.find((email) => email.id === selectedEmail) || null;
    }, [emailThreads, selectedEmail, fullThreadData]);

    // Show banner only if email was NOT sent by user AND NOT sent to user
    // (i.e., email is between other team members)
    // Don't show banner for no-reply emails
    useEffect(() => {
        if (selectedEmailData?.emailContent?.messages?.[0] && user?.email) {
            const firstMessage = selectedEmailData.emailContent.messages[0];
            const senderEmail = firstMessage.sender?.email?.toLowerCase();
            const recipientEmail = firstMessage.recipient?.email?.toLowerCase();
            const userEmailLower = user.email.toLowerCase();

            const isNoReply = senderEmail && (
                senderEmail.includes("no-reply") ||
                senderEmail.includes("noreply") ||
                senderEmail.includes("donotreply") ||
                senderEmail.includes("no_reply")
            );

            // Show banner only if email is between other team members (not involving current user)
            // AND not from a no-reply address
            const isNotFromUser = senderEmail && senderEmail !== userEmailLower;
            const isNotToUser = recipientEmail && recipientEmail !== userEmailLower;
            // setShowBanner(isNotFromUser && isNotToUser);
            setShowBanner(isNotFromUser && isNotToUser && !isNoReply);
        } else {
            setShowBanner(false);
        }
    }, [user?.email, selectedEmailData]);

    // Show Gmail integration prompt or loading
    if (isLoading || !hasGmailToken) {
        return (
            <GmailIntegrationPrompt
                isLoading={isLoading}
                isEnablingGmail={isEnablingGmail}
                onEnableGmail={handleEnableGmailIntegration}
            />
        );
    }

    return (
        <div id="all-emails-module" className={styles.container}>
            {/* Candidate Header */}
            {!careertab && (
                <CandidateHeader
                    viewingCandidate={viewingCandidate}
                    orgID={orgID}
                    onComposeClick={() => {
                        setComposeDraftData(null);
                        setShowReplyForwardBox(false);
                        setShowComposeModal(true);
                    }}
                />
            )}


            {/* Main Content Area */}
            <div className={styles.mainContent}>
                {/* Left Sidebar */}
                <EmailSidebar
                    selectedTab={selectedTab}
                    searchQuery={searchQuery}
                    emails={emailThreads}
                    selectedEmailId={selectedEmail}
                    isLoading={isLoadingEmails}
                    readFilter={readFilter}
                    typeFilter={typeFilter}
                    roleFilter={roleFilter}
                    careers={careers}
                    inboxStats={inboxStats}
                    draftsStats={draftsStats}
                    onTabChange={(tab) => {
                        setSelectedTab(tab);
                        setSelectedEmail(null);
                    }}
                    onSearchChange={setSearchQuery}
                    onReadFilterChange={setReadFilter}
                    onTypeFilterChange={setTypeFilter}
                    onRoleFilterChange={setRoleFilter}
                    onEmailSelect={(email) => {
                        // If it's a draft, open in compose modal for editing
                        if (email.isDraft || email.labelIds?.includes("DRAFT")) {
                            handleDraftClick(email);
                        } else {
                            setSelectedEmail(email.id);
                        }
                    }}
                    onMarkAsRead={handleMarkAsRead}
                />

                {/* Right Content Area - Email Viewer */}
                <div className={styles.contentArea}>
                    <EmailViewerHeader
                        user={user}
                        lastSyncTime={lastSyncTime}
                        currentTime={currentTime}
                        isLoadingEmails={isLoadingEmails}
                        onRefresh={fetchAllEmails}
                        onComposeClick={() => {
                            setComposeDraftData(null);
                            setShowReplyForwardBox(false);
                            setShowComposeModal(true);
                        }}
                        careertab={careertab}
                    />
                    {/* Team Emails Banner */}
                    {showBanner && (
                        <div className={styles.teamEmailsBanner}>
                            <span className={styles.bannerText}>
                                You are viewing emails sent by other members of your team.
                            </span>
                            <button
                                className={styles.bannerCloseButton}
                                onClick={() => setShowBanner(false)}
                                aria-label="Close banner"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M12 4L4 12M4 4L12 12"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    )}


                    <EmailViewer
                        selectedEmailData={selectedEmailData}
                        onReply={handleReply}
                        onForward={handleForward}
                        isLoadingThread={isLoadingThread}
                        replyForwardData={replyForwardData}
                        isReplyForwardOpen={showReplyForwardBox}
                        onCloseReplyForward={() => {
                            setShowReplyForwardBox(false);
                            setReplyForwardData(null);
                        }}
                        onEmailSent={handleEmailSent}
                    />
                </div>
            </div>

            {/* Compose Email Modal - Only for drafts and new compose */}
            {showComposeModal && (
                <ComposeEmailModuleV2
                    isOpen={showComposeModal}
                    onClose={() => {
                        setShowComposeModal(false);
                        setComposeDraftData(null);
                    }}
                    draftData={composeDraftData?.draftData}
                    onEmailSent={handleEmailSent}
                />
            )}
        </div>
    );
}