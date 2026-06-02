import backendAuthCheck from "../../../../lib/firebase/backendAuthCheck";
import connectMongoDB from "../../../../lib/mongoDB/mongoDB";
import { toIdString, toObjectId } from "../../../../lib/utils/dataTransform";
import { DecodedIdToken } from "firebase-admin/auth";
import { Collection } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

interface ErrProps {
  message?: string;
  status?: number;
}

interface TemplateProps {
  templateID: string;
  template_name: string;
  subject: string;
  message: string;
  orgID: String;
  type: "User" | "Global" | "System";
  dateUpdated: string;
  creator: {
    email?: string;
    id?: string;
    name: string;
    picture: string;
    role: string;
  };
  // Schedule sending fields (optional)
  enable_schedule_send?: string;
  schedule_delay?: string;
  schedule_delay_unit?: string;
  // Preferred time fields (optional)
  enable_preferred_time?: string;
  preferred_time?: string;
  // Copy flag (optional)
  is_copy?: boolean;
}

interface TemplatePayloadProps extends TemplateProps {
  creatorID: string;
  dateCreated: string;
  dateUpdated: string;
  is_copy?: boolean;
}

interface ThrowHttpErrorProps {
  message: string;
  status: number;
}

interface VerifyProps {
  decodedToken: DecodedIdToken;
  emailTemplatesModel: Collection;
  membersModel: Collection;
}

function throwHttpError({ message, status }: ThrowHttpErrorProps) {
  const error = new Error(message);
  (error as any).status = status;
  return error;
}

function validateBody(body: Record<string, any>) {
  const allowedKeys: Record<keyof TemplateProps, string> = {
    templateID: "string",
    template_name: "string",
    subject: "string",
    message: "string",
    orgID: "string",
    type: "string",
    dateUpdated: "string",
    creator: "object",
    enable_schedule_send: "string",
    schedule_delay: "string",
    schedule_delay_unit: "string",
    enable_preferred_time: "string",
    preferred_time: "string",
    is_copy: "boolean",
  };

  const extraKeys = Object.keys(body).filter((key) => !(key in allowedKeys));
  if (extraKeys.length > 0) {
    throw throwHttpError({
      message: "Invalid request body",
      status: 400,
    });
  }

  for (const key of Object.keys(body) as (keyof TemplateProps)[]) {
    const value = body[key];

    if (value === undefined) continue;

    if (
      key === "type" &&
      value !== "User" &&
      value !== "Global" &&
      value !== "System"
    ) {
      throw throwHttpError({
        message: "Invalid request body",
        status: 400,
      });
    }

    const expectedType = allowedKeys[key];
    if (expectedType === "string" && typeof value !== "string") {
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
  }
}

async function verify(request: NextRequest): Promise<VerifyProps> {
  try {
    // TOKEN VALIDATION - Firebase verifyIdToken expects raw JWT; client may send "Bearer <token>" or raw token
    const authHeader = request.headers.get("Authorization");
    const token =
      authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : (authHeader?.trim() ?? "");
    const decodedToken = await backendAuthCheck(token || null);
    if (!decodedToken) {
      throw throwHttpError({
        message: "Unauthorized. Please verify your credentials.",
        status: 401,
      });
    }

    // DATABASE SETUP
    const { db } = await connectMongoDB();
    const emailTemplatesModel = db.collection("email-templates");
    const membersModel = db.collection("members");

    return { decodedToken, emailTemplatesModel, membersModel };
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
    const { decodedToken, emailTemplatesModel, membersModel } = await verify(
      request
    );

    // PARAMETERS
    const url = new URL(request.url);
    const orgID = url.searchParams.get("orgID");
    const includeAllOrgTemplates =
      url.searchParams.get("includeAllOrgTemplates") === "true";
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
    const templates = await emailTemplatesModel
      .aggregate([
        {
          $match: {
            $or: [
              includeAllOrgTemplates
                ? {
                    type: "User",
                    orgID: toIdString(orgID),
                  }
                : { type: "User", creatorID: toIdString(isMember._id) },
              {
                type: "Global",
                orgID: toIdString(orgID),
              },
              {
                type: "System",
              },
            ],
          },
        },
        {
          $addFields: {
            creatorID: { $toObjectId: "$creatorID" },
          },
        },
        {
          $lookup: {
            from: "members",
            localField: "creatorID",
            foreignField: "_id",
            as: "creator",
          },
        },
        { $unwind: { path: "$creator" } },
        {
          $project: {
            _id: 0,
            template_id: { $toString: "$_id" },
            template_name: 1,
            subject: 1,
            message: 1,
            creator: {
              email: "$creator.email",
              id: { $toString: "$creator._id" },
              name: "$creator.name",
              picture: "$creator.image",
              role: "$creator.role",
            },
            date_updated: "$dateUpdated",
            orgID: 1,
            type: 1,
            enable_schedule_send: 1,
            schedule_delay: 1,
            schedule_delay_unit: 1,
            enable_preferred_time: 1,
            preferred_time: 1,
            is_copy: 1,
          },
        },
      ])
      .toArray();

    return NextResponse.json({ templates }, { status: 200 });
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

export async function POST(request: NextRequest) {
  try {
    const { decodedToken, emailTemplatesModel, membersModel } = await verify(
      request
    );

    // PARAMETERS
    const { email } = decodedToken;
    const body: TemplateProps = await request.json();

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

    if (body.type == "Global" && isMember.role != "admin") {
      throw throwHttpError({
        message: "Forbidden. You do not have the required permissions.",
        status: 403,
      });
    }

    // IMPLEMENTATION
    const date = new Date().toString();
    const templatePayload: TemplatePayloadProps = {
      ...body,
      creatorID: toIdString(isMember._id),
      dateCreated: date,
      dateUpdated: date,
    };
    const data = await emailTemplatesModel.insertOne(templatePayload);

    return NextResponse.json(
      {
        message: "Email template successfully created",
        data: {
          template_id: toIdString(data.insertedId),
          date_updated: date,
          creator: {
            name: isMember.name,
            picture: isMember.image,
            role: isMember.role,
          },
        },
      },
      { status: 201 }
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

export async function DELETE(request: NextRequest) {
  try {
    const { decodedToken, emailTemplatesModel, membersModel } = await verify(
      request
    );

    // PARAMETERS
    const { email } = decodedToken;
    const body: TemplateProps = await request.json();

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

    const emailTemplates = await emailTemplatesModel.findOne({
      _id: toObjectId(body.templateID),
      orgID: toIdString(body.orgID),
    });
    if (!emailTemplates) {
      throw throwHttpError({
        message: "Email template not found.",
        status: 404,
      });
    }
    if (emailTemplates.type == "Global" && isMember.role != "admin") {
      throw throwHttpError({
        message: "Forbidden. You do not have the required permissions.",
        status: 403,
      });
    }

    // IMPLEMENTATION
    await emailTemplatesModel.deleteOne({
      _id: toObjectId(body.templateID),
      orgID: toIdString(body.orgID),
    });

    return NextResponse.json(
      {
        message: "Email template successfully deleted.",
      },
      { status: 200 }
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

export async function PATCH(request: NextRequest) {
  try {
    const { decodedToken, emailTemplatesModel, membersModel } = await verify(
      request
    );

    // PARAMETERS
    const { email } = decodedToken;
    const body: TemplateProps = await request.json();

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

    const emailTemplates = await emailTemplatesModel.findOne({
      _id: toObjectId(body.templateID),
      orgID: toIdString(body.orgID),
    });
    if (!emailTemplates) {
      throw throwHttpError({
        message: "Email template not found.",
        status: 404,
      });
    }
    if (emailTemplates.type == "Global" && isMember.role != "admin") {
      throw throwHttpError({
        message: "Forbidden. You do not have the required permissions.",
        status: 403,
      });
    }

    // IMPLEMENTATION
    const date = new Date().toString();
    const templatePayload: Partial<TemplatePayloadProps> = {
      template_name: body.template_name,
      subject: body.subject,
      message: body.message,
      dateUpdated: date,
    };

    // Add schedule fields if provided
    if (body.enable_schedule_send !== undefined) {
      templatePayload.enable_schedule_send = body.enable_schedule_send;
    }
    if (body.schedule_delay !== undefined) {
      templatePayload.schedule_delay = body.schedule_delay;
    }
    if (body.schedule_delay_unit !== undefined) {
      templatePayload.schedule_delay_unit = body.schedule_delay_unit;
    }
    if (body.enable_preferred_time !== undefined) {
      templatePayload.enable_preferred_time = body.enable_preferred_time;
    }
    if (body.preferred_time !== undefined) {
      templatePayload.preferred_time = body.preferred_time;
    }

    await emailTemplatesModel.updateOne(
      { _id: toObjectId(body.templateID), orgID: toIdString(body.orgID) },
      { $set: templatePayload }
    );

    return NextResponse.json(
      {
        message: "Email template successfully edited.",
        data: {
          dateUpdated: date,
        },
      },
      { status: 200 }
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
