"use client";

import React, { useState, useEffect } from "react";
import AvatarImage from "../AvatarImage/AvatarImage";
import { useAppContext } from "@/lib/context/AppContext";
import { errorToast, successToast, emailSentToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import DropdownModal, { DropdownOption } from "../common/DropdownModal";

interface ReplyForwardModuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    replyData?: {
        to: string;
        subject: string;
        threadId?: string;
        messageId?: string;
        originalEmail?: any;
        isReply?: boolean;
        currentMessage?: string;
        attachedFiles?: any[];
    };
    forwardData?: {
        subject: string;
        originalEmail?: any;
        isForward?: boolean;
        currentMessage?: string;
        attachedFiles?: any[];
    };
    onEmailSent?: (emailData: {
        messageId: string;
        threadId: string;
        to: string;
        subject: string;
        message: string;
        sentAt: string;
    }) => void;
}

export default function ReplyForwardModuleModal({
    isOpen,
    onClose,
    replyData,
    forwardData,
    onEmailSent,
}: ReplyForwardModuleModalProps) {
    const { user, orgID } = useAppContext();
    const [isSending, setIsSending] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [showReplyDropdown, setShowReplyDropdown] = useState(false);
    const [fromEmailOptions, setFromEmailOptions] = useState<DropdownOption[]>([]);
    const [isLoadingFromEmails, setIsLoadingFromEmails] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [fromEmail, setFromEmail] = useState(user?.email || "");
    const [formData, setFormData] = useState({
        to: "",
        subject: "",
        message: "",
    });
    const [fontSize, setFontSize] = useState("16");
    const messageRef = React.useRef<HTMLDivElement>(null);
    const imageInputRef = React.useRef<HTMLInputElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        underline: false,
        strikeThrough: false,
        insertUnorderedList: false,
        insertOrderedList: false,
    });

    // Cleanup form when modal closes
    React.useEffect(() => {
        if (!isOpen) {
            // Reset form when modal closes
            setFormData({
                to: "",
                subject: "",
                message: "",
            });
            setAttachedFiles([]);
            if (messageRef.current) {
                messageRef.current.innerHTML = "";
            }
        } else if (isOpen && (replyData || forwardData)) {
            // Clear attachments when opening for reply or forward
            setAttachedFiles([]);
        }
    }, [isOpen, replyData, forwardData]);

    // Update form data when replyData changes (only when modal is open)
    React.useEffect(() => {
        if (isOpen && replyData) {
            // If currentMessage exists (from popup), use it, otherwise use empty reply prefix
            const currentMessage = replyData.currentMessage || "";
            const replyPrefix = currentMessage || "";

            setFormData({
                to: replyData.to,
                subject: replyData.subject,
                message: replyPrefix,
            });

            // If attachedFiles exist (from popup), use them, otherwise clear
            if (replyData.attachedFiles && replyData.attachedFiles.length > 0) {
                setAttachedFiles(replyData.attachedFiles);
            } else {
                setAttachedFiles([]);
            }

            if (messageRef.current) {
                messageRef.current.innerHTML = replyPrefix;
            }
        }
    }, [isOpen, replyData]);

    // Update form data when forwardData changes (only when modal is open)
    React.useEffect(() => {
        if (isOpen && forwardData) {
            // If currentMessage exists (from popup), use it, otherwise build forwarded content
            let forwardedContent = "";
            if (forwardData.currentMessage) {
                forwardedContent = forwardData.currentMessage;
            } else {
                // Format forwarded email content
                const originalEmail = forwardData.originalEmail;
                const messages = originalEmail?.emailContent?.messages || [];
                // Build forwarded content with all messages in the thread (HTML format)
                messages.forEach((message: any, index: number) => {
                    const date = message.timestamp || "";
                    const from = message.sender?.name || message.sender?.email || "Unknown";
                    const to = message.recipient?.name || message.recipient?.email || "Unknown";
                    const content = message.content || "";
                    // Format as HTML for better display in contentEditable
                    forwardedContent += `<div style="border-left: 3px solid #ccc; padding-left: 20px; margin: 20px 0; color: #666;">`;
                    forwardedContent += `<div style="font-weight: bold; margin-bottom: 10px;">---------- Forwarded message ----------</div>`;
                    forwardedContent += `<div><strong>From:</strong> ${from} &lt;${message.sender?.email || ""}&gt;</div>`;
                    forwardedContent += `<div><strong>To:</strong> ${to} &lt;${message.recipient?.email || ""}&gt;</div>`;
                    forwardedContent += `<div><strong>Date:</strong> ${date}</div>`;
                    forwardedContent += `<div><strong>Subject:</strong> ${forwardData.subject}</div>`;
                    forwardedContent += `<div style="margin-top: 10px;">${content}</div>`;
                    forwardedContent += `</div>`;
                });
            }

            // Set subject with "Fwd:" prefix if not already present
            const subject = forwardData.subject?.startsWith("Fwd:")
                ? forwardData.subject
                : `Fwd: ${forwardData.subject || ""}`;

            setFormData({
                to: "",
                subject: subject,
                message: forwardedContent,
            });

            // If attachedFiles exist (from popup), use them, otherwise clear
            if (forwardData.attachedFiles && forwardData.attachedFiles.length > 0) {
                setAttachedFiles(forwardData.attachedFiles);
            } else {
                setAttachedFiles([]);
            }

            // Set message content in contentEditable div
            if (messageRef.current) {
                messageRef.current.innerHTML = forwardedContent;
            }
        }
    }, [isOpen, forwardData]);

    // Update contentEditable div when message changes externally
    React.useEffect(() => {
        if (messageRef.current && formData.message && messageRef.current.innerHTML !== formData.message) {
            messageRef.current.innerHTML = formData.message;
        }
    }, [formData.message]);

    // Check if user is admin
    useEffect(() => {
        if (typeof window !== "undefined") {
            // const role = localStorage.getItem("role");
            // setIsAdmin(role === "admin");
            const asyncCheckAdmin = async () => {
                const response = await api.get("/api/check-admin", { email: user?.email });
                const isAdmin = response.data.isAdmin;
                setIsAdmin(isAdmin);
            }
            if (user?.email) {
                asyncCheckAdmin();
            }
        }
    }, []);

    // Fetch hiring manager emails for From field when admin
    useEffect(() => {
        const fetchFromEmailOptions = async () => {
            if (!isAdmin || !orgID) return;

            try {
                setIsLoadingFromEmails(true);
                const response = await api.post("/api/fetch-members", { orgID });
                const members = response.data || [];

                // Get all members with emails and map to dropdown options
                const memberOptions: DropdownOption[] = members
                    .filter((member: any) => member.email) // Include all members with email addresses
                    .map((member: any) => ({
                        label: member.email,
                        value: member.email,
                        avatar: member.image,
                    }));

                // Add no-reply emails
                const noReplyOptions: DropdownOption[] = [
                    {
                        label: "hr@whitecloak.com",
                        value: "hr@whitecloak.com",
                    },
                    {
                        label: "no-reply@hirejia.ai",
                        value: "no-reply@hirejia.ai",
                    },
                ];

                // Build all options and deduplicate by email address
                const allOptionsMap = new Map<string, DropdownOption>();
                
                // Add current user email first (if exists)
                if (user?.email) {
                    allOptionsMap.set(user.email.toLowerCase(), {
                        label: user.email,
                        value: user.email,
                        avatar: user?.image
                    });
                }
                
                // Add all member options (will skip if already added as user email)
                memberOptions.forEach(option => {
                    const emailLower = option.value.toLowerCase();
                    if (!allOptionsMap.has(emailLower)) {
                        allOptionsMap.set(emailLower, option);
                    }
                });
                
                // Add no-reply options
                noReplyOptions.forEach(option => {
                    const emailLower = option.value.toLowerCase();
                    if (!allOptionsMap.has(emailLower)) {
                        allOptionsMap.set(emailLower, option);
                    }
                });
                
                // Convert map to array (preserve order: user email first, then all members, then no-reply)
                const allOptions = Array.from(allOptionsMap.values());

                setFromEmailOptions(allOptions);
                // Set default from email to current user's email if not already set
                if (user?.email) {
                    setFromEmail((prev) => prev || user.email || "");
                }
            } catch (error) {
                console.error("Error fetching from email options:", error);
            } finally {
                setIsLoadingFromEmails(false);
            }
        };

        if (isOpen && isAdmin) {
            fetchFromEmailOptions();
        }
    }, [isAdmin, orgID, isOpen, user?.email]);

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleMessageChange = () => {
        const content = messageRef.current?.innerHTML || "";
        setFormData((prev) => ({
            ...prev,
            message: content,
        }));
        updateActiveFormats();
    };

    const updateActiveFormats = () => {
        setActiveFormats({
            bold: document.queryCommandState("bold"),
            italic: document.queryCommandState("italic"),
            underline: document.queryCommandState("underline"),
            strikeThrough: document.queryCommandState("strikeThrough"),
            insertUnorderedList: document.queryCommandState("insertUnorderedList"),
            insertOrderedList: document.queryCommandState("insertOrderedList"),
        });
    };

    const handleSend = async () => {
        // Validate required fields
        if (!formData.to || !formData.subject || !formData.message) {
            errorToast(
                "Please fill in all required fields (To, Subject, and Message)",
                "top-center"
            );
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.to)) {
            errorToast("Please enter a valid email address", "top-center");
            return;
        }

        setIsSending(true);
        try {
            const currentFromEmail = fromEmail || user?.email || "";

            const noReplyEmails = ["hr@whitecloak.com", "no-reply@hirejia.ai"];
            const isNoReplyEmail = noReplyEmails.includes(currentFromEmail);

            if (isNoReplyEmail && attachedFiles.length > 0) {
                errorToast(
                    "Attachments are not supported when sending from no-reply emails. Please remove attachments or use a different sender.",
                    "top-center"
                );
                setIsSending(false);
                return;
            }

            if (isNoReplyEmail) {
                const originalEmail = replyData?.originalEmail || forwardData?.originalEmail;
                const response = await api.post("/api/email-module/send-mailgun-email", {
                    from: currentFromEmail,
                    to: formData.to,
                    subject: formData.subject,
                    html: formData.message,
                    orgID: orgID,
                    CareerId: originalEmail?.CareerId || null,
                    sentByGmail: user?.email || null,
                    metadata: {
                        isReply: replyData?.isReply || false,
                        threadId: replyData?.threadId || null,
                        messageId: replyData?.messageId || null,
                        conversationId: originalEmail?.emailContent?.conversationId || null,
                    },
                });

                if (response.data?.success) {
                    const sentEmailData = {
                        messageId: response.data?.mailgunId || "",
                        threadId: replyData?.threadId || "",
                        to: formData.to,
                        subject: formData.subject,
                        message: formData.message,
                        sentAt: new Date().toISOString(),
                    };
                    const emailParts = formData.to.split("@")[0];
                    const recipientName = emailParts
                        .split(/[._-]/)
                        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(" ");
                    const recipientEmail = formData.to;
                    emailSentToast(
                        recipientEmail,
                        recipientName,
                        5000,
                        () => {
                            errorToast("Undo functionality not available for Mailgun emails", "top-center");
                        },
                        () => {
                            if (onEmailSent && sentEmailData) {
                                onEmailSent(sentEmailData);
                            }
                        }
                    );
                    if (onEmailSent && sentEmailData) {
                        onEmailSent(sentEmailData);
                    }
                    setAttachedFiles([]);
                    onClose();
                } else {
                    errorToast(
                        "Failed to send email: " + (response.data?.error || "Unknown error"),
                        "top-center"
                    );
                }
                setIsSending(false);
                return;
            }

            // Prepare FormData for multipart upload (to support attachments)
            const formDataToSend = new FormData();
            formDataToSend.append("fromEmail", currentFromEmail);
            formDataToSend.append("toEmail", formData.to);
            formDataToSend.append("subject", formData.subject);
            formDataToSend.append("message", formData.message);

            // Add reply-related fields if available (only for replies, not forwards)
            if (replyData?.isReply && replyData?.threadId) {
                formDataToSend.append("threadId", replyData.threadId);
            }
            if (replyData?.isReply && replyData?.messageId) {
                formDataToSend.append("messageId", replyData.messageId);
            }
            formDataToSend.append("isReply", (replyData?.isReply || false).toString());

            // Add attachments
            attachedFiles.forEach((file) => {
                formDataToSend.append("attachments", file);
            });

            const response = await api.post("/api/email-module/gm-send-email", formDataToSend, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            if (response.data?.success) {
                const data = await response.data;
                if (data.success) {
                    const sentEmailData = {
                        messageId: data.data.messageId,
                        threadId: data.data.threadId,
                        to: formData.to,
                        subject: formData.subject,
                        message: formData.message,
                        sentAt: data.data.sentAt,
                    };

                    // Store sent email data for undo functionality
                    console.log("sentEmailData: ", sentEmailData);
                    const emailParts = formData.to.split("@")[0];
                    const recipientName = emailParts
                        .split(/[._-]/)
                        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(" ");
                    const recipientEmail = formData.to;

                    // Show custom email sent toast
                    emailSentToast(
                        recipientEmail,
                        recipientName,
                        5000,
                        () => {
                            errorToast("Undo functionality requires Gmail API integration", "top-center");
                        },
                        () => {
                            if (onEmailSent && sentEmailData) {
                                onEmailSent(sentEmailData);
                            }
                        }
                    );

                    if (onEmailSent && data.data) {
                        onEmailSent(sentEmailData);
                    }

                    // Clear attached files
                    setAttachedFiles([]);
                    onClose();
                } else {
                    errorToast(
                        "Failed to send email: " + (data.error || "Unknown error"),
                        "top-center"
                    );
                }
            } else {
                const errorData = await response.data;
                const errorMessage = errorData.error || "Unknown error";

                // Handle specific error cases
                if (errorMessage.includes("Thread not found")) {
                    errorToast(
                        "The original email thread was not found. The email will be sent as a new message.",
                        "top-center"
                    );
                } else {
                    errorToast("Failed to send email: " + errorMessage, "top-center");
                }
            }
        } catch (error) {
            console.error("Error sending email:", error);
            errorToast("Failed to send email. Please try again.", "top-center");
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveDraft = async () => {
        // Validate required fields
        if (!formData.to || !formData.subject || !formData.message) {
            errorToast(
                "Please fill in all required fields (To, Subject, and Message)",
                "top-center"
            );
            return;
        }

        try {
            setIsSavingDraft(true);

            // Prepare FormData for multipart upload (to support attachments)
            const formDataToSend = new FormData();
            formDataToSend.append("fromEmail", fromEmail || user?.email || "");
            formDataToSend.append("toEmail", formData.to);
            formDataToSend.append("subject", formData.subject);
            formDataToSend.append("message", formData.message);
            formDataToSend.append("orgID", orgID);
            formDataToSend.append("createdby", user?.email );
            

            // Add reply-related fields if available (only for replies, not forwards)
            if (replyData?.isReply && replyData?.threadId) {
                formDataToSend.append("threadId", replyData.threadId);
            }

            // Add attachments
            attachedFiles.forEach((file) => {
                formDataToSend.append("attachments", file);
            });

            const response = await api.post("/api/email-module/gm-save-draft", formDataToSend, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            if (response.data.success) {
                const isUpdate = response.data.data.isUpdate;
                successToast(
                    isUpdate ? "Draft updated successfully!" : "Draft saved successfully!",
                    "top-center"
                );

                // Clear form after successful save
                setFormData({
                    to: "",
                    subject: "",
                    message: "",
                });
                setAttachedFiles([]);
                if (messageRef.current) {
                    messageRef.current.innerHTML = "";
                }
                onClose();
            }
        } catch (error: any) {
            console.error("Error saving draft:", error);
            errorToast(
                error.response?.data?.details || "Failed to save draft. Please try again.",
                "top-center"
            );
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleDiscard = () => {
        setShowDiscardModal(true);
    };

    const confirmDiscard = () => {
        setFormData({
            to: "",
            subject: "",
            message: "",
        });
        setAttachedFiles([]);
        if (messageRef.current) {
            messageRef.current.innerHTML = "";
        }
        setShowDiscardModal(false);
        onClose();
    };

    const cancelDiscard = () => {
        setShowDiscardModal(false);
    };

    // Rich text formatting functions using execCommand for proper HTML
    const executeCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value);
        messageRef.current?.focus();
        handleMessageChange();
    };

    const handleBold = () => executeCommand("bold");
    const handleItalic = () => executeCommand("italic");
    const handleUnderline = () => executeCommand("underline");
    const handleStrikethrough = () => executeCommand("strikeThrough");

    const handleList = (type: "ul" | "ol") => {
        if (type === "ul") {
            executeCommand("insertUnorderedList");
        } else {
            executeCommand("insertOrderedList");
        }
    };

    const handleAlignText = (alignment: "left" | "center" | "right") => {
        const alignCommands = {
            left: "justifyLeft",
            center: "justifyCenter",
            right: "justifyRight",
        };
        executeCommand(alignCommands[alignment]);
    };

    const handleInsertLink = () => {
        const url = prompt("Enter URL:");
        if (url) {
            executeCommand("createLink", url);
        }
    };

    const handleInsertImage = () => {
        imageInputRef.current?.click();
    };

    const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            errorToast("Please select a valid image file", "top-center");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            errorToast("Image size must be less than 5MB", "top-center");
            return;
        }

        // Convert image to base64 and insert
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Image = event.target?.result as string;
            if (base64Image && messageRef.current) {
                // Focus the editor
                messageRef.current.focus();
                // Create image element
                const img = document.createElement('img');
                img.src = base64Image;
                img.style.maxWidth = '100%';
                img.style.height = '40rem';
                img.style.display = 'block';
                img.style.margin = '10px 0';
                img.style.borderRadius = '4px';
                // Insert image at cursor position or at the end
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(img);
                    // Move cursor after the image
                    range.setStartAfter(img);
                    range.setEndAfter(img);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    // Append at the end if no selection
                    messageRef.current.appendChild(img);
                }
                // Update the message state
                handleMessageChange();
            }
        };
        reader.onerror = () => {
            errorToast("Failed to read image file", "top-center");
        };
        reader.readAsDataURL(file);

        // Reset input value to allow selecting the same file again
        e.target.value = '';
    };

    const handleAttachFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        // Validate total file size (max 25MB total)
        const totalSize = fileArray.reduce((acc, file) => acc + file.size, 0);
        if (totalSize > 25 * 1024 * 1024) {
            errorToast("Total file size must be less than 25MB", "top-center");
            return;
        }

        // Add files to attached files list
        setAttachedFiles((prev) => [...prev, ...fileArray]);

        // Reset input value to allow selecting the same file again
        e.target.value = '';
    };

    const handleRemoveFile = (index: number) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleFontSizeChange = (size: string) => {
        setFontSize(size);
        const editor = messageRef.current;
        if (editor) {
            editor.style.fontSize = `${size}px`;
        }
    };

    if (!isOpen) return null;

    const modalOverlayStyle: React.CSSProperties = {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        zIndex: 1500,
        // backdropFilter: "blur(1px)", 
    };

    const containerStyle: React.CSSProperties = {
        backgroundColor: "#ffffff",
        border: "1px solid #E5E7EB",
        borderRadius: "24px",
        display: "flex",
        flexDirection: "column",
        width: "1000px",
        maxWidth: "820px",
        maxHeight: "calc(100vh - 64px)",
        boxShadow: "0 35px 80px rgba(15, 23, 42, 0.35)",
        overflow: "hidden",

    };

    const headerStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 28px 18px 28px",
        borderBottom: "1px solid #F3F4F6",
        backgroundColor: "#F8F9FC",
        cursor: "default",
        width: "100%",
        height: "56px",
    };
   

    const headerLeftStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: "14px",
    };

    const headerTitleStyle: React.CSSProperties = {
        fontSize: "15px",
        fontWeight: 600,
        color: "#111827",
        margin: 0,
    };

    const headerSubtitleStyle: React.CSSProperties = {
        fontSize: "13px",
        color: "#6B7280",
        margin: 0,
    };

    const headerActionsStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    };


    const windowControlsStyle: React.CSSProperties = {
        display: "flex",
        gap: "4px",
    };

    const windowControlButtonStyle: React.CSSProperties = {
        width: "28px",
        height: "28px",
        borderRadius: "6px",
        border: "none",
        backgroundColor: "transparent",
        color: "#535862",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontSize: "18px",
        transition: "background-color 0.2s",
    };

    const contentStyle: React.CSSProperties = {
        flex: 1,
        padding: "24px 28px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
    };

    const formSectionStyle: React.CSSProperties = {
        // marginBottom: "16px"
    };

    const labelStyle: React.CSSProperties = {
        display: "block",
        fontSize: "16px",
        fontWeight: 500,
        color: "#374151",
        marginBottom: "6px",
        marginRight: "12px",
        whiteSpace: "nowrap",
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "10px 14px",
        border: "1px solid #D1D5DB",
        borderRadius: "8px",
        fontSize: "16px",
        backgroundColor: "#ffffff",
        outline: "none",
        transition: "border-color 0.2s",
    };

    const fromInputFieldStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 14px",
        border: "1px solid #D1D5DB",
        borderRadius: "8px",
        backgroundColor: "#ffffff",
        flex: 1,
        minWidth: 0,
    };
    const fromEmailStyle: React.CSSProperties = {
        fontSize: "16px",
        fontWeight: 500,
        color: "#111827",
    };


    const templateButtonStyle: React.CSSProperties = {
        backgroundColor: "#ffffff",
        color: "#374151",
        border: "1px solid #D1D5DB",
        borderRadius: "50px",
        padding: "8px 14px",
        fontSize: "14px",
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
    };
    const toolbarStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "10px 0",
        paddingLeft: "14px",
        width: "100%",
        border: "1px solid #D1D5DB",
        borderTop: "none",
        borderBottomRightRadius: "8px",
        borderBottomLeftRadius: "8px",
    };

    const toolbarButtonStyle: React.CSSProperties = {
        width: "40px",
        height: "40px",
        padding: "0",
        borderRadius: "4px",
        backgroundColor: "transparent",
        color: "#374151",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontSize: "16px",
        transition: "all 0.2s",
        border: "none",
        flexShrink: 0,
    };

    const activeToolbarButtonStyle: React.CSSProperties = {
        ...toolbarButtonStyle,
        backgroundColor: "#2563EB",
        color: "#ffffff",
        borderColor: "#2563EB",
    };

    const toolbarSelectStyle: React.CSSProperties = {
        width: "auto",
        minWidth: "50px",
        height: "46px",
        padding: "0 10px",
        fontSize: "16px",
        borderRadius: "6px",
        border: "1px solid #E5E7EB",
        backgroundColor: "transparent",
        color: "#374151",
        cursor: "pointer",
        outline: "none",
        marginRight: "4px",
    };

    const toolbarSeparatorStyle: React.CSSProperties = {
        width: "2px",
        height: "47px",
        backgroundColor: "#E5E7EB",
        margin: "0 8px",
        flexShrink: 0,
    };

    const footerStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
        backgroundColor: "#ffffff",
    };

    const footerLeftStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    };

    const attachButtonStyle: React.CSSProperties = {
        backgroundColor: "transparent",
        color: "#414651",
        border: "1px solid #D5D7DA",
        borderRadius: "100px",
        padding: "8px 14px",
        fontSize: "13px",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        transition: "all 0.2s",
        width: "141px",
        height: "40px",
    };

    const discardLinkStyle: React.CSSProperties = {
        color: "#535862",
        fontSize: "14px",
        fontWeight: 500,
        textDecoration: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
    };

    const footerRightStyle: React.CSSProperties = {
        display: "flex",
        gap: "10px",
        alignItems: "center",
    };

    const saveDraftButtonStyle: React.CSSProperties = {
        backgroundColor: "#ffffff",
        color: "#374151",
        border: "1px solid #D1D5DB",
        borderRadius: "100px",
        padding: "9px 18px",
        fontSize: "14px",
        cursor: "pointer",
        fontWeight: 500,
        transition: "all 0.2s",
    };

    const sendButtonStyle: React.CSSProperties = {
        backgroundColor: "#181D27",
        color: "#ffffff",
        border: "none",
        borderRadius: "100px",
        padding: "9px 20px",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        fontWeight: 500,
        transition: "all 0.2s",
    };

    const headerSubject =
        formData.subject ||
        replyData?.subject ||
        forwardData?.subject ||
        "New message";

    const senderName = user?.name || user?.email?.split("@")[0] || "You";

    return (
        <>
            <style>{`
        .message-editor[contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
        }
        .message-editor b, .message-editor strong {
          font-weight: bold;
        }
        .message-editor i, .message-editor em {
          font-style: italic;
        }
        .message-editor u {
          text-decoration: underline;
        }
        .message-editor a {
          color: #2563EB;
          text-decoration: underline;
        }
        .message-editor img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 10px 0;
          border-radius: 4px;
          cursor: pointer;
        }
        .from-dropdown-container {
          width: auto;
          flex: 1;
        }
        .from-dropdown-button {
          padding: 0 !important;
          border: none !important;
          border-radius: 0 !important;
          font-size: 16px !important;
          background-color: transparent !important;
          color: #111827 !important;
          height: 100% !important;
          min-height: auto !important;
          width: 100% !important;
          max-width: 100% !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          font-weight: 500 !important;
          justify-content: flex-start !important;
        }
        .from-dropdown-button img {
          margin-right: 0 !important;
        }
        .from-dropdown-button .buttonText {
          flex: 1 !important;
          text-align: left !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          margin: 0 !important;
        }
        .from-dropdown-button svg {
          margin-left: auto !important;
          flex-shrink: 0 !important;
        }
        .from-dropdown-button:hover:not(:disabled) {
          border-color: #9CA3AF !important;
        }
      `}</style>
            <div
                style={modalOverlayStyle}
                onClick={onClose}
            >
                <div
                    style={containerStyle}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={headerStyle}>
                        <div style={headerLeftStyle}>
                            <div>
                                <p style={headerTitleStyle}>{headerSubject} - {senderName}</p>
                            </div>
                        </div>
                        <div style={headerActionsStyle}>
                            <div style={windowControlsStyle}>
                                <button
                                    type="button"
                                    style={windowControlButtonStyle}
                                    aria-label="Minimize"
                                >
                                    <i className="la la-minus"></i>
                                </button>
                                <button
                                    type="button"
                                    style={windowControlButtonStyle}
                                    aria-label="Expand"
                                >
                                    <i className="la la-square-o"></i>
                                </button>
                                <button
                                    type="button"
                                    style={windowControlButtonStyle}
                                    aria-label="Close"
                                    onClick={onClose}
                                >
                                    <i className="la la-times"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div style={contentStyle}>
                        {/* From Field */}
                        <div style={{ ...formSectionStyle, display: "flex", alignItems: "center", gap: "12px"  }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>From</label>
                            {isAdmin && fromEmailOptions.length > 0 ? (
                                <div style={fromInputFieldStyle}>
                                    <DropdownModal
                                        value={fromEmail}
                                        options={fromEmailOptions}
                                        onSelect={(value) => setFromEmail(value)}
                                        placeholder={isLoadingFromEmails ? "Loading..." : "Select email"}
                                        disabled={isLoadingFromEmails}
                                        buttonClassName="from-dropdown-button"
                                        containerClassName="from-dropdown-container"
                                        style={{ flex: 1, minWidth: 0, border: "none", padding: 0 }}
                                        showImg={true}
                                    />
                                </div>
                            ) : (
                                <div style={fromInputFieldStyle}>
                                    <AvatarImage
                                        src={
                                            user?.image ||
                                            "https://api.dicebear.com/9.x/glass/svg?seed=sabine"
                                        }
                                        className="rounded-circle"
                                        alt={user?.name || "jia"}
                                        style={{ width: "32px", height: "32px", flexShrink: 0 }}
                                    />
                                    <div style={{ ...fromEmailStyle, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {user?.email || fromEmail}
                                    </div>
                                    <i className="la la-angle-down" style={{ fontSize: "16px", color: "#6B7280", flexShrink: 0 }}></i>
                                </div>
                            )}
                            <button
                                style={templateButtonStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                            >
                                <i className="la la-file-text" style={{ fontSize: "20px" }}></i>
                                Insert a Template
                            </button>
                        </div>

                        {/* To Field */}
                        <div style={formSectionStyle}>
                            {/* <label style={labelStyle}>To</label> */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {/* Reply Dropdown Button */}
                                <div style={{ position: "relative" }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowReplyDropdown(!showReplyDropdown)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: "8px 12px",
                                            border: "1px solid #D1D5DB",
                                            backgroundColor: "#ffffff",
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                            width: "80px",
                                            height: "40px",
                                            borderRadius: "100px",
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = "#9CA3AF"}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                                    >
                                        <i className="la la-reply" style={{ fontSize: "18px", color: "#6B7280" }}></i>
                                        <i className="la la-angle-down" style={{ fontSize: "12px", color: "#6B7280", marginLeft: "4px" }}></i>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {showReplyDropdown && (
                                        <>
                                            <div
                                                style={{
                                                    position: "fixed",
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    zIndex: 999,
                                                }}
                                                onClick={() => setShowReplyDropdown(false)}
                                            />
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: "100%",
                                                    left: 0,
                                                    marginTop: "4px",
                                                    backgroundColor: "#ffffff",
                                                    border: "1px solid #E5E7EB",
                                                    borderRadius: "8px",
                                                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                                                    minWidth: "160px",
                                                    zIndex: 1000,
                                                    overflow: "hidden",
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowReplyDropdown(false);
                                                        // Reply action is already handled by the module being open
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        padding: "10px 16px",
                                                        textAlign: "left",
                                                        border: "none",
                                                        backgroundColor: "transparent",
                                                        cursor: "pointer",
                                                        fontSize: "14px",
                                                        color: "#374151",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "8px",
                                                        transition: "background-color 0.2s",
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                                >
                                                    <i className="la la-reply" style={{ fontSize: "16px", color: "#6B7280" }}></i>
                                                    <span>Reply</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowReplyDropdown(false);
                                                        // Forward action is already handled by the module being open
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        padding: "10px 16px",
                                                        textAlign: "left",
                                                        border: "none",
                                                        backgroundColor: "transparent",
                                                        cursor: "pointer",
                                                        fontSize: "14px",
                                                        color: "#374151",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "8px",
                                                        transition: "background-color 0.2s",
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                                >
                                                    <i className="la la-share" style={{ fontSize: "16px", color: "#6B7280" }}></i>
                                                    <span>Forward</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowReplyDropdown(false);
                                                        // Pop out reply functionality placeholder
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        padding: "10px 16px",
                                                        textAlign: "left",
                                                        border: "none",
                                                        backgroundColor: "transparent",
                                                        cursor: "pointer",
                                                        fontSize: "14px",
                                                        color: "#374151",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "8px",
                                                        transition: "background-color 0.2s",
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                                >
                                                    <i className="la la-external-link-square" style={{ fontSize: "16px", color: "#6B7280" }}></i>
                                                    <span>Pop out reply</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* To Input Field */}
                                <input
                                    type="email"
                                    style={{ ...inputStyle, flex: 1 }}
                                    value={formData.to}
                                    onChange={(e) => handleInputChange("to", e.target.value)}
                                    placeholder="recipient@example.com"
                                />
                            </div>
                        </div>

                        {/* Message Field */}
                        <div style={formSectionStyle}>
                            <label style={labelStyle}>Message</label>
                            <div style={{
                                border: "1px solid #D1D5DB",
                                borderRadius: "8px",
                                borderBottomRightRadius: "0",
                                borderBottomLeftRadius: "0",
                                backgroundColor: "#ffffff",
                            }}>
                                <div
                                    ref={messageRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    className="message-editor"
                                    style={{
                                        width: "100%",
                                        minHeight: "200px",
                                        padding: "10px 14px",
                                        fontSize: `${fontSize}px`,
                                        color: "black",
                                        outline: "none",
                                        fontFamily: "inherit",
                                        lineHeight: "1.5",
                                        overflowY: "auto",
                                        wordWrap: "break-word",
                                    }}
                                    onInput={handleMessageChange}
                                    onMouseUp={updateActiveFormats}
                                    onKeyUp={updateActiveFormats}
                                    data-placeholder="Enter message"
                                />

                                {/* Display attached files inside message field */}
                                {attachedFiles.length > 0 && (
                                    <div style={{
                                        padding: "0 14px 14px 14px",
                                        marginTop: "10px"
                                    }}>
                                        {attachedFiles.map((file, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    padding: "8px 12px",
                                                    backgroundColor: "#F3F4F6",
                                                    borderRadius: "6px",
                                                    fontSize: "14px",
                                                    color: "#1F2937",
                                                    marginTop: "8px",
                                                    width: "70%"
                                                }}
                                            >
                                                <i className="la la-paperclip" style={{ fontSize: "16px", color: "#6B7280" }}></i>
                                                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {file.name || file.filename || "Attachment"}
                                                </span>
                                                <span style={{ fontSize: "13px", color: "#6B7280" }}>
                                                    {file.size ? `(${(file.size / 1024).toFixed(0)}K)` : file.fileSize ? `(${(file.fileSize / 1024).toFixed(0)}K)` : ""}
                                                </span>
                                                <button
                                                    onClick={() => handleRemoveFile(index)}
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        cursor: "pointer",
                                                        padding: "4px",
                                                        color: "#6B7280",
                                                        fontSize: "18px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        lineHeight: 1
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = "#EF4444"}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = "#6B7280"}
                                                    title="Remove file"
                                                >
                                                    <i className="la la-times"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Rich Text Editor Toolbar */}
                            <div style={toolbarStyle} className="reply-forward-email-toolbar">
                                <select
                                    style={toolbarSelectStyle}
                                    value={fontSize}
                                    onChange={(e) => handleFontSizeChange(e.target.value)}
                                >
                                    <option value="12">12</option>
                                    <option value="14">14</option>
                                    <option value="16">16</option>
                                    <option value="18">18</option>
                                    <option value="20">20</option>
                                </select>
                                <div style={toolbarSeparatorStyle}></div>
                                <button
                                    style={activeFormats.bold ? activeToolbarButtonStyle : toolbarButtonStyle}
                                    onClick={handleBold}
                                    title="Bold (Ctrl+B)"
                                    type="button"
                                >
                                    <strong>B</strong>
                                </button>
                                <button
                                    style={activeFormats.italic ? activeToolbarButtonStyle : toolbarButtonStyle}
                                    onClick={handleItalic}
                                    title="Italic (Ctrl+I)"
                                    type="button"
                                >
                                    <em>I</em>
                                </button>
                                <button
                                    style={activeFormats.underline ? activeToolbarButtonStyle : toolbarButtonStyle}
                                    onClick={handleUnderline}
                                    title="Underline (Ctrl+U)"
                                    type="button"
                                >
                                    <u>U</u>
                                </button>
                                <button
                                    style={activeFormats.strikeThrough ? activeToolbarButtonStyle : toolbarButtonStyle}
                                    onClick={handleStrikethrough}
                                    title="Strikethrough"
                                    type="button"
                                >
                                    <s>S</s>
                                </button>
                                <div style={toolbarSeparatorStyle}></div>
                                <button
                                    style={toolbarButtonStyle}
                                    onClick={() => handleAlignText("left")}
                                    title="Align Left"
                                    type="button"
                                >
                                    <i className="la la-align-left"></i>
                                </button>
                                <button
                                    style={toolbarButtonStyle}
                                    onClick={() => handleAlignText("center")}
                                    title="Align Center"
                                    type="button"
                                >
                                    <i className="la la-align-center"></i>
                                </button>
                                <button
                                    style={toolbarButtonStyle}
                                    onClick={() => handleAlignText("right")}
                                    title="Align Right"
                                    type="button"
                                >
                                    <i className="la la-align-right"></i>
                                </button>
                                <div style={toolbarSeparatorStyle}></div>
                                <button
                                    style={activeFormats.insertUnorderedList ? activeToolbarButtonStyle : toolbarButtonStyle}
                                    onClick={() => handleList("ul")}
                                    title="Bullet List"
                                    type="button"
                                >
                                    <i className="la la-list-ul"></i>
                                </button>
                                <button
                                    style={activeFormats.insertOrderedList ? activeToolbarButtonStyle : toolbarButtonStyle}
                                    onClick={() => handleList("ol")}
                                    title="Numbered List"
                                    type="button"
                                >
                                    <i className="la la-list-ol"></i>
                                </button>
                                <div style={toolbarSeparatorStyle}></div>
                                <button
                                    style={toolbarButtonStyle}
                                    onClick={handleInsertImage}
                                    title="Insert Image"
                                    type="button"
                                >
                                    <i className="la la-image"></i>
                                </button>
                                <button
                                    style={toolbarButtonStyle}
                                    onClick={handleInsertLink}
                                    title="Insert Link"
                                    type="button"
                                >
                                    <i className="la la-link"></i>
                                </button>
                                <button
                                    style={{ ...toolbarButtonStyle, width: "auto", paddingLeft: "10px", paddingRight: "10px" }}
                                    title="Insert Token"
                                    type="button"
                                >
                                    <i className="la la-plus-circle"></i>
                                    <span style={{ fontSize: "13px", marginLeft: "4px" }}>Insert Token</span>
                                </button>
                            </div>

                        </div>
                        <button style={attachButtonStyle} onClick={handleAttachFile}>
                        <i className="la la-paperclip"></i>
                        Attach a File
                    </button>
                    </div>
                    {/* Footer */}
                    <div style={footerStyle} className="reply-forward-email-footer">
                        <div style={footerLeftStyle}>
                            <a
                                style={discardLinkStyle}
                                onClick={handleDiscard}
                            >
                                <i className="la la-trash" style={{ fontSize: "24px" }}></i>
                                Discard
                            </a>
                        </div>
                        <div style={footerRightStyle}>
                            <button
                                onClick={handleSaveDraft}
                                style={{
                                    ...saveDraftButtonStyle,
                                    opacity: isSavingDraft ? 0.7 : 1,
                                    cursor: isSavingDraft ? "not-allowed" : "pointer",
                                }}
                                disabled={isSavingDraft}
                                onMouseEnter={(e) => !isSavingDraft && (e.currentTarget.style.backgroundColor = "#F9FAFB")}
                                onMouseLeave={(e) => !isSavingDraft && (e.currentTarget.style.backgroundColor = "#ffffff")}
                            >
                                {isSavingDraft ? (
                                    <>
                                        <i className="la la-spinner la-spin"></i> Saving...
                                    </>
                                ) : (
                                    "Save Draft"
                                )}
                            </button>
                            <button
                                onClick={handleSend}
                                style={{
                                    ...sendButtonStyle,
                                    opacity: isSending ? 0.7 : 1,
                                    cursor: isSending ? "not-allowed" : "pointer",
                                }}
                                disabled={isSending}
                            >
                                {isSending ? (
                                    <>
                                        <i className="la la-spinner la-spin"></i> Sending...
                                    </>
                                ) : (
                                    <>
                                        <i className="la la-paper-plane"></i> Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    {/* Hidden file input for image upload */}
                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageFileSelect}
                    />
                    {/* Hidden file input for file attachments */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                    />
                </div>
            </div>

            {/* Discard Confirmation Modal */}
            {showDiscardModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2000,
                    }}
                    onClick={cancelDiscard}
                >
                    <div
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: "12px",
                            padding: "24px",
                            maxWidth: "400px",
                            width: "90%",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Warning Icon */}
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                            <div
                                style={{
                                    width: "64px",
                                    height: "64px",
                                    borderRadius: "50%",
                                    backgroundColor: "#FFF4E6",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    position: "relative",
                                }}
                            >
                                <div
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "50%",
                                        backgroundColor: "#FEF0C7",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        boxShadow: "0 0 0 8px rgba(255, 149, 0, 0.1)",
                                    }}
                                >
                                    <img alt="" src="/icons/alert-octagon.svg" style={{ width: "24px", height: "24px" }} />
                                </div>
                            </div>
                        </div>

                        {/* Message */}
                        <div style={{ textAlign: "center", marginBottom: "24px" }}>
                            <h3
                                style={{
                                    fontSize: "18px",
                                    fontWeight: 600,
                                    color: "#111827",
                                    margin: "0 0 8px 0",
                                }}
                            >
                                Discard unsaved changes?
                            </h3>
                            <p
                                style={{
                                    fontSize: "14px",
                                    color: "#6B7280",
                                    margin: 0,
                                }}
                            >
                                Your message will not be saved.
                            </p>
                        </div>

                        {/* Buttons */}
                        <div
                            style={{
                                display: "flex",
                                gap: "12px",
                                justifyContent: "center",
                            }}
                        >
                            <button
                                onClick={confirmDiscard}
                                style={{
                                    padding: "10px 20px",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "#374151",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #D1D5DB",
                                    borderRadius: "100px",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                            >
                                Discard changes
                            </button>
                            <button
                                onClick={cancelDiscard}
                                style={{
                                    padding: "10px 20px",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "#ffffff",
                                    backgroundColor: "#181D27",
                                    border: "none",
                                    borderRadius: "100px",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}

                            >
                                Return to edit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

