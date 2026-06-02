import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { sendEmail } from "@/lib/Email";
import backendAuthCheck from "@/lib/firebase/backendAuthCheck";
import { DecodedIdToken } from "firebase-admin/auth";
import { resolveTalentVaultForAuth } from "@/app/(talent-vault)/lib/server/findTalentVaultProfile";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Welcome email template for guests who just joined
function getGuestWelcomeTemplate(
  name: string,
  email: string,
  image: string,
  companyName: string,
  role: string,
  orgId: string
): string {
  const JIA_LOGO_URL = "https://cdn.hellojia.ai/public-assets/jia-logo-header.png";
  const GUEST_PORTAL_URL = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN
    ? `${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}/careers?orgId=${orgId}`
    : `http://localhost:3000/careers?orgId=${orgId}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Jia!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif; background-color: #F8F9FC; padding: 40px 20px; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8F9FC;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; padding: 24px;">
          <tr>
            <td align="center" style="background: linear-gradient(90deg, #A8C5E8 0%, #E8B5D0 100%); padding: 40px 24px; text-align: center; border-radius: 8px; height: 120px;">
              <img src="${JIA_LOGO_URL}" alt="Jia Logo" style="height: 60px; width: auto; display: block; margin: 0 auto;" />
            </td>
          </tr>
          
          <tr>
            <td style="padding: 24px; text-align: center;">
              <div style="margin: 24px 0;">
                <img src="${image}" alt="${name}" style="width: 80px; height: 80px; border-radius: 50%; display: block; margin: 0 auto; border: 3px solid #A8C5E8;" />
              </div>
              
              <h1 style="font-size: 28px; font-weight: 700; color: #1A1625; margin: 16px 0;">Welcome, ${name}! 🎉</h1>
              
              <p style="font-size: 16px; color: #717680; margin: 0 0 24px 0; line-height: 1.6;">
                You've successfully joined <strong>${companyName}</strong> as a <strong>${role}</strong> on Jia!
              </p>
              
              <div style="background-color: #F8F9FC; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: left;">
                <h3 style="font-size: 16px; font-weight: 600; color: #1A1625; margin: 0 0 12px 0;">Your Account Details:</h3>
                <p style="font-size: 14px; color: #717680; margin: 4px 0;"><strong>Name:</strong> ${name}</p>
                <p style="font-size: 14px; color: #717680; margin: 4px 0;"><strong>Email:</strong> ${email}</p>
                <p style="font-size: 14px; color: #717680; margin: 4px 0;"><strong>Role:</strong> ${role}</p>
                <p style="font-size: 14px; color: #717680; margin: 4px 0;"><strong>Organization:</strong> ${companyName}</p>
              </div>
              
              <p style="font-size: 16px; color: #717680; margin: 24px 0; line-height: 1.6;">
                You can now access the guest portal and explore available career opportunities!
              </p>
              
              <a href="${GUEST_PORTAL_URL}" style="display: inline-block; background-color: #181D27; color: #ffffff; padding: 12px 120px; border: 1px solid #999999; border-radius: 50px; text-decoration: none; font-size: 17px; font-weight: 550; margin: 16px 0;">Visit Guest Portal</a>
              
              <p style="font-size: 14px; color: #717680; margin: 24px 0 0 0; line-height: 1.6;">
                If you have any questions, feel free to reach out to our support team.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer outside card -->
        <div style="margin-top: 24px; text-align: center;">
          <div style="font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #717680;">© Jia</div>
          <p style="margin: 0; font-size: 12px; color: #717680;">Please do not reply to this email. This is a system generated email.</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header is required" },
        { status: 401 }
      );
    }

    // Handle Bearer token format
    const token = authHeader.startsWith("Bearer ") 
      ? authHeader.substring(7) 
      : authHeader;

    const decodeToken = await backendAuthCheck(token);

    if (!decodeToken) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { name, email, picture } = decodeToken as DecodedIdToken;

    // 1 & 2. Validate required fields and email format
    if (!name || !email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Invalid parameters. Name and a valid email are required." },
        { status: 400 }
      );
    }

    const image =
      picture || `https://api.dicebear.com/8.x/shapes/svg?seed=${encodeURIComponent(email)}`;

    const { db } = await connectMongoDB();

    // 3. Optimization: Parallelize user type lookups
    const [admin, orgMembers, applicant] = await Promise.all([
      db.collection("admins").findOne({ email }, { projection: { password: 0 } }),
      db.collection("members").aggregate([
        { $match: { email: email } },
        {
          $lookup: {
            from: "organizations",
            let: { orgIdStr: "$orgID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { 
                        $eq: [
                          "$_id", 
                          { 
                            $convert: { 
                              input: "$$orgIdStr", 
                              to: "objectId", 
                              onError: null, 
                              onNull: null 
                            } 
                          }
                        ] 
                      },
                      { $eq: ["$status", "active"] },
                    ],
                  },
                },
              },
              { $project: { name: 1, status: 1 } }
            ],
            as: "organizationDetails",
          },
        },
        { $unwind: "$organizationDetails" },
        {
          $addFields: {
            "organizationDetails.role": "$role",
            "organizationDetails.careers": "$careers",
          },
        },
      ]).toArray(),
      db.collection("applicants").findOne({ email })
    ]);

    if (admin) {
      await db.collection("admins").updateOne(
        { email: email },
        {
          $set: {
            name: name,
            image: image,
            lastSeen: new Date(),
          },
        }
      );

      const talentVaultSummary = await resolveTalentVaultForAuth(db, {
        applicantId: applicant?._id,
        email,
      }).catch((err: unknown) => {
        console.error("Talent vault resolution failed for admin:", err);
        return { status: "inactive" as const };
      });

      admin.talentVault = talentVaultSummary;

      return NextResponse.json(admin);
    }

    if (orgMembers.length > 0) {
      // 3. Optimization: Parallelize membership updates
      await Promise.all(orgMembers.map(async (member) => {
        const isFirstLogin = member.status === "invited" && !member.lastLogin;
        const now = new Date();

        const updateFields: any = {
          name: name,
          image: image,
          lastLogin: now,
        };

        if (isFirstLogin) {
          updateFields.status = "joined";
        }

        await db.collection("members").updateOne(
          { email: email, orgID: member.orgID },
          { $set: updateFields }
        );

        // Update local object for response
        member.lastLogin = now;
        member.name = name;
        member.image = image;
        if (isFirstLogin) {
          member.status = "joined";

          // Welcome email for guests (fire and forget)
          if (member.role === "guest") {
            const orgName = member.organizationDetails?.name || "the organization";
            const memberRole = member.organizationDetails?.role || member.role || "guest";
            
            sendEmail({
              recipient: email,
              html: getGuestWelcomeTemplate(name, email, image, orgName, memberRole, member.orgID),
              subject: `Welcome to Jia, ${name}! 🎉`,
            }).catch(err => console.error("Welcome email failed:", err));
          }
        }
      }));

      if (applicant) {
        let talentVaultSummary: Record<string, unknown> = { status: "inactive" };
        try {
          talentVaultSummary = await resolveTalentVaultForAuth(db, {
            applicantId: applicant._id,
            email,
          });
        } catch (err) {
          console.error("Talent vault resolution failed:", err);
        }

        orgMembers[0].talentVault = {
          ...(orgMembers[0].talentVault || {}),
          ...talentVaultSummary,
        };
      }

      // Return the first membership (frontend will handle org switching)
      return NextResponse.json(orgMembers[0]);
    }

    if (applicant) {
      const now = new Date();
      if (applicant.status === "invited") {
        // Update fields for new user
        await db.collection("applicants").updateOne(
          { _id: applicant._id },
          {
            $set: {
              name: name,
              image: image,
              lastSeen: now,
              status: "joined",
            },
          }
        );
        applicant.name = name;
        applicant.image = image;
        applicant.status = "joined";
      } else {
        await db.collection("applicants").updateOne(
          { _id: applicant._id },
          {
            $set: {
              lastSeen: now,
            },
          }
        );
      }

      const talentVaultSummary = await resolveTalentVaultForAuth(db, {
        applicantId: applicant._id,
        email,
      }).catch((err: unknown) => {
        console.error("Talent vault resolution failed for applicant:", err);
        return { status: "inactive" as const };
      });

      applicant.talentVault = {
        ...(applicant.talentVault || {}),
        ...talentVaultSummary,
      };

      applicant.lastSeen = now;
      return NextResponse.json(applicant);
    }

    // Handle new applicant registration
    const now = new Date();
    const newApplicantData = {
      email: email,
      name: name,
      image: image,
      createdAt: now,
      lastSeen: now,
      role: "applicant",
      status: "joined",
      talentVault: { status: "inactive" },
    };

    const insertResult = await db.collection("applicants").insertOne(newApplicantData);
    
    return NextResponse.json({
      ...newApplicantData,
      _id: insertResult.insertedId,
      isNew: true
    });

  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.json(
      { error: "Failed to authenticate user" },
      { status: 500 }
    );
  }
}
