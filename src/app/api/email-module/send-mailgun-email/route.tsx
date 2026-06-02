import { NextResponse } from "next/server";
import Mailgun from "mailgun.js";
import formData from "form-data";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const { from, to, subject, message, html, orgID, metadata, CareerId, sentByGmail } = await request.json();
        // console.warn("================================================");
        // console.log("metadata: ", metadata);
        // console.warn("================================================");
        // Validate required parameters
        if (!from || !to || !subject) {
            console.error("[send-mailgun-email] Missing required data: from, to, or subject");
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required data",
                },
                { status: 400 }
            );
        }

        // Validate that at least one of message, html,  is provided
        if (!message && !html) {
            console.error("[send-mailgun-email] Missing required data: message or html");
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required data",
                },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(from)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid 'from' email format",
                },
                { status: 400 }
            );
        }

        // Validate 'to' email(s) - can be string or array
        const toArray = Array.isArray(to) ? to : [to];
        for (const email of toArray) {
            if (!emailRegex.test(email)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid 'to' email format: ${email}`,
                    },
                    { status: 400 }
                );
            }
        }

        // Initialize Mailgun
        const mailgun = new Mailgun(formData);
        const mg = mailgun.client({
            username: "api",
            key: process.env.MAILGUN_API_KEY,
        });

        // Prepare message data
        const messageData: any = {
            from: from,
            to: Array.isArray(to) ? to : [to],
            subject: subject,
        };

        // Add message content (prioritize html, then message)
        if (html) {
            messageData.html = html;
        } else if (message) {
            // If only message is provided, use it as HTML
            messageData.html = message;
        }

        // Send email via Mailgun
        const mailgunResponse = await mg.messages.create("hellojia.ai", messageData);

        // Prepare email record for database
        const emailRecord = {
            from: from.toLowerCase(),
            to: Array.isArray(to) ? to.map((email: string) => email.toLowerCase()) : [to.toLowerCase()],
            subject: subject,
            message: message ||html || null,
            orgID: orgID || null,
            sentBy: request.user?.email || null,
            sentByUserId: request.user?.uid || null,
            sentByGmail: sentByGmail || null,
            CareerId: CareerId || null,
            mailgunId: mailgunResponse.id || null,
            status: "sent",
            metadata: metadata || {},
            type: "direct",
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Save email record to database
        // let savedRecord = null;
        try {
            const { db } = await connectMongoDB();
            const result = await db.collection("email-noreply").insertOne(emailRecord);
            // savedRecord = await db.collection("email-noreply").findOne({ _id: result.insertedId });
        } catch (dbError) {
            console.error("Error saving email record to database:", dbError);
            // Continue even if database save fails
        }

        return NextResponse.json({
            success: true,
            message: "Email sent successfully",
            mailgunId: mailgunResponse.id,
            // emailRecord: savedRecord,
        });
    } catch (error: any) {
        console.error("Error in send-mailgun-email endpoint:", error);

        // Prepare error email record for database (if we have the data)
        try {
            const { from, to, subject, orgID, CareerId, sentByGmail } = await request.json();

            if (from && to && subject) {
                const { db } = await connectMongoDB();
                const toArray = Array.isArray(to) ? to : [to];
                await db.collection("email-noreply").insertOne({
                    from: typeof from === 'string' ? from.toLowerCase() : null,
                    to: toArray.map((email: string) =>
                        typeof email === 'string' ? email.toLowerCase() : email
                    ),
                    subject: subject || null,
                    status: "failed",
                    error: error.message || "Unknown error",
                    orgID: orgID || null,
                    sentBy: request.user?.email || null,
                    sentByGmail: sentByGmail || null,
                    CareerId: CareerId || null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }
        } catch (dbError) {
            console.error("Error saving failed email record:", dbError);
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message || "Failed to send email",
            },
            { status: 500 }
        );
    }
});

