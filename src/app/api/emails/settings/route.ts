import backendAuthCheck from "../../../../lib/firebase/backendAuthCheck";
import connectMongoDB from "../../../../lib/mongoDB/mongoDB";
import { getOAuth2Client } from "../../../../lib/data/google";
import { decrypt, encrypt } from "../../../../lib/utils/cryptography";
import { toIdString } from "../../../../lib/utils/dataTransform";
import { DecodedIdToken } from "firebase-admin/auth";
import { Collection } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { GmailScopes } from "@/lib/data/googleScope";

interface EmailSettingsProps {
  orgID: string;
  enableGmailSending: boolean;
  preference: "system" | "gmail";
  connected: boolean;
  signature: string;
  dateCreated: string;
}

interface ErrProps {
  message?: string;
  status?: number;
}

interface TokenProps {
  access_token: string;
  expiry_date: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

interface VerifyProps {
  decodedToken: DecodedIdToken;
  emailSettingsModel: Collection;
  membersModel: Collection;
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

function validateBody(body: Record<string, any>) {
  const allowedKeys: Record<string, string> = {
    orgID: "string",
    enableGmailSending: "boolean",
    preference: "string",
    connected: "boolean",
    signature: "string",
    dateCreated: "string",
    outlookConnected: "boolean",
    outlookEmail: "string",
    outlookDateSync: "string",
    outlookUser: "object",
    outlookTokens: "string",
    enableOutlookSending: "boolean",
    user: "object",
    tokens: "string",
    permission: "string",
    preferGmail: "boolean",
    dateSync: "string",
  };

  const extraKeys = Object.keys(body).filter((key) => !(key in allowedKeys));
  if (extraKeys.length > 0) {
    throw throwHttpError({
      message: `Invalid request body: ${extraKeys.join(", ")}`,
      status: 400,
    });
  }

  for (const key of Object.keys(body)) {
    const value = body[key];

    if (value === undefined) continue;

    if (key === "preference" && value !== "system" && value !== "gmail") {
      throw throwHttpError({
        message: "Invalid request body",
        status: 400,
      });
    }

    if (
      (key === "dateCreated" ||
        key === "dateSync" ||
        key === "outlookDateSync") &&
      typeof value === "string" &&
      isNaN(Date.parse(value))
    ) {
      throw throwHttpError({
        message: "Invalid request body",
        status: 400,
      });
    }

    const expectedType = allowedKeys[key];
    if (
      expectedType === "string" &&
      typeof value !== "string" &&
      value !== null
    ) {
      throw throwHttpError({
        message: "Invalid request body",
        status: 400,
      });
    }
    if (expectedType === "boolean" && typeof value !== "boolean") {
      throw throwHttpError({
        message: "Invalid request body",
        status: 400,
      });
    }
    if (
      expectedType === "object" &&
      value !== null &&
      typeof value !== "object"
    ) {
      throw throwHttpError({
        message: "Invalid request body",
        status: 400,
      });
    }
  }
}

async function verify(request: NextRequest): Promise<VerifyProps> {
  try {
    // TOKEN VALIDATION
    let token = request.headers.get("Authorization");
    // Remove "Bearer " prefix if present
    if (token && token.startsWith("Bearer ")) {
      token = token.slice(7);
    }
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

    return { decodedToken, emailSettingsModel, membersModel };
  } catch (err) {
    const error = err as ErrProps;
    throw throwHttpError({
      message:
        error?.message ||
        "An unexpected error occurred. Please try again later.",
      status: error?.status || 500,
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { decodedToken, emailSettingsModel, membersModel } =
      await verify(request);

    // PARAMETERS
    const url = new URL(request.url);
    const orgID = url.searchParams.get("orgID");
    const { email } = decodedToken;

    // PERMISSION CHECKING
    const isMember = await membersModel.findOne({
      orgID: toIdString(orgID),
      email,
    });
    if (!isMember) {
      throw throwHttpError({
        message: "Forbidden. You do not have the required permissions.",
        status: 403,
      });
    }

    // IMPLEMENTATION
    const [emailSettings] = await emailSettingsModel
      .aggregate([
        {
          $match: {
            orgID: toIdString(orgID),
            userID: toIdString(isMember._id),
          },
        },
        {
          $addFields: {
            userID: { $toObjectId: "$userID" },
            preferGmail: {
              $cond: [{ $eq: ["$preference", "gmail"] }, true, false],
            },
            dateSync: "$dateCreated",
          },
        },
        {
          $lookup: {
            from: "members",
            localField: "userID",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user" } },
        {
          $project: {
            _id: 0,
            enableGmailSending: 1,
            preferGmail: 1,
            connected: 1,
            dateSync: 1,
            signature: 1,
            outlookEmail: 1,
            outlookConnected: 1,
            outlookDateSync: 1,
            outlookUser: 1,
            enableOutlookSending: 1,
            user: {
              name: "$user.name",
              picture: "$user.image",
              email: "$user.email",
            },
          },
        },
      ])
      .toArray();

    if (emailSettings) {
      emailSettings["permission"] = GmailScopes;
    }

    return NextResponse.json({ emailSettings }, { status: 200 });
  } catch (err: unknown) {
    const error = err as ErrProps;
    return NextResponse.json(
      {
        error:
          error?.message ||
          "An unexpected error occurred. Please try again later.",
      },
      { status: error?.status || 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { decodedToken, emailSettingsModel, membersModel } =
      await verify(request);

    // PARAMETERS
    const { email } = decodedToken;
    const body: Partial<EmailSettingsProps> = await request.json();

    validateBody(body);

    // PERMISSION CHECKING
    const isMember = await membersModel.findOne({
      orgID: toIdString(body.orgID),
      email,
    });
    if (!isMember) {
      throw throwHttpError({
        message: "Forbidden. You do not have the required permissions.",
        status: 403,
      });
    }

    // IMPLEMENTATION
    await emailSettingsModel.updateOne(
      { orgID: toIdString(body.orgID), userID: toIdString(isMember._id) },
      {
        $set: {
          ...body,
          userID: toIdString(isMember._id),
          dateUpdated: new Date().toString(),
        },
      },
      { upsert: true },
    );

    return NextResponse.json(
      { message: "Email settings successfully updated." },
      { status: 200 },
    );
  } catch (err: unknown) {
    const error = err as ErrProps;
    return NextResponse.json(
      {
        error:
          error?.message ||
          "An unexpected error occurred. Please try again later.",
      },
      { status: error?.status || 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { decodedToken, emailSettingsModel, membersModel } =
      await verify(request);

    // PARAMETERS
    const { email } = decodedToken;
    const body: Partial<EmailSettingsProps> = await request.json();

    validateBody(body);

    // PERMISSION CHECKING
    const isMember = await membersModel.findOne({
      orgID: toIdString(body.orgID),
      email,
    });
    if (!isMember) {
      throw throwHttpError({
        message: "Forbidden. You do not have the required permissions.",
        status: 403,
      });
    }

    // IMPLEMENTATION
    await emailSettingsModel.replaceOne(
      {
        orgID: toIdString(body.orgID),
        userID: toIdString(isMember._id),
      },
      {
        ...body,
        userID: toIdString(isMember._id),
        dateUpdated: new Date().toString(),
      },
    );

    return NextResponse.json(
      { message: "Email settings successfully updated." },
      { status: 200 },
    );
  } catch (err: unknown) {
    const error = err as ErrProps;
    return NextResponse.json(
      {
        error:
          error?.message ||
          "An unexpected error occurred. Please try again later.",
      },
      { status: error?.status || 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { decodedToken, emailSettingsModel, membersModel } =
      await verify(request);

    // PARAMETERS
    const { email } = decodedToken;
    const body = await request.json();

    // validateBody(body);

    // PERMISSION CHECKING
    const isMember = await membersModel.findOne({
      orgID: toIdString(body.orgID),
      email,
    });
    if (!isMember) {
      throw throwHttpError({
        message: "Forbidden. You do not have the required permissions.",
        status: 403,
      });
    }

    // IMPLEMENTATION
    const emailSettings = await emailSettingsModel.findOne({
      orgID: toIdString(body.orgID),
      userID: toIdString(isMember._id),
    });

    if (!body.user) {
      await emailSettingsModel.updateOne(
        { orgID: toIdString(body.orgID), userID: toIdString(isMember._id) },
        {
          $set: {
            orgID: toIdString(body.orgID),
            userID: toIdString(isMember._id),
            connected: body.connected,
            dateCreated: body.dateSync,
            enableGmailSending: body.enableGmailSending,
            preference: body.preferGmail,
            tokens: null,
            dateUpdated: new Date().toString(),
            signature: body.signature,
          },
        },
        { upsert: true },
      );

      return NextResponse.json(
        { message: "Email settings successfully updated." },
        { status: 200 },
      );
    }

    if (emailSettings && emailSettings.dateCreated != body.dateSync) {
      const decryptTokens = decrypt(emailSettings.tokens);
      if (!decryptTokens) {
        throw throwHttpError({
          message: "Required configuration not found",
          status: 404,
        });
      }

      let parsedTokens: TokenProps | null = null;

      try {
        parsedTokens = JSON.parse(decryptTokens);
      } catch (err) {
        throw throwHttpError({
          message: "Required configuration not found",
          status: 404,
        });
      }

      if (!parsedTokens) {
        throw throwHttpError({
          message: "Required configuration not found",
          status: 404,
        });
      }

      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        refresh_token: parsedTokens.refresh_token,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      if (!credentials) {
        throw throwHttpError({
          message: "Required configuration not found",
          status: 404,
        });
      }

      const encrypTokens = encrypt(JSON.stringify(credentials));
      if (!encrypTokens) {
        throw throwHttpError({
          message: "Required configuration not found",
          status: 404,
        });
      }

      if (!body.dateSync) {
        throw throwHttpError({
          message: "Required configuration not found",
          status: 404,
        });
      }
      await emailSettingsModel.updateOne(
        { orgID: toIdString(body.orgID), userID: toIdString(isMember._id) },
        {
          $set: {
            tokens: encrypTokens,
            dateCreated: body.dateSync.toString(),
            dateUpdated: new Date().toString(),
          },
        },
      );
    } else {
      let data: any = { signature: body.signature };

      if (typeof body.connected == "boolean") {
        data = { ...data, connected: body.connected };
      }

      if (typeof body.connected == "boolean") {
        data = { ...data, enableGmailSending: body.enableGmailSending };
      }

      if (typeof body.connected == "boolean") {
        data = { ...data, preference: body.preferGmail ? "gmail" : "system" };
      }

      // Outlook settings
      if (typeof body.enableOutlookSending === "boolean") {
        data = { ...data, enableOutlookSending: body.enableOutlookSending };
      }

      if (typeof body.outlookConnected === "boolean") {
        data = { ...data, outlookConnected: body.outlookConnected };
      }

      if (body.outlookEmail !== undefined) {
        data = { ...data, outlookEmail: body.outlookEmail };
      }

      if (body.outlookDateSync !== undefined) {
        data = { ...data, outlookDateSync: body.outlookDateSync };
      }

      if (body.outlookUser !== undefined) {
        data = { ...data, outlookUser: body.outlookUser };
      }

      if (body.outlookTokens !== undefined) {
        data = { ...data, outlookTokens: body.outlookTokens };
      }

      await emailSettingsModel.updateOne(
        { orgID: toIdString(body.orgID), userID: toIdString(isMember._id) },
        {
          $set: {
            ...data,
            orgID: toIdString(body.orgID),
            userID: toIdString(isMember._id),
            dateUpdated: new Date().toString(),
          },
        },
        { upsert: true },
      );
    }

    return NextResponse.json(
      { message: "Email settings successfully updated." },
      { status: 200 },
    );
  } catch (err: unknown) {
    const error = err as ErrProps;
    return NextResponse.json(
      {
        error:
          error?.message ||
          "An unexpected error occurred. Please try again later.",
      },
      { status: error?.status || 500 },
    );
  }
}
