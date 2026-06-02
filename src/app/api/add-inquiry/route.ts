import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { guid } from "@/lib/Utils";
import { sendEmail } from "@/lib/Email";

export async function POST(request: NextRequest) {
    const { email, message, firstName, lastName, phoneNumber, companyName, companySize, companyPosition, monthlyHiringVolume, recruiterCount, reasonForInquiry, sourceOfInquiry, customSourceOfInquiry, subscribeToNewsletter } = await request.json();

    try {
        const { db } = await connectMongoDB();

        const inquiry = {
            id: guid(),
            email,
            message,
            firstName,
            lastName,
            phoneNumber,
            companyName,
            companySize,
            companyPosition,
            monthlyHiringVolume,
            recruiterCount,
            reasonForInquiry,
            sourceOfInquiry,
            customSourceOfInquiry,
            subscribeToNewsletter,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        await db.collection("inquiries").insertOne(inquiry);

        // Email the inquiry to the admin
        await sendEmail({
            recipient: "contact@hirejia.ai",
            subject: "HireJia Inquiry",
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(to bottom, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">HireJia Inquiry</h1>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 10px;">
                New inquiry from ${firstName} ${lastName},
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 10px;">
            <b>Email:</b> <a href="mailto:${email}">${email}</a>
            <br />
            <b>Phone Number:</b> ${phoneNumber}
            <br />
            <b>Company Name:</b> ${companyName}
            <br />
            <b>Company Size:</b> ${companySize}
            <br />
            <b>Reason For Inquiry:</b> ${reasonForInquiry}
            <br />
            <b>Source Of Inquiry:</b> ${sourceOfInquiry}
            <br />
            ${customSourceOfInquiry ? `<b>Custom Source Of Inquiry:</b> ${customSourceOfInquiry}` : ""}
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 10px;">
            <b>Message:</b>
            <br />
            ${message}
            </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #666666; font-size: 14px;">
            <p>This is an automated message, please do not reply directly to this email.</p>
            </div>
        </div>
            `,
        })
        return NextResponse.json({ message: "Inquiry added" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: "Failed to add inquiry" }, { status: 500 });
    }
}