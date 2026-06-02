import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { getOAuth2Client } from "@/lib/data/google";
import { decrypt, encrypt } from "@/lib/utils/cryptography";
import { google } from "googleapis";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgID = searchParams.get("orgID");
    const careerId = searchParams.get("careerId");

    // Validate required orgID
    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID (orgID) is required" },
        { status: 400 }
      );
    }

    // Connect to database
    const { db } = await connectMongoDB();

    // Normalize orgID to ObjectId if valid
    const normalizedOrgId =
      ObjectId.isValid(String(orgID))
        ? new ObjectId(String(orgID))
        : orgID;

    // Build query
    const query: any = {
      orgID: normalizedOrgId,
    };

    // Add careerId to query if provided
    if (careerId) {
      query.careerId = careerId;
    }

    // Add campaignId to query if provided
    if (searchParams.get("campaignId")) {
      query.campaignId = searchParams.get("campaignId");
    }

    // Query gmail-subject collection to get senderEmail and subject combinations
    const gmailSubjects = await db
      .collection("gmail-subject")
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    // Log gmail-subject results
    console.log("[GET /api/gmail/emails] Query:", JSON.stringify(query));
    console.log("[GET /api/gmail/emails] Gmail-subject count:", gmailSubjects.length);
    
    // Early return if no gmail-subject entries found
    if (gmailSubjects.length === 0) {
      console.log("[GET /api/gmail/emails] No gmail-subject entries found matching query. Returning empty results.");
      return NextResponse.json({
        success: true,
        data: [],
        threads: [],
        count: 0,
        message: "No Gmail emails found matching the criteria",
      });
    }

    console.log("[GET /api/gmail/emails] Gmail-subject results:", JSON.stringify(gmailSubjects, null, 2));

    // Group gmail-subject entries by userId
    const gmailSubjectsByUserId = new Map<string, any[]>();
    gmailSubjects.forEach((item: any) => {
      const userId = String(item.userId || "");
      if (userId) {
        if (!gmailSubjectsByUserId.has(userId)) {
          gmailSubjectsByUserId.set(userId, []);
        }
        gmailSubjectsByUserId.get(userId)!.push(item);
      }
    });

    // Fetch all emailSettings for the organization
    // Build query for emailSettings - need to check both ObjectId and string formats for orgID
    const orgIdObjectId = ObjectId.isValid(String(orgID)) ? new ObjectId(String(orgID)) : null;
    
    const emailSettingsQuery: any = {};
    if (orgIdObjectId) {
      emailSettingsQuery.$or = [
        { orgID: String(orgID) },
        { orgID: orgIdObjectId },
      ];
    } else {
      emailSettingsQuery.orgID = orgID;
    }

    // Fetch all matching emailSettings
    const emailSettingsResults = await db
      .collection("email-settings")
      .find(emailSettingsQuery)
      .toArray();

    // Log emailSettings results
    console.log("[GET /api/gmail/emails] EmailSettings count:", emailSettingsResults.length);

    // Create enriched results array with emailSettings and matching gmail-subject entries
    const enrichedResults = emailSettingsResults.map((emailSettings: any) => {
      const userId = String(emailSettings.userID || "");
      const gmailSubjectEntries = gmailSubjectsByUserId.get(userId) || [];
      
      return {
        userId: emailSettings.userID,
        orgID: emailSettings.orgID,
        emailSettings: emailSettings,
        gmailSubjects: gmailSubjectEntries,
      };
    });

    // Filter to only users with gmail-subject entries
    const usersWithGmailSubjects = enrichedResults.filter((item) => item.gmailSubjects.length > 0);
    
    // Early return if no users have matching gmail-subject entries
    if (usersWithGmailSubjects.length === 0) {
      console.log("[GET /api/gmail/emails] No users found with matching gmail-subject entries. Returning empty results.");
      return NextResponse.json({
        success: true,
        data: [],
        threads: [],
        count: 0,
        message: "No Gmail emails found - no matching gmail-subject entries for any users",
        gmailTokenExpired: false,
      });
    }

    console.log(`[GET /api/gmail/emails] Processing ${usersWithGmailSubjects.length} user(s) with matching gmail-subject entries`);

    // Fetch Gmail emails for all users and group into threads
    const emailSettingsCollection = db.collection("email-settings");
    const allThreadsMap = new Map<string, any>();
    const usersWithInsufficientScopes = new Set<string>(); // Track users with scope issues
    let gmailTokenExpired = false; // Set when refresh fails with invalid_grant so UI can show reconnect alert

    // Process each emailSettings to fetch Gmail emails (only users with gmail-subject entries)
    await Promise.all(
      usersWithGmailSubjects.map(async (enrichedItem: any) => {
        const emailSettings = enrichedItem.emailSettings;

        if (!emailSettings || !emailSettings.tokens) {
          console.log(`[GET /api/gmail/emails] No emailSettings or tokens for userId: ${emailSettings.userID}`);
          return;
        }

        const userId = emailSettings.userID;

        try {
          // Decrypt tokens
          const decryptTokens = decrypt(emailSettings.tokens);
          if (!decryptTokens) {
            console.log(`[GET /api/gmail/emails] Failed to decrypt tokens for userId: ${userId}`);
            return;
          }

          const parsedTokens = JSON.parse(decryptTokens);
          const oAuth2Client = getOAuth2Client();
          oAuth2Client.setCredentials({
            access_token: parsedTokens.access_token,
            refresh_token: parsedTokens.refresh_token,
          });

          // Check if token is expired and refresh if needed
          let tokensUpdated = false;
          if (Date.now() > parsedTokens.expiry_date) {
            console.log(`[GET /api/gmail/emails] Token expired for userId: ${userId}, refreshing...`);
            try {
              const { credentials } = await oAuth2Client.refreshAccessToken();
              oAuth2Client.setCredentials(credentials);

              // Update emailSettings with new encrypted tokens
              const encryptedNewTokens = encrypt(JSON.stringify(credentials));
              await emailSettingsCollection.updateOne(
                { userID: userId },
                { $set: { tokens: encryptedNewTokens } }
              );

              // Update the parsedTokens for this request
              Object.assign(parsedTokens, credentials);
              tokensUpdated = true;
              console.log(`[GET /api/gmail/emails] Tokens refreshed and updated for userId: ${userId}`);
            } catch (refreshErr: any) {
              console.error(`[GET /api/gmail/emails] Failed to refresh token for userId: ${userId}`, refreshErr);
              const isInvalidGrant =
                refreshErr?.response?.data?.error === "invalid_grant" ||
                String(refreshErr?.message || "").includes("invalid_grant");
              if (isInvalidGrant) {
                gmailTokenExpired = true;
              }
              return;
            }
          }

          // Initialize Gmail API
          const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

          // Get gmail-subject entries for this user
          const gmailSubjectEntries = enrichedItem.gmailSubjects || [];
          
          if (gmailSubjectEntries.length === 0) {
            console.log(`[GET /api/gmail/emails] No gmail-subject entries for userId: ${userId}, skipping`);
            return;
          }

          // Build optimized queries using senderEmail and subject from gmail-subject
          // Create a map to track careerId by (senderEmail, subject) key
          const careerIdMap = new Map<string, string>();
          const queries: Array<{ label: string; query: string; senderEmail: string; subject: string; createdAt?: any; careerId?: string; campaignId?: string }> = [];
          
          for (const gmailSubject of gmailSubjectEntries) {
            const senderEmail = String(gmailSubject.senderEmail || "").trim().toLowerCase();
            const subject = String(gmailSubject.subject || "").trim();
            const createdAt = gmailSubject.createdAt || gmailSubject.date;
            const careerId = gmailSubject.careerId ? String(gmailSubject.careerId) : null;
            const campaignId = gmailSubject.campaignId ? String(gmailSubject.campaignId) : null;
            
            if (!senderEmail || !subject) continue;
            
            // Store careerId mapping for this (senderEmail, subject) combination
            const key = `${senderEmail}|${subject}`;
            if (careerId) {
              careerIdMap.set(key, careerId);
            }

            // Escape special characters in subject for exact Gmail query matching
            // Gmail requires proper escaping: escape backslashes and quotes
            const escapedSubject = subject
              .replace(/\\/g, '\\\\')  // Escape backslashes first
              .replace(/"/g, '\\"');   // Then escape quotes
            
            // Format createdAt date for Gmail query (after:YYYY/MM/DD)
            let dateFilter = "";
            if (createdAt) {
              try {
                const date = new Date(createdAt);
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  dateFilter = `after:${year}/${month}/${day}`;
                }
              } catch (e) {
                console.warn(`[GET /api/gmail/emails] Error formatting date for gmail-subject:`, e);
              }
            }
            
            // Build queries for inbox, sent, and drafts with exact senderEmail, subject, and date filters
            // Format: in:inbox from:email@domain.com subject:"Exact Subject" after:YYYY/MM/DD
            // - from: matches the exact sender email
            // - subject:"..." ensures exact phrase matching (case-insensitive but exact phrase)
            // - after:YYYY/MM/DD filters emails created on or after the specified date
            const baseQuery = dateFilter 
              ? `from:${senderEmail} subject:"${escapedSubject}" ${dateFilter}`
              : `from:${senderEmail} subject:"${escapedSubject}"`;
            
            queries.push({
              label: "INBOX",
              query: `in:inbox ${baseQuery}`,
              senderEmail: senderEmail,
              subject: subject,
              createdAt: createdAt,
              careerId: careerId,
              campaignId: campaignId,
            });
            queries.push({
              label: "SENT",
              query: `in:sent ${baseQuery}`,
              senderEmail: senderEmail,
              subject: subject,
              createdAt: createdAt,
              careerId: careerId,
              campaignId: campaignId,
            });
            queries.push({
              label: "DRAFT",
              query: `in:drafts ${baseQuery}`,
              senderEmail: senderEmail,
              subject: subject,
              createdAt: createdAt,
              careerId: careerId,
              campaignId: campaignId,
            });
          }

          console.log(`[GET /api/gmail/emails] Built ${queries.length} optimized queries for userId: ${userId}`);

          for (const { label, query: gmailQuery, senderEmail, subject, careerId, campaignId } of queries) {
            try {
              console.log(`[GET /api/gmail/emails] Fetching ${label} threads for userId: ${userId}, senderEmail: ${senderEmail}, subject: "${subject}", careerId: ${careerId || "N/A"}`);
              
              const threadsResponse = await gmail.users.threads.list({
                userId: "me",
                q: gmailQuery,
                maxResults: 50, // Reduced since we're filtering more specifically
              });

              const threadIds = threadsResponse.data.threads || [];
              console.log(`[GET /api/gmail/emails] Found ${threadIds.length} ${label} threads for userId: ${userId}`);

              // Fetch detailed thread information
              for (const threadRef of threadIds.slice(0, 50)) {
                try {
                  const threadDetail = await gmail.users.threads.get({
                    userId: "me",
                    id: threadRef.id,
                    format: "full",
                  });

                  const threadId = threadDetail.data.id;
                  const messages = threadDetail.data.messages || [];
                  const labelIds = (threadDetail.data as any).labelIds || [];

                  // Check if thread has matching subject (accounting for Re: and Fwd: prefixes)
                  const threadSubject = messages[0]?.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "";
                  
                  // Normalize subject for comparison (strip Re:, Fwd:, etc.)
                  const normalizeSubject = (subj: string) => {
                    return subj
                      .replace(/^(Re:|re:|RE:)\s*/g, "") // Strip Re: prefix
                      .replace(/^(Fwd:|fwd:|FWD:)\s*/g, "") // Strip Fwd: prefix
                      .trim();
                  };
                  
                  const normalizedThreadSubject = normalizeSubject(threadSubject);
                  const normalizedExpectedSubject = normalizeSubject(subject);
                  
                  if (normalizedThreadSubject !== normalizedExpectedSubject) {
                    // Subject doesn't match, skip this thread
                    console.log(`[GET /api/gmail/emails] Skipping thread ${threadId} - subject mismatch. Expected: "${normalizedExpectedSubject}", Got: "${normalizedThreadSubject}"`);
                    continue;
                  }

                  // Process messages in thread first to get their labelIds
                  const processedMessages = await Promise.all(
                    messages.map(async (msg: any) => {
                      try {
                        const payload = msg.payload || {};
                        const headers = payload.headers || [];
                        
                        const getHeader = (name: string) => {
                          const header = headers.find((h: any) => h.name === name);
                          return header?.value || "";
                        };

                        // Extract body content - prioritize HTML, always return HTML
                        let text = "";
                        let html = "";
                        if (payload.body?.data) {
                          const bodyData = Buffer.from(payload.body.data, "base64").toString("utf-8");
                          if (payload.mimeType === "text/html") {
                            html = bodyData;
                          } else {
                            text = bodyData;
                          }
                        } else if (payload.parts) {
                          const findBodyPart = (parts: any[], preferHtml = true) => {
                            let foundText = "";
                            let foundHtml = "";
                            for (const part of parts) {
                              if (part.mimeType === "text/html" && part.body?.data) {
                                foundHtml = Buffer.from(part.body.data, "base64").toString("utf-8");
                                if (preferHtml) break; // Prefer HTML, stop if found
                              }
                              if (part.mimeType === "text/plain" && part.body?.data && !foundHtml) {
                                foundText = Buffer.from(part.body.data, "base64").toString("utf-8");
                              }
                              if (part.parts) {
                                const found = findBodyPart(part.parts, preferHtml);
                                if (found.html) foundHtml = found.html;
                                if (found.text && !foundHtml) foundText = found.text;
                                if (foundHtml && preferHtml) break;
                              }
                            }
                            return { text: foundText, html: foundHtml };
                          };
                          const bodyParts = findBodyPart(payload.parts, true);
                          text = bodyParts.text;
                          html = bodyParts.html;
                        }

                        // Convert text to HTML if HTML is not available
                        if (!html && text) {
                          html = text
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/\n/g, "<br>")
                            .replace(/\r/g, "");
                        }

                        // Ensure HTML is always set (even if empty)
                        if (!html) {
                          html = "";
                        }

                        // Extract attachments
                        const attachments: any[] = [];
                        if (payload.parts) {
                          const findAttachments = (parts: any[]) => {
                            for (const part of parts) {
                              if (part.filename && part.body?.attachmentId) {
                                attachments.push({
                                  attachmentId: part.body.attachmentId,
                                  messageId: msg.id, // Gmail message ID for downloading
                                  fileName: part.filename, // Match EmailMessageCard field name
                                  fileType: part.mimeType, // Match EmailMessageCard field name
                                  fileSize: part.body.size, // Match EmailMessageCard field name
                                  // For download endpoint
                                  url: `/api/gmail/download-attachment?messageId=${msg.id}&attachmentId=${part.body.attachmentId}&filename=${encodeURIComponent(part.filename)}&orgID=${orgID}&userId=${userId}`,
                                  // Keep original fields for compatibility
                                  filename: part.filename,
                                  mimeType: part.mimeType,
                                  size: part.body.size,
                                });
                              }
                              if (part.parts) {
                                findAttachments(part.parts);
                              }
                            }
                          };
                          findAttachments(payload.parts);
                        }

                        const messageSubject = getHeader("Subject");
                        
                        // Normalize subject for comparison (strip Re:, Fwd:, etc.)
                        const normalizeSubject = (subj: string) => {
                          return subj
                            .replace(/^(Re:|re:|RE:)\s*/g, "") // Strip Re: prefix
                            .replace(/^(Fwd:|fwd:|FWD:)\s*/g, "") // Strip Fwd: prefix
                            .trim();
                        };
                        
                        const normalizedMessageSubject = normalizeSubject(messageSubject);
                        const normalizedExpectedSubject = normalizeSubject(subject);
                        
                        // Double-check subject match (accounting for Re: and Fwd: prefixes)
                        if (normalizedMessageSubject !== normalizedExpectedSubject) {
                          console.log(`[GET /api/gmail/emails] Skipping message ${msg.id} - subject mismatch. Expected: "${normalizedExpectedSubject}", Got: "${normalizedMessageSubject}"`);
                          return null;
                        }

                        return {
                          id: msg.id,
                          threadId: threadId,
                          subject: messageSubject,
                          from: getHeader("From"),
                          to: getHeader("To"),
                          date: getHeader("Date"),
                          snippet: msg.snippet || "",
                          text: text,
                          html: html, // Always return HTML
                          attachments: attachments,
                          labelIds: msg.labelIds || [],
                        };
                      } catch (msgErr: any) {
                        console.error(`[GET /api/gmail/emails] Error processing message ${msg.id}:`, msgErr);
                        return null;
                      }
                    })
                  );

                  const validMessages = processedMessages.filter((m) => m !== null);
                  if (validMessages.length === 0) continue;

                  // Sort messages by date (oldest first)
                  validMessages.sort((a: any, b: any) => {
                    const dateA = new Date(a.date || 0).getTime();
                    const dateB = new Date(b.date || 0).getTime();
                    return dateA - dateB;
                  });

                  // Get last message
                  const lastMessage = validMessages[validMessages.length - 1];

                  // Collect all labelIds from all messages in the thread
                  const allMessageLabelIds: string[] = [];
                  validMessages.forEach((msg: any) => {
                    if (msg.labelIds && Array.isArray(msg.labelIds)) {
                      allMessageLabelIds.push(...msg.labelIds);
                    }
                  });

                  // Merge thread-level labelIds with all message labelIds
                  const allLabelIds = [...new Set([...labelIds, ...allMessageLabelIds])];

                  // Check if thread already processed and merge if it exists
                  if (allThreadsMap.has(threadId)) {
                    const existingThread = allThreadsMap.get(threadId);
                    // Merge labelIds from both thread-level and message-level
                    const mergedLabelIds = [...new Set([...existingThread.labelIds, ...allLabelIds])];
                    existingThread.labelIds = mergedLabelIds;
                    // Update flags based on merged labelIds
                    existingThread.isInbox = mergedLabelIds.includes("INBOX");
                    existingThread.isSent = mergedLabelIds.includes("SENT");
                    existingThread.isDraft = mergedLabelIds.includes("DRAFT");
                    continue;
                  }

                  // Create thread object matching EmailModule format
                  const thread = {
                    id: threadId,
                    subject: lastMessage.subject || "(no subject)",
                    careerId: careerId || undefined,
                    campaignId: campaignId || undefined,
                    lastMessage: {
                      id: lastMessage.id,
                      from: lastMessage.from,
                      to: lastMessage.to,
                      date: lastMessage.date,
                      snippet: lastMessage.snippet,
                      text: lastMessage.text,
                      html: lastMessage.html,
                    },
                    messages: validMessages,
                    messageCount: validMessages.length,
                    isInbox: allLabelIds.includes("INBOX"),
                    isSent: allLabelIds.includes("SENT"),
                    isDraft: allLabelIds.includes("DRAFT"),
                    labelIds: allLabelIds,
                  };

                  allThreadsMap.set(threadId, thread);
                } catch (threadErr: any) {
                  // Handle insufficient scopes error gracefully
                  const errorMessage = threadErr.message || String(threadErr) || "";
                  const isInsufficientScopes = 
                    threadErr.code === 403 && 
                    (errorMessage.toLowerCase().includes("insufficient") || 
                     errorMessage.toLowerCase().includes("authentication scopes") ||
                     errorMessage.toLowerCase().includes("scope"));
                  
                  if (isInsufficientScopes) {
                    usersWithInsufficientScopes.add(userId);
                    console.warn(`[GET /api/gmail/emails] ⚠️ INSUFFICIENT SCOPES: User ${userId} does not have required Gmail API scopes to fetch thread ${threadRef.id}. User needs to re-authenticate with additional scopes.`);
                    continue;
                  }
                  console.error(`[GET /api/gmail/emails] Error fetching thread ${threadRef.id} for userId: ${userId}:`, errorMessage);
                }
              }
            } catch (queryErr: any) {
              // Handle insufficient scopes error gracefully
              const errorMessage = queryErr.message || String(queryErr) || "";
              const isInsufficientScopes = 
                queryErr.code === 403 && 
                (errorMessage.toLowerCase().includes("insufficient") || 
                 errorMessage.toLowerCase().includes("authentication scopes") ||
                 errorMessage.toLowerCase().includes("scope"));
              
              if (isInsufficientScopes) {
                usersWithInsufficientScopes.add(userId);
                console.warn(`[GET /api/gmail/emails] ⚠️ INSUFFICIENT SCOPES: User ${userId} does not have required Gmail API scopes to fetch ${label} emails. User needs to re-authenticate with additional scopes (gmail.readonly or gmail scope).`);
                // Continue processing other queries/users
                continue;
              }
              console.error(`[GET /api/gmail/emails] Error fetching ${label} threads for userId: ${userId}:`, errorMessage);
            }
          }
        } catch (err: any) {
          console.error(`[GET /api/gmail/emails] Error fetching Gmail emails for userId: ${userId}`, err);
        }
      })
    );

    // Log users with insufficient scopes
    if (usersWithInsufficientScopes.size > 0) {
      const userIds = Array.from(usersWithInsufficientScopes);
      console.error(`[GET /api/gmail/emails] ⚠️ SUMMARY: ${usersWithInsufficientScopes.size} user(s) have insufficient Gmail API scopes and cannot fetch emails:`);
      userIds.forEach((uid) => {
        console.error(`[GET /api/gmail/emails]   - User ID: ${uid} - Needs to re-authenticate with gmail.readonly or gmail scope`);
      });
    }

    // Convert threads map to array and sort by last message date
    const threadsArray = Array.from(allThreadsMap.values());
    threadsArray.sort((a, b) => {
      const dateA = new Date(a.lastMessage.date || 0).getTime();
      const dateB = new Date(b.lastMessage.date || 0).getTime();
      return dateB - dateA; // Most recent first
    });

    // Early return if no threads found
    if (threadsArray.length === 0) {
      console.log("[GET /api/gmail/emails] No Gmail emails found matching the criteria (exact senderEmail, subject, and date).");
      return NextResponse.json({
        success: true,
        data: [],
        threads: [],
        count: 0,
        message: "No Gmail emails found matching the criteria",
        usersWithInsufficientScopes: usersWithInsufficientScopes.size > 0 ? Array.from(usersWithInsufficientScopes) : undefined,
        gmailTokenExpired: gmailTokenExpired,
      });
    }

    // Log final results
    console.log("[GET /api/gmail/emails] Final threads count:", threadsArray.length);
    console.log("[GET /api/gmail/emails] Final threads:", JSON.stringify(threadsArray, null, 2));

    return NextResponse.json({
      success: true,
      data: threadsArray,
      threads: threadsArray,
      count: threadsArray.length,
      usersWithInsufficientScopes: usersWithInsufficientScopes.size > 0 ? Array.from(usersWithInsufficientScopes) : undefined,
      gmailTokenExpired: gmailTokenExpired,
    });
  } catch (err: any) {
    console.error("[GET /api/gmail/emails] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch Gmail emails" },
      { status: 500 }
    );
  }
}