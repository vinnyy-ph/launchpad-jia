import backendAuthCheck from "../../../../../lib/firebase/backendAuthCheck";
import {
  exchangeMicrosoftCode,
  getMicrosoftUser,
} from "../../../../../lib/data/microsoftAuth";
import connectMongoDB from "../../../../../lib/mongoDB/mongoDB";
import { encrypt } from "../../../../../lib/utils/cryptography";
import { toIdString } from "../../../../../lib/utils/dataTransform";
import { NextRequest, NextResponse } from "next/server";

interface ErrProps {
  message?: string;
  status?: number;
}

function throwHttpError(message: string, status: number) {
  const error = new Error(message);
  (error as any).status = status;
  return error;
}

export async function GET(request: NextRequest) {
  return handleCallback(request, "GET");
}

export async function POST(request: NextRequest) {
  return handleCallback(request, "POST");
}

async function handleCallback(request: NextRequest, method: "GET" | "POST") {
  try {
    let code: string | null;
    let state: string | null;

    if (method === "GET") {
      const { searchParams } = new URL(request.url);
      code = searchParams.get("code");
      state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Check for errors from Microsoft
      if (error) {
        throw throwHttpError(
          `Microsoft OAuth error: ${error}. ${errorDescription || "Please check your Azure app registration settings and ensure the redirect URI is correctly configured."}`,
          400,
        );
      }
    } else {
      const body = await request.json();
      code = body.code;
      state = body.state;
    }

    if (!code || !state) {
      throw throwHttpError(
        "Missing authorization code or state. Please try again from Settings.",
        400,
      );
    }

    let parsedState: { token: string; orgID: string };
    try {
      parsedState = JSON.parse(decodeURIComponent(state));
    } catch {
      throw throwHttpError("Invalid state parameter.", 400);
    }

    const { token, orgID } = parsedState;
    const decodedToken = await backendAuthCheck(token);

    if (!decodedToken) {
      throw throwHttpError(
        "Unauthorized. Please verify your credentials.",
        401,
      );
    }

    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    if (!redirectUri) {
      throw throwHttpError("Microsoft redirect URI is not configured.", 500);
    }

    const { db } = await connectMongoDB();
    const emailSettingsModel = db.collection("email-settings");
    const membersModel = db.collection("members");

    const isMember = await membersModel.findOne({
      orgID: toIdString(orgID),
      email: decodedToken.email,
    });

    if (!isMember) {
      throw throwHttpError(
        "Forbidden. You do not have the required permissions.",
        403,
      );
    }

    const tokens = await exchangeMicrosoftCode(code, redirectUri);
    const hasOutlookAccount = await fetch(
      "https://graph.microsoft.com/v1.0/me/mailboxSettings",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );
    if (hasOutlookAccount.status !== 200) {
      if (hasOutlookAccount.status !== 200) {
        throw throwHttpError(
          "Outlook mailbox not found. Please check your account or contact your admin.",
          403,
        );
      }
    }
    const userInfo = await getMicrosoftUser(tokens.access_token);

    const outlookEmail =
      userInfo.mail || userInfo.userPrincipalName || decodedToken.email;

    if (outlookEmail.includes("gmail.com")) {
      throw throwHttpError(
        "Microsoft Outlook account required. Personal Gmail accounts are not supported.",
        403,
      );
    }

    const userPayload = {
      name: userInfo.displayName,
      email: outlookEmail,
      picture: userInfo.picture || "",
    };

    const encryptTokens = encrypt(
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        expires_at: Date.now() + tokens.expires_in * 1000,
      }),
    );

    if (!encryptTokens) {
      throw throwHttpError("Failed to encrypt tokens.", 500);
    }

    const date = new Date().toISOString();

    await emailSettingsModel.updateOne(
      { orgID: toIdString(orgID), userID: toIdString(isMember._id) },
      {
        $set: {
          orgID: toIdString(orgID),
          userID: toIdString(isMember._id),
          outlookTokens: encryptTokens,
          outlookEmail,
          outlookDateSync: date,
          outlookConnected: true,
          outlookUser: userPayload,
          enableOutlookSending: true,
          dateUpdated: new Date().toString(),
        },
      },
      { upsert: true },
    );

    const clientPayload = {
      outlookEmail,
      outlookConnected: true,
      outlookDateSync: date,
      outlookUser: userPayload,
      enableOutlookSending: true,
    };

    const safeClientPayload = JSON.stringify(clientPayload).replace(
      /<\/script>/g,
      "<\\/script>",
    );

    return new NextResponse(
      `<!DOCTYPE html>
       <html>
         <body>
           <script>
             const clientPayload = ${safeClientPayload};
             if (window.opener) {
               window.opener.postMessage(
                 { type: "MICROSOFT_OAUTH_PAYLOAD", clientPayload },
                 window.location.origin
               );
             }
             window.close();
           </script>
         </body>
       </html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  } catch (err: unknown) {
    const error = err as ErrProps;
    return NextResponse.json(
      {
        error:
          error?.message ||
          "An unexpected error occurred. Please try again later.",
      },
      { status: (error as any)?.status ?? 500 },
    );
  }
}
