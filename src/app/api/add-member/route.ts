import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { sendEmail } from "@/lib/Email";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsAdmin } from "@/lib/utils/adminAuth";

// Local implementations to avoid dependency on adminSeatValidation.ts
interface AdminSeatValidationResult {
  valid: boolean;
  currentCount: number;
  limit: number | null;
  error?: string;
  code?: string;
}

function isAdminRole(role: string): boolean {
  return role === "admin";
}

async function countOrgAdmins(db: any, orgId: string): Promise<number> {
  return db.collection("members").countDocuments({
    orgID: orgId,
    role: "admin",
  });
}

async function getOrgAdminSeatLimit(
  db: any,
  organization: any
): Promise<{ limit: number | null }> {
  // Fetch credit-based plan if assigned (using nested structure)
  let creditBasedPlan: { maxAdminSeats?: number | null } | null = null;
  if (organization?.creditBasedPlan?.planId) {
    try {
      const plan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(organization.creditBasedPlan.planId) });
      creditBasedPlan = plan as { maxAdminSeats?: number | null } | null;
    } catch {
      // Invalid ObjectId, ignore
    }
  }

  // Fetch premium plan if assigned (using nested structure)
  let premiumPlan: { maxAdminSeats?: number | null } | null = null;
  if (organization?.premiumPlan?.planId) {
    try {
      const plan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(organization.premiumPlan.planId) });
      premiumPlan = plan as { maxAdminSeats?: number | null } | null;
    } catch {
      // Invalid ObjectId, ignore
    }
  }

  const creditBasedSeats = creditBasedPlan?.maxAdminSeats;
  const premiumSeats = premiumPlan?.maxAdminSeats;

  // Treat undefined and null as unlimited
  const creditIsUnlimited = creditBasedSeats === null || creditBasedSeats === undefined;
  const premiumIsUnlimited = premiumSeats === null || premiumSeats === undefined;

  let limit: number | null;

  // Both are unlimited
  if (creditIsUnlimited && premiumIsUnlimited) {
    limit = null;
  }
  // Only credit is unlimited, use premium limit
  else if (creditIsUnlimited && !premiumIsUnlimited) {
    limit = premiumSeats!;
  }
  // Only premium is unlimited, use credit limit
  else if (!creditIsUnlimited && premiumIsUnlimited) {
    limit = creditBasedSeats!;
  }
  // Both have limits, add them
  else {
    limit = (creditBasedSeats || 0) + (premiumSeats || 0);
  }

  return { limit };
}

async function validateAdminSeatLimit(
  db: any,
  orgId: string,
  additionalAdminCount: number,
  organization?: any | null
): Promise<AdminSeatValidationResult> {
  // Fetch organization if not provided
  let org = organization;
  if (!org) {
    try {
      const fetchedOrg = await db.collection("organizations").findOne({ _id: new ObjectId(orgId) });
      org = fetchedOrg as any | null;
    } catch {
      // Invalid ObjectId
      return {
        valid: false,
        currentCount: 0,
        limit: null,
        error: "Invalid organization ID",
        code: "INVALID_ORG_ID",
      };
    }
  }

  if (!org) {
    return {
      valid: false,
      currentCount: 0,
      limit: null,
      error: "Organization not found",
      code: "ORG_NOT_FOUND",
    };
  }

  // Get current admin count
  const currentCount = await countOrgAdmins(db, orgId);

  // Get admin seat limit
  const { limit } = await getOrgAdminSeatLimit(db, org);

  // If limit is null, seats are unlimited
  if (limit === null) {
    return {
      valid: true,
      currentCount,
      limit,
    };
  }

  // Check if adding new admins would exceed limit
  const projectedCount = currentCount + additionalAdminCount;

  if (projectedCount > limit) {
    return {
      valid: false,
      currentCount,
      limit,
      error: `Admin seat limit exceeded. Your plan allows ${limit} admin seats, and you currently have ${currentCount}.`,
      code: "ADMIN_SEAT_LIMIT_EXCEEDED",
    };
  }

  return {
    valid: true,
    currentCount,
    limit,
  };
}


const getInvitationEmailTemplate = (
  email: string,
  orgName: string,
  role: string
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(to bottom, #4f04b9f0, #b79fcf76); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Jia</h1>
    </div>
    
    <div style="background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
        Dear ${email},
      </p>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
        We are pleased to invite you to join <strong>${orgName}</strong> on Jia as a <strong>${role.charAt(0).toUpperCase() + role.slice(1)
  }</strong>. Your expertise and contribution will be valuable to our team.
      </p>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 30px;">
        To get started, please click the button below to access your account:
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://${process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN}" 
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
`;

const getGuestInvitationTemplate = (
  name: string,
  companyName: string,
  inviterEmail: string,
  inviterName: string,
  orgId: string,
  redirectTo: 'careers' | 'requisitions' = 'requisitions'
): string => {
  const JIA_LOGO_URL = "https://cdn.hellojia.ai/public-assets/jia-logo-header.png";
  const WHITECLOAK_LOGO_URL =
    "https://cdn.hellojia.ai/public-assets/whitecloak-logo.png";
  const HANDS_ICON_URL =
    "https://cdn.hellojia.ai/public-assets/hands-thumbs-up.png";

  // Build magic link through /auth/callback for Google SSO login
  const baseUrl = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}`
    : 'http://localhost:3000';
  const redirectPath = `/guest-portal/${redirectTo}?orgId=${orgId}`;
  const LOGIN_URL = `${baseUrl}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jia Invitation</title>
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
              <h1 style="font-size: 24px; font-weight: 700; color: #1A1625; margin: 0 0 24px 0;">Hi ${name}!</h1>
              
              <div style="margin: 20px 0;">
                <img src="${WHITECLOAK_LOGO_URL}" alt="White Cloak Technologies" style="width: 128px; height: 32px; display: block; margin: 0 auto;" />
              </div>
              
              <div style="font-size: 20px; font-weight: 700; color: #1A1625; margin: 0;">${companyName}</div>
              <p style="font-size: 18px; color: #717680; margin: 0 0 32px 0; font-weight: 500;">has invited you to join Jia</p>
              
              <div style="margin: 24px 0;">
                <img src="${HANDS_ICON_URL}" alt="Hands Icon" style="height: 120px; width: auto; display: block; margin: 0 auto;">
              </div>
              
              <h2 style="font-size: 24px; font-weight: 700; color: #1A1625; margin: 0 0 16px 0;">Welcome to Jia!</h2>
              
              <p style="font-size: 16px; color: #717680; margin: 0 0 16px 0; line-height: 1.6;">
                ${inviterName} (${inviterEmail}) has invited you as a guest at ${companyName} on Jia.
              </p>
              
              <p style="font-size: 16px; color: #717680; margin: 0 0 16px 0; line-height: 1.6;">
                If you have any questions, please contact our support team.
              </p>
              
              <p style="font-size: 16px; color: #717680; margin: 0 0 24px 0; line-height: 1.6;">
                Best regards,<br>
                Jia Team
              </p>
              
              <a href="${LOGIN_URL}" style="display: inline-block; background-color: #181D27; color: #ffffff; padding: 12px 120px; border: 1px solid #999999; border-radius: 50px; text-decoration: none; font-size: 17px; font-weight: 550;">Log In</a>
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
};

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const { orgID, email, role, careers } = await req.json();
  const { db } = await connectMongoDB();

  // Security Check: Verify if the requester is an admin
  const requesterEmail = req.user.email;
  if (!requesterEmail) {
    return NextResponse.json(
      { error: "User email not found in token" },
      { status: 401 }
    );
  }

  const authResult = await verifyUserIsAdmin(db, requesterEmail, orgID);
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.reason },
      { status: 403 }
    );
  }

  // Check if member exists with this email and orgID
  const member = await db.collection("members").findOne({ email, orgID });
  const org = await db
    .collection("organizations")
    .findOne({ _id: new ObjectId(orgID) });

  const guestPortalEnabledEffective =
    typeof org?.guestPortalEnabled === "boolean"
      ? org.guestPortalEnabled
      : !!org?.projectsEnabled;

  // Check if organization has an active plan
  const now = new Date();
  const BUFFER_MS = 14 * 60 * 60 * 1000;
  const nowWithBuffer = new Date(now.getTime() + BUFFER_MS);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const creditBasedPlan = org?.creditBasedPlan;
  const premiumPlan = org?.premiumPlan;

  const isCreditActive =
    creditBasedPlan?.planId &&
    creditBasedPlan.startDate &&
    new Date(creditBasedPlan.startDate) <= nowWithBuffer &&
    (!creditBasedPlan.endDate || new Date(creditBasedPlan.endDate) >= todayStart);

  const isPremiumActive =
    premiumPlan?.planId &&
    premiumPlan.startDate &&
    new Date(premiumPlan.startDate) <= nowWithBuffer &&
    (!premiumPlan.endDate || new Date(premiumPlan.endDate) >= todayStart);

  if (!isCreditActive && !isPremiumActive) {
    return NextResponse.json(
      {
        error:
          "This organization does not have an active plan.",
      },
      { status: 403 }
    );
  }

  // Enforce that Guest role is only available when Guest Portal is enabled
  if (role === "guest" && !guestPortalEnabledEffective) {
    return NextResponse.json(
      {
        error:
          "Guest role is only available when Guest Portal is enabled for this organization.",
        code: "GUEST_ROLE_REQUIRES_PROJECTS_ENABLED",
      },
      { status: 422 }
    );
  }

  // Enforce admin seat limit for admin/super_admin roles
  if (isAdminRole(role)) {
    // Check if member already exists with an admin role (not a new admin addition)
    const existingAdminMember = member && member.role === "admin";

    // Only validate if this is a new admin (not already an admin)
    if (!existingAdminMember) {
      const validation = await validateAdminSeatLimit(db, orgID, 1, org);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: validation.error,
            code: validation.code,
          },
          { status: 400 }
        );
      }
    }
  }

  if (member) {
    // Check if trying to add the same role that already exists
    if (member.role === role && member.status !== "invited") {
      return NextResponse.json(
        { message: `${role.charAt(0).toUpperCase() + role.slice(1)} with this email already exists in this organization` },
        { status: 400 }
      );
    }

    // If different role, allow it (e.g., can be both admin and guest)
    if (member.role !== role) {
      // Create a new member record with different role
      const newMember = {
        image: `https://api.dicebear.com/9.x/shapes/svg?seed=${email}`,
        name: email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1),
        email,
        orgID,
        role,
        careers,
        addedAt: new Date(),
        lastLogin: null,
        status: "invited",
      };

      await db.collection("members").insertOne(newMember);

      // Send appropriate invitation email
      if (role === "guest") {
        try {
          const guestName = newMember.name;
          const htmlContent = getGuestInvitationTemplate(
            guestName,
            org?.name || 'White Cloak Technologies, Inc.',
            req.user?.email || '',
            req.user?.name || '',
            orgID
          );

          await sendEmail({
            recipient: email,
            html: htmlContent,
            subject: `Jia | ${org?.name || 'White Cloak Technologies, Inc.'} has invited you to join`,
          });
        } catch (emailError: any) {
          console.error('Failed to send guest invitation email:', emailError?.message || emailError);
        }
      } else {
        try {
          await sendEmail({
            recipient: email,
            html: getInvitationEmailTemplate(email, org?.name || "", role),
          });
        } catch (emailError: any) {
          console.error('Failed to send invitation email:', emailError?.message || emailError);
        }
      }

      return NextResponse.json(
        { message: `${role.charAt(0).toUpperCase() + role.slice(1)} invitation sent successfully` },
        { status: 200 }
      );
    }

    // Same role, status is "invited" - resend invitation
    if (role === "guest") {
      // Send guest invitation email for guests using Mailgun
      try {
        const guestName = email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1);
        const htmlContent = getGuestInvitationTemplate(
          guestName,
          org?.name || 'White Cloak Technologies, Inc.',
          req.user?.email || '',
          req.user?.name || '',
          orgID
        );

        await sendEmail({
          recipient: email,
          html: htmlContent,
          subject: `Jia | ${org?.name || 'White Cloak Technologies, Inc.'} has invited you to join`,
        });
      } catch (emailError: any) {
        console.error('Failed to send guest invitation email:', emailError?.message || emailError);
      }
    } else {
      // Send regular invitation email for admin and hiring manager
      try {
        await sendEmail({
          recipient: email,
          html: getInvitationEmailTemplate(email, org?.name || "", role),
        });
      } catch (emailError: any) {
        console.error('Failed to send invitation email:', emailError?.message || emailError);
      }
    }

    return NextResponse.json(
      { message: "Invitation email resent successfully" },
      { status: 200 }
    );
  }

  // Create member with placeholder name/image (will be updated from Google on first login)
  const newMember = {
    image: `https://api.dicebear.com/9.x/shapes/svg?seed=${email}`, // Placeholder avatar
    name: email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1), // Placeholder name from email
    email,
    orgID,
    role,
    careers,
    addedAt: new Date(),
    lastLogin: null,
    status: "invited",
    // Note: name and image will be updated with actual Google profile data on first login
  };

  await db.collection("members").insertOne(newMember);

  if (role === "guest") {
    // Send guest invitation email for guests using Mailgun
    try {
      const guestName = newMember.name;
      const htmlContent = getGuestInvitationTemplate(
        guestName,
        org?.name || 'White Cloak Technologies, Inc.',
        req.user?.email || '',
        req.user?.name || '',
        orgID
      );

      await sendEmail({
        recipient: email,
        html: htmlContent,
        subject: `Jia | ${org?.name || 'White Cloak Technologies, Inc.'} has invited you to join`,
      });
    } catch (emailError: any) {
      console.error('Failed to send guest invitation email:', emailError?.message || emailError);
      // Don't fail the entire request if email fails - member is already created
    }
  } else {
    // Send regular invitation email for admin and hiring manager
    try {
      await sendEmail({
        recipient: email,
        html: getInvitationEmailTemplate(email, org?.name || "", role),
      });
    } catch (emailError: any) {
      console.error('Failed to send invitation email:', emailError?.message || emailError);
      // Don't fail the entire request if email fails - member is already created
    }
  }

  return NextResponse.json(
    { message: "Member added successfully" },
    { status: 200 }
  );
});
