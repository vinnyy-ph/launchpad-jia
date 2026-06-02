import Mailgun from "mailgun.js";
import formData from "form-data";
import connectMongoDB from "./mongoDB/mongoDB";

export async function sendEmail({
  recipient,
  html,
  text,
  subject = "JIA Update: Your Application Has Been Successfully Updated",
  orgID,
}: {
  recipient: string;
  html?: string;
  text?: string;
  subject?: string;
  orgID?: string | null;
}) {
  const mailgun = new Mailgun(formData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY,
  });

  try {
    const messageData: any = {
      from: "noreply@hellojia.ai",
      to: [recipient],
      subject: subject,
    };

    // Add either HTML or text content
    if (html) {
      messageData.html = html;
    }
    if (text) {
      messageData.text = text;
    }

    const msg = await mg.messages.create("hellojia.ai", messageData);

    console.log(msg);

    // Save email record to database
    if (orgID) {
      try {
        const { db } = await connectMongoDB();
        const emailRecord = {
          from: messageData.from,
          to: [recipient],
          subject: subject,
          message: html || text || null,
          orgID: orgID || null,
          sentBy: null,
          sentByUserId: null,
          sentByGmail: null,
          CareerId: null,
          mailgunId: null,
          status: "sent",
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          type: "automated",
        };

        await db.collection("email-noreply").insertOne(emailRecord);
        console.log("Email saved to database:", emailRecord);
      } catch (dbError) {
        console.error("Error saving email record to database:", dbError);
      }
    }
    return {
      success: true,
      message: "Email sent successfully",
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: "Email sending failed",
    };
  }
}
