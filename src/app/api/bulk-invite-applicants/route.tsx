import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { sendEmail } from "../../../lib/Email";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { orgID, emails } = await request.json();
    if (!orgID || !emails) {
        return NextResponse.json({ error: "OrgID and emails are required" }, { status: 400 });
    }

    try {
        const { db } = await connectMongoDB();
        const applicants = await db.collection("applicants").find({ email: { $in: emails } }).toArray();
        
        await Promise.all(applicants.map((applicant: any) => sendEmail({
            recipient: applicant.email,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(to bottom, #4f04b9f0, #b79fcf76); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Jia</h1>
    </div>
    
    <div style="background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
        Dear ${applicant.name},
      </p>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
        We are pleased to invite you to join Jia and create an account. To get started, please click the button below to create your account:
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}" 
           style="background: #4f04b9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Click Here to Login
        </a>
      </div>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
        If you have any questions or need assistance, please don't hesitate to contact us.
      </p>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333333;">
        Best regards,<br>
        The Jia Team
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 20px; color: #666666; font-size: 14px;">
      <p>This is an automated message, please do not reply directly to this email.</p>
    </div>
  </div>
            `,
        })));
        return NextResponse.json({ message: "Applicants bulk invited successfully" }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to bulk invite applicants" }, { status: 500 });
    }
});