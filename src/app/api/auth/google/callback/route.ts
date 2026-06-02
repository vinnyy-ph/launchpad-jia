import { getOAuth2Client } from "@/lib/data/google";
import backendAuthCheck from "../../../../../lib/firebase/backendAuthCheck";
import connectMongoDB from "../../../../../lib/mongoDB/mongoDB";
import { encrypt } from "../../../../../lib/utils/cryptography";
import { toIdString } from "../../../../../lib/utils/dataTransform";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { EmailSettingsProps } from "@/lib/types/email.type";
import { GmailScopes } from "@/lib/data/googleScope";

interface ErrProps {
  message?: string;
  status?: number;
}

interface SettingsProps {
  enableGmailSending: boolean;
  preference: "system" | "gmail";
  connected: boolean;
  dateCreated: string;
}

interface EmailSettingsPayloadProps extends SettingsProps {
  tokens: string;
  dateUpdated: string;
  orgID: string;
  userID: string;
}

interface ThrowHttpErrorProps {
  message: string;
  status: number;
}

function throwHttpError({ message, status }: ThrowHttpErrorProps) {
  const error = new Error(message);
  (error as any).status = status;
  return error;
}

export async function GET(request: NextRequest) {
  try {
    // PARAMETERS
    const { searchParams } = new URL(request.url);

    // VALIDATION
    const code = searchParams.get("code");
    if (!code) {
      throw throwHttpError({
        message: "Authorization code is missing from Google OAuth callback.",
        status: 400,
      });
    }

    const state = searchParams.get("state");
    if (!state) {
      throw throwHttpError({
        message: "Missing state from Google OAuth callback.",
        status: 400,
      });
    }

    const { token, orgID } = JSON.parse(decodeURIComponent(state));
    const decodedToken = await backendAuthCheck(token);

    if (!decodedToken) {
      throw throwHttpError({
        message: "Unauthorized. Please verify your credentials.",
        status: 401,
      });
    }

    // DATABASE SETUP
    const { db } = await connectMongoDB();
    const emailSettingsModel = db.collection("email-settings");
    const membersModel = db.collection("members");

    // PERMISSION CHECKING
    const isMember = await membersModel.findOne({
      orgID: toIdString(orgID),
      email: decodedToken.email,
    });
    if (!isMember) {
      throw throwHttpError({
        message: "Forbidden. You do not have the required permissions.",
        status: 403,
      });
    }

    // IMPLEMENTATION
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
    const userInfo = (await oauth2.userinfo.get()).data;

    if (decodedToken.email != userInfo.email) {
      throw throwHttpError({
        message: "Forbidden. You do not have the required permissions.",
        status: 403,
      });
    }

    const encryptTokens = encrypt(JSON.stringify(tokens));
    if (!encryptTokens) {
      throw throwHttpError({
        message: "Failed to encrypt tokens.",
        status: 500,
      });
    }

    const date = new Date().toString();
    const emailSettingsPayload: EmailSettingsPayloadProps = {
      tokens: encryptTokens,
      dateCreated: date,
      dateUpdated: date,
      orgID: toIdString(orgID),
      userID: toIdString(isMember._id),
      enableGmailSending: true,
      preference: "gmail",
      connected: true,
    };

    const settings = await emailSettingsModel.findOneAndUpdate(
      { orgID: toIdString(orgID), userID: toIdString(isMember._id) },
      { $set: emailSettingsPayload },
      { returnDocument: "after", upsert: true }
    );

    const clientPayload: EmailSettingsProps = {
      user: {
        name: isMember.name,
        email: isMember.email,
        picture: isMember.image,
      },
      connected: true,
      dateSync: date,
      enableGmailSending: true,
      permission: GmailScopes,
      preferGmail: settings.preference === "gmail",
      signature: settings?.signature,
    };

    const safeClientPayload = JSON.stringify(clientPayload).replace(
      /<\/script>/g,
      "<\\/script>"
    );

    return new NextResponse(
      `<!DOCTYPE html>
       <html>
         <body>
           <script>
             const clientPayload = ${safeClientPayload};
             if (window.opener) {
               window.opener.postMessage(
                 { type: "GOOGLE_OAUTH_PAYLOAD", clientPayload },
                 window.location.origin
               );
             }
             window.close();
           </script>
         </body>
       </html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err: unknown) {
    const error = err as ErrProps;
    return NextResponse.json(
      {
        error:
          error?.message ||
          "An unexpected error occurred. Please try again later.",
      },
      { status: error?.status || 500 }
    );
  }
}
